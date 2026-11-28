import { CalendarClock, CheckCheck, ListFilter, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CheckableListCard } from '../../components/ui/CheckableListCard';
import { ListFilterBar } from '../../components/ui/ListFilterBar';
import { RingGauge } from '../../components/ui/RingGauge';
import type { BudgetPeriodSummary, EnvelopeItem } from '../../types/budget.types';
import { formatCurrency, formatFullDate, toDateInputValue } from '../../utils/format';
import {
  buildReorderedIds,
  SectionManageHeader,
  sortEnvelopesByOrder
} from './SectionManageHeader';
import { ZeroBasedBanner, type ZeroBasedQuickActions } from './ZeroBasedBanner';

type ChargeFilter = 'all' | 'upcoming' | 'paid';

export interface FixedChargesListProps {
  items: EnvelopeItem[];
  summary: BudgetPeriodSummary;
  activeBalance?: number;
  onAddFixedCharge: () => void;
  onEditFixedCharge: (item: EnvelopeItem) => void;
  onTogglePaid: (item: EnvelopeItem) => void;
  onBulkTogglePaid?: (envelopeIds: string[], isPaid: boolean) => Promise<void> | void;
  onReorder: (orderedIds: string[]) => void;
  onDeleteFixedCharge: (item: EnvelopeItem) => void;
  onSyncRecurring?: () => Promise<void> | void;
  zeroBasedActions?: ZeroBasedQuickActions;
}

/**
 * Vue complète de l'onglet « Dépenses » (Dépenses fixes) :
 * Jauge circulaire « Reste à dépenser » = `remainingToLive`,
 * détail « Tout voir ▶ » et historique pointable en 1 tap.
 */
export function FixedChargesList({
  items,
  summary,
  activeBalance,
  onAddFixedCharge,
  onEditFixedCharge,
  onTogglePaid,
  onBulkTogglePaid,
  onReorder,
  onDeleteFixedCharge,
  onSyncRecurring,
  zeroBasedActions
}: FixedChargesListProps) {
  const [isManageMode, setIsManageMode] = useState(false);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [filter, setFilter] = useState<ChargeFilter>('all');
  const [viewMode, setViewMode] = useState<'list' | 'schedule'>('list');
  const [includePaidInSchedule, setIncludePaidInSchedule] = useState(false);
  const [isBulkSheetOpen, setIsBulkSheetOpen] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [lastBulkUndoIds, setLastBulkUndoIds] = useState<string[] | null>(null);

  useEffect(() => {
    if (!lastBulkUndoIds) return;
    const timer = window.setTimeout(() => setLastBulkUndoIds(null), 5000);
    return () => window.clearTimeout(timer);
  }, [lastBulkUndoIds]);

  const sortedItems = useMemo(() => sortEnvelopesByOrder(items), [items]);

  const dueUnpaidItems = useMemo(() => {
    const todayStr = toDateInputValue(new Date().toISOString());
    return sortedItems.filter((item) => !item.isPaid && toDateInputValue(item.date) <= todayStr);
  }, [sortedItems]);

  const dueUnpaidTotal = useMemo(
    () => dueUnpaidItems.reduce((sum, item) => sum + item.allocatedAmount, 0),
    [dueUnpaidItems]
  );

  const selectedBulkTotal = useMemo(() => {
    const idSet = new Set(selectedBulkIds);
    return dueUnpaidItems
      .filter((item) => idSet.has(item.id))
      .reduce((sum, item) => sum + item.allocatedAmount, 0);
  }, [dueUnpaidItems, selectedBulkIds]);

  const openBulkSheet = () => {
    setSelectedBulkIds(dueUnpaidItems.map((item) => item.id));
    setIsBulkSheetOpen(true);
  };

  const handleConfirmBulkPaid = async () => {
    if (!onBulkTogglePaid || selectedBulkIds.length === 0) return;
    setIsBulkSubmitting(true);
    try {
      const idsToMark = [...selectedBulkIds];
      await onBulkTogglePaid(idsToMark, true);
      setIsBulkSheetOpen(false);
      setLastBulkUndoIds(idsToMark);
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const handleUndoBulkPaid = async () => {
    if (!onBulkTogglePaid || !lastBulkUndoIds?.length) return;
    const idsToRevert = [...lastBulkUndoIds];
    setLastBulkUndoIds(null);
    await onBulkTogglePaid(idsToRevert, false);
  };

  const paidTotal = useMemo(
    () =>
      sortedItems
        .filter((item) => item.isPaid)
        .reduce((acc, item) => acc + item.allocatedAmount, 0),
    [sortedItems]
  );

  const upcomingTotal = useMemo(
    () =>
      sortedItems
        .filter((item) => !item.isPaid)
        .reduce((acc, item) => acc + item.allocatedAmount, 0),
    [sortedItems]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'order' | 'amount_desc' | 'amount_asc'>('order');

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = sortedItems.filter((item) => {
      if (filter === 'upcoming' && item.isPaid) return false;
      if (filter === 'paid' && !item.isPaid) return false;
      if (query && !item.name.toLowerCase().includes(query)) return false;
      return true;
    });
    if (sortBy === 'amount_desc') {
      return [...filtered].sort((a, b) => b.allocatedAmount - a.allocatedAmount);
    }
    if (sortBy === 'amount_asc') {
      return [...filtered].sort((a, b) => a.allocatedAmount - b.allocatedAmount);
    }
    return filtered;
  }, [filter, searchQuery, sortBy, sortedItems]);

  const filteredTotal = useMemo(
    () => visibleItems.reduce((acc, item) => acc + item.allocatedAmount, 0),
    [visibleItems]
  );

  const paidCount = useMemo(() => sortedItems.filter((item) => item.isPaid).length, [sortedItems]);

  const scheduleGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const candidates = sortedItems
      .filter((item) => {
        if (!includePaidInSchedule && item.isPaid) return false;
        if (query && !item.name.toLowerCase().includes(query)) return false;
        return true;
      })
      .sort((a, b) => {
        const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
        return diff !== 0 ? diff : a.order - b.order;
      });

    const grouped = new Map<string, { dateKey: string; items: EnvelopeItem[]; subtotal: number }>();
    for (const item of candidates) {
      const dateKey = toDateInputValue(item.date);
      const existing = grouped.get(dateKey);
      if (existing) {
        existing.items.push(item);
        existing.subtotal = Math.round((existing.subtotal + item.allocatedAmount) * 100) / 100;
      } else {
        grouped.set(dateKey, {
          dateKey,
          items: [item],
          subtotal: Math.round(item.allocatedAmount * 100) / 100
        });
      }
    }

    return Array.from(grouped.values());
  }, [includePaidInSchedule, searchQuery, sortedItems]);

  const scheduleTotal = useMemo(
    () =>
      Math.round(
        scheduleGroups.reduce((acc, group) => acc + group.subtotal, 0) * 100
      ) / 100,
    [scheduleGroups]
  );

  const scheduleItemsCount = useMemo(
    () => scheduleGroups.reduce((acc, group) => acc + group.items.length, 0),
    [scheduleGroups]
  );

  const handleMove = (index: number, direction: -1 | 1) => {
    const orderedIds = buildReorderedIds(sortedItems, index, direction);
    if (orderedIds) {
      onReorder(orderedIds);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-slate-500">Total</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {formatCurrency(summary.plannedFixedCharges)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsBreakdownOpen((previous) => !previous)}
            aria-expanded={isBreakdownOpen}
            className="inline-flex min-h-11 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-violet-600 transition-colors hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/50"
          >
            <span>{isBreakdownOpen ? 'Masquer ▼' : 'Tout voir ▶'}</span>
          </button>
        </div>

        {isBreakdownOpen && (
          <div className="mb-4 space-y-2.5 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white p-2.5 shadow-sm dark:bg-slate-900">
                <p className="text-slate-500 dark:text-slate-400">Déjà payées</p>
                <p className="mt-0.5 font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(paidTotal)}
                </p>
              </div>
              <div className="rounded-xl bg-white p-2.5 shadow-sm dark:bg-slate-900">
                <p className="text-slate-500 dark:text-slate-400">Restant à payer</p>
                <p className="mt-0.5 font-bold tabular-nums text-slate-900 dark:text-slate-50">
                  {formatCurrency(upcomingTotal)}
                </p>
              </div>
            </div>
            <div className="flex gap-1.5" role="group" aria-label="Filtrer les dépenses fixes">
              {(
                [
                  { id: 'all', label: 'Toutes' },
                  { id: 'upcoming', label: 'À venir' },
                  { id: 'paid', label: 'Payées' }
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={filter === option.id}
                  onClick={() => setFilter(option.id)}
                  className={`min-h-11 flex-1 rounded-xl px-2 text-xs font-semibold transition-colors ${
                    filter === option.id
                      ? 'bg-violet-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <RingGauge
          value={summary.remainingToLive}
          max={Math.max(summary.plannedIncome, Math.abs(summary.remainingToLive), 1)}
          label="Reste à dépenser"
        />

        {typeof activeBalance === 'number' && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/70">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-50">
                Solde estimé en compte
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Payées : {formatCurrency(paidTotal)} · À venir : {formatCurrency(upcomingTotal)}
              </p>
            </div>
            <span
              className={`shrink-0 text-sm font-bold tabular-nums ${
                activeBalance < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-blue-700 dark:text-blue-300'
              }`}
            >
              {formatCurrency(activeBalance)}
            </span>
          </div>
        )}
      </Card>

      <ZeroBasedBanner
        remainingToAllocate={summary.remainingToAllocate}
        plannedIncome={summary.plannedIncome}
        {...zeroBasedActions}
      />

      <section aria-label="Historique des dépenses fixes" className="space-y-2.5">
        {onSyncRecurring ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void onSyncRecurring()}
              className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 dark:bg-violet-950/60 dark:text-violet-300 dark:hover:bg-violet-900/60"
            >
              Reconduire le mois précédent
            </button>
          </div>
        ) : null}
        <SectionManageHeader
          title="Historique des dépenses fixes"
          count={sortedItems.length}
          isManageMode={isManageMode}
          manageButtonLabel="Gérer l’ordre et supprimer des dépenses fixes"
          onToggleManageMode={() => setIsManageMode((previous) => !previous)}
        />

        {onBulkTogglePaid && dueUnpaidItems.length >= 2 && (
          <button
            type="button"
            onClick={openBulkSheet}
            className="flex w-full min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
          >
            <CheckCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Pointer {dueUnpaidItems.length} charges échues ({formatCurrency(dueUnpaidTotal)})
            </span>
          </button>
        )}

        {lastBulkUndoIds && lastBulkUndoIds.length > 0 && (
          <div
            role="status"
            className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <span>{lastBulkUndoIds.length} charges pointées comme payées.</span>
            <button
              type="button"
              onClick={() => void handleUndoBulkPaid()}
              className="rounded-lg bg-white/15 px-2.5 py-1 font-semibold text-white hover:bg-white/25"
            >
              Annuler
            </button>
          </div>
        )}

        {sortedItems.length > 0 && (
          <div
            role="group"
            aria-label="Mode d’affichage des dépenses fixes"
            className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/90"
          >
            <button
              type="button"
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-[#7C3AED] shadow-sm dark:bg-slate-900 dark:text-violet-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-50'
              }`}
            >
              <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Liste</span>
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'schedule'}
              onClick={() => setViewMode('schedule')}
              className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors ${
                viewMode === 'schedule'
                  ? 'bg-white text-[#7C3AED] shadow-sm dark:bg-slate-900 dark:text-violet-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-50'
              }`}
            >
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Échéancier</span>
            </button>
          </div>
        )}

        {sortedItems.length > 0 && viewMode === 'list' ? (
          <ListFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Rechercher une dépense fixe…"
            sortOptions={[
              { value: 'order', label: 'Ordre' },
              { value: 'amount_desc', label: 'Montant ↓' },
              { value: 'amount_asc', label: 'Montant ↑' }
            ]}
            sortBy={sortBy}
            onSortChange={(val) => setSortBy(val as 'order' | 'amount_desc' | 'amount_asc')}
            isFilterActive={Boolean(searchQuery.trim() || filter !== 'all' || sortBy !== 'order')}
            resultCount={visibleItems.length}
            resultTotalFormatted={formatCurrency(filteredTotal)}
            onReset={() => {
              setSearchQuery('');
              setFilter('all');
              setSortBy('order');
            }}
          />
        ) : null}

        {sortedItems.length === 0 ? (
          <Card className="text-center">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Aucune dépense fixe enregistrée sur cette période.
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Ajoutez votre loyer, vos factures, abonnements ou mensualités de crédit.
            </p>
            <div className="mt-4">
              <Button type="button" variant="primary" onClick={onAddFixedCharge}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Saisir ma première dépense fixe
              </Button>
            </div>
          </Card>
        ) : viewMode === 'schedule' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {includePaidInSchedule ? 'Toutes les échéances' : 'Prélèvements à venir'} ({scheduleItemsCount})
                </p>
                <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">
                  {formatCurrency(scheduleTotal)}
                </p>
              </div>
              {paidCount > 0 && (
                <button
                  type="button"
                  aria-pressed={includePaidInSchedule}
                  onClick={() => setIncludePaidInSchedule((prev) => !prev)}
                  className={`inline-flex min-h-11 items-center rounded-xl border px-3 text-xs font-semibold transition-colors ${
                    includePaidInSchedule
                      ? 'border-violet-600 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-950/60 dark:text-violet-300'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  Inclure payées ({paidCount})
                </button>
              )}
            </div>

            {scheduleGroups.length === 0 ? (
              <Card className="space-y-2.5 text-center">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Aucun prélèvement à venir sur ce cycle.
                </p>
                {paidCount > 0 && !includePaidInSchedule ? (
                  <button
                    type="button"
                    onClick={() => setIncludePaidInSchedule(true)}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-50 px-4 text-xs font-semibold text-violet-700 hover:bg-violet-100 dark:bg-violet-950/60 dark:text-violet-300 dark:hover:bg-violet-900/60"
                  >
                    Afficher les charges déjà payées ({paidCount})
                  </button>
                ) : null}
              </Card>
            ) : (
              <div className="space-y-4">
                {scheduleGroups.map((group) => (
                  <div key={group.dateKey} className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full bg-violet-600 dark:bg-violet-400"
                          aria-hidden="true"
                        />
                        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          {formatFullDate(`${group.dateKey}T12:00:00.000Z`)}
                        </h3>
                        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                          ({group.items.length}{' '}
                          {group.items.length > 1 ? 'prélèvements' : 'prélèvement'})
                        </span>
                      </div>
                      <span className="text-xs font-bold tabular-nums text-slate-800 dark:text-slate-100">
                        {formatCurrency(group.subtotal)}
                      </span>
                    </div>

                    <div className="space-y-2 border-l-2 border-violet-200 pl-3 dark:border-violet-800/70">
                      {group.items.map((item) => (
                        <CheckableListCard
                          key={item.id}
                          item={item}
                          isManageMode={false}
                          onEdit={onEditFixedCharge}
                          onTogglePaid={onTogglePaid}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : visibleItems.length === 0 ? (
          <Card className="text-center">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Aucune dépense fixe dans ce filtre.
            </p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {visibleItems.map((item) => {
              const sortedIndex = sortedItems.findIndex((candidate) => candidate.id === item.id);
              return (
                <CheckableListCard
                  key={item.id}
                  item={item}
                  isManageMode={isManageMode && filter === 'all'}
                  canMoveUp={sortedIndex > 0}
                  canMoveDown={sortedIndex < sortedItems.length - 1}
                  onEdit={onEditFixedCharge}
                  onTogglePaid={onTogglePaid}
                  onMoveUp={() => handleMove(sortedIndex, -1)}
                  onMoveDown={() => handleMove(sortedIndex, 1)}
                  onDelete={onDeleteFixedCharge}
                />
              );
            })}
          </div>
        )}
      </section>

      <BottomSheet
        isOpen={isBulkSheetOpen}
        onClose={() => setIsBulkSheetOpen(false)}
        title="Pointer les charges échues"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Sélectionnez les charges fixes déjà prélevées sur votre compte pour mettre à jour votre
            solde estimé en 1 tap.
          </p>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {dueUnpaidItems.map((item) => {
              const checked = selectedBulkIds.includes(item.id);
              return (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800/80"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedBulkIds((prev) =>
                          prev.includes(item.id)
                            ? prev.filter((id) => id !== item.id)
                            : [...prev, item.id]
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span aria-hidden="true">{item.icon}</span>
                    <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {item.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">
                    {formatCurrency(item.allocatedAmount)}
                  </span>
                </label>
              );
            })}
          </div>

          {activeBalance !== undefined && (
            <div className="rounded-2xl bg-slate-50 p-3 text-xs dark:bg-slate-800/70">
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                Solde estimé en compte
              </p>
              <p className="mt-1 font-bold tabular-nums text-slate-900 dark:text-slate-50">
                {formatCurrency(activeBalance)} → {formatCurrency(activeBalance - selectedBulkTotal)}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIsBulkSheetOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={selectedBulkIds.length === 0 || isBulkSubmitting}
              onClick={() => void handleConfirmBulkPaid()}
            >
              {isBulkSubmitting
                ? 'Pointage…'
                : `Confirmer (${selectedBulkIds.length})`}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

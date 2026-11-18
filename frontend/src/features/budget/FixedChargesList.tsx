import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CheckableListCard } from '../../components/ui/CheckableListCard';
import { ListFilterBar } from '../../components/ui/ListFilterBar';
import { RingGauge } from '../../components/ui/RingGauge';
import type { BudgetPeriodSummary, EnvelopeItem } from '../../types/budget.types';
import { formatCurrency } from '../../utils/format';
import {
  buildReorderedIds,
  SectionManageHeader,
  sortEnvelopesByOrder
} from './SectionManageHeader';
import { ZeroBasedBanner } from './ZeroBasedBanner';

type ChargeFilter = 'all' | 'upcoming' | 'paid';

export interface FixedChargesListProps {
  items: EnvelopeItem[];
  summary: BudgetPeriodSummary;
  onAddFixedCharge: () => void;
  onEditFixedCharge: (item: EnvelopeItem) => void;
  onTogglePaid: (item: EnvelopeItem) => void;
  onReorder: (orderedIds: string[]) => void;
  onDeleteFixedCharge: (item: EnvelopeItem) => void;
}

/**
 * Vue complète de l'onglet « Dépenses » (Dépenses fixes) :
 * Jauge circulaire « Reste à dépenser » = `remainingToLive`,
 * détail « Tout voir ▶ » et historique pointable en 1 tap.
 */
export function FixedChargesList({
  items,
  summary,
  onAddFixedCharge,
  onEditFixedCharge,
  onTogglePaid,
  onReorder,
  onDeleteFixedCharge
}: FixedChargesListProps) {
  const [isManageMode, setIsManageMode] = useState(false);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [filter, setFilter] = useState<ChargeFilter>('all');

  const sortedItems = useMemo(() => sortEnvelopesByOrder(items), [items]);

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
            className="inline-flex min-h-11 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-violet-600 transition-colors hover:bg-violet-50"
          >
            <span>{isBreakdownOpen ? 'Masquer ▼' : 'Tout voir ▶'}</span>
          </button>
        </div>

        {isBreakdownOpen && (
          <div className="mb-4 space-y-2.5 rounded-2xl bg-slate-50 p-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white p-2.5 shadow-sm">
                <p className="text-slate-500">Déjà payées</p>
                <p className="mt-0.5 font-bold tabular-nums text-emerald-600">
                  {formatCurrency(paidTotal)}
                </p>
              </div>
              <div className="rounded-xl bg-white p-2.5 shadow-sm">
                <p className="text-slate-500">Restant à payer</p>
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
                      : 'bg-white text-slate-600 hover:bg-slate-100'
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
      </Card>

      <ZeroBasedBanner
        remainingToAllocate={summary.remainingToAllocate}
        plannedIncome={summary.plannedIncome}
      />

      <section aria-label="Historique des dépenses fixes" className="space-y-2.5">
        <SectionManageHeader
          title="Historique des dépenses fixes"
          count={sortedItems.length}
          isManageMode={isManageMode}
          manageButtonLabel="Gérer l’ordre et supprimer des dépenses fixes"
          onToggleManageMode={() => setIsManageMode((previous) => !previous)}
        />

        {sortedItems.length > 0 ? (
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
            <p className="text-sm font-medium text-slate-600">
              Aucune dépense fixe enregistrée sur cette période.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Ajoutez votre loyer, vos factures, abonnements ou mensualités de crédit.
            </p>
            <div className="mt-4">
              <Button type="button" variant="primary" onClick={onAddFixedCharge}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Saisir ma première dépense fixe
              </Button>
            </div>
          </Card>
        ) : visibleItems.length === 0 ? (
          <Card className="text-center">
            <p className="text-sm font-medium text-slate-600">
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
    </div>
  );
}

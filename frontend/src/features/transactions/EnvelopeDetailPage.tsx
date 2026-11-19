import { ArrowLeft, ArrowLeftRight, Pencil, Settings, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { QuickAddButton } from '../../components/layout/QuickAddButton';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ListFilterBar } from '../../components/ui/ListFilterBar';
import { RingGauge } from '../../components/ui/RingGauge';
import type { BudgetMember, EnvelopeItem, TransactionItem } from '../../types/budget.types';
import { formatCurrency } from '../../utils/format';
import { TransactionHistory } from './TransactionHistory';

export interface EnvelopeDetailPageProps {
  envelope: EnvelopeItem;
  allEnvelopes: EnvelopeItem[];
  transactions: TransactionItem[];
  members: BudgetMember[];
  currentUserId: string;
  isSharedBudget: boolean;
  isLoadingTransactions?: boolean;
  isRebalancing?: boolean;
  isDeletingEnvelope?: boolean;
  deletingTransactionId?: string | null;
  onBack: () => void;
  onAddExpense: () => void;
  onEditExpense: (transaction: TransactionItem) => void;
  onDeleteExpense: (transactionId: string) => Promise<void> | void;
  onEditEnvelope: (envelope: EnvelopeItem) => void;
  onRebalanceEnvelope: (
    sourceEnvelopeId: string,
    targetEnvelopeId: string,
    amount: number
  ) => Promise<void> | void;
  onDeleteEnvelope: (envelopeId: string) => Promise<void> | void;
}

/**
 * Page dédiée au détail d'une enveloppe variable (vue plein écran contrôlée par état).
 */
export function EnvelopeDetailPage({
  envelope,
  allEnvelopes,
  transactions,
  members,
  currentUserId,
  isSharedBudget,
  isRebalancing = false,
  isDeletingEnvelope = false,
  deletingTransactionId = null,
  onBack,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
  onEditEnvelope,
  onRebalanceEnvelope,
  onDeleteEnvelope
}: EnvelopeDetailPageProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showRebalance, setShowRebalance] = useState(false);
  const [targetEnvelopeId, setTargetEnvelopeId] = useState('');
  const [rebalanceAmount, setRebalanceAmount] = useState('');
  const [rebalanceError, setRebalanceError] = useState<string | null>(null);
  const [confirmDeleteEnvelope, setConfirmDeleteEnvelope] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>(
    'date_desc'
  );
  const [memberFilter, setMemberFilter] = useState<string>('all');

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = transactions.filter((tx) => {
      if (isSharedBudget && memberFilter !== 'all' && tx.paidByUserId !== memberFilter) {
        return false;
      }
      if (
        query &&
        !tx.label.toLowerCase().includes(query) &&
        !(tx.notes ?? '').toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'date_asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === 'amount_desc') return b.amount - a.amount;
      if (sortBy === 'amount_asc') return a.amount - b.amount;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [isSharedBudget, memberFilter, searchQuery, sortBy, transactions]);

  const filteredTotal = useMemo(
    () =>
      Math.round(
        filteredTransactions.reduce(
          (acc, tx) => (tx.type === 'income' ? acc - tx.amount : acc + tx.amount),
          0
        ) * 100
      ) / 100,
    [filteredTransactions]
  );

  const allocated = envelope.allocatedAmount;
  const rollover = envelope.rolloverAmount ?? 0;
  const available = Number((allocated + rollover).toFixed(2));
  const spent = envelope.spentOrPaidAmount;
  const remaining = Number((available - spent).toFixed(2));
  const isOver = remaining < 0;
  const accentColor = isOver ? '#EF4444' : envelope.color;

  const otherEnvelopes = allEnvelopes.filter((item) => item.id !== envelope.id);
  const activeTargetId =
    targetEnvelopeId && otherEnvelopes.some((item) => item.id === targetEnvelopeId)
      ? targetEnvelopeId
      : (otherEnvelopes[0]?.id ?? '');

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    setShowRebalance(false);
    setConfirmDeleteEnvelope(false);
    setRebalanceError(null);
  };

  const handleRebalanceSubmit = async () => {
    setRebalanceError(null);
    const parsed = Number.parseFloat(rebalanceAmount.replace(',', '.'));
    if (!activeTargetId) {
      setRebalanceError('Aucune autre enveloppe disponible.');
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setRebalanceError('Saisis un montant supérieur à 0 €.');
      return;
    }
    if (parsed > allocated) {
      setRebalanceError('Montant supérieur au budget de cette enveloppe.');
      return;
    }

    await onRebalanceEnvelope(envelope.id, activeTargetId, parsed);
    setRebalanceAmount('');
    setShowRebalance(false);
    setIsSettingsOpen(false);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-eparnio-bg pb-24 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      {/* En-tête : Retour < | Icône + Nom coloré | Engrenage ⚙️ */}
      <header className="flex items-center justify-between px-4 pb-2 pt-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour aux enveloppes"
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-800 shadow-card transition-transform active:scale-95 dark:border dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <h1
          className="flex min-w-0 items-center gap-2 truncate px-2 text-lg font-bold"
          style={{ color: accentColor }}
        >
          <span aria-hidden="true" className="text-xl">
            {envelope.icon}
          </span>
          <span className="truncate">{envelope.name}</span>
        </h1>

        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          aria-label="Réglages de l’enveloppe"
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-800 shadow-card transition-transform active:scale-95 dark:border dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        >
          <Settings className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <main className="flex-1 space-y-5 px-4 pt-2">
        {/* Carte Synthèse & Jauge Circulaire */}
        <Card className="p-5">
          <p className="text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
            Reste dans l’enveloppe
          </p>

          <div className="mt-3 flex justify-center">
            <RingGauge
              value={spent}
              max={available > 0 ? available : 1}
              label="Dépensé"
              size={172}
              strokeWidth={15}
              accentColor={spent < 0 ? '#10B981' : isOver ? '#EF4444' : undefined}
            />
          </div>

          <div className="mt-4">
            <p className="text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
              Détail
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Objectif</p>
                <p
                  className="mt-0.5 text-sm font-bold tabular-nums"
                  style={{ color: accentColor }}
                >
                  {formatCurrency(allocated)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Restant</p>
                <p
                  className="mt-0.5 text-sm font-bold tabular-nums"
                  style={{ color: accentColor }}
                >
                  {formatCurrency(remaining)}
                </p>
              </div>
            </div>
            {rollover !== 0 ? (
              <p className="mt-2.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
                Budget du mois {formatCurrency(allocated)}{' '}
                {rollover > 0 ? `+ ${formatCurrency(rollover)}` : `− ${formatCurrency(Math.abs(rollover))}`}{' '}
                reportés − {formatCurrency(spent)} dépensés
              </p>
            ) : null}
          </div>
        </Card>

        {/* Historique des dépenses */}
        <section className="space-y-2.5">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
            Historique des dépenses
          </h2>
          {transactions.length > 0 ? (
            <ListFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Rechercher une dépense…"
              sortOptions={[
                { value: 'date_desc', label: 'Plus récentes' },
                { value: 'date_asc', label: 'Plus anciennes' },
                { value: 'amount_desc', label: 'Montant ↓' },
                { value: 'amount_asc', label: 'Montant ↑' }
              ]}
              sortBy={sortBy}
              onSortChange={(val) =>
                setSortBy(val as 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc')
              }
              filterPills={
                isSharedBudget
                  ? [
                      { value: 'all', label: 'Tous' },
                      ...members.map((m) => ({
                        value: m.userId,
                        label: `${m.avatarEmoji} ${m.displayName}`
                      }))
                    ]
                  : undefined
              }
              filterValue={memberFilter}
              onFilterChange={setMemberFilter}
              isFilterActive={Boolean(
                searchQuery.trim() || memberFilter !== 'all' || sortBy !== 'date_desc'
              )}
              resultCount={filteredTransactions.length}
              resultTotalFormatted={formatCurrency(filteredTotal)}
              onReset={() => {
                setSearchQuery('');
                setMemberFilter('all');
                setSortBy('date_desc');
              }}
            />
          ) : null}
          <TransactionHistory
            transactions={filteredTransactions}
            members={members}
            currentUserId={currentUserId}
            isSharedBudget={isSharedBudget}
            isDeleting={Boolean(deletingTransactionId)}
            onEditTransaction={onEditExpense}
            onDeleteTransaction={onDeleteExpense}
          />
        </section>
      </main>

      {/* FAB Bleu + */}
      <div className="fixed bottom-6 right-5 z-30">
        <QuickAddButton onClick={onAddExpense} ariaLabel={`Ajouter une dépense dans ${envelope.name}`} />
      </div>

      {/* Tiroir Réglages de l'enveloppe ⚙️ */}
      <BottomSheet
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        title={`Réglages — ${envelope.name}`}
      >
        <div className="space-y-3">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={() => {
              handleCloseSettings();
              onEditEnvelope(envelope);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
            Modifier l’enveloppe
          </Button>

          {otherEnvelopes.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => {
                setShowRebalance((prev) => !prev);
                setRebalanceError(null);
              }}
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" aria-hidden="true" />
              Rééquilibrer avec une autre enveloppe
            </Button>
          )}

          {showRebalance && otherEnvelopes.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800/70">
              <div>
                <label
                  htmlFor="rebalance-target-page"
                  className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Transférer vers
                </label>
                <select
                  id="rebalance-target-page"
                  value={activeTargetId}
                  onChange={(event) => setTargetEnvelopeId(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                >
                  {otherEnvelopes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.icon} {item.name} ({formatCurrency(item.allocatedAmount)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="rebalance-amount-page"
                  className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Montant à transférer (€)
                </label>
                <input
                  id="rebalance-amount-page"
                  type="text"
                  inputMode="decimal"
                  value={rebalanceAmount}
                  onChange={(event) => setRebalanceAmount(event.target.value)}
                  placeholder="Ex. 25"
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold tabular-nums text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                />
              </div>
              {rebalanceError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {rebalanceError}
                </p>
              )}
              <Button
                type="button"
                variant="primary"
                fullWidth
                disabled={isRebalancing}
                onClick={() => void handleRebalanceSubmit()}
              >
                {isRebalancing ? 'Transfert...' : 'Confirmer le transfert'}
              </Button>
            </div>
          )}

          {!confirmDeleteEnvelope ? (
            <Button
              type="button"
              variant="danger"
              fullWidth
              onClick={() => setConfirmDeleteEnvelope(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Supprimer l’enveloppe
            </Button>
          ) : (
            <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/30">
              <p className="text-xs font-medium text-red-700 dark:text-red-300">
                Confirmer la suppression définitive de cette enveloppe et de ses dépenses ?
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={() => setConfirmDeleteEnvelope(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  fullWidth
                  disabled={isDeletingEnvelope}
                  onClick={() => void onDeleteEnvelope(envelope.id)}
                >
                  {isDeletingEnvelope ? 'Suppression...' : 'Supprimer'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}

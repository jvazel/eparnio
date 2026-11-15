import { Pencil, Plus } from 'lucide-react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { resolvePastelTheme } from '../../components/ui/PastelEnvelopeCard';
import { ProgressBar } from '../../components/ui/ProgressBar';
import type { BudgetMember, EnvelopeItem, TransactionItem } from '../../types/budget.types';
import { formatCurrency } from '../../utils/format';
import { TransactionHistory } from './TransactionHistory';

export interface EnvelopeDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  envelope: EnvelopeItem | null;
  transactions: TransactionItem[];
  isLoadingTransactions?: boolean;
  isDeletingTransaction?: boolean;
  members?: BudgetMember[];
  currentUserId?: string;
  isSharedBudget?: boolean;
  onAddExpense: () => void;
  onEditEnvelope: (envelope: EnvelopeItem) => void;
  onEditTransaction: (transaction: TransactionItem) => void;
  onDeleteTransaction: (transactionId: string) => Promise<void> | void;
}

/**
 * Tiroir de détail d'une enveloppe variable (ouvert au tap sur une tuile pastel) :
 * rappel Montant / Dépensé / Restant, rééquilibrage et historique des dépenses.
 */
export function EnvelopeDetailSheet({
  isOpen,
  onClose,
  envelope,
  transactions,
  isLoadingTransactions = false,
  isDeletingTransaction = false,
  members = [],
  currentUserId,
  isSharedBudget = false,
  onAddExpense,
  onEditEnvelope,
  onEditTransaction,
  onDeleteTransaction
}: EnvelopeDetailSheetProps) {
  if (!envelope) {
    return (
      <BottomSheet isOpen={isOpen} onClose={onClose} title="Détail de l’enveloppe">
        <div className="py-4 text-center text-sm text-slate-500">Aucune enveloppe sélectionnée.</div>
      </BottomSheet>
    );
  }

  const theme = resolvePastelTheme(envelope.color);
  const remaining = Math.round((envelope.allocatedAmount - envelope.spentOrPaidAmount) * 100) / 100;
  const usageRatio =
    envelope.allocatedAmount > 0 ? envelope.spentOrPaidAmount / envelope.allocatedAmount : 0;
  const progressColor =
    remaining < 0 || usageRatio >= 0.95
      ? '#EF4444'
      : usageRatio >= 0.7
        ? '#F59E0B'
        : theme.ring;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={envelope.name}>
      <div className="space-y-4">
        <div
          className="rounded-2xl p-4 shadow-card"
          style={{ backgroundColor: theme.background }}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-full border-2 bg-white text-xl shadow-sm"
                style={{ borderColor: theme.ring }}
                aria-hidden="true"
              >
                {envelope.icon}
              </span>
              <div>
                <p className="text-xs font-medium text-slate-600">Enveloppe budgétaire</p>
                <p className="text-base font-bold text-slate-900">{envelope.name}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onEditEnvelope(envelope)}
              aria-label={`Modifier l’enveloppe ${envelope.name}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/90 px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-white"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Rééquilibrer</span>
            </button>
          </div>

          <div className="mb-3 grid grid-cols-3 gap-2 rounded-xl bg-white/90 p-2.5 text-center text-xs">
            <div>
              <p className="text-slate-500">Montant</p>
              <p className="mt-0.5 font-bold tabular-nums text-slate-900">
                {formatCurrency(envelope.allocatedAmount)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Dépensé</p>
              <p className="mt-0.5 font-bold tabular-nums text-slate-900">
                {formatCurrency(envelope.spentOrPaidAmount)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Restant</p>
              <p
                className={`mt-0.5 font-bold tabular-nums ${
                  remaining < 0 ? 'text-red-600' : 'text-emerald-700'
                }`}
              >
                {formatCurrency(remaining)}
              </p>
            </div>
          </div>

          <ProgressBar
            value={envelope.spentOrPaidAmount}
            max={Math.max(envelope.allocatedAmount, 1)}
            color={progressColor}
            label={`Consommation ${envelope.name}`}
          />
        </div>

        <Button type="button" variant="primary" fullWidth onClick={onAddExpense}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Ajouter une dépense
        </Button>

        <section aria-label="Dépenses de l’enveloppe" className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-900">Dépenses du mois</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
              {transactions.length}
            </span>
          </div>

          {isLoadingTransactions ? (
            <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
          ) : (
            <TransactionHistory
              transactions={transactions}
              members={members}
              currentUserId={currentUserId}
              isSharedBudget={isSharedBudget}
              isDeleting={isDeletingTransaction}
              onEditTransaction={onEditTransaction}
              onDeleteTransaction={onDeleteTransaction}
            />
          )}
        </section>
      </div>
    </BottomSheet>
  );
}

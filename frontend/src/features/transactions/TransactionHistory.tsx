import { Check, Pencil, RotateCcw, StickyNote, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { BudgetMember, TransactionItem } from '../../types/budget.types';
import { formatCurrency, formatFullDate } from '../../utils/format';

export interface TransactionHistoryProps {
  transactions: TransactionItem[];
  members?: BudgetMember[];
  currentUserId?: string;
  isSharedBudget?: boolean;
  isDeleting?: boolean;
  onEditTransaction: (transaction: TransactionItem) => void;
  onDeleteTransaction: (transactionId: string) => Promise<void> | void;
}

/**
 * Liste chronologique des dépenses et remboursements enregistrés dans une enveloppe,
 * avec pastille membre en budget partagé, notes, tap pour éditer et suppression sécurisée.
 */
export function TransactionHistory({
  transactions,
  members = [],
  currentUserId,
  isSharedBudget = false,
  isDeleting = false,
  onEditTransaction,
  onDeleteTransaction
}: TransactionHistoryProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-800/50">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Aucune dépense saisie dans cette enveloppe.
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-400">
          Appuyez sur « Ajouter une dépense » pour enregistrer votre premier achat.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2" aria-label="Historique des dépenses de l’enveloppe">
      {transactions.map((tx) => {
        const payerIndex = members.findIndex((member) => member.userId === tx.paidByUserId);
        const payerMember = payerIndex >= 0 ? members[payerIndex] : undefined;
        const payerLabel =
          tx.paidByUserId === currentUserId
            ? 'Moi'
            : payerIndex >= 0
              ? `Membre ${payerIndex + 1}`
              : null;
        const isConfirming = confirmingId === tx.id;
        const isSelected = selectedId === tx.id;
        const isRefund = tx.type === 'income';

        return (
          <li
            key={tx.id}
            className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2 shadow-card dark:border-slate-800 dark:bg-slate-900"
          >
            <button
              type="button"
              onClick={() => {
                setSelectedId(isSelected ? null : tx.id);
                setConfirmingId(null);
              }}
              aria-expanded={isSelected}
              className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 text-left"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {tx.label}
                  </p>
                  {isRefund ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <RotateCcw className="h-3 w-3" aria-hidden="true" />
                      Remboursement
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{formatFullDate(tx.date)}</span>
                  {isSharedBudget && payerLabel ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: payerMember?.color ?? '#7C3AED' }}
                        aria-hidden="true"
                      />
                      {payerLabel}
                    </span>
                  ) : null}
                </div>
                {tx.splitGroupId ? (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                    ✂️ Ticket partagé
                  </span>
                ) : null}
                {tx.notes ? (
                  <p className="mt-1 flex items-start gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <StickyNote
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500"
                      aria-hidden="true"
                    />
                    <span className="line-clamp-2">{tx.notes}</span>
                  </p>
                ) : null}
              </div>

              <span
                className={`shrink-0 text-sm font-bold tabular-nums ${
                  isRefund
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-900 dark:text-slate-50'
                }`}
              >
                {isRefund ? `+${formatCurrency(tx.amount)}` : `-${formatCurrency(tx.amount)}`}
              </span>
            </button>

            {isSelected && !isConfirming && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onEditTransaction(tx)}
                  aria-label={`Modifier ${tx.label}`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingId(tx.id)}
                  aria-label={`Supprimer ${tx.label}`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}

            {isConfirming && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    await onDeleteTransaction(tx.id);
                    setConfirmingId(null);
                    setSelectedId(null);
                  }}
                  aria-label={`Confirmer la suppression de ${tx.label}`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-red-600 text-white hover:bg-red-700"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setConfirmingId(null)}
                  aria-label={`Annuler la suppression de ${tx.label}`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

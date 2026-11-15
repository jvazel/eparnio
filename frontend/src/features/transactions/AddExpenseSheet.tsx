import { Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useId, useMemo, useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import {
  formatAmountToKeypadString,
  NumericKeypad,
  parseAmountString
} from '../../components/ui/NumericKeypad';
import type { BudgetMember, EnvelopeItem, TransactionItem } from '../../types/budget.types';
import { formatCurrency, toDateInputValue } from '../../utils/format';
import {
  AmountHeroField,
  DateCardField,
  MemberPayerSelector
} from '../budget/SharedFormFields';

export interface AddExpensePayload {
  envelopeId: string;
  amount: number;
  label: string;
  date: string;
  paidByUserId?: string;
}

export interface AddExpenseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  envelope: EnvelopeItem | null;
  defaultDate?: string;
  initialTransaction?: TransactionItem | null;
  members?: BudgetMember[];
  currentUserId?: string;
  isSharedBudget?: boolean;
  isSubmitting?: boolean;
  onSubmit: (payload: AddExpensePayload) => Promise<void> | void;
  onDelete?: (transactionId: string) => Promise<void> | void;
}

/**
 * Tiroir de saisie ou d'édition rapide d'une dépense variable au pouce
 * avec pavé numérique intégré et calcul en direct de « Restant dans l'enveloppe ».
 */
export function AddExpenseSheet({
  isOpen,
  onClose,
  envelope,
  defaultDate,
  initialTransaction,
  members = [],
  currentUserId,
  isSharedBudget = false,
  isSubmitting = false,
  onSubmit,
  onDelete
}: AddExpenseSheetProps) {
  const isEditing = Boolean(initialTransaction);
  const resolvedDefaultDate = useMemo(
    () => defaultDate ?? toDateInputValue(new Date()),
    [defaultDate]
  );

  const [amountInput, setAmountInput] = useState('');
  const [label, setLabel] = useState('');
  const [dateValue, setDateValue] = useState(resolvedDefaultDate);
  const [paidByUserId, setPaidByUserId] = useState<string | undefined>(currentUserId);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const labelInputId = useId();

  useEffect(() => {
    if (!isOpen) return;

    if (initialTransaction) {
      setAmountInput(formatAmountToKeypadString(initialTransaction.amount));
      setLabel(initialTransaction.label);
      setDateValue(toDateInputValue(initialTransaction.date));
      setPaidByUserId(initialTransaction.paidByUserId ?? currentUserId);
    } else {
      setAmountInput('');
      setLabel('');
      setDateValue(resolvedDefaultDate);
      setPaidByUserId(currentUserId);
    }
    setIsConfirmingDelete(false);
    setErrorMessage(null);
  }, [isOpen, initialTransaction, resolvedDefaultDate, currentUserId]);

  const numericAmount = parseAmountString(amountInput);

  const projectedRemainingInEnvelope = useMemo(() => {
    if (!envelope) return 0;
    const baseRemaining =
      envelope.allocatedAmount -
      envelope.spentOrPaidAmount +
      (initialTransaction ? initialTransaction.amount : 0);
    const raw = baseRemaining - numericAmount;
    return Math.round((raw + Number.EPSILON) * 100) / 100;
  }, [envelope, initialTransaction, numericAmount]);

  if (!envelope) {
    return null;
  }

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (numericAmount <= 0) {
      setErrorMessage('Veuillez saisir un montant supérieur à 0 €.');
      return;
    }

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setErrorMessage('Veuillez saisir un libellé de dépense.');
      return;
    }

    try {
      await onSubmit({
        envelopeId: envelope.id,
        amount: numericAmount,
        label: trimmedLabel,
        date: new Date(`${dateValue}T12:00:00.000Z`).toISOString(),
        ...(isSharedBudget && paidByUserId ? { paidByUserId } : {})
      });
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible d’enregistrer cette dépense pour le moment.'
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!initialTransaction || !onDelete) return;
    setErrorMessage(null);
    try {
      await onDelete(initialTransaction.id);
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de supprimer cette dépense pour le moment.'
      );
    }
  };

  const subtitleText =
    projectedRemainingInEnvelope < 0
      ? `Restant dans l’enveloppe : ${formatCurrency(projectedRemainingInEnvelope)} (dépassement)`
      : `Restant dans l’enveloppe : ${formatCurrency(projectedRemainingInEnvelope)}`;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Modifier la dépense' : `Ajouter une dépense · ${envelope.name}`}
    >
      <form
        method="post"
        onSubmit={handleFormSubmit}
        className="space-y-4 rounded-3xl bg-gradient-to-b from-violet-50/75 via-blue-50/45 to-slate-50/60 p-3.5 dark:from-slate-800/80 dark:via-slate-900/90 dark:to-slate-900"
      >
        <div className="flex items-center justify-center gap-3 pt-1" aria-hidden="true">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100/85 text-xl shadow-sm ring-4 ring-blue-100/40">
            🛍️
          </span>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100/90 text-2xl shadow-sm ring-4 ring-orange-100/50">
            {envelope.icon}
          </span>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-100/85 text-xl shadow-sm ring-4 ring-rose-100/40">
            💳
          </span>
        </div>

        <AmountHeroField
          value={amountInput}
          onChange={setAmountInput}
          subtitle={subtitleText}
          subtitleTone={
            projectedRemainingInEnvelope < 0
              ? 'red'
              : Math.abs(projectedRemainingInEnvelope) < 0.01
                ? 'emerald'
                : 'neutral'
          }
          subtitleTestId="live-remaining-in-envelope"
        />

        <NumericKeypad value={amountInput} onChange={setAmountInput} />

        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <label htmlFor={labelInputId} className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
              Nom
            </label>
            <input
              id={labelInputId}
              type="text"
              maxLength={100}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Nom de ma dépense (ex. Supermarché)"
              className="mt-1 min-h-11 w-full bg-transparent text-base font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none dark:text-slate-50"
            />
          </div>

          <DateCardField value={dateValue} onChange={setDateValue} />

          {isSharedBudget && (
            <MemberPayerSelector
              label="Payé par"
              members={members}
              selectedMemberId={paidByUserId}
              currentUserId={currentUserId}
              onSelect={setPaidByUserId}
            />
          )}
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="rounded-2xl bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-600"
          >
            {errorMessage}
          </p>
        )}

        <div className="space-y-2 pt-1">
          <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
            {isSubmitting
              ? 'Enregistrement...'
              : isEditing
                ? 'Enregistrer'
                : 'Ajouter'}
          </Button>

          {isEditing && onDelete && (
            <div>
              {!isConfirmingDelete ? (
                <Button
                  type="button"
                  variant="danger"
                  fullWidth
                  disabled={isSubmitting}
                  onClick={() => setIsConfirmingDelete(true)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Supprimer
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    disabled={isSubmitting}
                    onClick={() => setIsConfirmingDelete(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    fullWidth
                    disabled={isSubmitting}
                    onClick={handleConfirmDelete}
                  >
                    Confirmer la suppression
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </BottomSheet>
  );
}

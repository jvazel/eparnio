import { Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useId, useMemo, useState } from "react";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { Button } from "../../components/ui/Button";
import {
  formatAmountToKeypadString,
  NumericKeypad,
  parseAmountString
} from "../../components/ui/NumericKeypad";
import type { CreateGoalWithdrawalPayload } from "../../services/goal.service";
import type {
  BudgetMember,
  SavingsGoalItem,
  SavingsWithdrawalItem
} from "../../types/budget.types";
import { formatCurrency, toDateInputValue } from "../../utils/format";
import {
  AmountHeroField,
  DateCardField,
  MemberPayerSelector
} from "../budget/SharedFormFields";

export interface GoalWithdrawalSheetProps {
  isOpen: boolean;
  onClose: () => void;
  goal: SavingsGoalItem | null;
  defaultDate?: string;
  initialWithdrawal?: SavingsWithdrawalItem | null;
  members?: BudgetMember[];
  currentUserId?: string;
  isSharedBudget?: boolean;
  isSubmitting?: boolean;
  onSubmit: (payload: CreateGoalWithdrawalPayload) => Promise<void> | void;
  onDelete?: (withdrawalId: string) => Promise<void> | void;
}

/**
 * Tiroir de saisie ou modification d'un retrait / utilisation d'une cagnotte d'épargne
 * sans impact sur le Reste à vivre du cycle budgétaire actif.
 */
export function GoalWithdrawalSheet({
  isOpen,
  onClose,
  goal,
  defaultDate,
  initialWithdrawal,
  members = [],
  currentUserId,
  isSharedBudget = false,
  isSubmitting = false,
  onSubmit,
  onDelete
}: GoalWithdrawalSheetProps) {
  const isEditing = Boolean(initialWithdrawal);
  const resolvedDefaultDate = useMemo(
    () => defaultDate ?? toDateInputValue(new Date()),
    [defaultDate]
  );

  const [amountInput, setAmountInput] = useState('');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [dateValue, setDateValue] = useState(resolvedDefaultDate);
  const [memberId, setMemberId] = useState<string | undefined>(currentUserId);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const labelInputId = useId();
  const notesInputId = useId();
  const notesHintId = useId();

  useEffect(() => {
    if (!isOpen || !goal) return;

    if (initialWithdrawal) {
      setAmountInput(formatAmountToKeypadString(initialWithdrawal.amount));
      setLabel(initialWithdrawal.label);
      setNotes(initialWithdrawal.notes ?? '');
      setDateValue(toDateInputValue(initialWithdrawal.date));
      setMemberId(initialWithdrawal.memberId ?? currentUserId);
    } else {
      setAmountInput('');
      setLabel('');
      setNotes('');
      setDateValue(resolvedDefaultDate);
      setMemberId(currentUserId);
    }
    setIsConfirmingDelete(false);
    setErrorMessage(null);
  }, [isOpen, goal, initialWithdrawal, resolvedDefaultDate, currentUserId]);

  const numericAmount = parseAmountString(amountInput);

  const { rawRemainingBalance, projectedBalance } = useMemo(() => {
    if (!goal) {
      return { rawRemainingBalance: 0, projectedBalance: 0 };
    }
    const baseAvailable = goal.currentAmount + (initialWithdrawal?.amount ?? 0);
    const raw = Math.round((baseAvailable - numericAmount + Number.EPSILON) * 100) / 100;
    return {
      rawRemainingBalance: raw,
      projectedBalance: Math.max(0, raw)
    };
  }, [goal, initialWithdrawal, numericAmount]);

  if (!goal) {
    return null;
  }

  const isOverBalance = rawRemainingBalance < 0;
  const subtitleText = isOverBalance
    ? `Nouveau solde de la cagnotte : 0,00 € (dépassement de ${formatCurrency(
        Math.abs(rawRemainingBalance)
      )})`
    : `Nouveau solde de la cagnotte : ${formatCurrency(projectedBalance)}`;

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (numericAmount <= 0) {
      setErrorMessage('Veuillez saisir un montant supérieur à 0 €.');
      return;
    }

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setErrorMessage('Veuillez saisir un libellé de retrait.');
      return;
    }

    const trimmedNotes = notes.trim();
    const shouldSendNotes =
      trimmedNotes.length > 0 || (isEditing && Boolean(initialWithdrawal?.notes));

    try {
      await onSubmit({
        amount: numericAmount,
        label: trimmedLabel,
        date: new Date(`${dateValue}T12:00:00.000Z`).toISOString(),
        ...(isSharedBudget && memberId ? { memberId } : {}),
        ...(shouldSendNotes ? { notes: trimmedNotes } : {})
      });
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible d’enregistrer ce retrait pour le moment.'
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!initialWithdrawal || !onDelete) return;
    setErrorMessage(null);
    try {
      await onDelete(initialWithdrawal.id);
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de supprimer ce retrait pour le moment.'
      );
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Modifier le retrait' : `Utiliser / retirer · ${goal.name}`}
    >
      <form
        method="post"
        onSubmit={handleFormSubmit}
        className="space-y-4 rounded-3xl bg-gradient-to-b from-amber-50/70 via-orange-50/35 to-slate-50/60 p-3.5 dark:from-slate-800/80 dark:via-slate-900/90 dark:to-slate-900"
      >
        <div className="flex items-center justify-center gap-3 pt-1" aria-hidden="true">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100/85 text-xl shadow-sm ring-4 ring-blue-100/40">
            🐷
          </span>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100/90 text-2xl shadow-sm ring-4 ring-orange-100/50">
            {goal.icon}
          </span>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100/90 text-xl shadow-sm ring-4 ring-amber-100/45">
            💸
          </span>
        </div>

        <AmountHeroField
          value={amountInput}
          onChange={setAmountInput}
          subtitle={subtitleText}
          subtitleTone={isOverBalance ? 'red' : numericAmount > 0 ? 'emerald' : 'neutral'}
          subtitleTestId="live-goal-withdrawal-balance"
        />

        <p className="rounded-2xl bg-white/80 px-3.5 py-2 text-center text-[11px] font-medium text-slate-600 shadow-sm dark:bg-slate-800/70 dark:text-slate-300">
          Ce retrait déduit la cagnotte sans impacter votre Reste à vivre du mois.
        </p>

        <NumericKeypad value={amountInput} onChange={setAmountInput} />

        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <label
              htmlFor={labelInputId}
              className="block text-xs font-semibold text-slate-500 dark:text-slate-400"
            >
              Nom
            </label>
            <input
              id={labelInputId}
              name="label"
              type="text"
              maxLength={100}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ex. Billets d’avion, Révision auto…"
              className="mt-1 min-h-11 w-full bg-transparent text-base font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none dark:text-slate-50"
            />
          </div>

          <DateCardField value={dateValue} onChange={setDateValue} />

          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <label
              htmlFor={notesInputId}
              className="block text-xs font-semibold text-slate-500 dark:text-slate-400"
            >
              Note (optionnel)
            </label>
            <textarea
              id={notesInputId}
              name="notes"
              rows={2}
              maxLength={300}
              value={notes}
              aria-describedby={notesHintId}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Précision, facture, contexte…"
              className="mt-1 w-full resize-y bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-50"
            />
            <p
              id={notesHintId}
              className="mt-1 text-right text-[11px] font-medium tabular-nums text-slate-400 dark:text-slate-500"
            >
              {notes.length} / 300
            </p>
          </div>

          {isSharedBudget && (
            <MemberPayerSelector
              label="Utilisé par"
              members={members}
              selectedMemberId={memberId}
              currentUserId={currentUserId}
              onSelect={setMemberId}
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
            {isSubmitting ? 'Enregistrement...' : isEditing ? 'Enregistrer' : 'Retirer'}
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


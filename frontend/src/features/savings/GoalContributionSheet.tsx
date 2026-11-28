import { RefreshCw, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useId, useMemo, useState } from "react";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { Button } from "../../components/ui/Button";
import {
  formatAmountToKeypadString,
  NumericKeypad,
  parseAmountString
} from "../../components/ui/NumericKeypad";
import type { CreateEnvelopePayload } from "../../services/envelope.service";
import type { BudgetMember, EnvelopeItem, SavingsGoalItem } from "../../types/budget.types";
import { formatCurrency, toDateInputValue } from "../../utils/format";
import {
  AmountHeroField,
  DateCardField,
  MemberPayerSelector
} from "../budget/SharedFormFields";

export interface GoalContributionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  goal: SavingsGoalItem | null;
  currentRemainingToAllocate: number;
  defaultDate?: string;
  initialContribution?: EnvelopeItem | null;
  members?: BudgetMember[];
  currentUserId?: string;
  isSharedBudget?: boolean;
  isSubmitting?: boolean;
  onSubmit: (payload: CreateEnvelopePayload) => Promise<void> | void;
  onDelete?: (envelopeId: string) => Promise<void> | void;
}

/**
 * Tiroir de saisie ou modification d'un versement d'épargne mensuel relié à un objectif (`linkedGoalId`)
 * avec pavé numérique tactile et calcul en direct de « Restant à répartir ».
 */
export function GoalContributionSheet({
  isOpen,
  onClose,
  goal,
  currentRemainingToAllocate,
  defaultDate,
  initialContribution,
  members = [],
  currentUserId,
  isSharedBudget = false,
  isSubmitting = false,
  onSubmit,
  onDelete
}: GoalContributionSheetProps) {
  const isEditing = Boolean(initialContribution);
  const resolvedDefaultDate = useMemo(
    () => defaultDate ?? toDateInputValue(new Date()),
    [defaultDate]
  );

  const [amountInput, setAmountInput] = useState('');
  const [name, setName] = useState('');
  const [dateValue, setDateValue] = useState(resolvedDefaultDate);
  const [isRecurring, setIsRecurring] = useState(false);
  const [memberId, setMemberId] = useState<string | undefined>(currentUserId);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nameInputId = useId();
  const recurringCheckboxId = useId();

  useEffect(() => {
    if (!isOpen || !goal) return;

    if (initialContribution) {
      setAmountInput(formatAmountToKeypadString(initialContribution.allocatedAmount));
      setName(initialContribution.name);
      setDateValue(toDateInputValue(initialContribution.date));
      setIsRecurring(initialContribution.isRecurring);
      setMemberId(initialContribution.memberId ?? currentUserId);
    } else {
      setAmountInput('');
      setName(`Versement ${goal.name}`);
      setDateValue(resolvedDefaultDate);
      setIsRecurring(false);
      setMemberId(currentUserId);
    }
    setIsConfirmingDelete(false);
    setErrorMessage(null);
  }, [isOpen, goal, initialContribution, resolvedDefaultDate, currentUserId]);

  const numericAmount = parseAmountString(amountInput);

  const projectedRemainingToAllocate = useMemo(() => {
    const previousContribution = initialContribution ? initialContribution.allocatedAmount : 0;
    const raw = currentRemainingToAllocate + previousContribution - numericAmount;
    return Math.round((raw + Number.EPSILON) * 100) / 100;
  }, [currentRemainingToAllocate, initialContribution, numericAmount]);

  if (!goal) {
    return null;
  }

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (numericAmount <= 0) {
      setErrorMessage('Veuillez saisir un montant supérieur à 0 €.');
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Veuillez saisir un libellé de versement.');
      return;
    }

    try {
      await onSubmit({
        pillar: 'savings',
        linkedGoalId: goal.id,
        name: trimmedName,
        icon: goal.icon,
        color: goal.color,
        allocatedAmount: numericAmount,
        date: new Date(`${dateValue}T12:00:00.000Z`).toISOString(),
        isRecurring,
        isPaid: true,
        ...(isSharedBudget && memberId ? { memberId } : {})
      });
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible d’enregistrer ce versement pour le moment.'
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!initialContribution || !onDelete) return;
    setErrorMessage(null);
    try {
      await onDelete(initialContribution.id);
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de supprimer ce versement pour le moment.'
      );
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Modifier le versement' : `Ajouter un versement · ${goal.name}`}
    >
      <form
        method="post"
        onSubmit={handleFormSubmit}
        className="space-y-4 rounded-3xl bg-gradient-to-b from-violet-50/75 via-blue-50/45 to-slate-50/60 p-3.5 dark:from-slate-800/80 dark:via-slate-900/90 dark:to-slate-900"
      >
        <div className="flex items-center justify-center gap-3 pt-1" aria-hidden="true">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100/85 text-xl shadow-sm ring-4 ring-blue-100/40">
            🐷
          </span>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100/90 text-2xl shadow-sm ring-4 ring-orange-100/50">
            {goal.icon}
          </span>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100/85 text-xl shadow-sm ring-4 ring-emerald-100/40">
            💶
          </span>
        </div>

        <AmountHeroField
          value={amountInput}
          onChange={setAmountInput}
          subtitle={`Restant à répartir : ${formatCurrency(projectedRemainingToAllocate)}`}
          subtitleTone={
            projectedRemainingToAllocate < 0
              ? 'red'
              : Math.abs(projectedRemainingToAllocate) < 0.01
                ? 'emerald'
                : 'neutral'
          }
          subtitleTestId="live-savings-remaining-to-allocate"
        />

        <NumericKeypad value={amountInput} onChange={setAmountInput} />

        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <label htmlFor={nameInputId} className="block text-xs font-semibold text-slate-500">
              Nom
            </label>
            <input
              id={nameInputId}
              type="text"
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={`Versement ${goal.name}`}
              className="mt-1 min-h-11 w-full bg-transparent text-base font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none dark:text-slate-50"
            />
          </div>

          <DateCardField value={dateValue} onChange={setDateValue} />

          <label
            htmlFor={recurringCheckboxId}
            className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-card dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Ajouter chaque mois</p>
                <p className="text-xs text-slate-500">Versement automatique · Inclus gratuitement</p>
              </div>
            </div>
            <input
              id={recurringCheckboxId}
              type="checkbox"
              checked={isRecurring}
              onChange={(event) => setIsRecurring(event.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
          </label>

          {isSharedBudget && (
            <MemberPayerSelector
              label="Versé par"
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
            {isSubmitting ? 'Enregistrement...' : isEditing ? 'Enregistrer' : 'Ajouter'}
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


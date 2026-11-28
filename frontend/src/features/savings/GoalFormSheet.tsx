import { useQuery } from "@tanstack/react-query";
import { Calendar, PiggyBank, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useId, useState } from "react";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { Button } from "../../components/ui/Button";
import { DropdownSelect } from "../../components/ui/DropdownSelect";
import {
  formatAmountToKeypadString,
  NumericKeypad,
  parseAmountString,
  sanitizeTypedAmount
} from "../../components/ui/NumericKeypad";
import type { CreateGoalPayload } from "../../services/goal.service";
import { fetchBudgetNetWorth } from "../../services/netWorth.service";
import type { SavingsGoalItem } from "../../types/budget.types";
import { formatCurrency, formatFullDate, toDateInputValue } from "../../utils/format";
import {
  AmountHeroField,
  ColorSwatchPicker,
  IconAppearanceCard
} from "../budget/SharedFormFields";
import { computeSinkingFundInfo } from "./sinkingFund";

const GOAL_EMOJIS = [
  "🐷", "✈️", "🏠", "🛡️", "🚗", "💍", "🎓", "🌴", "💻", "🎁", "🛟", "🚀"
] as const;

export interface GoalFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  budgetId?: string;
  initialGoal?: SavingsGoalItem | null;
  isSubmitting?: boolean;
  onSubmit: (payload: CreateGoalPayload) => Promise<void> | void;
  onDelete?: (goalId: string) => Promise<void> | void;
}

/**
 * Tiroir de création, édition ou suppression d'un objectif d'épargne (calibré sur Finzee).
 */
export function GoalFormSheet({
  isOpen,
  onClose,
  budgetId,
  initialGoal,
  isSubmitting = false,
  onSubmit,
  onDelete
}: GoalFormSheetProps) {
  const isEditing = Boolean(initialGoal);
  const [targetInput, setTargetInput] = useState('');
  const [name, setName] = useState('');
  const [initialAmountInput, setInitialAmountInput] = useState('');
  const [deadlineValue, setDeadlineValue] = useState('');
  const [assetAccountId, setAssetAccountId] = useState('');

  const { data: netWorth } = useQuery({
    queryKey: ['net-worth', budgetId],
    queryFn: () => fetchBudgetNetWorth(budgetId!),
    enabled: isOpen && Boolean(budgetId),
  });
  const [icon, setIcon] = useState('🐷');
  const [color, setColor] = useState('#16A34A');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nameInputId = useId();
  const initialInputId = useId();
  const deadlineInputId = useId();

  useEffect(() => {
    if (!isOpen) return;

    if (initialGoal) {
      setTargetInput(formatAmountToKeypadString(initialGoal.targetAmount));
      setName(initialGoal.name);
      setAssetAccountId(initialGoal.assetAccountId ?? '');
      setInitialAmountInput(
        initialGoal.initialAmount > 0
          ? formatAmountToKeypadString(initialGoal.initialAmount)
          : ''
      );
      setDeadlineValue(initialGoal.deadline ? toDateInputValue(initialGoal.deadline) : '');
      setIcon(initialGoal.icon || '🐷');
      setColor(initialGoal.color || '#16A34A');
    } else {
      setTargetInput('');
      setName('');
      setAssetAccountId('');
      setInitialAmountInput('');
      setDeadlineValue('');
      setIcon('🐷');
      setColor('#16A34A');
    }
    setIsConfirmingDelete(false);
    setErrorMessage(null);
  }, [isOpen, initialGoal]);

  const numericTarget = parseAmountString(targetInput);
  const numericInitial = parseAmountString(initialAmountInput);
  const remainingToReach = Math.max(
    0,
    Math.round((numericTarget - numericInitial + Number.EPSILON) * 100) / 100
  );

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (numericTarget <= 0) {
      setErrorMessage('Veuillez saisir un objectif supérieur à 0 €.');
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Veuillez saisir un nom d’objectif.');
      return;
    }

    try {
      await onSubmit({
        name: trimmedName,
        targetAmount: numericTarget,
        initialAmount: numericInitial,
        icon,
        color,
        assetAccountId: assetAccountId || null,
        deadline: deadlineValue ? new Date(`${deadlineValue}T12:00:00.000Z`).toISOString() : null
      });
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible d’enregistrer cet objectif pour le moment.'
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!initialGoal || !onDelete) return;
    setErrorMessage(null);
    try {
      await onDelete(initialGoal.id);
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de supprimer cet objectif pour le moment.'
      );
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Modifier l’objectif' : 'Ajouter un objectif d’épargne'}
    >
      <form
        method="post"
        onSubmit={handleFormSubmit}
        className="space-y-4 rounded-3xl bg-gradient-to-b from-violet-50/75 via-blue-50/45 to-slate-50/60 p-3.5 dark:from-slate-800/80 dark:via-slate-900/90 dark:to-slate-900"
      >
        <div className="flex items-center justify-center gap-3 pt-1" aria-hidden="true">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100/85 text-xl shadow-sm ring-4 ring-blue-100/40">
            🏠
          </span>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100/90 text-2xl shadow-sm ring-4 ring-orange-100/50">
            🐷
          </span>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-100/85 text-xl shadow-sm ring-4 ring-rose-100/40">
            ✈️
          </span>
        </div>

        <AmountHeroField
          value={targetInput}
          onChange={setTargetInput}
          subtitle={`Objectif restant à atteindre : ${formatCurrency(remainingToReach)}`}
          subtitleTone={remainingToReach === 0 && numericTarget > 0 ? 'emerald' : 'neutral'}
          subtitleTestId="live-goal-target-remaining"
        />

        <NumericKeypad value={targetInput} onChange={setTargetInput} />

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
              placeholder="Nom du projet (ex. Voyage Bali)"
              className="mt-1 min-h-11 w-full bg-transparent text-base font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none dark:text-slate-50"
            />
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <PiggyBank className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <label
                    htmlFor={initialInputId}
                    className="block text-xs font-semibold text-slate-500"
                  >
                    Épargne déjà constituée (optionnel)
                  </label>
                  <p className="text-[11px] text-slate-400">Avant Eparnio</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <input
                  id={initialInputId}
                  type="text"
                  inputMode="decimal"
                  value={initialAmountInput}
                  placeholder="0,00"
                  onChange={(event) =>
                    setInitialAmountInput(sanitizeTypedAmount(event.target.value))
                  }
                  className="min-h-11 w-24 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-right text-base font-semibold tabular-nums text-slate-900 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                />
                <span className="text-sm font-bold text-slate-500">€</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <label
                    htmlFor={deadlineInputId}
                    className="block text-xs font-semibold text-slate-500"
                  >
                    Échéance (optionnel)
                  </label>
                  <p className="text-xs font-semibold text-slate-700">
                    {deadlineValue
                      ? formatFullDate(`${deadlineValue}T12:00:00.000Z`)
                      : 'Aucune échéance'}
                  </p>
                </div>
              </div>
              <input
                id={deadlineInputId}
                type="date"
                value={deadlineValue}
                onChange={(event) => setDeadlineValue(event.target.value)}
                className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-medium text-slate-700 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
            {netWorth && netWorth.accounts.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
                <DropdownSelect
                  label="Placé sur le compte (optionnel)"
                  emptyOptionLabel="Aucun compte lié"
                  value={assetAccountId}
                  onChange={setAssetAccountId}
                  options={netWorth.accounts
                    .filter((a) => a.category !== 'liability')
                    .map((a) => ({
                      value: a.id,
                      label: a.name,
                      icon: a.icon,
                      sublabel: `${a.currentBalance.toFixed(0)} €`,
                    }))}
                />
              </div>
            )}
            {(() => {
              if (!deadlineValue || numericTarget <= 0) {
                return null;
              }
              const info = computeSinkingFundInfo(
                numericTarget,
                initialGoal?.currentAmount ?? numericInitial,
                `${deadlineValue}T12:00:00.000Z`
              );
              if (info.status === 'active') {
                return (
                  <p className="mt-2 rounded-xl bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                    Mensualité conseillée : {formatCurrency(info.monthlySuggestedAmount)} / mois
                  </p>
                );
              }
              return null;
            })()}
          </div>

          <IconAppearanceCard
            icon={icon}
            color={color}
            emojis={GOAL_EMOJIS}
            onSelectIcon={setIcon}
          />

          <ColorSwatchPicker selectedColor={color} onSelectColor={setColor} />
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


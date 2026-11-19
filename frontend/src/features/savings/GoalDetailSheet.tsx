import { Calendar, PiggyBank, RefreshCw, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useId, useMemo, useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { computeSinkingFundInfo } from './sinkingFund';
import { Button } from '../../components/ui/Button';
import {
  formatAmountToKeypadString,
  NumericKeypad,
  parseAmountString,
  sanitizeTypedAmount
} from '../../components/ui/NumericKeypad';
import type { CreateEnvelopePayload } from '../../services/envelope.service';
import type { CreateGoalPayload, CreateGoalWithdrawalPayload } from '../../services/goal.service';
import type {
  BudgetMember,
  EnvelopeItem,
  SavingsGoalItem,
  SavingsWithdrawalItem
} from '../../types/budget.types';
import { formatCurrency, formatFullDate, toDateInputValue } from '../../utils/format';
import {
  AmountHeroField,
  ColorSwatchPicker,
  DateCardField,
  IconAppearanceCard,
  MemberPayerSelector
} from '../budget/SharedFormFields';

const GOAL_EMOJIS = [
  '🐷',
  '✈️',
  '🏠',
  '🛡️',
  '🚗',
  '💍',
  '🎓',
  '🌴',
  '💻',
  '🎁',
  '🛟',
  '🚀'
] as const;

export interface GoalFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
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

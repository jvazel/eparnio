import { AlertTriangle, CheckCircle2, Lock, PiggyBank, RefreshCw, Sparkles } from 'lucide-react';
import { type FormEvent, useEffect, useId, useMemo, useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { formatAmountToKeypadString, parseAmountString, sanitizeTypedAmount } from '../../components/ui/NumericKeypad';
import type {
  CloseEnvelopeAction,
  CloseEnvelopeDecisionPayload,
  CloseNextMonthAdjustmentPayload,
  ClosePeriodPayload
} from '../../services/period.service';
import type { BudgetPeriod, EnvelopeItem, SavingsGoalItem } from '../../types/budget.types';
import { formatCurrency, formatMonthLabel } from '../../utils/format';

export interface MonthClosingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  period: BudgetPeriod | null;
  envelopes: EnvelopeItem[];
  goals: SavingsGoalItem[];
  isSubmitting?: boolean;
  onConfirmClose: (payload: ClosePeriodPayload) => Promise<void> | void;
}

interface EnvelopeDecisionState {
  action: CloseEnvelopeAction;
  goalId: string;
}

interface NextMonthRowState {
  include: boolean;
  amountInput: string;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isNextMonthCandidate(
  item: EnvelopeItem,
  nextYear: number,
  nextMonth: number
): boolean {
  if (item.pillar === 'variable_envelope') {
    return true;
  }
  if (!item.isRecurring) {
    return false;
  }
  const freq = item.recurrenceFrequency ?? 'monthly';
  if (freq !== 'monthly') {
    return false;
  }
  if (typeof item.recurrenceRemainingCount === 'number' && item.recurrenceRemainingCount <= 1) {
    return false;
  }
  if (item.recurrenceEndDate) {
    const sourceDate = new Date(item.date);
    const daysInNext = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
    const day = Math.min(sourceDate.getUTCDate(), daysInNext);
    const targetMs = Date.UTC(nextYear, nextMonth - 1, day, 12, 0, 0, 0);
    const end = new Date(item.recurrenceEndDate);
    const endOfDayUtc = Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate(),
      23,
      59,
      59,
      999
    );
    if (targetMs > endOfDayUtc) {
      return false;
    }
  }
  return true;
}

/**
 * Assistant guidé Mobile-First en 3 étapes pour clôturer le mois :
 * 1. Bilan du cycle, 2. Affectation des surplus, 3. Aperçu et ajustement du mois suivant.
 */
export function MonthClosingWizard({
  isOpen,
  onClose,
  period,
  envelopes,
  goals,
  isSubmitting = false,
  onConfirmClose
}: MonthClosingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [decisions, setDecisions] = useState<Record<string, EnvelopeDecisionState>>({});
  const [nextRows, setNextRows] = useState<Record<string, NextMonthRowState>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const formId = useId();

  const nextCycle = useMemo(() => {
    if (!period) {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() + 1 };
    }
    return period.month === 12
      ? { year: period.year + 1, month: 1 }
      : { year: period.year, month: period.month + 1 };
  }, [period]);

  const nextMonthLabel = useMemo(
    () => formatMonthLabel(new Date(nextCycle.year, nextCycle.month - 1, 1)),
    [nextCycle.month, nextCycle.year]
  );

  const variableStatuses = useMemo(
    () =>
      envelopes
        .filter((item) => item.pillar === 'variable_envelope')
        .sort((a, b) => a.order - b.order)
        .map((item) => {
          const available = round2(item.allocatedAmount + (item.rolloverAmount ?? 0));
          const remaining = round2(available - item.spentOrPaidAmount);
          return {
            envelope: item,
            available,
            remaining,
            isKept: remaining >= 0
          };
        }),
    [envelopes]
  );

  const surplusEnvelopes = useMemo(
    () => variableStatuses.filter((item) => item.remaining >= 0.01),
    [variableStatuses]
  );

  const carryoverCandidates = useMemo(
    () =>
      envelopes
        .filter((item) => isNextMonthCandidate(item, nextCycle.year, nextCycle.month))
        .sort((a, b) => {
          const orderMap = { income: 0, fixed_charge: 1, variable_envelope: 2, savings: 3 };
          const diff = orderMap[a.pillar] - orderMap[b.pillar];
          return diff !== 0 ? diff : a.order - b.order;
        }),
    [envelopes, nextCycle.month, nextCycle.year]
  );

  useEffect(() => {
    if (!isOpen || !period) return;
    setStep(1);
    setErrorMessage(null);

    const defaultGoalId = goals[0]?.id ?? '';
    const initialDecisions: Record<string, EnvelopeDecisionState> = {};
    for (const entry of variableStatuses) {
      if (entry.remaining < 0.01) continue;
      initialDecisions[entry.envelope.id] = {
        action: entry.envelope.rolloverEnabled ? 'rollover_next_month' : 'reset_zero',
        goalId: defaultGoalId
      };
    }
    setDecisions(initialDecisions);

    const initialNextRows: Record<string, NextMonthRowState> = {};
    for (const item of carryoverCandidates) {
      initialNextRows[item.id] = {
        include: true,
        amountInput: formatAmountToKeypadString(item.allocatedAmount)
      };
    }
    setNextRows(initialNextRows);
  }, [isOpen, period, variableStatuses, carryoverCandidates, goals]);

  const keptCount = useMemo(
    () => variableStatuses.filter((item) => item.isKept).length,
    [variableStatuses]
  );

  const netVariableSavings = useMemo(
    () => round2(variableStatuses.reduce((sum, item) => sum + item.remaining, 0)),
    [variableStatuses]
  );

  const savingsRate = useMemo(() => {
    if (!period || period.summary.plannedIncome <= 0) return 0;
    return (
      Math.round((period.summary.plannedSavings / period.summary.plannedIncome) * 1000) / 10
    );
  }, [period]);

  const surplusSummary = useMemo(() => {
    let rollover = 0;
    let savings = 0;
    let reset = 0;
    for (const entry of surplusEnvelopes) {
      const choice = decisions[entry.envelope.id]?.action ?? 'reset_zero';
      if (choice === 'rollover_next_month') {
        rollover = round2(rollover + entry.remaining);
      } else if (choice === 'transfer_to_goal') {
        savings = round2(savings + entry.remaining);
      } else {
        reset = round2(reset + entry.remaining);
      }
    }
    return { rollover, savings, reset };
  }, [decisions, surplusEnvelopes]);

  const nextMonthSummary = useMemo(() => {
    let plannedIncome = 0;
    let plannedOutflows = 0;
    for (const item of carryoverCandidates) {
      const state = nextRows[item.id] ?? {
        include: true,
        amountInput: formatAmountToKeypadString(item.allocatedAmount)
      };
      if (!state.include) continue;
      const amount = parseAmountString(state.amountInput);
      if (item.pillar === 'income') {
        plannedIncome = round2(plannedIncome + amount);
      } else {
        plannedOutflows = round2(plannedOutflows + amount);
      }
    }
    return {
      plannedIncome,
      plannedOutflows,
      remainingToAllocate: round2(plannedIncome - plannedOutflows)
    };
  }, [carryoverCandidates, nextRows]);

  if (!period) {
    return null;
  }

  const handleDecisionActionChange = (envelopeId: string, action: CloseEnvelopeAction) => {
    setErrorMessage(null);
    setDecisions((prev) => ({
      ...prev,
      [envelopeId]: {
        action,
        goalId: prev[envelopeId]?.goalId || goals[0]?.id || ''
      }
    }));
  };

  const handleDecisionGoalChange = (envelopeId: string, goalId: string) => {
    setErrorMessage(null);
    setDecisions((prev) => ({
      ...prev,
      [envelopeId]: {
        action: prev[envelopeId]?.action ?? 'transfer_to_goal',
        goalId
      }
    }));
  };

  const handleValidateStep2 = () => {
    for (const entry of surplusEnvelopes) {
      const decision = decisions[entry.envelope.id];
      if (decision?.action === 'transfer_to_goal' && !decision.goalId) {
        setErrorMessage(
          `Veuillez sélectionner un objectif d’épargne pour « ${entry.envelope.name} ».`
        );
        return;
      }
    }
    setErrorMessage(null);
    setStep(3);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const envelopeDecisions: CloseEnvelopeDecisionPayload[] = surplusEnvelopes.map((entry) => {
      const choice = decisions[entry.envelope.id];
      const action = choice?.action ?? 'reset_zero';
      return {
        envelopeId: entry.envelope.id,
        action,
        ...(action === 'transfer_to_goal' && choice?.goalId ? { goalId: choice.goalId } : {})
      };
    });

    for (const decision of envelopeDecisions) {
      if (decision.action === 'transfer_to_goal' && !decision.goalId) {
        setErrorMessage('Veuillez choisir un objectif d’épargne pour chaque transfert.');
        setStep(2);
        return;
      }
    }

    const nextMonthAdjustments: CloseNextMonthAdjustmentPayload[] = [];
    for (const item of carryoverCandidates) {
      const state = nextRows[item.id] ?? {
        include: true,
        amountInput: formatAmountToKeypadString(item.allocatedAmount)
      };
      const amount = parseAmountString(state.amountInput);
      if (state.include && (Number.isNaN(amount) || amount < 0)) {
        setErrorMessage(`Montant invalide pour « ${item.name} ».`);
        return;
      }
      nextMonthAdjustments.push({
        sourceEnvelopeId: item.id,
        allocatedAmount: amount,
        include: state.include
      });
    }

    try {
      await onConfirmClose({
        envelopeDecisions,
        nextMonthAdjustments
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de clôturer cette période pour le moment.'
      );
    }
  };

  const wizardSteps = [
    { id: 1 as const, label: '1. Bilan' },
    { id: 2 as const, label: '2. Surplus' },
    { id: 3 as const, label: '3. Mois suivant' }
  ];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`Clôturer ${period.label}`}>
      <form id={formId} method="post" noValidate onSubmit={handleSubmit} className="space-y-4">
        <nav aria-label="Étapes de clôture du mois">
          <ol className="grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/90">
            {wizardSteps.map((item) => {
              const isCurrent = step === item.id;
              const isDone = step > item.id;
              return (
                <li
                  key={item.id}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex min-h-10 items-center justify-center rounded-xl px-2 text-center text-xs font-semibold transition-colors ${
                    isCurrent
                      ? 'bg-white text-[#7C3AED] shadow-sm dark:bg-slate-900 dark:text-violet-300'
                      : isDone
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {item.label}
                </li>
              );
            })}
          </ol>
        </nav>

        {step === 1 && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/70">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Enveloppes tenues
                </p>
                <p className="mt-1 text-base font-bold tabular-nums text-slate-900 dark:text-slate-50">
                  {keptCount} / {variableStatuses.length}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/70">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Économies nettes
                </p>
                <p
                  className={`mt-1 text-sm font-bold tabular-nums ${
                    netVariableSavings >= 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatCurrency(netVariableSavings)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/70">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Taux d’épargne
                </p>
                <p className="mt-1 text-base font-bold tabular-nums text-violet-700 dark:text-violet-300">
                  {savingsRate} %
                </p>
              </div>
            </div>

            {variableStatuses.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                Aucune enveloppe variable sur cette période. Vous pouvez passer directement aux
                étapes suivantes.
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Bilan des enveloppes
                </p>
                <ul className="space-y-2">
                  {variableStatuses.map(({ envelope, remaining, isKept }) => (
                    <li
                      key={envelope.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span aria-hidden="true" className="text-lg">
                          {envelope.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                            {envelope.name}
                          </p>
                          <p
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                              isKept
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {isKept ? (
                              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            )}
                            <span>{isKept ? 'Tenue' : 'Dépassée'}</span>
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-sm font-bold tabular-nums ${
                          remaining >= 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {remaining >= 0 ? `+ ${formatCurrency(remaining)}` : formatCurrency(remaining)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              type="button"
              variant="primary"
              fullWidth
              enterKeyHint="next"
              onClick={() => {
                setErrorMessage(null);
                setStep(2);
              }}
            >
              Suivant
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {surplusEnvelopes.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                Aucun surplus positif à répartir sur ce cycle.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 rounded-2xl border border-violet-100 bg-violet-50/70 p-2.5 text-center text-[11px] dark:border-violet-900/60 dark:bg-violet-950/40">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Reporté</p>
                    <p className="font-bold tabular-nums text-violet-700 dark:text-violet-300">
                      {formatCurrency(surplusSummary.rollover)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Épargné</p>
                    <p className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {formatCurrency(surplusSummary.savings)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Remis à 0</p>
                    <p className="font-bold tabular-nums text-slate-700 dark:text-slate-200">
                      {formatCurrency(surplusSummary.reset)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {surplusEnvelopes.map(({ envelope, remaining }) => {
                    const currentDecision = decisions[envelope.id] ?? {
                      action: 'reset_zero' as CloseEnvelopeAction,
                      goalId: goals[0]?.id ?? ''
                    };
                    return (
                      <fieldset
                        key={envelope.id}
                        className="space-y-2 rounded-2xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <legend className="sr-only">Affecter le surplus de {envelope.name}</legend>
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-50">
                            <span aria-hidden="true">{envelope.icon}</span>
                            <span className="truncate">{envelope.name}</span>
                          </span>
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold tabular-nums text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            + {formatCurrency(remaining)}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          {(
                            [
                              { id: 'rollover_next_month', label: 'Reporter', disabled: false },
                              {
                                id: 'transfer_to_goal',
                                label: 'Épargner',
                                disabled: goals.length === 0
                              },
                              { id: 'reset_zero', label: 'Remettre à 0', disabled: false }
                            ] as const
                          ).map((option) => {
                            const selected = currentDecision.action === option.id;
                            return (
                              <label
                                key={option.id}
                                className={`flex min-h-11 items-center justify-center rounded-xl border px-2 text-center text-xs font-semibold transition-colors focus-within:ring-2 focus-within:ring-violet-500 ${
                                  option.disabled
                                    ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400 opacity-60 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-500'
                                    : selected
                                      ? 'cursor-pointer border-violet-600 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-950/60 dark:text-violet-200'
                                      : 'cursor-pointer border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`decision-${envelope.id}`}
                                  value={option.id}
                                  disabled={option.disabled}
                                  checked={selected}
                                  onChange={() => handleDecisionActionChange(envelope.id, option.id)}
                                  className="sr-only"
                                />
                                <span>{option.label}</span>
                              </label>
                            );
                          })}
                        </div>

                        {goals.length === 0 && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Créez un objectif dans l’onglet Épargne pour activer le transfert.
                          </p>
                        )}

                        {currentDecision.action === 'transfer_to_goal' && goals.length > 0 && (
                          <div>
                            <label
                              htmlFor={`${formId}-goal-${envelope.id}`}
                              className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300"
                            >
                              <PiggyBank className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                              <span>Objectif cible pour {envelope.name}</span>
                            </label>
                            <select
                              id={`${formId}-goal-${envelope.id}`}
                              value={currentDecision.goalId}
                              onChange={(event) =>
                                handleDecisionGoalChange(envelope.id, event.target.value)
                              }
                              className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            >
                              {goals.map((goal) => (
                                <option key={goal.id} value={goal.id}>
                                  {goal.icon} {goal.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </fieldset>
                    );
                  })}
                </div>
              </>
            )}

            {errorMessage && (
              <p
                role="alert"
                className="rounded-2xl bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-600 dark:bg-red-950/60 dark:text-red-300"
              >
                {errorMessage}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                enterKeyHint="previous"
                onClick={() => {
                  setErrorMessage(null);
                  setStep(1);
                }}
              >
                Précédent
              </Button>
              <Button
                type="button"
                variant="primary"
                enterKeyHint="next"
                onClick={handleValidateStep2}
              >
                Suivant
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50/90 to-blue-50/80 p-3 dark:border-violet-900/60 dark:from-violet-950/50 dark:to-blue-950/40">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  Aperçu {nextMonthLabel}
                </span>
                <span
                  className={`font-bold tabular-nums ${
                    Math.abs(nextMonthSummary.remainingToAllocate) < 0.01
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : nextMonthSummary.remainingToAllocate < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-violet-700 dark:text-violet-300'
                  }`}
                >
                  Restant à répartir : {formatCurrency(nextMonthSummary.remainingToAllocate)}
                </span>
              </div>
              <p className="mt-1 text-[11px] tabular-nums text-slate-600 dark:text-slate-300">
                Revenus {formatCurrency(nextMonthSummary.plannedIncome)} · Dépenses &amp; Enveloppes{' '}
                {formatCurrency(nextMonthSummary.plannedOutflows)}
              </p>
            </div>

            {carryoverCandidates.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                Aucun poste récurrent ou enveloppe à reconduire automatiquement.
              </div>
            ) : (
              <div className="space-y-2">
                {carryoverCandidates.map((item) => {
                  const rowState = nextRows[item.id] ?? {
                    include: true,
                    amountInput: formatAmountToKeypadString(item.allocatedAmount)
                  };
                  const surplusInfo = surplusEnvelopes.find((entry) => entry.envelope.id === item.id);
                  const willRollover =
                    surplusInfo && decisions[item.id]?.action === 'rollover_next_month';
                  const rowCheckboxId = `${formId}-include-${item.id}`;
                  const rowAmountId = `${formId}-amount-${item.id}`;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border px-3 py-2.5 transition-colors ${
                        rowState.include
                          ? 'border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900'
                          : 'border-slate-100 bg-slate-50 opacity-65 dark:border-slate-800 dark:bg-slate-900/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor={rowCheckboxId}
                          className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5"
                        >
                          <input
                            id={rowCheckboxId}
                            type="checkbox"
                            checked={rowState.include}
                            onChange={(event) =>
                              setNextRows((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...rowState,
                                  include: event.target.checked
                                }
                              }))
                            }
                            className="h-5 w-5 shrink-0 rounded border-slate-300 text-violet-600 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-800"
                          />
                          <span aria-hidden="true">{item.icon}</span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-50">
                              {item.name}
                            </p>
                            {willRollover && surplusInfo ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                                <Sparkles className="h-3 w-3" aria-hidden="true" />
                                + {formatCurrency(surplusInfo.remaining)} reporté
                              </span>
                            ) : item.isRecurring ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                                Reconduit
                              </span>
                            ) : null}
                          </div>
                        </label>

                        <div className="flex shrink-0 items-center gap-1">
                          <label htmlFor={rowAmountId} className="sr-only">
                            Montant pour {item.name}
                          </label>
                          <input
                            id={rowAmountId}
                            type="text"
                            inputMode="decimal"
                            disabled={!rowState.include}
                            value={rowState.amountInput}
                            onChange={(event) =>
                              setNextRows((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...rowState,
                                  amountInput: sanitizeTypedAmount(event.target.value)
                                }
                              }))
                            }
                            className="min-h-11 w-24 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-right text-sm font-bold tabular-nums text-slate-900 focus:border-violet-500 focus:outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
                          />
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            €
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {errorMessage && (
              <p
                role="alert"
                className="rounded-2xl bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-600 dark:bg-red-950/60 dark:text-red-300"
              >
                {errorMessage}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                enterKeyHint="previous"
                disabled={isSubmitting}
                onClick={() => {
                  setErrorMessage(null);
                  setStep(2);
                }}
              >
                Précédent
              </Button>
              <Button
                type="submit"
                variant="primary"
                enterKeyHint="done"
                disabled={isSubmitting}
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                {isSubmitting ? 'Clôture...' : `Clôturer et ouvrir ${nextMonthLabel}`}
              </Button>
            </div>
          </div>
        )}
      </form>
    </BottomSheet>
  );
}

import {
  ArrowDownLeft,
  ChevronDown,
  Minus,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  StickyNote,
  Trash2
} from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { computeSinkingFundInfo } from './sinkingFund';
import { Card } from '../../components/ui/Card';
import { DonutSummaryCard, type DonutSegmentItem } from '../../components/ui/DonutChart';
import { resolvePastelTheme } from '../../components/ui/PastelEnvelopeCard';
import { ProgressBar } from '../../components/ui/ProgressBar';
import type {
  BudgetMember,
  BudgetPeriodSummary,
  EnvelopeItem,
  SavingsGoalItem,
  SavingsWithdrawalItem
} from '../../types/budget.types';
import { formatCurrency, formatFullDate } from '../../utils/format';
import { ZeroBasedBanner, type ZeroBasedQuickActions } from '../budget/ZeroBasedBanner';

export interface SavingsGoalCardProps {
  goal: SavingsGoalItem;
  contributions: EnvelopeItem[];
  members?: BudgetMember[];
  currentUserId?: string;
  isSharedBudget?: boolean;
  onEditGoal: (goal: SavingsGoalItem) => void;
  onDeleteGoal: (goalId: string) => Promise<void> | void;
  onAddContribution: (goal: SavingsGoalItem) => void;
  onEditContribution: (goal: SavingsGoalItem, contribution: EnvelopeItem) => void;
  onDeleteContribution: (envelopeId: string) => Promise<void> | void;
  onAddWithdrawal?: (goal: SavingsGoalItem) => void;
  onEditWithdrawal?: (goal: SavingsGoalItem, withdrawal: SavingsWithdrawalItem) => void;
  onDeleteWithdrawal?: (goalId: string, withdrawalId: string) => Promise<void> | void;
}

/**
 * Carte d'objectif d'épargne (calibrée sur Finzee) :
 * icône cerclée + menu ⋮, Objectif / Total epargné, barre fine, accordéon ⌄ Epargne du mois et boutons − / + pastel.
 */
export function SavingsGoalCard({
  goal,
  contributions,
  members = [],
  currentUserId,
  isSharedBudget = false,
  onEditGoal,
  onDeleteGoal,
  onAddContribution,
  onEditContribution,
  onDeleteContribution,
  onAddWithdrawal,
  onEditWithdrawal,
  onDeleteWithdrawal
}: SavingsGoalCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [confirmingContribId, setConfirmingContribId] = useState<string | null>(null);
  const [confirmingWithdrawalId, setConfirmingWithdrawalId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const accordionId = useId();
  const withdrawals = goal.withdrawals ?? [];

  const pastelTheme = resolvePastelTheme(goal.color);
  const monthlyTotal = useMemo(
    () =>
      Math.round(
        contributions.reduce((acc, item) => acc + item.allocatedAmount, 0) * 100
      ) / 100,
    [contributions]
  );

  const memberMap = useMemo(
    () => new Map(members.map((member, index) => [member.userId, { member, index }])),
    [members]
  );

  const handleConfirmDeleteGoal = async () => {
    setIsBusy(true);
    try {
      await onDeleteGoal(goal.id);
    } finally {
      setIsBusy(false);
      setIsConfirmingDelete(false);
    }
  };

  const handleConfirmDeleteContribution = async (envelopeId: string) => {
    setIsBusy(true);
    try {
      await onDeleteContribution(envelopeId);
    } finally {
      setIsBusy(false);
      setConfirmingContribId(null);
    }
  };

  const handleConfirmDeleteWithdrawal = async (withdrawalId: string) => {
    if (!onDeleteWithdrawal) return;
    setIsBusy(true);
    try {
      await onDeleteWithdrawal(goal.id, withdrawalId);
    } finally {
      setIsBusy(false);
      setConfirmingWithdrawalId(null);
    }
  };

  return (
    <Card className="relative space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] bg-white text-xl shadow-sm dark:bg-slate-800"
            style={{ borderColor: goal.color }}
            aria-hidden="true"
          >
            {goal.icon}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-slate-900 dark:text-slate-50">{goal.name}</h3>
            {goal.deadline ? (
              <div>
                <p className="text-xs font-medium text-slate-400">
                  Échéance : {formatFullDate(goal.deadline)}
                </p>
                {(() => {
                  const sinkingInfo = computeSinkingFundInfo(
                    goal.targetAmount,
                    goal.currentAmount,
                    goal.deadline
                  );
                  if (sinkingInfo.status === 'completed') {
                    return (
                      <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Objectif atteint
                      </span>
                    );
                  }
                  if (sinkingInfo.status === 'overdue') {
                    return (
                      <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                        Échéance dépassée — Reste {formatCurrency(sinkingInfo.remainingAmount)}
                      </span>
                    );
                  }
                  if (sinkingInfo.status === 'active') {
                    return (
                      <span className="mt-1 inline-block rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                        Conseillé : {formatCurrency(sinkingInfo.monthlySuggestedAmount)}/mois
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
            ) : (
              <p className="text-xs font-medium text-slate-400">Projet d’épargne</p>
            )}
          </div>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsMenuOpen((previous) => !previous);
              setIsConfirmingDelete(false);
            }}
            aria-label={`Options de l’objectif ${goal.name}`}
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <MoreVertical className="h-5 w-5" aria-hidden="true" />
          </button>

          {isMenuOpen && (
            <div
              role="menu"
              aria-label={`Actions pour ${goal.name}`}
              className="absolute right-0 top-12 z-20 w-48 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-900"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  onEditGoal(goal);
                }}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <span>Modifier l’objectif</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsConfirmingDelete(true);
                }}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 text-red-500" aria-hidden="true" />
                <span>Supprimer l’objectif</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {isConfirmingDelete && (
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-red-50 p-3">
          <p className="text-xs font-semibold text-red-700">
            Supprimer cet objectif et ses versements liés ?
          </p>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isBusy}
              onClick={() => setIsConfirmingDelete(false)}
              className="px-3 py-1.5 text-xs"
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={isBusy}
              onClick={handleConfirmDeleteGoal}
              className="px-3 py-1.5 text-xs"
            >
              Confirmer
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1 text-right text-xs">
        <p className="text-slate-500">
          Objectif :{' '}
          <span className="font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {formatCurrency(goal.targetAmount)}
          </span>
        </p>
        <p className="text-slate-500">
          Total epargné :{' '}
          <span className="font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {formatCurrency(goal.currentAmount)}
          </span>
        </p>
      </div>

      <ProgressBar
        value={goal.currentAmount}
        max={goal.targetAmount}
        color={goal.color}
        label={goal.name}
        className="h-2"
      />

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={() => setIsExpanded((previous) => !previous)}
          aria-expanded={isExpanded}
          aria-controls={accordionId}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-left text-xs text-slate-600 transition-colors hover:text-slate-900"
        >
          <span>
            Epargne du mois :{' '}
            <span className="font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {formatCurrency(monthlyTotal)}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {onAddWithdrawal ? (
            <button
              type="button"
              onClick={() => onAddWithdrawal(goal)}
              aria-label={`Utiliser ou retirer de ${goal.name}`}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700 shadow-sm transition-transform hover:bg-amber-100 active:scale-95 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60"
            >
              <Minus className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onAddContribution(goal)}
            aria-label={`Ajouter un versement pour ${goal.name}`}
            style={{
              backgroundColor: pastelTheme.background,
              color: pastelTheme.ring
            }}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-sm transition-transform hover:brightness-95 active:scale-95"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div
          id={accordionId}
          className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800"
        >
          {contributions.length === 0 && withdrawals.length === 0 ? (
            <p className="py-1 text-center text-xs text-slate-400 dark:text-slate-500">
              Aucun versement pour cet objectif ce mois-ci.
            </p>
          ) : (
            <>
              {contributions.map((contribution) => {
                const memberMeta = contribution.memberId
                  ? memberMap.get(contribution.memberId)
                  : undefined;
                const payerLabel =
                  contribution.memberId && contribution.memberId === currentUserId
                    ? 'Moi'
                    : memberMeta
                      ? `Membre ${memberMeta.index + 1}`
                      : undefined;

                return (
                  <div
                    key={contribution.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-slate-50/80 px-3 py-2 dark:bg-slate-800/70"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-50">
                          {contribution.name}
                        </p>
                        {contribution.isRecurring && (
                          <RefreshCw
                            className="h-3 w-3 shrink-0 text-violet-500"
                            aria-label="Versement récurrent"
                          />
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{formatFullDate(contribution.date)}</span>
                        {isSharedBudget && memberMeta && payerLabel && (
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: memberMeta.member.color }}
                              aria-hidden="true"
                            />
                            <span>{payerLabel}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <span className="mr-1 text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        + {formatCurrency(contribution.allocatedAmount)}
                      </span>

                      {confirmingContribId === contribution.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setConfirmingContribId(null)}
                            className="min-h-11 rounded-lg px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleConfirmDeleteContribution(contribution.id)}
                            className="min-h-11 rounded-lg bg-red-600 px-2 text-[11px] font-semibold text-white hover:bg-red-700"
                          >
                            Confirmer
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onEditContribution(goal, contribution)}
                            aria-label={`Modifier le versement ${contribution.name}`}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingContribId(contribution.id)}
                            aria-label={`Supprimer le versement ${contribution.name}`}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-red-500 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/50"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {withdrawals.map((withdrawal) => {
                const memberMeta = withdrawal.memberId
                  ? memberMap.get(withdrawal.memberId)
                  : undefined;
                const payerLabel =
                  withdrawal.memberId && withdrawal.memberId === currentUserId
                    ? 'Moi'
                    : memberMeta
                      ? `Membre ${memberMeta.index + 1}`
                      : undefined;

                return (
                  <div
                    key={withdrawal.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-amber-50/70 px-3 py-2 dark:bg-amber-950/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-50">
                          {withdrawal.label}
                        </p>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                          <ArrowDownLeft className="h-3 w-3" aria-hidden="true" />
                          Retrait
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{formatFullDate(withdrawal.date)}</span>
                        {isSharedBudget && memberMeta && payerLabel && (
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: memberMeta.member.color }}
                              aria-hidden="true"
                            />
                            <span>{payerLabel}</span>
                          </span>
                        )}
                      </div>
                      {withdrawal.notes ? (
                        <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <StickyNote
                            className="mt-0.5 h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500"
                            aria-hidden="true"
                          />
                          <span className="line-clamp-2">{withdrawal.notes}</span>
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <span className="mr-1 text-xs font-bold tabular-nums text-amber-700 dark:text-amber-300">
                        − {formatCurrency(withdrawal.amount)}
                      </span>

                      {confirmingWithdrawalId === withdrawal.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setConfirmingWithdrawalId(null)}
                            className="min-h-11 rounded-lg px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleConfirmDeleteWithdrawal(withdrawal.id)}
                            className="min-h-11 rounded-lg bg-red-600 px-2 text-[11px] font-semibold text-white hover:bg-red-700"
                          >
                            Confirmer
                          </button>
                        </div>
                      ) : (
                        <>
                          {onEditWithdrawal ? (
                            <button
                              type="button"
                              onClick={() => onEditWithdrawal(goal, withdrawal)}
                              aria-label={`Modifier le retrait ${withdrawal.label}`}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          ) : null}
                          {onDeleteWithdrawal ? (
                            <button
                              type="button"
                              onClick={() => setConfirmingWithdrawalId(withdrawal.id)}
                              aria-label={`Supprimer le retrait ${withdrawal.label}`}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-red-500 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/50"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

export interface SavingsGoalsListProps {
  goals: SavingsGoalItem[];
  savingsEnvelopes: EnvelopeItem[];
  summary: BudgetPeriodSummary;
  members?: BudgetMember[];
  currentUserId?: string;
  isSharedBudget?: boolean;
  onAddGoal: () => void;
  onEditGoal: (goal: SavingsGoalItem) => void;
  onDeleteGoal: (goalId: string) => Promise<void> | void;
  onAddContribution: (goal: SavingsGoalItem) => void;
  onEditContribution: (goal: SavingsGoalItem, contribution: EnvelopeItem) => void;
  onDeleteContribution: (envelopeId: string) => Promise<void> | void;
  onAddWithdrawal?: (goal: SavingsGoalItem) => void;
  onEditWithdrawal?: (goal: SavingsGoalItem, withdrawal: SavingsWithdrawalItem) => void;
  onDeleteWithdrawal?: (goalId: string, withdrawalId: string) => Promise<void> | void;
  zeroBasedActions?: ZeroBasedQuickActions;
}

/**
 * Vue complète de l'onglet « Epargne » : Donut multicolore mensuel, bandeau Base Zéro
 * et liste « Historique des épargnes » avec cartes d'objectifs et accordéon des versements et retraits.
 */
export function SavingsGoalsList({
  goals,
  savingsEnvelopes,
  summary,
  members = [],
  currentUserId,
  isSharedBudget = false,
  onAddGoal,
  onEditGoal,
  onDeleteGoal,
  onAddContribution,
  onEditContribution,
  onDeleteContribution,
  onAddWithdrawal,
  onEditWithdrawal,
  onDeleteWithdrawal,
  zeroBasedActions
}: SavingsGoalsListProps) {
  const contributionsByGoal = useMemo(() => {
    const grouped = new Map<string, EnvelopeItem[]>();
    for (const item of savingsEnvelopes) {
      if (!item.linkedGoalId) continue;
      const bucket = grouped.get(item.linkedGoalId) ?? [];
      bucket.push(item);
      grouped.set(item.linkedGoalId, bucket);
    }
    return grouped;
  }, [savingsEnvelopes]);

  const donutItems = useMemo<DonutSegmentItem[]>(() => {
    const segments: DonutSegmentItem[] = [];
    for (const goal of goals) {
      const list = contributionsByGoal.get(goal.id) ?? [];
      const totalForGoal =
        Math.round(list.reduce((acc, item) => acc + item.allocatedAmount, 0) * 100) / 100;
      if (totalForGoal > 0) {
        segments.push({
          id: goal.id,
          label: goal.name,
          amount: totalForGoal,
          color: goal.color
        });
      }
    }

    const unlinkedTotal =
      Math.round(
        savingsEnvelopes
          .filter((item) => !item.linkedGoalId)
          .reduce((acc, item) => acc + item.allocatedAmount, 0) * 100
      ) / 100;
    if (unlinkedTotal > 0) {
      segments.push({
        id: 'unlinked-savings',
        label: 'Autres épargnes',
        amount: unlinkedTotal,
        color: '#94A3B8'
      });
    }

    return segments;
  }, [goals, contributionsByGoal, savingsEnvelopes]);

  return (
    <div className="space-y-4">
      <DonutSummaryCard
        title="Total"
        total={summary.plannedSavings}
        items={donutItems}
        allowModeToggle={false}
        emptyMessage="Aucun versement d’épargne prévu ce mois-ci. Appuyez sur + sur un objectif pour verser."
      />

      <ZeroBasedBanner
        remainingToAllocate={summary.remainingToAllocate}
        plannedIncome={summary.plannedIncome}
        {...zeroBasedActions}
      />

      <section aria-label="Historique des épargnes" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">Historique des épargnes</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
              {goals.length}
            </span>
          </div>
        </div>

        {goals.length === 0 ? (
          <Card className="text-center">
            <p className="text-sm font-medium text-slate-600">
              Aucun objectif d’épargne configuré pour cet espace.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Créez votre matelas de sécurité, un projet voyage ou un apport immobilier.
            </p>
            <div className="mt-4">
              <Button type="button" variant="primary" onClick={onAddGoal}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Créer mon premier objectif
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => (
              <SavingsGoalCard
                key={goal.id}
                goal={goal}
                contributions={contributionsByGoal.get(goal.id) ?? []}
                members={members}
                currentUserId={currentUserId}
                isSharedBudget={isSharedBudget}
                onEditGoal={onEditGoal}
                onDeleteGoal={onDeleteGoal}
                onAddContribution={onAddContribution}
                onEditContribution={onEditContribution}
                onDeleteContribution={onDeleteContribution}
                onAddWithdrawal={onAddWithdrawal}
                onEditWithdrawal={onEditWithdrawal}
                onDeleteWithdrawal={onDeleteWithdrawal}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Wand2
} from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { TabId } from '../../components/layout/BottomNav';
import type { EnvelopeItem, SavingsGoalItem } from '../../types/budget.types';
import { formatCurrency } from '../../utils/format';

export interface ZeroBasedQuickActions {
  variableEnvelopes?: EnvelopeItem[];
  goals?: SavingsGoalItem[];
  isAutoBalancing?: boolean;
  currentTab?: TabId;
  onAutoBalanceToEnvelope?: (envelope: EnvelopeItem, amount: number) => Promise<void> | void;
  onAutoBalanceToGoal?: (goal: SavingsGoalItem, amount: number) => Promise<void> | void;
  onNavigateToTab?: (tab: TabId) => void;
}

export interface ZeroBasedBannerProps extends ZeroBasedQuickActions {
  remainingToAllocate: number;
  plannedIncome?: number;
  className?: string;
}

/**
 * Bandeau pédagogique d'équilibre Base Zéro affichant le montant restant à attribuer en direct,
 * avec raccourci « Auto-équilibrer à 0 € » (reliquat > 0) et garde-fou de sur-allocation (< 0).
 */
export function ZeroBasedBanner({
  remainingToAllocate,
  plannedIncome = 0,
  className = '',
  variableEnvelopes = [],
  goals = [],
  isAutoBalancing = false,
  currentTab,
  onAutoBalanceToEnvelope,
  onAutoBalanceToGoal,
  onNavigateToTab
}: ZeroBasedBannerProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [submittingTargetKey, setSubmittingTargetKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const pickerPanelId = useId();

  const isEmpty = Math.abs(plannedIncome) < 0.01 && Math.abs(remainingToAllocate) < 0.01;
  const isBalanced = !isEmpty && Math.abs(remainingToAllocate) < 0.01;
  const isOverAllocated = remainingToAllocate <= -0.01;
  const hasPositiveSurplus = !isEmpty && remainingToAllocate >= 0.01;

  const roundedSurplus = Math.round(remainingToAllocate * 100) / 100;
  const envelopeTargets = onAutoBalanceToEnvelope ? variableEnvelopes : [];
  const goalTargets = onAutoBalanceToGoal ? goals : [];
  const hasInteractiveTargets = envelopeTargets.length > 0 || goalTargets.length > 0;
  const canShowAutoBalance = hasPositiveSurplus && (hasInteractiveTargets || Boolean(onNavigateToTab));

  useEffect(() => {
    if (!hasPositiveSurplus) {
      setIsPickerOpen(false);
      setActionError(null);
    }
  }, [hasPositiveSurplus]);

  const containerStyle = isOverAllocated
    ? 'border-red-200 bg-red-50/90 text-red-900 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-100'
    : isBalanced
      ? 'border-emerald-200 bg-emerald-50/90 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-100'
      : 'border-violet-100 bg-gradient-to-r from-violet-50/90 to-blue-50/80 text-slate-900 dark:border-violet-900/60 dark:from-violet-950/50 dark:to-blue-950/40 dark:text-slate-100';

  const badgeStyle = isOverAllocated
    ? 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300'
    : isBalanced
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
      : 'bg-white text-violet-700 shadow-sm dark:bg-slate-800 dark:text-violet-300';

  const statusText = isEmpty
    ? 'Ajoutez vos revenus du mois pour démarrer votre Budget Base Zéro.'
    : isBalanced
      ? 'Parfait ! Chaque euro du mois a un rôle précis (0 € restant).'
      : isOverAllocated
        ? `Vos prévisions dépassent vos revenus de ${formatCurrency(Math.abs(remainingToAllocate))}.`
        : 'Attribuez chaque euro à une dépense, enveloppe ou épargne.';

  const Icon = isOverAllocated ? AlertTriangle : isBalanced ? CheckCircle2 : Sparkles;
  const isBusy = isAutoBalancing || submittingTargetKey !== null;

  const handleAssignToEnvelope = async (envelope: EnvelopeItem) => {
    if (!onAutoBalanceToEnvelope || roundedSurplus <= 0) return;
    setActionError(null);
    setSubmittingTargetKey(`env:${envelope.id}`);
    try {
      await onAutoBalanceToEnvelope(envelope, roundedSurplus);
      setIsPickerOpen(false);
    } catch {
      setActionError('Impossible d’affecter ce reliquat pour le moment. Réessayez.');
    } finally {
      setSubmittingTargetKey(null);
    }
  };

  const handleAssignToGoal = async (goal: SavingsGoalItem) => {
    if (!onAutoBalanceToGoal || roundedSurplus <= 0) return;
    setActionError(null);
    setSubmittingTargetKey(`goal:${goal.id}`);
    try {
      await onAutoBalanceToGoal(goal, roundedSurplus);
      setIsPickerOpen(false);
    } catch {
      setActionError('Impossible de verser ce reliquat sur l’objectif. Réessayez.');
    } finally {
      setSubmittingTargetKey(null);
    }
  };

  const adjustButtons = onNavigateToTab
    ? [
        ...(currentTab !== 'enveloppes'
          ? [{ tab: 'enveloppes' as const, label: 'Ajuster les enveloppes' }]
          : []),
        ...(currentTab !== 'depenses'
          ? [{ tab: 'depenses' as const, label: 'Ajuster les charges fixes' }]
          : []),
        ...(currentTab === 'enveloppes' || currentTab === 'depenses'
          ? [{ tab: 'epargne' as const, label: 'Ajuster l’épargne' }]
          : [])
      ]
    : [];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-2xl border px-4 py-3 transition-colors ${containerStyle} ${className}`.trim()}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${badgeStyle}`}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-xs font-bold uppercase tracking-wide opacity-80">
                Restant à répartir
              </p>
              {isOverAllocated ? (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 dark:bg-red-900/70 dark:text-red-200">
                  Sur-allocation
                </span>
              ) : null}
            </div>
            <p className="text-xs leading-snug opacity-85">{statusText}</p>
          </div>
        </div>
        <span
          className={`shrink-0 text-base font-bold tabular-nums ${
            isOverAllocated
              ? 'text-red-600 dark:text-red-400'
              : isBalanced
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-violet-700 dark:text-violet-300'
          }`}
        >
          {formatCurrency(remainingToAllocate)}
        </span>
      </div>

      {canShowAutoBalance ? (
        <div className="mt-2.5">
          <button
            type="button"
            disabled={isBusy}
            aria-expanded={isPickerOpen}
            aria-controls={pickerPanelId}
            onClick={() => {
              setActionError(null);
              setIsPickerOpen((prev) => !prev);
            }}
            className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-violet-200 bg-white/95 px-3 py-2 text-xs font-semibold text-violet-700 shadow-sm transition-colors hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-violet-800/70 dark:bg-slate-900/90 dark:text-violet-200 dark:hover:bg-slate-800"
          >
            <span className="inline-flex items-center gap-2">
              <Wand2 className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden="true" />
              <span>Auto-équilibrer à 0 €</span>
            </span>
            {isPickerOpen ? (
              <ChevronUp className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
          </button>

          {isPickerOpen ? (
            <div
              id={pickerPanelId}
              className="mt-2 space-y-2.5 rounded-xl border border-violet-200/80 bg-white/95 p-3 text-slate-900 shadow-sm dark:border-violet-800/60 dark:bg-slate-900/95 dark:text-slate-100"
            >
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Affecter <span className="font-bold tabular-nums">{formatCurrency(roundedSurplus)}</span> en 1 tap :
              </p>

              {actionError ? (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300"
                >
                  {actionError}
                </p>
              ) : null}

              {envelopeTargets.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Enveloppes variables
                  </p>
                  <div className="space-y-1.5">
                    {envelopeTargets.map((env) => {
                      const nextAllocated =
                        Math.round((env.allocatedAmount + roundedSurplus) * 100) / 100;
                      const isTargetBusy = submittingTargetKey === `env:${env.id}`;
                      return (
                        <button
                          key={env.id}
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            void handleAssignToEnvelope(env);
                          }}
                          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-left text-xs transition-colors hover:border-violet-300 hover:bg-violet-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-violet-700 dark:hover:bg-slate-800"
                        >
                          <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                            <span aria-hidden="true">{env.icon}</span>
                            <span className="truncate">{env.name}</span>
                          </span>
                          <span className="shrink-0 font-bold tabular-nums text-violet-700 dark:text-violet-300">
                            {isTargetBusy
                              ? 'En cours…'
                              : `${formatCurrency(env.allocatedAmount)} → ${formatCurrency(nextAllocated)}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {goalTargets.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Objectifs d’épargne
                  </p>
                  <div className="space-y-1.5">
                    {goalTargets.map((goal) => {
                      const isTargetBusy = submittingTargetKey === `goal:${goal.id}`;
                      return (
                        <button
                          key={goal.id}
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            void handleAssignToGoal(goal);
                          }}
                          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-left text-xs transition-colors hover:border-emerald-300 hover:bg-emerald-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-emerald-700 dark:hover:bg-slate-800"
                        >
                          <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                            <span aria-hidden="true">{goal.icon}</span>
                            <span className="truncate">{goal.name}</span>
                          </span>
                          <span className="shrink-0 font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                            {isTargetBusy ? 'En cours…' : `+ ${formatCurrency(roundedSurplus)}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {!hasInteractiveTargets && onNavigateToTab ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Créez d’abord une enveloppe ou un objectif d’épargne pour y affecter ce reliquat.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('enveloppes')}
                      className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Ouvrir Enveloppes
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('epargne')}
                      className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Ouvrir Épargne
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {isOverAllocated ? (
        <div className="mt-2.5 rounded-xl border border-red-200/80 bg-white/80 px-3 py-2 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-100">
          <p className="font-medium leading-snug">
            Réduisez une enveloppe, une charge fixe ou une épargne pour revenir à 0 €.
          </p>
          {adjustButtons.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {adjustButtons.map((btn) => (
                <button
                  key={btn.tab}
                  type="button"
                  onClick={() => onNavigateToTab?.(btn.tab)}
                  className="inline-flex min-h-11 items-center rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200 dark:hover:bg-red-900/70"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

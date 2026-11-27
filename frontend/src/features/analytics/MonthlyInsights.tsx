import { CalendarCheck2, Lock, Scale, TrendingUp } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { TabId } from '../../components/layout/BottomNav';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import type { BudgetTrendItem } from '../../services/analytics.service';
import type { EnvelopeItem, PeriodAnalytics, SavingsGoalItem, BudgetViewMode } from '../../types/budget.types';
import { formatFullDate } from '../../utils/format';
import { computeActiveAccountBalance } from '../../utils/activeBalance';
import { ExportActionsCard } from '../budget/ExportActionsCard';
import { ZeroBasedBanner, type ZeroBasedQuickActions } from '../budget/ZeroBasedBanner';
import type { DetectedAnomalyItem } from '../../services/transaction.service';
import { AnomalousExpensesCard } from './AnomalousExpensesCard';
import { AllocationDonutCard } from './AllocationDonut';
import { CashFlowSummaryCard } from './CashFlowSummaryCard';
import { DailyBudgetCard } from './DailyBudgetCard';
import { EnvelopeBreakdownCard } from './EnvelopeBreakdownCard';
import { EnvelopesAtRiskCard } from './EnvelopesAtRiskCard';
import { MemberBreakdownCard } from './MemberBreakdownCard';
import { MonthVsEnvelopesCard } from './MonthVsEnvelopesCard';
import { PaceProjectionCard } from './PaceProjectionCard';
import { SavingsHealthCard } from './SavingsHealthCard';
import { SharedActivityCard } from './SharedActivityCard';
import { TrendsCard } from './TrendsCard';

export type BudgetSubTab = 'essentiel' | 'pilotage' | 'tendances' | 'foyer';

export const BUDGET_SUBTAB_STORAGE_KEY = 'eparnio_budget_subtab';

function isValidSubTab(value: string | null, isSharedBudget: boolean): value is BudgetSubTab {
  if (value === 'essentiel' || value === 'pilotage' || value === 'tendances') {
    return true;
  }
  return value === 'foyer' && isSharedBudget;
}

function readStoredBudgetSubTab(isSharedBudget: boolean): BudgetSubTab {
  if (typeof window === 'undefined') {
    return 'essentiel';
  }
  try {
    const stored = window.sessionStorage.getItem(BUDGET_SUBTAB_STORAGE_KEY);
    return isValidSubTab(stored, isSharedBudget) ? stored : 'essentiel';
  } catch {
    return 'essentiel';
  }
}

function writeStoredBudgetSubTab(tab: BudgetSubTab): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(BUDGET_SUBTAB_STORAGE_KEY, tab);
  } catch {
    // Ignorer les erreurs de stockage en navigation privée restreinte.
  }
}

export interface MonthlyInsightsProps
  extends Pick<
    ZeroBasedQuickActions,
    'goals' | 'isAutoBalancing' | 'onAutoBalanceToEnvelope' | 'onAutoBalanceToGoal' | 'onNavigateToTab'
  > {
  analytics: PeriodAnalytics;
  envelopes?: EnvelopeItem[];
  trends?: BudgetTrendItem[];
  totalSavingsGoals?: number;
  emergencyFundAmount?: number;
  hasLiquidAssets?: boolean;
  currentUserId?: string;
  isPeriodClosed?: boolean;
  periodClosedAt?: string;
  onOpenMonthClosing?: () => void;
  onExportCsv?: () => Promise<string | void> | string | void;
  onExportPdf?: () => Promise<string | void> | string | void;
  onExportJson?: () => Promise<string | void> | string | void;
  onOpenCalculator?: () => void;
  onOpenCsvImport?: () => void;
  onOpenBalanceReconcile?: () => void;
  anomalies?: DetectedAnomalyItem[];
  onDismissAnomaly?: (transactionId: string) => void;
  budgetViewMode?: BudgetViewMode;
  onChangeBudgetViewMode?: (mode: BudgetViewMode) => void;
}

/**
 * Vue complète de l'onglet « Budget » sans FAB (+) :
 * Structurée en sous-onglets pilules accessibles (Essentiel / Pilotage / Tendances / Foyer)
 * mémorisés en session, avec garde-fou Base Zéro interactif.
 */
export function MonthlyInsights({
  analytics,
  envelopes = [],
  trends = [],
  totalSavingsGoals = 0,
  emergencyFundAmount,
  hasLiquidAssets = false,
  currentUserId,
  isPeriodClosed = false,
  periodClosedAt,
  onOpenMonthClosing,
  onExportCsv,
  onExportPdf,
  onExportJson,
  onOpenCalculator,
  onOpenCsvImport,
  onOpenBalanceReconcile,
  anomalies = [],
  onDismissAnomaly,
  budgetViewMode = 'essential',
  goals = [],
  isAutoBalancing = false,
  onAutoBalanceToEnvelope,
  onAutoBalanceToGoal,
  onNavigateToTab
}: MonthlyInsightsProps) {
  const isSharedBudget = analytics.budgetType === 'shared';
  const baseId = useId();
  const [activeSubTab, setActiveSubTab] = useState<BudgetSubTab>(() =>
    readStoredBudgetSubTab(isSharedBudget)
  );
  const tabRefs = useRef<Partial<Record<BudgetSubTab, HTMLButtonElement | null>>>({});

  const subTabs = useMemo<readonly { id: BudgetSubTab; label: string }[]>(
    () =>
      isSharedBudget
        ? [
            { id: 'essentiel', label: 'Essentiel' },
            { id: 'pilotage', label: 'Pilotage' },
            { id: 'tendances', label: 'Tendances' },
            { id: 'foyer', label: 'Foyer' }
          ]
        : [
            { id: 'essentiel', label: 'Essentiel' },
            { id: 'pilotage', label: 'Pilotage' },
            { id: 'tendances', label: 'Tendances' }
          ],
    [isSharedBudget]
  );

  const effectiveSubTab: BudgetSubTab =
    activeSubTab === 'foyer' && !isSharedBudget ? 'essentiel' : activeSubTab;

  useEffect(() => {
    if (!isSharedBudget && (activeSubTab === 'foyer' || readStoredBudgetSubTab(true) === 'foyer')) {
      if (activeSubTab === 'foyer') {
        setActiveSubTab('essentiel');
      }
      writeStoredBudgetSubTab('essentiel');
    }
  }, [activeSubTab, isSharedBudget]);

  const selectSubTab = (tab: BudgetSubTab, shouldFocus = false) => {
    setActiveSubTab(tab);
    writeStoredBudgetSubTab(tab);
    if (shouldFocus) {
      tabRefs.current[tab]?.focus();
    }
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const lastIndex = subTabs.length - 1;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') {
      nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = lastIndex;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      const targetTab = subTabs[nextIndex];
      if (targetTab) {
        selectSubTab(targetTab.id, true);
      }
    }
  };

  const variableEnvelopes = useMemo(
    () => envelopes.filter((item) => item.pillar === 'variable_envelope'),
    [envelopes]
  );

  const activeBalanceMetrics = useMemo(
    () =>
      envelopes.length > 0
        ? computeActiveAccountBalance(envelopes, analytics.cashFlow)
        : null,
    [envelopes, analytics.cashFlow]
  );

  const zeroBasedProps: {
    variableEnvelopes: EnvelopeItem[];
    goals: SavingsGoalItem[];
    isAutoBalancing: boolean;
    currentTab: TabId;
    onAutoBalanceToEnvelope?: (envelope: EnvelopeItem, amount: number) => Promise<void> | void;
    onAutoBalanceToGoal?: (goal: SavingsGoalItem, amount: number) => Promise<void> | void;
    onNavigateToTab?: (tab: TabId) => void;
  } = {
    variableEnvelopes,
    goals,
    isAutoBalancing,
    currentTab: 'budget',
    onAutoBalanceToEnvelope,
    onAutoBalanceToGoal,
    onNavigateToTab
  };

  return (
    <div className="space-y-4">
      {budgetViewMode === 'essential' ? (
        <div className="space-y-4">
          <CashFlowSummaryCard
            cashFlow={analytics.cashFlow}
            activeBalance={activeBalanceMetrics?.activeBalance}
            upcomingFixedCharges={activeBalanceMetrics?.upcomingFixedCharges}
          />

          <DailyBudgetCard dailyBudget={analytics.dailyBudget} />

          <ZeroBasedBanner
            remainingToAllocate={analytics.zeroBased.remainingToAllocate}
            plannedIncome={analytics.zeroBased.plannedIncome}
            {...zeroBasedProps}
          />

          <AllocationDonutCard allocation={analytics.allocation} />

          {isSharedBudget && (
            <div className="space-y-3">
              <MemberBreakdownCard
                members={analytics.memberBreakdown}
                currentUserId={currentUserId}
              />
              <SharedActivityCard envelopes={envelopes} />
              {onOpenCalculator ? (
                <Button type="button" variant="secondary" fullWidth onClick={onOpenCalculator}>
                  <Scale className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                  Calculateur 50/50 &amp; Prorata
                </Button>
              ) : null}
            </div>
          )}

          {isPeriodClosed ? (
            <Card className="border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/40">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
                  aria-hidden="true"
                >
                  <Lock className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                    Mois clôturé
                  </p>
                  <p className="text-xs text-emerald-800/85 dark:text-emerald-200/85">
                    {periodClosedAt
                      ? `Clôture enregistrée le ${formatFullDate(periodClosedAt)}.`
                      : 'Ce cycle a été clôturé et reconduit vers le mois suivant.'}
                  </p>
                </div>
              </div>
            </Card>
          ) : onOpenMonthClosing && analytics.dailyBudget.daysRemaining <= 5 ? (
            <Card className="space-y-3 border-violet-100 dark:border-violet-900/60">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
                  aria-hidden="true"
                >
                  <CalendarCheck2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
                    Clôture de fin de mois
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Faites le bilan, répartissez vos surplus et préparez le mois suivant.
                  </p>
                </div>
              </div>
              <Button type="button" variant="secondary" fullWidth onClick={onOpenMonthClosing}>
                <CalendarCheck2 className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                Clôturer le mois
              </Button>
            </Card>
          ) : null}
        </div>
      ) : (
        <>
      <div
        role="tablist"
        aria-label="Sections du budget"
        className={`grid gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/90 ${
          isSharedBudget ? 'grid-cols-4' : 'grid-cols-3'
        }`}
      >
        {subTabs.map((tab, index) => {
          const isSelected = effectiveSubTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              id={`${baseId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => selectSubTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={`min-h-11 rounded-xl px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] dark:focus-visible:ring-violet-400 ${
                isSelected
                  ? 'bg-white text-[#7C3AED] shadow-sm dark:bg-slate-900 dark:text-violet-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-50'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        id={`${baseId}-panel-${effectiveSubTab}`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${effectiveSubTab}`}
        className="space-y-4"
      >
        {effectiveSubTab === 'essentiel' && (
          <>
            <CashFlowSummaryCard
            cashFlow={analytics.cashFlow}
            activeBalance={activeBalanceMetrics?.activeBalance}
            upcomingFixedCharges={activeBalanceMetrics?.upcomingFixedCharges}
          />

            <DailyBudgetCard dailyBudget={analytics.dailyBudget} />

            <ZeroBasedBanner
              remainingToAllocate={analytics.zeroBased.remainingToAllocate}
              plannedIncome={analytics.zeroBased.plannedIncome}
              {...zeroBasedProps}
            />

            <AllocationDonutCard allocation={analytics.allocation} />

            {anomalies.length > 0 && onDismissAnomaly && (
              <AnomalousExpensesCard anomalies={anomalies} onDismiss={onDismissAnomaly} />
            )}

            {(onOpenCsvImport || onOpenBalanceReconcile) && (
              <Card className="space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Suivi bancaire manuel
                </p>
                <div className="flex flex-wrap gap-2">
                  {onOpenCsvImport && (
                    <Button type="button" variant="secondary" onClick={onOpenCsvImport}>
                      Importer un relevé CSV
                    </Button>
                  )}
                  {onOpenBalanceReconcile && (
                    <Button type="button" variant="secondary" onClick={onOpenBalanceReconcile}>
                      Réconcilier mon solde bancaire
                    </Button>
                  )}
                </div>
              </Card>
            )}

            {isPeriodClosed ? (
              <Card className="border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/40">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
                    aria-hidden="true"
                  >
                    <Lock className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                      Mois clôturé
                    </p>
                    <p className="text-xs text-emerald-800/85 dark:text-emerald-200/85">
                      {periodClosedAt
                        ? `Clôture enregistrée le ${formatFullDate(periodClosedAt)}.`
                        : 'Ce cycle a été clôturé et reconduit vers le mois suivant.'}
                    </p>
                  </div>
                </div>
              </Card>
            ) : onOpenMonthClosing ? (
              <Card className="space-y-3 border-violet-100 dark:border-violet-900/60">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
                    aria-hidden="true"
                  >
                    <CalendarCheck2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
                      Clôture de fin de mois
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Faites le bilan, répartissez vos surplus et préparez le mois suivant.
                    </p>
                  </div>
                </div>
                <Button type="button" variant="secondary" fullWidth onClick={onOpenMonthClosing}>
                  <CalendarCheck2 className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                  Clôturer le mois
                </Button>
              </Card>
            ) : null}

            <ExportActionsCard
              variant="card"
              onExportCsv={onExportCsv}
              onExportPdf={onExportPdf}
              onExportJson={onExportJson}
            />
          </>
        )}

        {effectiveSubTab === 'pilotage' && (
          <>
            <PaceProjectionCard
              remainingToLive={analytics.cashFlow.remainingToLive}
              spentVariables={analytics.cashFlow.spentVariables}
              remainingDays={analytics.dailyBudget.daysRemaining}
              startDate={analytics.dailyBudget.startDate}
            />

            <MonthVsEnvelopesCard
              totalDays={analytics.dailyBudget.totalDays}
              daysRemaining={analytics.dailyBudget.daysRemaining}
              spentVariables={analytics.cashFlow.spentVariables}
              plannedEnvelopes={analytics.cashFlow.plannedEnvelopes}
            />

            <EnvelopesAtRiskCard
              envelopes={envelopes}
              totalDays={analytics.dailyBudget.totalDays}
              daysRemaining={analytics.dailyBudget.daysRemaining}
            />

            <SavingsHealthCard
              plannedIncome={analytics.cashFlow.plannedIncome}
              plannedSavings={analytics.cashFlow.plannedSavings}
              plannedFixedCharges={analytics.cashFlow.plannedFixedCharges}
              totalSavingsGoals={totalSavingsGoals}
              emergencyFundAmount={emergencyFundAmount}
              hasLiquidAssets={hasLiquidAssets}
              ageOfMoney={analytics.ageOfMoney}
            />

            <EnvelopeBreakdownCard envelopes={envelopes} />
          </>
        )}

        {effectiveSubTab === 'tendances' &&
          (trends.length > 0 ? (
            <TrendsCard items={trends} />
          ) : (
            <Card className="space-y-2 py-8 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300">
                <TrendingUp className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                Évolution multi-mois
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Vos tendances apparaîtront dès que plusieurs mois budgétaires seront enregistrés.
              </p>
            </Card>
          ))}

        {effectiveSubTab === 'foyer' && isSharedBudget && (
          <div className="space-y-3">
            <MemberBreakdownCard
              members={analytics.memberBreakdown}
              currentUserId={currentUserId}
            />
            <SharedActivityCard envelopes={envelopes} />
            {onOpenCalculator ? (
              <Button type="button" variant="secondary" fullWidth onClick={onOpenCalculator}>
                <Scale className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                Calculateur 50/50 &amp; Prorata
              </Button>
            ) : null}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}

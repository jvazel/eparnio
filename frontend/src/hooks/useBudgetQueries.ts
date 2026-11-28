import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import type { TabId } from '../components/layout/BottomNav';
import { fetchBudgetTrends, getPeriodAnalytics, getTagsSummary } from '../services/analytics.service';
import { listBudgets } from '../services/budget.service';
import { listGoals } from '../services/goal.service';
import { fetchBudgetNetWorth } from '../services/netWorth.service';
import { getPeriodByMonth } from '../services/period.service';
import {
  getPeriodAnomalies,
  getTransactionSuggestions,
  listTransactions
} from '../services/transaction.service';
import { fetchBudgetWeeklyHabit } from '../services/weeklyHabit.service';
import type { BudgetPeriodSummary } from '../types/budget.types';
import { computeActiveAccountBalance } from '../utils/activeBalance';

const EMPTY_SUMMARY: BudgetPeriodSummary = {
  plannedIncome: 0,
  plannedFixedCharges: 0,
  plannedEnvelopes: 0,
  plannedSavings: 0,
  spentVariables: 0,
  remainingToAllocate: 0,
  remainingToLive: 0
};

export interface UseBudgetQueriesParams {
  canLoadApp: boolean;
  userId?: string;
  token: string | null;
  activeBudgetId: string | null;
  setActiveBudgetId: (id: string | null) => void;
  activeTab: TabId;
  referenceDate: Date;
  selectedEnvelopeId: string | null;
}

/**
 * Centralise toutes les requêtes TanStack Query et les sélecteurs dérivés d'Eparnio
 * (budgets, période active, enveloppes par pilier, objectifs, analyses, tendances, patrimoine,
 * anomalies, tags, point du dimanche et transactions de l'enveloppe sélectionnée).
 */
export function useBudgetQueries({
  canLoadApp,
  userId,
  token,
  activeBudgetId,
  setActiveBudgetId,
  activeTab,
  referenceDate,
  selectedEnvelopeId
}: UseBudgetQueriesParams) {
  const budgetsQuery = useQuery({
    queryKey: ['budgets', userId],
    queryFn: listBudgets,
    enabled: canLoadApp
  });

  const budgets = budgetsQuery.data ?? [];

  const activeBudget = useMemo(() => {
    if (budgets.length === 0) return null;
    return budgets.find((item) => item.id === activeBudgetId) ?? budgets[0] ?? null;
  }, [budgets, activeBudgetId]);

  const suggestionsQuery = useQuery({
    queryKey: ['transaction-suggestions', activeBudget?.id],
    queryFn: () => getTransactionSuggestions(activeBudget!.id),
    enabled: Boolean(canLoadApp && activeBudget?.id)
  });

  useEffect(() => {
    if (activeBudget && activeBudget.id !== activeBudgetId) {
      setActiveBudgetId(activeBudget.id);
    }
  }, [activeBudget, activeBudgetId, setActiveBudgetId]);

  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth() + 1;
  const periodQueryKey = useMemo(
    () =>
      [
        'period',
        activeBudget?.id ?? null,
        activeBudget?.budgetStartDay ?? 1,
        referenceYear,
        referenceMonth
      ] as const,
    [activeBudget?.id, activeBudget?.budgetStartDay, referenceYear, referenceMonth]
  );

  const periodQuery = useQuery({
    queryKey: periodQueryKey,
    queryFn: () => getPeriodByMonth(activeBudget!.id, referenceYear, referenceMonth),
    enabled: canLoadApp && Boolean(activeBudget?.id)
  });

  const activePeriod = periodQuery.data?.period ?? null;

  const anomaliesQuery = useQuery({
    queryKey: ['period-anomalies', activePeriod?.id],
    queryFn: () => getPeriodAnomalies(activePeriod!.id),
    enabled: Boolean(canLoadApp && activePeriod?.id)
  });

  const weeklyHabitQuery = useQuery({
    queryKey: ['weekly-habit', activeBudget?.id],
    queryFn: () => fetchBudgetWeeklyHabit(activeBudget!.id),
    enabled: Boolean(canLoadApp && activeBudget?.id)
  });

  const envelopes = periodQuery.data?.envelopes ?? [];
  const summary = activePeriod?.summary ?? EMPTY_SUMMARY;

  const activeBalanceMetrics = useMemo(
    () => computeActiveAccountBalance(envelopes, summary),
    [envelopes, summary]
  );

  const incomes = useMemo(
    () => envelopes.filter((item) => item.pillar === 'income'),
    [envelopes]
  );
  const fixedCharges = useMemo(
    () => envelopes.filter((item) => item.pillar === 'fixed_charge'),
    [envelopes]
  );
  const variableEnvelopes = useMemo(
    () => envelopes.filter((item) => item.pillar === 'variable_envelope'),
    [envelopes]
  );
  const savingsEnvelopes = useMemo(
    () => envelopes.filter((item) => item.pillar === 'savings'),
    [envelopes]
  );

  const goalsQueryKey = useMemo(
    () => ['goals', activeBudget?.id ?? null] as const,
    [activeBudget?.id]
  );

  const goalsQuery = useQuery({
    queryKey: goalsQueryKey,
    queryFn: () => listGoals(activeBudget!.id),
    enabled: canLoadApp && Boolean(activeBudget?.id)
  });

  const goals = goalsQuery.data?.goals ?? [];

  const analyticsQueryKey = useMemo(
    () => ['analytics', activePeriod?.id ?? null] as const,
    [activePeriod?.id]
  );

  const trendsQuery = useQuery({
    queryKey: ['trends', activeBudget?.id, 6],
    queryFn: () => fetchBudgetTrends(activeBudget!.id, 6),
    enabled: Boolean(token && activeBudget?.id && activeTab === 'budget')
  });

  const netWorthQuery = useQuery({
    queryKey: ['net-worth', activeBudget?.id],
    queryFn: () => fetchBudgetNetWorth(activeBudget!.id),
    enabled: Boolean(token && activeBudget?.id && activeTab === 'budget')
  });

  const tagsSummaryQuery = useQuery({
    queryKey: ['tags-summary', activeBudget?.id],
    queryFn: () => getTagsSummary(activeBudget!.id),
    enabled: Boolean(token && activeBudget?.id && activeTab === 'budget')
  });

  const analyticsQuery = useQuery({
    queryKey: analyticsQueryKey,
    queryFn: () => getPeriodAnalytics(activePeriod!.id),
    enabled: canLoadApp && Boolean(activePeriod?.id) && activeTab === 'budget'
  });

  const availableBudgetIds = useMemo(() => budgets.map((b) => b.id), [budgets]);

  const selectedEnvelope = useMemo(
    () => variableEnvelopes.find((item) => item.id === selectedEnvelopeId) ?? null,
    [variableEnvelopes, selectedEnvelopeId]
  );

  const envelopeTransactionsQueryKey = useMemo(
    () => ['transactions', activePeriod?.id ?? null, selectedEnvelope?.id ?? null] as const,
    [activePeriod?.id, selectedEnvelope?.id]
  );

  const envelopeTransactionsQuery = useQuery({
    queryKey: envelopeTransactionsQueryKey,
    queryFn: () => listTransactions(activePeriod!.id, selectedEnvelope!.id),
    enabled: canLoadApp && Boolean(activePeriod?.id && selectedEnvelope?.id)
  });

  const envelopeTransactions = envelopeTransactionsQuery.data?.transactions ?? [];

  return {
    budgetsQuery,
    budgets,
    activeBudget,
    availableBudgetIds,
    suggestionsQuery,
    referenceYear,
    referenceMonth,
    periodQueryKey,
    periodQuery,
    activePeriod,
    anomaliesQuery,
    weeklyHabitQuery,
    envelopes,
    summary,
    activeBalanceMetrics,
    incomes,
    fixedCharges,
    variableEnvelopes,
    savingsEnvelopes,
    goalsQueryKey,
    goalsQuery,
    goals,
    analyticsQueryKey,
    trendsQuery,
    netWorthQuery,
    tagsSummaryQuery,
    analyticsQuery,
    selectedEnvelope,
    envelopeTransactionsQueryKey,
    envelopeTransactionsQuery,
    envelopeTransactions
  };
}

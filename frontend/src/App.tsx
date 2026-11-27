import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { TabId } from './components/layout/BottomNav';
import { BudgetSwitcherOverlay } from './components/layout/BudgetSwitcher';
import { OfflineBanner } from './components/pwa/OfflineBanner';
import { PwaInstallBanner } from './components/pwa/PwaInstallBanner';
import { MobileShell } from './components/layout/MobileShell';
import { BottomSheet } from './components/ui/BottomSheet';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { MonthlyInsights } from './features/analytics/MonthlyInsights';
import { CheckingAccountCard } from './features/budget/CheckingAccountCard';
import { computeEmergencyFundAmount } from './features/analytics/SavingsHealthCard';
import { fetchBudgetNetWorth } from './services/netWorth.service';
import { StreakBadgeCard } from './features/analytics/StreakBadgeCard';
import { WeeklyRecapSheet } from './features/analytics/WeeklyRecapSheet';
import { WeeklyDigestCard } from './features/analytics/WeeklyDigestCard';
import { WeeklyDigestSheet } from './features/analytics/WeeklyDigestSheet';
import { HabitMilestonesCard } from './features/analytics/HabitMilestonesCard';
import { fetchBudgetWeeklyHabit } from './services/weeklyHabit.service';
import { getTagsSummary, fetchBudgetStreak } from './services/analytics.service';
import { TagAnalyticsCard } from './features/analytics/TagAnalyticsCard';
import { QuickAddExpenseSheet } from './features/transactions/QuickAddExpenseSheet';
import { createQuickTemplate, deleteQuickTemplate } from './services/budget.service';
import {
  dismissTransactionAnomaly,
  getPeriodAnomalies,
  getTransactionSuggestions,
  splitTransaction
} from './services/transaction.service';
import { AuthScreen } from './features/auth/AuthScreen';
import { CreationFormModal } from './features/budget/CreationFormModal';
import type { GlobalSearchItem } from './services/search.service';
import { EnvelopesList } from './features/budget/EnvelopesList';
import { FixedChargesList } from './features/budget/FixedChargesList';
import { IncomeList } from './features/budget/IncomeList';
import type { ZeroBasedQuickActions } from './features/budget/ZeroBasedBanner';
import { AddExpenseSheet, type AddExpensePayload } from './features/transactions/AddExpenseSheet';
import { EnvelopeDetailPage } from './features/transactions/EnvelopeDetailPage';
import {
  GoalContributionSheet,
  GoalFormSheet,
  GoalWithdrawalSheet
} from './features/savings/GoalDetailSheet';
import { SavingsGoalsList } from './features/savings/SavingsGoalsList';

const BudgetCalendarView = lazy(() =>
  import('./features/budget/BudgetCalendarView').then((m) => ({ default: m.BudgetCalendarView }))
);
const BudgetPatrimoineView = lazy(() =>
  import('./features/budget/BudgetPatrimoineView').then((m) => ({
    default: m.BudgetPatrimoineView
  }))
);
const WhatIfSimulatorSheet = lazy(() =>
  import('./features/budget/WhatIfSimulatorSheet').then((m) => ({
    default: m.WhatIfSimulatorSheet
  }))
);
const WrappedModal = lazy(() =>
  import('./features/budget/WrappedModal').then((m) => ({ default: m.WrappedModal }))
);
const TagDetailModal = lazy(() =>
  import('./features/analytics/TagDetailModal').then((m) => ({ default: m.TagDetailModal }))
);
const BalanceReconcileSheet = lazy(() =>
  import('./features/budget/BalanceReconcileSheet').then((m) => ({
    default: m.BalanceReconcileSheet
  }))
);
const CsvImportSheet = lazy(() =>
  import('./features/transactions/CsvImportSheet').then((m) => ({ default: m.CsvImportSheet }))
);
const OnboardingWizard = lazy(() =>
  import('./features/auth/OnboardingWizard').then((m) => ({ default: m.OnboardingWizard }))
);
const ProfileSheet = lazy(() =>
  import('./features/auth/ProfileSheet').then((m) => ({ default: m.ProfileSheet }))
);
const BudgetSettingsSheet = lazy(() =>
  import('./features/budget/BudgetSettingsSheet').then((m) => ({ default: m.BudgetSettingsSheet }))
);
const GlobalSearchModal = lazy(() =>
  import('./features/budget/GlobalSearchModal').then((m) => ({ default: m.GlobalSearchModal }))
);
const MonthClosingWizard = lazy(() =>
  import('./features/budget/MonthClosingWizard').then((m) => ({ default: m.MonthClosingWizard }))
);
const ContributionCalculatorSheet = lazy(() =>
  import('./features/shared-budget/ContributionCalculatorSheet').then((m) => ({
    default: m.ContributionCalculatorSheet
  }))
);
const InvitePartnerSheet = lazy(() =>
  import('./features/shared-budget/InvitePartnerSheet').then((m) => ({
    default: m.InvitePartnerSheet
  }))
);
import {
  buildClientPeriodAnalytics,
  fetchBudgetTrends,
  getPeriodAnalytics
} from './services/analytics.service';
import {
  extractInviteCodeFromInput,
  generateBudgetInvite,
  listBudgets
} from './services/budget.service';
import {
  createEnvelope,
  type CreateEnvelopePayload,
  deleteEnvelope,
  reorderEnvelopes,
  updateEnvelope,
  type UpdateEnvelopePayload
} from './services/envelope.service';
import {
  createGoal,
  type CreateGoalPayload,
  createGoalWithdrawal,
  type CreateGoalWithdrawalPayload,
  deleteGoal,
  deleteGoalWithdrawal,
  listGoals,
  updateGoal,
  updateGoalWithdrawal
} from './services/goal.service';
import {
  closePeriod,
  type ClosePeriodPayload,
  getPeriodByMonth,
  syncRecurringFromPrevious
} from './services/period.service';
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
  type UpdateTransactionPayload
} from './services/transaction.service';
import { useAuthStore } from './store/useAuthStore';
import { useBudgetStore } from './store/useBudgetStore';
import type {
  GoalsListResponse,
  PeriodWithEnvelopesResponse,
  TransactionsListResponse
} from './types/api.types';
import type {
  BudgetPeriod,
  BudgetPeriodSummary,
  BudgetSpace,
  EnvelopeItem,
  SavingsGoalItem,
  SavingsWithdrawalItem,
  TransactionItem
} from './types/budget.types';
import {
  downloadBudgetCsv,
  downloadBudgetJsonBackup,
  downloadPeriodPdfReport
} from './utils/exportReport';
import { formatMonthLabel } from './utils/format';

interface TabMetadata {
  title: string;
  description: string;
  addTitle: string;
  gaugeLabel?: string;
}

const TAB_CONFIG: Record<TabId, TabMetadata> = {
  revenus: {
    title: 'Revenus',
    description:
      'Recensez toutes vos entrées d’argent du mois (salaires, primes, aides ou apports communs).',
    addTitle: 'Ajouter un revenu'
  },
  depenses: {
    title: 'Dépenses fixes',
    description:
      'Regroupez vos charges mensuelles récurrentes, abonnements et mensualités de crédits.',
    addTitle: 'Ajouter une dépense fixe',
    gaugeLabel: 'Reste à dépenser'
  },
  enveloppes: {
    title: 'Dépenses variables',
    description:
      'Allouez un plafond à vos enveloppes du quotidien (courses, sorties, loisirs) et suivez le restant.',
    addTitle: 'Ajouter une enveloppe',
    gaugeLabel: 'Reste dans les enveloppes'
  },
  epargne: {
    title: 'Epargne',
    description:
      'Suivez vos cagnottes et versements mensuels vers vos projets et votre matelas de sécurité.',
    addTitle: 'Ajouter un objectif d’épargne'
  },
  budget: {
    title: 'Budget',
    description:
      'Vue d’ensemble Base Zéro : revenus, dépenses fixes, enveloppes variables, épargne et reste quotidien.',
    addTitle: ''
  }
};

const EMPTY_SUMMARY: BudgetPeriodSummary = {
  plannedIncome: 0,
  plannedFixedCharges: 0,
  plannedEnvelopes: 0,
  plannedSavings: 0,
  spentVariables: 0,
  remainingToAllocate: 0,
  remainingToLive: 0
};

export function App() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const activeBudgetId = useBudgetStore((state) => state.activeBudgetId);
  const setActiveBudgetId = useBudgetStore((state) => state.setActiveBudgetId);

  const activeTheme = user?.preferences?.theme ?? 'light';
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', activeTheme === 'dark');
    root.style.colorScheme = activeTheme;
  }, [activeTheme]);

  const [budgetSubView, setBudgetSubView] = useState<'synthese' | 'calendrier' | 'patrimoine'>('synthese');
  const [isWhatIfOpen, setIsWhatIfOpen] = useState(false);
  const [isWrappedOpen, setIsWrappedOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);
  const [activeTab, setActiveTab] = useState<TabId>(
    () => user?.preferences?.defaultTab ?? 'depenses'
  );
  const [isQuickAddExpenseOpen, setIsQuickAddExpenseOpen] = useState(false);
  const [referenceDate, setReferenceDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [editorState, setEditorState] = useState<{
    isOpen: boolean;
    pillar: 'income' | 'fixed_charge' | 'variable_envelope';
    item: EnvelopeItem | null;
  }>({
    isOpen: false,
    pillar: 'fixed_charge',
    item: null
  });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState<string | null>(null);
  const [expenseEditorState, setExpenseEditorState] = useState<{
    isOpen: boolean;
    transaction: TransactionItem | null;
  }>({
    isOpen: false,
    transaction: null
  });
  const [goalFormState, setGoalFormState] = useState<{
    isOpen: boolean;
    goal: SavingsGoalItem | null;
  }>({
    isOpen: false,
    goal: null
  });
  const [contributionState, setContributionState] = useState<{
    isOpen: boolean;
    goal: SavingsGoalItem | null;
    envelope: EnvelopeItem | null;
  }>({
    isOpen: false,
    goal: null,
    envelope: null
  });
  const [withdrawalState, setWithdrawalState] = useState<{
    isOpen: boolean;
    goal: SavingsGoalItem | null;
    withdrawal: SavingsWithdrawalItem | null;
  }>({
    isOpen: false,
    goal: null,
    withdrawal: null
  });
  const [isPlaceholderAddOpen, setIsPlaceholderAddOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [settingsState, setSettingsState] = useState<{
    isOpen: boolean;
    mode: 'edit' | 'create';
    budget: BudgetSpace | null;
  }>({
    isOpen: false,
    mode: 'edit',
    budget: null
  });
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [joinInitialCode, setJoinInitialCode] = useState('');
  const [calculatorBudget, setCalculatorBudget] = useState<BudgetSpace | null>(null);
  const [isClosingWizardOpen, setIsClosingWizardOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [isBalanceReconcileOpen, setIsBalanceReconcileOpen] = useState(false);
  const [isWeeklyRecapOpen, setIsWeeklyRecapOpen] = useState(false);
  const [isWeeklyDigestOpen, setIsWeeklyDigestOpen] = useState(false);

  const canLoadApp = Boolean(isAuthenticated && user && token && user.hasCompletedOnboarding);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const inviteParam = params.get('invite');
    if (inviteParam) {
      const clean = extractInviteCodeFromInput(inviteParam);
      if (clean) {
        sessionStorage.setItem('eparnio_pending_invite', clean);
        setJoinInitialCode(clean);
      }
      params.delete('invite');
      const nextSearch = params.toString();
      const cleanUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', cleanUrl);
    } else {
      const stored = sessionStorage.getItem('eparnio_pending_invite');
      if (stored) {
        setJoinInitialCode(stored);
      }
    }
  }, []);

  useEffect(() => {
    if (canLoadApp && joinInitialCode) {
      setIsJoinOpen(true);
    }
  }, [canLoadApp, joinInitialCode]);

  const budgetsQuery = useQuery({
    queryKey: ['budgets', user?.id],
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

  useEffect(() => {
    if (user?.preferences?.theme) {
      document.documentElement.dataset.theme = user.preferences.theme;
    }
  }, [user?.preferences?.theme]);

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

  const streakQuery = useQuery({
    queryKey: ['budget-streak', activeBudget?.id],
    queryFn: async () => {
      // fetchBudgetStreak importé statiquement
      return fetchBudgetStreak(activeBudget!.id);
    },
    enabled: Boolean(token && activeBudget?.id && activeTab === 'budget')
  });

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

  const syncGoalCache = (goal?: SavingsGoalItem) => {
    if (!goal) return;
    queryClient.setQueryData<GoalsListResponse>(goalsQueryKey, (current) => {
      if (!current) {
        return { status: 'ok', goals: [goal] };
      }
      const exists = current.goals.some((item) => item.id === goal.id);
      return {
        status: 'ok',
        goals: exists
          ? current.goals.map((item) => (item.id === goal.id ? goal : item))
          : [...current.goals, goal]
      };
    });
    if (goal.assetAccountId) {
      void queryClient.invalidateQueries({ queryKey: ['net-worth'] });
    }
  };

  const syncEnvelopeAndPeriodCache = (
    envelope: EnvelopeItem,
    period: BudgetPeriod,
    goal?: SavingsGoalItem
  ) => {
    queryClient.setQueryData<PeriodWithEnvelopesResponse>(periodQueryKey, (current) => {
      if (!current) return current;
      return {
        status: 'ok',
        period,
        envelopes: current.envelopes.map((item) =>
          item.id === envelope.id ? envelope : item
        )
      };
    });
    syncGoalCache(goal);
    void queryClient.invalidateQueries({ queryKey: ['analytics'] });
  };

  const createEnvelopeMutation = useMutation({
    mutationFn: ({
      periodId,
      payload
    }: {
      periodId: string;
      payload: CreateEnvelopePayload;
    }) => createEnvelope(periodId, payload),
    onSuccess: (response) => {
      queryClient.setQueryData<PeriodWithEnvelopesResponse>(periodQueryKey, (current) => {
        if (!current) {
          return {
            status: 'ok',
            period: response.period,
            envelopes: [response.envelope]
          };
        }
        return {
          status: 'ok',
          period: response.period,
          envelopes: [...current.envelopes, response.envelope]
        };
      });
      syncGoalCache(response.goal);
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    }
  });

  const updateEnvelopeMutation = useMutation({
    mutationFn: ({
      periodId,
      envelopeId,
      payload
    }: {
      periodId: string;
      envelopeId: string;
      payload: UpdateEnvelopePayload;
    }) => updateEnvelope(periodId, envelopeId, payload),
    onSuccess: (response) => {
      queryClient.setQueryData<PeriodWithEnvelopesResponse>(periodQueryKey, (current) => {
        if (!current) return current;
        return {
          status: 'ok',
          period: response.period,
          envelopes: current.envelopes.map((item) =>
            item.id === response.envelope.id ? response.envelope : item
          )
        };
      });
      syncGoalCache(response.goal);
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    }
  });

  const deleteEnvelopeMutation = useMutation({
    mutationFn: ({ periodId, envelopeId }: { periodId: string; envelopeId: string }) =>
      deleteEnvelope(periodId, envelopeId),
    onSuccess: (response) => {
      queryClient.setQueryData<PeriodWithEnvelopesResponse>(periodQueryKey, (current) => {
        if (!current) return current;
        return {
          status: 'ok',
          period: response.period,
          envelopes: current.envelopes.filter((item) => item.id !== response.deletedId)
        };
      });
      if (selectedEnvelopeId === response.deletedId) {
        setSelectedEnvelopeId(null);
      }
      queryClient.removeQueries({
        queryKey: ['transactions', response.period.id, response.deletedId]
      });
      syncGoalCache(response.goal);
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    }
  });

  const createGoalMutation = useMutation({
    mutationFn: ({ budgetId, payload }: { budgetId: string; payload: CreateGoalPayload }) =>
      createGoal(budgetId, payload),
    onSuccess: (response) => {
      syncGoalCache(response.goal);
    }
  });

  const updateGoalMutation = useMutation({
    mutationFn: ({
      budgetId,
      goalId,
      payload
    }: {
      budgetId: string;
      goalId: string;
      payload: CreateGoalPayload;
    }) => updateGoal(budgetId, goalId, payload),
    onSuccess: (response) => {
      syncGoalCache(response.goal);
    }
  });

  const deleteGoalMutation = useMutation({
    mutationFn: ({ budgetId, goalId }: { budgetId: string; goalId: string }) =>
      deleteGoal(budgetId, goalId),
    onSuccess: (response) => {
      queryClient.setQueryData<GoalsListResponse>(goalsQueryKey, (current) => {
        if (!current) return current;
        return {
          status: 'ok',
          goals: current.goals.filter((item) => item.id !== response.deletedId)
        };
      });
      void queryClient.invalidateQueries({ queryKey: ['period'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    }
  });

  const createGoalWithdrawalMutation = useMutation({
    mutationFn: ({
      budgetId,
      goalId,
      payload
    }: {
      budgetId: string;
      goalId: string;
      payload: CreateGoalWithdrawalPayload;
    }) => createGoalWithdrawal(budgetId, goalId, payload),
    onSuccess: (response) => {
      syncGoalCache(response.goal);
    }
  });

  const updateGoalWithdrawalMutation = useMutation({
    mutationFn: ({
      budgetId,
      goalId,
      withdrawalId,
      payload
    }: {
      budgetId: string;
      goalId: string;
      withdrawalId: string;
      payload: CreateGoalWithdrawalPayload;
    }) => updateGoalWithdrawal(budgetId, goalId, withdrawalId, payload),
    onSuccess: (response) => {
      syncGoalCache(response.goal);
    }
  });

  const deleteGoalWithdrawalMutation = useMutation({
    mutationFn: ({
      budgetId,
      goalId,
      withdrawalId
    }: {
      budgetId: string;
      goalId: string;
      withdrawalId: string;
    }) => deleteGoalWithdrawal(budgetId, goalId, withdrawalId),
    onSuccess: (response) => {
      syncGoalCache(response.goal);
    }
  });

  const createTransactionMutation = useMutation({
    mutationFn: ({ periodId, payload }: { periodId: string; payload: AddExpensePayload }) =>
      createTransaction(periodId, payload),
    onSuccess: (response) => {
      syncEnvelopeAndPeriodCache(response.envelope, response.period, response.goal);
      queryClient.setQueryData<TransactionsListResponse>(
        ['transactions', response.period.id, response.envelope.id],
        (current) => ({
          status: 'ok',
          transactions: current
            ? [response.transaction, ...current.transactions]
            : [response.transaction]
        })
      );
    }
  });

  const updateTransactionMutation = useMutation({
    mutationFn: ({
      periodId,
      transactionId,
      payload
    }: {
      periodId: string;
      transactionId: string;
      payload: UpdateTransactionPayload;
    }) => updateTransaction(periodId, transactionId, payload),
    onSuccess: (response) => {
      syncEnvelopeAndPeriodCache(response.envelope, response.period, response.goal);
      queryClient.setQueryData<TransactionsListResponse>(
        ['transactions', response.period.id, response.envelope.id],
        (current) => {
          if (!current) return current;
          return {
            status: 'ok',
            transactions: current.transactions.map((item) =>
              item.id === response.transaction.id ? response.transaction : item
            )
          };
        }
      );
    }
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: ({ periodId, transactionId }: { periodId: string; transactionId: string }) =>
      deleteTransaction(periodId, transactionId),
    onSuccess: (response) => {
      syncEnvelopeAndPeriodCache(response.envelope, response.period, response.goal);
      queryClient.setQueryData<TransactionsListResponse>(
        ['transactions', response.period.id, response.envelope.id],
        (current) => {
          if (!current) return current;
          return {
            status: 'ok',
            transactions: current.transactions.filter((item) => item.id !== response.deletedId)
          };
        }
      );
    }
  });

  const reorderMutation = useMutation({
    mutationFn: ({ periodId, orderedIds }: { periodId: string; orderedIds: string[] }) =>
      reorderEnvelopes(periodId, orderedIds),
    onSuccess: (response) => {
      queryClient.setQueryData<PeriodWithEnvelopesResponse>(periodQueryKey, (current) => {
        if (!current) return current;
        const updatedMap = new Map(response.envelopes.map((item) => [item.id, item]));
        return {
          ...current,
          envelopes: current.envelopes.map((item) => updatedMap.get(item.id) ?? item)
        };
      });
    }
  });

  const closePeriodMutation = useMutation({
    mutationFn: ({
      budgetId,
      periodId,
      payload
    }: {
      budgetId: string;
      periodId: string;
      payload: ClosePeriodPayload;
    }) => closePeriod(budgetId, periodId, payload),
    onSuccess: (response) => {
      for (const goal of response.updatedGoals) {
        syncGoalCache(goal);
      }
      queryClient.setQueryData<PeriodWithEnvelopesResponse>(
        [
          'period',
          response.nextPeriod.budgetId,
          activeBudget?.budgetStartDay ?? 1,
          response.nextPeriod.year,
          response.nextPeriod.month
        ],
        {
          status: 'ok',
          period: response.nextPeriod,
          envelopes: response.nextEnvelopes
        }
      );
      void queryClient.invalidateQueries({ queryKey: ['period'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
      void queryClient.invalidateQueries({ queryKey: ['trends'] });
      void queryClient.invalidateQueries({ queryKey: ['goals'] });
      setIsClosingWizardOpen(false);
      setSelectedEnvelopeId(null);
      setReferenceDate(new Date(response.nextPeriod.year, response.nextPeriod.month - 1, 1));
    }
  });

  const periodLabel = useMemo(() => formatMonthLabel(referenceDate), [referenceDate]);
  const defaultEntryDate = useMemo(() => {
    const now = new Date();
    const isCurrentCalendarMonth =
      referenceYear === now.getFullYear() && referenceMonth === now.getMonth() + 1;
    const day = isCurrentCalendarMonth ? String(now.getDate()).padStart(2, '0') : '01';
    return `${referenceYear}-${String(referenceMonth).padStart(2, '0')}-${day}`;
  }, [referenceYear, referenceMonth]);
  const currentConfig = TAB_CONFIG[activeTab];

  if (!isAuthenticated || !user || !token) {
    return <AuthScreen />;
  }

  if (!user.hasCompletedOnboarding) {
    return (
      <Suspense fallback={null}>
        <OnboardingWizard />
      </Suspense>
    );
  }

  const handlePreviousPeriod = () => {
    setSelectedEnvelopeId(null);
    setReferenceDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextPeriod = () => {
    setSelectedEnvelopeId(null);
    setReferenceDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleQuickAdd = () => {
    if (activeTab === 'revenus') {
      setEditorState({ isOpen: true, pillar: 'income', item: null });
      return;
    }
    if (activeTab === 'depenses') {
      setEditorState({ isOpen: true, pillar: 'fixed_charge', item: null });
      return;
    }
    if (activeTab === 'enveloppes') {
      setEditorState({ isOpen: true, pillar: 'variable_envelope', item: null });
      return;
    }
    if (activeTab === 'epargne') {
      setGoalFormState({ isOpen: true, goal: null });
      return;
    }
    setIsPlaceholderAddOpen(true);
  };

  const handleSaveGoal = async (payload: CreateGoalPayload) => {
    if (!activeBudget) {
      throw new Error('Espace budgétaire introuvable, réessayez dans un instant.');
    }

    if (goalFormState.goal) {
      await updateGoalMutation.mutateAsync({
        budgetId: activeBudget.id,
        goalId: goalFormState.goal.id,
        payload
      });
      return;
    }

    await createGoalMutation.mutateAsync({
      budgetId: activeBudget.id,
      payload
    });
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!activeBudget) return;
    await deleteGoalMutation.mutateAsync({
      budgetId: activeBudget.id,
      goalId
    });
  };

  const handleSaveWithdrawal = async (payload: CreateGoalWithdrawalPayload) => {
    if (!activeBudget || !withdrawalState.goal) {
      throw new Error('Espace budgétaire introuvable, réessayez dans un instant.');
    }

    if (withdrawalState.withdrawal) {
      await updateGoalWithdrawalMutation.mutateAsync({
        budgetId: activeBudget.id,
        goalId: withdrawalState.goal.id,
        withdrawalId: withdrawalState.withdrawal.id,
        payload
      });
      return;
    }

    await createGoalWithdrawalMutation.mutateAsync({
      budgetId: activeBudget.id,
      goalId: withdrawalState.goal.id,
      payload
    });
  };

  const handleDeleteWithdrawal = async (goalId: string, withdrawalId: string) => {
    if (!activeBudget) return;
    await deleteGoalWithdrawalMutation.mutateAsync({
      budgetId: activeBudget.id,
      goalId,
      withdrawalId
    });
  };

  const handleSaveContribution = async (payload: CreateEnvelopePayload) => {
    let targetPeriodId = activePeriod?.id;
    if (!targetPeriodId && activeBudget) {
      const ensured = await periodQuery.refetch();
      targetPeriodId = ensured.data?.period.id;
    }
    if (!targetPeriodId) {
      throw new Error('Période budgétaire en cours de chargement, réessayez dans un instant.');
    }

    if (contributionState.envelope) {
      await updateEnvelopeMutation.mutateAsync({
        periodId: targetPeriodId,
        envelopeId: contributionState.envelope.id,
        payload
      });
      return;
    }

    await createEnvelopeMutation.mutateAsync({
      periodId: targetPeriodId,
      payload
    });
  };

  const handleSaveExpense = async (payload: AddExpensePayload) => {
    if (!activePeriod) {
      throw new Error('Période budgétaire en cours de chargement, réessayez dans un instant.');
    }

    if (expenseEditorState.transaction) {
      await updateTransactionMutation.mutateAsync({
        periodId: activePeriod.id,
        transactionId: expenseEditorState.transaction.id,
        payload
      });
      return;
    }

    await createTransactionMutation.mutateAsync({
      periodId: activePeriod.id,
      payload
    });
  };

  const handleDeleteExpense = async (transactionId: string) => {
    if (!activePeriod) return;
    await deleteTransactionMutation.mutateAsync({
      periodId: activePeriod.id,
      transactionId
    });
  };

  const handleSaveEnvelope = async (payload: CreateEnvelopePayload) => {
    let targetPeriodId = activePeriod?.id;
    if (!targetPeriodId && activeBudget) {
      const ensured = await periodQuery.refetch();
      targetPeriodId = ensured.data?.period.id;
    }
    if (!targetPeriodId) {
      throw new Error('Période budgétaire en cours de chargement, réessayez dans un instant.');
    }

    if (editorState.item) {
      await updateEnvelopeMutation.mutateAsync({
        periodId: targetPeriodId,
        envelopeId: editorState.item.id,
        payload
      });
      return;
    }

    await createEnvelopeMutation.mutateAsync({
      periodId: targetPeriodId,
      payload
    });
  };

  const handleDeleteById = async (envelopeId: string) => {
    if (!activePeriod) return;
    await deleteEnvelopeMutation.mutateAsync({
      periodId: activePeriod.id,
      envelopeId
    });
  };

  const handleTogglePaid = (item: EnvelopeItem) => {
    if (!activePeriod) return;
    updateEnvelopeMutation.mutate({
      periodId: activePeriod.id,
      envelopeId: item.id,
      payload: { isPaid: !item.isPaid }
    });
  };

  const handleReorder = (orderedIds: string[]) => {
    if (!activePeriod) return;
    reorderMutation.mutate({
      periodId: activePeriod.id,
      orderedIds
    });
  };

  const isMutating =
    createEnvelopeMutation.isPending ||
    updateEnvelopeMutation.isPending ||
    deleteEnvelopeMutation.isPending ||
    createGoalMutation.isPending ||
    updateGoalMutation.isPending ||
    deleteGoalMutation.isPending ||
    createGoalWithdrawalMutation.isPending ||
    updateGoalWithdrawalMutation.isPending ||
    deleteGoalWithdrawalMutation.isPending ||
    createTransactionMutation.isPending ||
    updateTransactionMutation.isPending ||
    deleteTransactionMutation.isPending;

  const handleAutoBalanceToEnvelope = async (envelope: EnvelopeItem, amount: number) => {
    if (!activePeriod || amount <= 0) return;
    const nextAllocatedAmount = Math.round((envelope.allocatedAmount + amount) * 100) / 100;
    await updateEnvelopeMutation.mutateAsync({
      periodId: activePeriod.id,
      envelopeId: envelope.id,
      payload: { allocatedAmount: nextAllocatedAmount }
    });
  };

  const handleAutoBalanceToGoal = async (goal: SavingsGoalItem, amount: number) => {
    if (!activePeriod || amount <= 0) return;
    const roundedAmount = Math.round(amount * 100) / 100;
    await createEnvelopeMutation.mutateAsync({
      periodId: activePeriod.id,
      payload: {
        pillar: 'savings',
        linkedGoalId: goal.id,
        name: `Équilibrage ${goal.name}`.slice(0, 80),
        icon: goal.icon,
        color: goal.color,
        allocatedAmount: roundedAmount,
        date: new Date(`${defaultEntryDate}T12:00:00.000Z`).toISOString(),
        isRecurring: false,
        isPaid: true,
        memberId: activeBudget?.type === 'shared' ? user.id : undefined
      }
    });
  };

  const zeroBasedActions: ZeroBasedQuickActions = {
    variableEnvelopes,
    goals,
    isAutoBalancing: isMutating,
    currentTab: activeTab,
    onAutoBalanceToEnvelope: handleAutoBalanceToEnvelope,
    onAutoBalanceToGoal: handleAutoBalanceToGoal,
    onNavigateToTab: setActiveTab
  };

  const renderTabContent = () => {
    if (periodQuery.isError && !activePeriod) {
      return (
        <Card className="space-y-3 text-center">
          <p className="text-sm font-semibold text-red-600">
            Impossible de charger cette période budgétaire.
          </p>
          <Button variant="secondary" onClick={() => periodQuery.refetch()}>
            Réessayer
          </Button>
        </Card>
      );
    }

    if (activeTab === 'revenus') {
      return (
        <IncomeList
          items={incomes}
          summary={summary}
          onAddIncome={() => setEditorState({ isOpen: true, pillar: 'income', item: null })}
          onEditIncome={(item) => setEditorState({ isOpen: true, pillar: 'income', item })}
          onTogglePaid={handleTogglePaid}
          onReorder={handleReorder}
          onDeleteIncome={(item) => handleDeleteById(item.id)}
          zeroBasedActions={zeroBasedActions}
        />
      );
    }

    if (activeTab === 'depenses') {
      return (
        <FixedChargesList
          items={fixedCharges}
          summary={summary}
          onAddFixedCharge={() =>
            setEditorState({ isOpen: true, pillar: 'fixed_charge', item: null })
          }
          onEditFixedCharge={(item) =>
            setEditorState({ isOpen: true, pillar: 'fixed_charge', item })
          }
          onTogglePaid={handleTogglePaid}
          onReorder={handleReorder}
          onDeleteFixedCharge={(item) => handleDeleteById(item.id)}
          onSyncRecurring={async () => {
            if (!activeBudget || !activePeriod) return;
            await syncRecurringFromPrevious(activeBudget.id, activePeriod.id);
            await queryClient.invalidateQueries({ queryKey: periodQueryKey });
            await queryClient.invalidateQueries({ queryKey: analyticsQueryKey });
          }}
          zeroBasedActions={zeroBasedActions}
        />
      );
    }

    if (activeTab === 'enveloppes') {
      return (
        <EnvelopesList
          items={variableEnvelopes}
          summary={summary}
          onAddEnvelope={() =>
            setEditorState({ isOpen: true, pillar: 'variable_envelope', item: null })
          }
          onSelectEnvelope={(envelope) => setSelectedEnvelopeId(envelope.id)}
          zeroBasedActions={zeroBasedActions}
        />
      );
    }

    if (activeTab === 'epargne') {
      return (
        <SavingsGoalsList
          goals={goals}
          savingsEnvelopes={savingsEnvelopes}
          summary={summary}
          members={activeBudget?.members ?? []}
          currentUserId={user.id}
          isSharedBudget={activeBudget?.type === 'shared'}
          onAddGoal={() => setGoalFormState({ isOpen: true, goal: null })}
          onEditGoal={(goal) => setGoalFormState({ isOpen: true, goal })}
          onDeleteGoal={handleDeleteGoal}
          onAddContribution={(goal) =>
            setContributionState({ isOpen: true, goal, envelope: null })
          }
          onEditContribution={(goal, envelope) =>
            setContributionState({ isOpen: true, goal, envelope })
          }
          onDeleteContribution={handleDeleteById}
          onAddWithdrawal={(goal) =>
            setWithdrawalState({ isOpen: true, goal, withdrawal: null })
          }
          onEditWithdrawal={(goal, withdrawal) =>
            setWithdrawalState({ isOpen: true, goal, withdrawal })
          }
          onDeleteWithdrawal={handleDeleteWithdrawal}
          zeroBasedActions={zeroBasedActions}
        />
      );
    }

    const fallbackPeriod: BudgetPeriod = activePeriod ?? {
      id: 'period-fallback',
      budgetId: activeBudget?.id ?? 'budget-fallback',
      year: referenceYear,
      month: referenceMonth,
      label: periodLabel,
      startDate: new Date(Date.UTC(referenceYear, referenceMonth - 1, 1)).toISOString(),
      endDate: new Date(Date.UTC(referenceYear, referenceMonth, 0, 23, 59, 59, 999)).toISOString(),
      summary: EMPTY_SUMMARY
    };

    const resolvedAnalytics =
      analyticsQuery.data?.analytics ??
      buildClientPeriodAnalytics(fallbackPeriod, envelopes, activeBudget, user);

    return (
      <div className="space-y-4">
        {/* Switcher segmenté Synthèse | Calendrier */}
        <div className="bg-slate-200/70 dark:bg-slate-800 p-1 rounded-2xl flex items-center gap-1">
          <button
            type="button"
            onClick={() => setBudgetSubView('synthese')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
              budgetSubView === 'synthese'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Synthèse
          </button>
          <button
            type="button"
            onClick={() => setBudgetSubView('calendrier')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
              budgetSubView === 'calendrier'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Calendrier
          </button>
          <button
            type="button"
            onClick={() => setBudgetSubView('patrimoine')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
              budgetSubView === 'patrimoine'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Patrimoine
          </button>
        </div>

        {activePeriod && (user.preferences?.budgetViewMode ?? 'essential') === 'advanced' && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsWhatIfOpen(true)}
              className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 text-white text-xs font-semibold shadow-sm flex items-center justify-center gap-1.5"
            >
              <span>✨</span>
              <span>Simuler un achat</span>
            </button>
            <button
              type="button"
              onClick={() => setIsWrappedOpen(true)}
              className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white text-xs font-semibold shadow-sm flex items-center justify-center gap-1.5"
            >
              <span>🎉</span>
              <span>Bilan annuel</span>
            </button>
          </div>
        )}

        {budgetSubView === 'patrimoine' && activeBudget ? (
          <BudgetPatrimoineView
            budgetId={activeBudget.id}
            activePeriodId={activePeriod?.id}
            goals={goals}
          />
        ) : budgetSubView === 'calendrier' && activePeriod ? (
          <BudgetCalendarView
            periodId={activePeriod.id}
            onAddExpenseOnDay={() => setActiveTab('enveloppes')}
          />
        ) : (
          <>
          {weeklyHabitQuery.data?.digest ? (
            <WeeklyDigestCard
              digest={weeklyHabitQuery.data.digest}
              onOpenDigest={() => setIsWeeklyDigestOpen(true)}
            />
          ) : null}
          {streakQuery.data ? (
            <StreakBadgeCard
              streak={streakQuery.data}
              onOpenRecap={() => setIsWeeklyRecapOpen(true)}
            />
          ) : null}
          <MonthlyInsights
        analytics={resolvedAnalytics}
        envelopes={envelopes}
        trends={trendsQuery.data?.items ?? []}
        totalSavingsGoals={goals.reduce((sum, goal) => sum + goal.currentAmount, 0)}
        emergencyFundAmount={
          computeEmergencyFundAmount(goals, netWorthQuery.data?.accounts ?? []).totalAmount
        }
        hasLiquidAssets={
          computeEmergencyFundAmount(goals, netWorthQuery.data?.accounts ?? []).liquidAssetsTotal > 0
        }
        currentUserId={user.id}
        isPeriodClosed={Boolean(activePeriod?.closedAt)}
        periodClosedAt={activePeriod?.closedAt}
        onOpenMonthClosing={activePeriod ? () => setIsClosingWizardOpen(true) : undefined}
        onOpenCsvImport={activePeriod ? () => setIsCsvImportOpen(true) : undefined}
        onOpenBalanceReconcile={activePeriod ? () => setIsBalanceReconcileOpen(true) : undefined}
        anomalies={anomaliesQuery.data?.anomalies ?? []}
        onDismissAnomaly={
          activePeriod
            ? async (txId) => {
                await dismissTransactionAnomaly(activePeriod.id, txId);
                void queryClient.invalidateQueries({ queryKey: ['period-anomalies'] });
              }
            : undefined
        }
        onExportCsv={
          activeBudget
            ? () =>
                downloadBudgetCsv(activeBudget.id, {
                  budgetName: activeBudget.name,
                  periodId: activePeriod?.id,
                  periodLabel
                })
            : undefined
        }
        onExportPdf={
          activeBudget
            ? async () => {
                // fetchBudgetNetWorth importé statiquement
                const netWorthData = await fetchBudgetNetWorth(activeBudget.id).catch(() => undefined);
                const txs = activePeriod
                  ? (await listTransactions(activePeriod.id).catch(() => ({ transactions: [] })))
                      .transactions
                  : [];
                return downloadPeriodPdfReport({
                  budgetName: activeBudget.name,
                  periodLabel,
                  analytics: resolvedAnalytics,
                  envelopes,
                  goals,
                  transactions: txs,
                  netWorth: netWorthData
                });
              }
            : undefined
        }
        onExportJson={
          activeBudget
            ? () => downloadBudgetJsonBackup(activeBudget.id, activeBudget.name)
            : undefined
        }
        onOpenCalculator={
          activeBudget ? () => setCalculatorBudget(activeBudget) : undefined
        }
        goals={goals}
        isAutoBalancing={isMutating}
        onAutoBalanceToEnvelope={handleAutoBalanceToEnvelope}
        onAutoBalanceToGoal={handleAutoBalanceToGoal}
        onNavigateToTab={setActiveTab}
        budgetViewMode={user.preferences?.budgetViewMode ?? 'essential'}
      />
        <TagAnalyticsCard
          tags={tagsSummaryQuery.data ?? []}
          onSelectTag={setSelectedTag}
        />
        {weeklyHabitQuery.data?.milestones ? (
          <HabitMilestonesCard milestones={weeklyHabitQuery.data.milestones} />
        ) : null}
        {activeBudget && activePeriod && (
          <CheckingAccountCard
            budgetId={activeBudget.id}
            periodId={activePeriod.id}
            budgetName={activeBudget.name}
            currentBalance={activePeriod.summary.remainingToLive}
          />
        )}
        </>
        )}
        {activePeriod && (
          <>
          <WeeklyRecapSheet
            isOpen={isWeeklyRecapOpen}
            onClose={() => setIsWeeklyRecapOpen(false)}
            streak={streakQuery.data ?? null}
          />
          <WeeklyDigestSheet
            isOpen={isWeeklyDigestOpen}
            onClose={() => setIsWeeklyDigestOpen(false)}
            digest={weeklyHabitQuery.data?.digest ?? null}
            onMarkFixedChargePaid={async (periodId, envelopeId) => {
              await updateEnvelope(periodId, envelopeId, { isPaid: true });
              void queryClient.invalidateQueries({ queryKey: ['envelopes'] });
              void queryClient.invalidateQueries({ queryKey: ['period-summary'] });
              void queryClient.invalidateQueries({ queryKey: ['weekly-habit'] });
            }}
            onSelectEnvelope={(envelopeId) => {
              setActiveTab('enveloppes');
              setSelectedEnvelopeId(envelopeId);
            }}
          />
          <WhatIfSimulatorSheet
            isOpen={isWhatIfOpen}
            onClose={() => setIsWhatIfOpen(false)}
            periodId={activePeriod.id}
            remainingToLive={summary.remainingToLive}
            remainingToAllocate={summary.remainingToAllocate}
            daysRemaining={resolvedAnalytics.dailyBudget.daysRemaining}
            totalIncome={summary.plannedIncome}
            variableEnvelopes={variableEnvelopes}
          />
          </>
        )}
        {activeBudget && (
          <WrappedModal
            isOpen={isWrappedOpen}
            onClose={() => setIsWrappedOpen(false)}
            budgetId={activeBudget.id}
          />
        )}
      </div>
    );
  };

  const settingsTargetAnalytics =
    activeBudget && settingsState.budget?.id === activeBudget.id
      ? (analyticsQuery.data?.analytics ??
        buildClientPeriodAnalytics(
          activePeriod ?? {
            id: 'period-fallback',
            budgetId: activeBudget.id,
            year: referenceYear,
            month: referenceMonth,
            label: periodLabel,
            startDate: new Date(Date.UTC(referenceYear, referenceMonth - 1, 1)).toISOString(),
            endDate: new Date(Date.UTC(referenceYear, referenceMonth, 0, 23, 59, 59, 999)).toISOString(),
            summary: EMPTY_SUMMARY
          },
          envelopes,
          activeBudget,
          user
        ))
      : null;

  const handleGenerateInvite = async (budgetId: string): Promise<string | null> => {
    const response = await generateBudgetInvite(budgetId);
    await queryClient.invalidateQueries({ queryKey: ['budgets'] });
    return response.inviteCode;
  };

  const handleCloseJoinSheet = () => {
    setIsJoinOpen(false);
    setJoinInitialCode('');
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('eparnio_pending_invite');
    }
  };

  const calculatorTargetAmount =
    Math.round(
      ((summary.plannedFixedCharges + summary.plannedEnvelopes + summary.plannedSavings) +
        Number.EPSILON) *
        100
    ) / 100;

  return (
    <Suspense fallback={null}>
      <>
      {selectedEnvelope ? (
        <EnvelopeDetailPage
          envelope={selectedEnvelope}
          allEnvelopes={variableEnvelopes}
          transactions={envelopeTransactions}
          members={activeBudget?.members ?? []}
          currentUserId={user.id}
          isSharedBudget={activeBudget?.type === 'shared'}
          isLoadingTransactions={envelopeTransactionsQuery.isLoading}
          isRebalancing={isMutating}
          isDeletingEnvelope={isMutating}
          onBack={() => {
            setSelectedEnvelopeId(null);
            setExpenseEditorState({ isOpen: false, transaction: null });
          }}
          onAddExpense={() => setExpenseEditorState({ isOpen: true, transaction: null })}
          onEditExpense={(tx) => setExpenseEditorState({ isOpen: true, transaction: tx })}
          onDeleteExpense={handleDeleteExpense}
          onEditEnvelope={(envelope) =>
            setEditorState({ isOpen: true, pillar: 'variable_envelope', item: envelope })
          }
          onRebalanceEnvelope={async (sourceId, targetId, amount) => {
            const source = variableEnvelopes.find((item) => item.id === sourceId);
            const target = variableEnvelopes.find((item) => item.id === targetId);
            if (!source || !target || !activePeriod) return;
            await updateEnvelopeMutation.mutateAsync({
              periodId: activePeriod.id,
              envelopeId: source.id,
              payload: { allocatedAmount: Number((source.allocatedAmount - amount).toFixed(2)) }
            });
            await updateEnvelopeMutation.mutateAsync({
              periodId: activePeriod.id,
              envelopeId: target.id,
              payload: { allocatedAmount: Number((target.allocatedAmount + amount).toFixed(2)) }
            });
          }}
          onDeleteEnvelope={async (envelopeId) => {
            await handleDeleteById(envelopeId);
            setSelectedEnvelopeId(null);
          }}
        />
      ) : (
      <MobileShell
        firstName={user.displayName}
        avatarEmoji={user.avatarEmoji}
        activeBudgetName={activeBudget?.name ?? 'Budget Perso'}
        periodLabel={periodLabel}
        isPeriodClosed={Boolean(activePeriod?.closedAt)}
        activeTab={activeTab}
        sectionTitle={currentConfig.title}
        sectionDescription={currentConfig.description}
        onTabChange={setActiveTab}
        onPreviousPeriod={handlePreviousPeriod}
        onNextPeriod={handleNextPeriod}
        onQuickAdd={handleQuickAdd}
        quickAddLabel={currentConfig.addTitle || undefined}
        fabMenuActions={
          activeTab === 'enveloppes' &&
          envelopes.some((env) => env.pillar === 'variable_envelope')
            ? [
                {
                  label: 'Ajouter une dépense',
                  primary: true,
                  onClick: () => setIsQuickAddExpenseOpen(true)
                },
                {
                  label: 'Nouvelle enveloppe',
                  onClick: handleQuickAdd
                }
              ]
            : undefined
        }
        onProfileClick={() => setIsProfileOpen(true)}
        onSearchClick={() => setIsSearchOpen(true)}
        onBudgetSwitcherClick={() => setIsSwitcherOpen(true)}
      >
        <OfflineBanner />
        <PwaInstallBanner />
        {periodQuery.isLoading && !activePeriod ? (
          <div className="space-y-4" aria-busy="true" aria-label="Chargement de la période">
            <Card className="h-44 animate-pulse bg-slate-100/70">
              <span className="sr-only">Chargement de la synthèse...</span>
            </Card>
            <Card className="h-20 animate-pulse bg-slate-100/70">
              <span className="sr-only">Chargement de la liste...</span>
            </Card>
          </div>
        ) : (
          renderTabContent()
        )}

      </MobileShell>
      )}

        <CreationFormModal
          isOpen={editorState.isOpen}
          onClose={() => setEditorState((previous) => ({ ...previous, isOpen: false }))}
          pillar={editorState.pillar}
          currentRemainingToAllocate={summary.remainingToAllocate}
          defaultDate={defaultEntryDate}
          initialItem={editorState.item}
          members={activeBudget?.members ?? []}
          currentUserId={user.id}
          isSharedBudget={activeBudget?.type === 'shared'}
          isSubmitting={isMutating}
          showRolloverOption={(user.preferences?.budgetViewMode ?? 'essential') === 'advanced'}
          onSubmit={handleSaveEnvelope}
          onDelete={editorState.item ? handleDeleteById : undefined}
        />

        {/* Modales globales */}

        <AddExpenseSheet
          isOpen={expenseEditorState.isOpen && Boolean(selectedEnvelope)}
          suggestions={suggestionsQuery.data ?? []}
          envelopes={envelopes.filter((env) => env.pillar === 'variable_envelope')}
          onSplitSubmit={
            (user.preferences?.budgetViewMode ?? 'essential') === 'advanced'
              ? async (payload) => {
                  if (!activePeriod) return;
                  await splitTransaction(activePeriod.id, payload);
                  void queryClient.invalidateQueries({ queryKey: ['period-summary'] });
                  void queryClient.invalidateQueries({ queryKey: ['envelopes'] });
                  void queryClient.invalidateQueries({ queryKey: ['transactions'] });
                  void queryClient.invalidateQueries({ queryKey: ['transaction-suggestions'] });
                }
              : undefined
          }
          onSaveQuickTemplate={
            activeBudget
              ? async (payload) => {
                  await createQuickTemplate(activeBudget.id, payload);
                  void queryClient.invalidateQueries({ queryKey: ['budgets'] });
                }
              : undefined
          }
          onClose={() => setExpenseEditorState({ isOpen: false, transaction: null })}
          envelope={selectedEnvelope}
          defaultDate={defaultEntryDate}
          initialTransaction={expenseEditorState.transaction}
          members={activeBudget?.members ?? []}
          currentUserId={user.id}
          isSharedBudget={activeBudget?.type === 'shared'}
          isSubmitting={isMutating}
          onSubmit={handleSaveExpense}
          onDelete={expenseEditorState.transaction ? handleDeleteExpense : undefined}
        />

        <GoalFormSheet
          isOpen={goalFormState.isOpen}
          onClose={() => setGoalFormState({ isOpen: false, goal: null })}
          budgetId={activeBudget?.id}
          initialGoal={goalFormState.goal}
          isSubmitting={isMutating}
          onSubmit={handleSaveGoal}
          onDelete={goalFormState.goal ? handleDeleteGoal : undefined}
        />

        <GoalContributionSheet
          isOpen={contributionState.isOpen && Boolean(contributionState.goal)}
          onClose={() => setContributionState({ isOpen: false, goal: null, envelope: null })}
          goal={contributionState.goal}
          currentRemainingToAllocate={summary.remainingToAllocate}
          defaultDate={defaultEntryDate}
          initialContribution={contributionState.envelope}
          members={activeBudget?.members ?? []}
          currentUserId={user.id}
          isSharedBudget={activeBudget?.type === 'shared'}
          isSubmitting={isMutating}
          onSubmit={handleSaveContribution}
          onDelete={contributionState.envelope ? handleDeleteById : undefined}
        />

        <GoalWithdrawalSheet
          isOpen={withdrawalState.isOpen && Boolean(withdrawalState.goal)}
          onClose={() => setWithdrawalState({ isOpen: false, goal: null, withdrawal: null })}
          goal={withdrawalState.goal}
          defaultDate={defaultEntryDate}
          initialWithdrawal={withdrawalState.withdrawal}
          members={activeBudget?.members ?? []}
          currentUserId={user.id}
          isSharedBudget={activeBudget?.type === 'shared'}
          isSubmitting={isMutating}
          onSubmit={handleSaveWithdrawal}
          onDelete={
            withdrawalState.withdrawal && withdrawalState.goal
              ? (withdrawalId) => handleDeleteWithdrawal(withdrawalState.goal!.id, withdrawalId)
              : undefined
          }
        />

        <BottomSheet
          isOpen={isPlaceholderAddOpen}
          onClose={() => setIsPlaceholderAddOpen(false)}
          title={currentConfig.addTitle || 'Action rapide'}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Ce module ({currentConfig.addTitle.toLowerCase()}) sera disponible dès les prochaines
              étapes de développement.
            </p>
            <Button fullWidth onClick={() => setIsPlaceholderAddOpen(false)}>
              Fermer l’aperçu
            </Button>
          </div>
        </BottomSheet>

      <ProfileSheet
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onProfileSaved={() => setToastMessage('Modification du profil enregistrée !')}
      />

      {toastMessage && (
        <div
          role="status"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-2xl bg-emerald-600 text-white text-xs font-semibold shadow-lg"
        >
          ✓ {toastMessage}
        </div>
      )}

      <BudgetSwitcherOverlay
        isOpen={isSwitcherOpen}
        budgets={budgets}
        activeBudgetId={activeBudget?.id ?? null}
        onClose={() => setIsSwitcherOpen(false)}
        onSelectBudget={(id) => {
          setSelectedEnvelopeId(null);
          setGoalFormState({ isOpen: false, goal: null });
          setContributionState({ isOpen: false, goal: null, envelope: null });
          setWithdrawalState({ isOpen: false, goal: null, withdrawal: null });
          setActiveBudgetId(id);
        }}
        onOpenSettings={(targetBudget) => {
          setIsSwitcherOpen(false);
          setSettingsState({ isOpen: true, mode: 'edit', budget: targetBudget });
        }}
        onCreateNewBudget={() => {
          setIsSwitcherOpen(false);
          setSettingsState({ isOpen: true, mode: 'create', budget: null });
        }}
        onJoinBudget={() => {
          setIsSwitcherOpen(false);
          setJoinInitialCode('');
          setIsJoinOpen(true);
        }}
        onGenerateInvite={handleGenerateInvite}
      />

      <BudgetSettingsSheet
        isOpen={settingsState.isOpen}
        onClose={() => setSettingsState((prev) => ({ ...prev, isOpen: false }))}
        budget={settingsState.budget}
        initialMode={settingsState.mode}
        canDelete={budgets.length > 1}
        currentUserId={user.id}
        activePeriod={settingsState.budget?.id === activeBudget?.id ? activePeriod : null}
        activeAnalytics={settingsTargetAnalytics}
        activeEnvelopes={settingsState.budget?.id === activeBudget?.id ? envelopes : []}
        activeGoals={settingsState.budget?.id === activeBudget?.id ? goals : []}
        onBudgetCreated={(created) => setActiveBudgetId(created.id)}
        onBudgetDeleted={(deletedId) => {
          if (activeBudgetId === deletedId) {
            const next = budgets.find((item) => item.id !== deletedId);
            setActiveBudgetId(next?.id ?? null);
          }
        }}
        onOpenCalculator={(targetBudget) => setCalculatorBudget(targetBudget)}
        budgetViewMode={user.preferences?.budgetViewMode ?? 'essential'}
      />

      <InvitePartnerSheet
        isOpen={isJoinOpen}
        initialCode={joinInitialCode}
        onClose={handleCloseJoinSheet}
        onJoined={(joinedBudget) => {
          setSelectedEnvelopeId(null);
          setGoalFormState({ isOpen: false, goal: null });
          setContributionState({ isOpen: false, goal: null, envelope: null });
          setActiveBudgetId(joinedBudget.id);
        }}
      />

      <ContributionCalculatorSheet
        isOpen={Boolean(calculatorBudget)}
        budget={calculatorBudget}
        periodId={
          calculatorBudget?.id === activeBudget?.id ? activePeriod?.id : undefined
        }
        defaultTargetAmount={calculatorTargetAmount}
        currentUserId={user.id}
        onClose={() => setCalculatorBudget(null)}
      />

      <MonthClosingWizard
        isOpen={isClosingWizardOpen}
        onClose={() => setIsClosingWizardOpen(false)}
        period={activePeriod}
        envelopes={envelopes}
        goals={goals}
        isSubmitting={closePeriodMutation.isPending}
        onConfirmClose={async (payload) => {
          if (!activeBudget || !activePeriod) return;
          await closePeriodMutation.mutateAsync({
            budgetId: activeBudget.id,
            periodId: activePeriod.id,
            payload
          });
        }}
      />

      {activePeriod && (
        <>
          <CsvImportSheet
            isOpen={isCsvImportOpen}
            onClose={() => setIsCsvImportOpen(false)}
            periodId={activePeriod.id}
            envelopes={envelopes.filter((env) => env.pillar === 'variable_envelope')}
            existingTransactions={[]}
            onImported={() => {
              void queryClient.invalidateQueries({ queryKey: ['period-summary'] });
              void queryClient.invalidateQueries({ queryKey: ['envelopes'] });
              void queryClient.invalidateQueries({ queryKey: ['transactions'] });
            }}
          />
          <BalanceReconcileSheet
            isOpen={isBalanceReconcileOpen}
            onClose={() => setIsBalanceReconcileOpen(false)}
            periodId={activePeriod.id}
            theoreticalBalance={activePeriod.summary.remainingToLive}
          />
          <QuickAddExpenseSheet
            isOpen={isQuickAddExpenseOpen}
            onClose={() => setIsQuickAddExpenseOpen(false)}
            envelopes={envelopes.filter((env) => env.pillar === 'variable_envelope')}
            isSharedBudget={activeBudget?.type === 'shared'}
            members={activeBudget?.members ?? []}
            currentUserId={user.id}
            quickTemplates={activeBudget?.quickTemplates ?? []}
            suggestions={suggestionsQuery.data ?? []}
            anomalyThresholds={anomaliesQuery.data?.envelopeThresholds ?? {}}
            onSaveQuickTemplate={
              activeBudget
                ? async (payload) => {
                    await createQuickTemplate(activeBudget.id, payload);
                    void queryClient.invalidateQueries({ queryKey: ['budgets'] });
                  }
                : undefined
            }
            onDeleteQuickTemplate={
              activeBudget
                ? async (templateId) => {
                    await deleteQuickTemplate(activeBudget.id, templateId);
                    void queryClient.invalidateQueries({ queryKey: ['budgets'] });
                  }
                : undefined
            }
            onSplitSubmit={
              (user.preferences?.budgetViewMode ?? 'essential') === 'advanced'
                ? async (payload) => {
                    await splitTransaction(activePeriod.id, payload);
                    void queryClient.invalidateQueries({ queryKey: ['period-summary'] });
                    void queryClient.invalidateQueries({ queryKey: ['envelopes'] });
                    void queryClient.invalidateQueries({ queryKey: ['transactions'] });
                    void queryClient.invalidateQueries({ queryKey: ['transaction-suggestions'] });
                  }
                : undefined
            }
            onSubmit={async (payload) => {
              await createTransaction(activePeriod.id, payload);
              void queryClient.invalidateQueries({ queryKey: ['period-summary'] });
              void queryClient.invalidateQueries({ queryKey: ['envelopes'] });
              void queryClient.invalidateQueries({ queryKey: ['transactions'] });
              void queryClient.invalidateQueries({ queryKey: ['transaction-suggestions'] });
            }}
          />
        </>
      )}

      {activeBudget && (
        <TagDetailModal
          isOpen={Boolean(selectedTag)}
          budgetId={activeBudget.id}
          tag={selectedTag}
          onClose={() => setSelectedTag(null)}
        />
      )}

      {activeBudget && (
        <GlobalSearchModal
          isOpen={isSearchOpen}
          budgetId={activeBudget.id}
          isSharedBudget={activeBudget.type === 'shared'}
          members={activeBudget.members}
          onClose={() => setIsSearchOpen(false)}
          onSelectResult={(item: GlobalSearchItem) => {
            setReferenceDate(new Date(item.year, item.month - 1, 1));
            if (item.kind === 'income') {
              setSelectedEnvelopeId(null);
              setActiveTab('revenus');
            } else if (item.kind === 'fixed_charge') {
              setSelectedEnvelopeId(null);
              setActiveTab('depenses');
            } else {
              setActiveTab('enveloppes');
              setSelectedEnvelopeId(item.envelopeId);
            }
          }}
        />
      )}
      </>
    </Suspense>
  );
}

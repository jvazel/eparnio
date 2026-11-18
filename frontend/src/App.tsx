import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { TabId } from './components/layout/BottomNav';
import { BudgetSwitcherOverlay } from './components/layout/BudgetSwitcher';
import { OfflineBanner } from './components/pwa/OfflineBanner';
import { PwaInstallBanner } from './components/pwa/PwaInstallBanner';
import { MobileShell } from './components/layout/MobileShell';
import { BottomSheet } from './components/ui/BottomSheet';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { MonthlyInsights } from './features/analytics/MonthlyInsights';
import { AuthScreen } from './features/auth/AuthScreen';
import { OnboardingWizard } from './features/auth/OnboardingWizard';
import { ProfileSheet } from './features/auth/ProfileSheet';
import { BudgetSettingsSheet } from './features/budget/BudgetSettingsSheet';
import { CreationFormModal } from './features/budget/CreationFormModal';
import { EnvelopesList } from './features/budget/EnvelopesList';
import { FixedChargesList } from './features/budget/FixedChargesList';
import { IncomeList } from './features/budget/IncomeList';
import { AddExpenseSheet, type AddExpensePayload } from './features/transactions/AddExpenseSheet';
import { EnvelopeDetailPage } from './features/transactions/EnvelopeDetailPage';
import { GoalContributionSheet, GoalFormSheet } from './features/savings/GoalDetailSheet';
import { SavingsGoalsList } from './features/savings/SavingsGoalsList';
import { ContributionCalculatorSheet } from './features/shared-budget/ContributionCalculatorSheet';
import { InvitePartnerSheet } from './features/shared-budget/InvitePartnerSheet';
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
  deleteGoal,
  listGoals,
  updateGoal
} from './services/goal.service';
import { getPeriodByMonth } from './services/period.service';
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
  TransactionItem
} from './types/budget.types';
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

  const [activeTab, setActiveTab] = useState<TabId>('depenses');
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

  const analyticsQuery = useQuery({
    queryKey: analyticsQueryKey,
    queryFn: () => getPeriodAnalytics(activePeriod!.id),
    enabled: canLoadApp && Boolean(activePeriod?.id) && activeTab === 'budget'
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
    return <OnboardingWizard />;
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
    createTransactionMutation.isPending ||
    updateTransactionMutation.isPending ||
    deleteTransactionMutation.isPending;

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
      <MonthlyInsights
        analytics={resolvedAnalytics}
        envelopes={envelopes}
        trends={trendsQuery.data?.items ?? []}
        totalSavingsGoals={goals.reduce((sum, goal) => sum + goal.currentAmount, 0)}
        currentUserId={user.id}
        onOpenCalculator={
          activeBudget ? () => setCalculatorBudget(activeBudget) : undefined
        }
      />
    );
  };

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
        activeTab={activeTab}
        sectionTitle={currentConfig.title}
        sectionDescription={currentConfig.description}
        onTabChange={setActiveTab}
        onPreviousPeriod={handlePreviousPeriod}
        onNextPeriod={handleNextPeriod}
        onQuickAdd={handleQuickAdd}
        quickAddLabel={currentConfig.addTitle || undefined}
        onProfileClick={() => setIsProfileOpen(true)}
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
          onSubmit={handleSaveEnvelope}
          onDelete={editorState.item ? handleDeleteById : undefined}
        />

        {/* Modales globales */}

        <AddExpenseSheet
          isOpen={expenseEditorState.isOpen && Boolean(selectedEnvelope)}
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

      <ProfileSheet isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

      <BudgetSwitcherOverlay
        isOpen={isSwitcherOpen}
        budgets={budgets}
        activeBudgetId={activeBudget?.id ?? null}
        onClose={() => setIsSwitcherOpen(false)}
        onSelectBudget={(id) => {
          setSelectedEnvelopeId(null);
          setGoalFormState({ isOpen: false, goal: null });
          setContributionState({ isOpen: false, goal: null, envelope: null });
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
        onBudgetCreated={(created) => setActiveBudgetId(created.id)}
        onBudgetDeleted={(deletedId) => {
          if (activeBudgetId === deletedId) {
            const next = budgets.find((item) => item.id !== deletedId);
            setActiveBudgetId(next?.id ?? null);
          }
        }}
        onOpenCalculator={(targetBudget) => setCalculatorBudget(targetBudget)}
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
    </>
  );
}

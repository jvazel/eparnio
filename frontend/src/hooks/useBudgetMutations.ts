import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { AddExpensePayload } from '../features/transactions/AddExpenseSheet';
import {
  bulkUpdateEnvelopesPaid,
  createEnvelope,
  type CreateEnvelopePayload,
  deleteEnvelope,
  reorderEnvelopes,
  updateEnvelope,
  type UpdateEnvelopePayload
} from '../services/envelope.service';
import {
  createGoal,
  type CreateGoalPayload,
  type CreateGoalWithdrawalPayload,
  createGoalWithdrawal,
  deleteGoal,
  deleteGoalWithdrawal,
  updateGoal,
  updateGoalWithdrawal
} from '../services/goal.service';
import { closePeriod, type ClosePeriodPayload } from '../services/period.service';
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
  type UpdateTransactionPayload
} from '../services/transaction.service';
import type {
  GoalsListResponse,
  PeriodWithEnvelopesResponse,
  TransactionsListResponse
} from '../types/api.types';
import type {
  BudgetPeriod,
  BudgetSpace,
  EnvelopeItem,
  SavingsGoalItem,
  TransactionItem
} from '../types/budget.types';

export interface UseBudgetMutationsParams {
  periodQueryKey: readonly unknown[];
  goalsQueryKey: readonly unknown[];
  activeBudget: BudgetSpace | null;
  selectedEnvelopeId: string | null;
  setSelectedEnvelopeId: (id: string | null) => void;
  setIsClosingWizardOpen: (open: boolean) => void;
  setReferenceDate: (date: Date) => void;
}

/**
 * Centralise toutes les mutations budgétaires TanStack Query avec :
 * - Optimistic UI + rollback sur erreur pour les actions quotidiennes (`togglePaid`, dépenses, réordonnancement)
 * - Invalidation de caches unifiée (`invalidateBudgetScope`).
 */
export function useBudgetMutations({
  periodQueryKey,
  goalsQueryKey,
  activeBudget,
  selectedEnvelopeId,
  setSelectedEnvelopeId,
  setIsClosingWizardOpen,
  setReferenceDate
}: UseBudgetMutationsParams) {
  const queryClient = useQueryClient();

  const invalidateAnalyticsAndInsights = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    void queryClient.invalidateQueries({ queryKey: ['calendar'] });
    void queryClient.invalidateQueries({ queryKey: ['trends'] });
    void queryClient.invalidateQueries({ queryKey: ['tags-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['period-anomalies'] });
    void queryClient.invalidateQueries({ queryKey: ['weekly-habit'] });
    void queryClient.invalidateQueries({ queryKey: ['transaction-suggestions'] });
  }, [queryClient]);

  const syncGoalCache = useCallback(
    (goal?: SavingsGoalItem) => {
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
    },
    [goalsQueryKey, queryClient]
  );

  const syncEnvelopeAndPeriodCache = useCallback(
    (envelope: EnvelopeItem, period: BudgetPeriod, goal?: SavingsGoalItem) => {
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
    },
    [periodQueryKey, queryClient, syncGoalCache]
  );

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

  // Optimistic UI : pointage ✓ et édition d'enveloppe/charge fixe instantanés avec rollback
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
    onMutate: async ({ envelopeId, payload }) => {
      await queryClient.cancelQueries({ queryKey: periodQueryKey });
      const previousPeriod =
        queryClient.getQueryData<PeriodWithEnvelopesResponse>(periodQueryKey);

      if (previousPeriod) {
        queryClient.setQueryData<PeriodWithEnvelopesResponse>(periodQueryKey, {
          ...previousPeriod,
          envelopes: previousPeriod.envelopes.map((item) => {
            if (item.id !== envelopeId) return item;
            const nextIsPaid = payload.isPaid ?? item.isPaid;
            const nextAllocated = payload.allocatedAmount ?? item.allocatedAmount;
            return {
              ...item,
              ...(payload.name !== undefined ? { name: payload.name } : {}),
              ...(payload.allocatedAmount !== undefined ? { allocatedAmount: nextAllocated } : {}),
              ...(payload.isPaid !== undefined ? { isPaid: nextIsPaid } : {}),
              ...(payload.isPaid !== undefined && item.pillar !== 'variable_envelope'
                ? { spentOrPaidAmount: nextIsPaid ? nextAllocated : 0 }
                : {})
            };
          })
        });
      }

      return { previousPeriod };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousPeriod) {
        queryClient.setQueryData<PeriodWithEnvelopesResponse>(
          periodQueryKey,
          context.previousPeriod
        );
      }
    },
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
      void queryClient.invalidateQueries({ queryKey: ['weekly-habit'] });
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
      void queryClient.invalidateQueries({ queryKey: ['net-worth'] });
      void queryClient.invalidateQueries({ queryKey: ['weekly-habit'] });
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

  // Optimistic UI : ajout de dépense variable instantané dans l'enveloppe + rollback
  const createTransactionMutation = useMutation({
    mutationFn: ({ periodId, payload }: { periodId: string; payload: AddExpensePayload }) =>
      createTransaction(periodId, payload),
    onMutate: async ({ periodId, payload }) => {
      const txKey = ['transactions', periodId, payload.envelopeId] as const;
      await Promise.all([
        queryClient.cancelQueries({ queryKey: periodQueryKey }),
        queryClient.cancelQueries({ queryKey: txKey })
      ]);

      const previousPeriod =
        queryClient.getQueryData<PeriodWithEnvelopesResponse>(periodQueryKey);
      const previousTransactions =
        queryClient.getQueryData<TransactionsListResponse>(txKey);

      const signedDelta = payload.type === 'income' ? -payload.amount : payload.amount;

      if (previousPeriod) {
        queryClient.setQueryData<PeriodWithEnvelopesResponse>(periodQueryKey, {
          ...previousPeriod,
          envelopes: previousPeriod.envelopes.map((env) =>
            env.id === payload.envelopeId
              ? {
                  ...env,
                  spentOrPaidAmount:
                    Math.round((env.spentOrPaidAmount + signedDelta) * 100) / 100
                }
              : env
          )
        });
      }

      const optimisticTx: TransactionItem = {
        id: `optimistic-${Date.now()}`,
        budgetId: activeBudget?.id ?? '',
        budgetPeriodId: periodId,
        envelopeId: payload.envelopeId,
        authorId: payload.paidByUserId ?? '',
        paidByUserId: payload.paidByUserId ?? '',
        type: payload.type ?? 'expense',
        amount: payload.amount,
        label: payload.label,
        date: payload.date,
        notes: payload.notes
      };

      queryClient.setQueryData<TransactionsListResponse>(txKey, (current) => ({
        status: 'ok',
        transactions: current ? [optimisticTx, ...current.transactions] : [optimisticTx]
      }));

      return { previousPeriod, previousTransactions, txKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousPeriod) {
        queryClient.setQueryData<PeriodWithEnvelopesResponse>(
          periodQueryKey,
          context.previousPeriod
        );
      }
      if (context?.txKey) {
        queryClient.setQueryData<TransactionsListResponse | undefined>(
          context.txKey,
          context.previousTransactions
        );
      }
    },
    onSuccess: (response) => {
      syncEnvelopeAndPeriodCache(response.envelope, response.period, response.goal);
      queryClient.setQueryData<TransactionsListResponse>(
        ['transactions', response.period.id, response.envelope.id],
        (current) => ({
          status: 'ok',
          transactions: current
            ? [
                response.transaction,
                ...current.transactions.filter((item) => !item.id.startsWith('optimistic-'))
              ]
            : [response.transaction]
        })
      );
      invalidateAnalyticsAndInsights();
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
      void queryClient.invalidateQueries({ queryKey: ['period'] });
      void queryClient.invalidateQueries({ queryKey: ['transactions', response.period.id] });
      invalidateAnalyticsAndInsights();
    }
  });

  // Optimistic UI : suppression de transaction instantanée avec rollback
  const deleteTransactionMutation = useMutation({
    mutationFn: ({ periodId, transactionId }: { periodId: string; transactionId: string }) =>
      deleteTransaction(periodId, transactionId),
    onMutate: async ({ periodId, transactionId }) => {
      const txKey = selectedEnvelopeId
        ? (['transactions', periodId, selectedEnvelopeId] as const)
        : null;
      await queryClient.cancelQueries({ queryKey: periodQueryKey });
      if (txKey) {
        await queryClient.cancelQueries({ queryKey: txKey });
      }

      const previousPeriod =
        queryClient.getQueryData<PeriodWithEnvelopesResponse>(periodQueryKey);
      const previousTransactions = txKey
        ? queryClient.getQueryData<TransactionsListResponse>(txKey)
        : undefined;

      if (txKey && previousTransactions) {
        const removed = previousTransactions.transactions.find((t) => t.id === transactionId);
        queryClient.setQueryData<TransactionsListResponse>(txKey, {
          ...previousTransactions,
          transactions: previousTransactions.transactions.filter((t) => t.id !== transactionId)
        });
        if (removed && previousPeriod) {
          const signedDelta = removed.type === 'income' ? removed.amount : -removed.amount;
          queryClient.setQueryData<PeriodWithEnvelopesResponse>(periodQueryKey, {
            ...previousPeriod,
            envelopes: previousPeriod.envelopes.map((env) =>
              env.id === removed.envelopeId
                ? {
                    ...env,
                    spentOrPaidAmount:
                      Math.round((env.spentOrPaidAmount + signedDelta) * 100) / 100
                  }
                : env
            )
          });
        }
      }

      return { previousPeriod, previousTransactions, txKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousPeriod) {
        queryClient.setQueryData<PeriodWithEnvelopesResponse>(
          periodQueryKey,
          context.previousPeriod
        );
      }
      if (context?.txKey) {
        queryClient.setQueryData<TransactionsListResponse | undefined>(
          context.txKey,
          context.previousTransactions
        );
      }
    },
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
      invalidateAnalyticsAndInsights();
    }
  });

  // Optimistic UI : réordonnancement instantané en mode ⚙️ avec rollback
  const reorderMutation = useMutation({
    mutationFn: ({ periodId, orderedIds }: { periodId: string; orderedIds: string[] }) =>
      reorderEnvelopes(periodId, orderedIds),
    onMutate: async ({ orderedIds }) => {
      await queryClient.cancelQueries({ queryKey: periodQueryKey });
      const previousPeriod =
        queryClient.getQueryData<PeriodWithEnvelopesResponse>(periodQueryKey);

      if (previousPeriod) {
        const orderIndex = new Map(orderedIds.map((id, idx) => [id, idx]));
        queryClient.setQueryData<PeriodWithEnvelopesResponse>(periodQueryKey, {
          ...previousPeriod,
          envelopes: previousPeriod.envelopes.map((item) =>
            orderIndex.has(item.id) ? { ...item, order: orderIndex.get(item.id)! } : item
          )
        });
      }

      return { previousPeriod };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousPeriod) {
        queryClient.setQueryData<PeriodWithEnvelopesResponse>(
          periodQueryKey,
          context.previousPeriod
        );
      }
    },
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

  // Optimistic UI : pointage groupé des charges fixes échues (« Pointer jusqu'à aujourd'hui »)
  const bulkTogglePaidMutation = useMutation({
    mutationFn: ({
      periodId,
      envelopeIds,
      isPaid
    }: {
      periodId: string;
      envelopeIds: string[];
      isPaid: boolean;
    }) => bulkUpdateEnvelopesPaid(periodId, envelopeIds, isPaid),
    onMutate: async ({ envelopeIds, isPaid }) => {
      await queryClient.cancelQueries({ queryKey: periodQueryKey });
      const previousPeriod =
        queryClient.getQueryData<PeriodWithEnvelopesResponse>(periodQueryKey);

      if (previousPeriod) {
        const idSet = new Set(envelopeIds);
        queryClient.setQueryData<PeriodWithEnvelopesResponse>(periodQueryKey, {
          ...previousPeriod,
          envelopes: previousPeriod.envelopes.map((item) =>
            idSet.has(item.id)
              ? {
                  ...item,
                  isPaid,
                  spentOrPaidAmount: isPaid ? item.allocatedAmount : 0
                }
              : item
          )
        });
      }

      return { previousPeriod };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousPeriod) {
        queryClient.setQueryData<PeriodWithEnvelopesResponse>(
          periodQueryKey,
          context.previousPeriod
        );
      }
    },
    onSuccess: (response) => {
      queryClient.setQueryData<PeriodWithEnvelopesResponse>(periodQueryKey, (current) => {
        if (!current) return current;
        const updatedMap = new Map(response.envelopes.map((item) => [item.id, item]));
        return {
          status: 'ok',
          period: response.period,
          envelopes: current.envelopes.map((item) => updatedMap.get(item.id) ?? item)
        };
      });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
      void queryClient.invalidateQueries({ queryKey: ['weekly-habit'] });
      void queryClient.invalidateQueries({ queryKey: ['calendar'] });
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

  return {
    syncGoalCache,
    syncEnvelopeAndPeriodCache,
    invalidateAnalyticsAndInsights,
    createEnvelopeMutation,
    updateEnvelopeMutation,
    deleteEnvelopeMutation,
    createGoalMutation,
    updateGoalMutation,
    deleteGoalMutation,
    createGoalWithdrawalMutation,
    updateGoalWithdrawalMutation,
    deleteGoalWithdrawalMutation,
    createTransactionMutation,
    updateTransactionMutation,
    deleteTransactionMutation,
    reorderMutation,
    bulkTogglePaidMutation,
    closePeriodMutation
  };
}

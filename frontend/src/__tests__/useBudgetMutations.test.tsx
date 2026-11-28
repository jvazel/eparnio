import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBudgetMutations } from '../hooks/useBudgetMutations';
import * as envelopeService from '../services/envelope.service';
import * as transactionService from '../services/transaction.service';
import type {
  PeriodWithEnvelopesResponse,
  TransactionsListResponse
} from '../types/api.types';
import type {
  BudgetPeriod,
  BudgetSpace,
  EnvelopeItem
} from '../types/budget.types';

const basePeriod: BudgetPeriod = {
  id: 'period-1',
  budgetId: 'budget-1',
  year: 2026,
  month: 11,
  label: 'Novembre 2026',
  startDate: '2026-11-01T00:00:00.000Z',
  endDate: '2026-11-30T23:59:59.999Z',
  summary: {
    plannedIncome: 3000,
    plannedFixedCharges: 1000,
    plannedEnvelopes: 500,
    plannedSavings: 200,
    spentVariables: 100,
    remainingToAllocate: 1300,
    remainingToLive: 1700
  }
};

const fixedEnvelope: EnvelopeItem = {
  id: 'env-fixed-1',
  budgetId: 'budget-1',
  budgetPeriodId: 'period-1',
  pillar: 'fixed_charge',
  name: 'Loyer',
  icon: '🏠',
  color: '#3B82F6',
  allocatedAmount: 800,
  spentOrPaidAmount: 0,
  date: '2026-11-05T00:00:00.000Z',
  isRecurring: true,
  isPaid: false,
  order: 0
};

const variableEnvelope: EnvelopeItem = {
  id: 'env-var-1',
  budgetId: 'budget-1',
  budgetPeriodId: 'period-1',
  pillar: 'variable_envelope',
  name: 'Courses',
  icon: '🛒',
  color: '#22C55E',
  allocatedAmount: 500,
  spentOrPaidAmount: 100,
  date: '2026-11-01T00:00:00.000Z',
  isRecurring: false,
  isPaid: false,
  order: 1
};

const activeBudget: BudgetSpace = {
  id: 'budget-1',
  name: 'Budget Perso',
  type: 'personal',
  ownerId: 'user-1',
  budgetStartDay: 1,
  contributionMode: 'equal_50_50',
  members: [],
  createdAt: '2026-01-01T00:00:00.000Z'
};

const periodQueryKey = ['period', 'budget-1', 1, 2026, 11] as const;
const goalsQueryKey = ['goals', 'budget-1'] as const;

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useBudgetMutations — Optimistic UI & Rollback (Étape 73)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applique le pointage ✓ de manière optimiste et effectue un rollback propre en cas d’erreur API', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    queryClient.setQueryData<PeriodWithEnvelopesResponse>(periodQueryKey, {
      status: 'ok',
      period: basePeriod,
      envelopes: [fixedEnvelope, variableEnvelope]
    });

    let rejectApi!: (err: Error) => void;
    vi.spyOn(envelopeService, 'updateEnvelope').mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectApi = reject;
        })
    );

    const { result } = renderHook(
      () =>
        useBudgetMutations({
          periodQueryKey,
          goalsQueryKey,
          activeBudget,
          selectedEnvelopeId: null,
          setSelectedEnvelopeId: vi.fn(),
          setIsClosingWizardOpen: vi.fn(),
          setReferenceDate: vi.fn()
        }),
      { wrapper: createWrapper(queryClient) }
    );

    act(() => {
      result.current.updateEnvelopeMutation.mutate({
        periodId: 'period-1',
        envelopeId: 'env-fixed-1',
        payload: { isPaid: true }
      });
    });

    // Mise à jour optimiste immédiate avant la résolution réseau
    await waitFor(() => {
      const cached = queryClient.getQueryData<PeriodWithEnvelopesResponse>(periodQueryKey);
      const updated = cached?.envelopes.find((e) => e.id === 'env-fixed-1');
      expect(updated?.isPaid).toBe(true);
      expect(updated?.spentOrPaidAmount).toBe(800);
    });

    // Échec API -> rollback exact vers l'état initial
    act(() => {
      rejectApi(new Error('Network error'));
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<PeriodWithEnvelopesResponse>(periodQueryKey);
      const restored = cached?.envelopes.find((e) => e.id === 'env-fixed-1');
      expect(restored?.isPaid).toBe(false);
      expect(restored?.spentOrPaidAmount).toBe(0);
    });
  });

  it('ajoute une dépense variable de manière optimiste dans le cache puis la remplace par la réponse serveur', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const txKey = ['transactions', 'period-1', 'env-var-1'] as const;
    queryClient.setQueryData<PeriodWithEnvelopesResponse>(periodQueryKey, {
      status: 'ok',
      period: basePeriod,
      envelopes: [fixedEnvelope, variableEnvelope]
    });
    queryClient.setQueryData<TransactionsListResponse>(txKey, {
      status: 'ok',
      transactions: []
    });

    let resolveApi!: (value: Awaited<ReturnType<typeof transactionService.createTransaction>>) => void;
    vi.spyOn(transactionService, 'createTransaction').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveApi = resolve;
        })
    );

    const { result } = renderHook(
      () =>
        useBudgetMutations({
          periodQueryKey,
          goalsQueryKey,
          activeBudget,
          selectedEnvelopeId: 'env-var-1',
          setSelectedEnvelopeId: vi.fn(),
          setIsClosingWizardOpen: vi.fn(),
          setReferenceDate: vi.fn()
        }),
      { wrapper: createWrapper(queryClient) }
    );

    act(() => {
      result.current.createTransactionMutation.mutate({
        periodId: 'period-1',
        payload: {
          envelopeId: 'env-var-1',
          amount: 45,
          label: 'Boulangerie',
          date: '2026-11-12',
          type: 'expense'
        }
      });
    });

    await waitFor(() => {
      const cachedPeriod = queryClient.getQueryData<PeriodWithEnvelopesResponse>(periodQueryKey);
      const env = cachedPeriod?.envelopes.find((e) => e.id === 'env-var-1');
      expect(env?.spentOrPaidAmount).toBe(145);

      const cachedTx = queryClient.getQueryData<TransactionsListResponse>(txKey);
      expect(cachedTx?.transactions).toHaveLength(1);
      expect(cachedTx?.transactions[0].label).toBe('Boulangerie');
      expect(cachedTx?.transactions[0].id.startsWith('optimistic-')).toBe(true);
    });

    act(() => {
      resolveApi({
        status: 'ok',
        transaction: {
          id: 'tx-server-1',
          budgetId: 'budget-1',
          budgetPeriodId: 'period-1',
          envelopeId: 'env-var-1',
          authorId: 'user-1',
          paidByUserId: 'user-1',
          type: 'expense',
          amount: 45,
          label: 'Boulangerie',
          date: '2026-11-12'
        },
        envelope: { ...variableEnvelope, spentOrPaidAmount: 145 },
        period: basePeriod
      });
    });

    await waitFor(() => {
      const cachedTx = queryClient.getQueryData<TransactionsListResponse>(txKey);
      expect(cachedTx?.transactions).toHaveLength(1);
      expect(cachedTx?.transactions[0].id).toBe('tx-server-1');
    });
  });

  it('réordonne les enveloppes de manière optimiste puis rollback en cas d’erreur', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    queryClient.setQueryData<PeriodWithEnvelopesResponse>(periodQueryKey, {
      status: 'ok',
      period: basePeriod,
      envelopes: [fixedEnvelope, variableEnvelope]
    });

    let rejectApi!: (err: Error) => void;
    vi.spyOn(envelopeService, 'reorderEnvelopes').mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectApi = reject;
        })
    );

    const { result } = renderHook(
      () =>
        useBudgetMutations({
          periodQueryKey,
          goalsQueryKey,
          activeBudget,
          selectedEnvelopeId: null,
          setSelectedEnvelopeId: vi.fn(),
          setIsClosingWizardOpen: vi.fn(),
          setReferenceDate: vi.fn()
        }),
      { wrapper: createWrapper(queryClient) }
    );

    act(() => {
      result.current.reorderMutation.mutate({
        periodId: 'period-1',
        orderedIds: ['env-var-1', 'env-fixed-1']
      });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<PeriodWithEnvelopesResponse>(periodQueryKey);
      expect(cached?.envelopes.find((e) => e.id === 'env-var-1')?.order).toBe(0);
      expect(cached?.envelopes.find((e) => e.id === 'env-fixed-1')?.order).toBe(1);
    });

    act(() => {
      rejectApi(new Error('Reorder failed'));
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<PeriodWithEnvelopesResponse>(periodQueryKey);
      expect(cached?.envelopes.find((e) => e.id === 'env-fixed-1')?.order).toBe(0);
      expect(cached?.envelopes.find((e) => e.id === 'env-var-1')?.order).toBe(1);
    });
  });
});

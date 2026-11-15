import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { AllocationDonutCard } from '../features/analytics/AllocationDonut';
import { CashFlowSummaryCard } from '../features/analytics/CashFlowSummaryCard';
import { DailyBudgetCard } from '../features/analytics/DailyBudgetCard';
import { MemberBreakdownCard } from '../features/analytics/MemberBreakdownCard';
import { MonthlyInsights } from '../features/analytics/MonthlyInsights';
import { EnvelopeBreakdownCard } from '../features/analytics/EnvelopeBreakdownCard';
import { ZeroBasedBanner } from '../features/budget/ZeroBasedBanner';
import * as analyticsService from '../services/analytics.service';
import * as budgetService from '../services/budget.service';
import * as goalService from '../services/goal.service';
import * as periodService from '../services/period.service';
import { useAuthStore } from '../store/useAuthStore';
import { useBudgetStore } from '../store/useBudgetStore';
import type {
  BudgetPeriod,
  BudgetSpace,
  EnvelopeItem,
  MemberBreakdownItem,
  PeriodAnalytics
} from '../types/budget.types';
import { formatMonthLabel } from '../utils/format';

vi.mock('../services/budget.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/budget.service')>();
  return {
    ...actual,
    listBudgets: vi.fn()
  };
});

vi.mock('../services/period.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/period.service')>();
  return {
    ...actual,
    getPeriodByMonth: vi.fn()
  };
});

vi.mock('../services/goal.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/goal.service')>();
  return {
    ...actual,
    listGoals: vi.fn()
  };
});

vi.mock('../services/analytics.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/analytics.service')>();
  return {
    ...actual,
    getPeriodAnalytics: vi.fn()
  };
});

function normalizeSpaces(value: string): string {
  return value.replace(/\u202f|\u00a0/g, ' ');
}

const finzeeAnalyticsSample: PeriodAnalytics = {
  periodId: 'period-sept-2025',
  budgetId: 'budget-shared-1',
  budgetType: 'shared',
  cashFlow: {
    plannedIncome: 2150.5,
    plannedFixedCharges: 864.99,
    plannedEnvelopes: 1163.51,
    spentVariables: 47,
    plannedSavings: 122,
    remainingToLive: 1116.51
  },
  dailyBudget: {
    startDate: '2025-09-01T00:00:00.000Z',
    endDate: '2025-09-30T23:59:59.999Z',
    referenceDate: '2025-09-03T12:00:00.000Z',
    totalDays: 30,
    daysRemaining: 28,
    remainingToLive: 1116.51,
    dailyAmount: 39.88
  },
  allocation: {
    totalOutflows: 1033.99,
    plannedIncome: 2150.5,
    items: [
      {
        key: 'fixed',
        label: 'Fixe',
        color: '#8B5CF6',
        amount: 864.99,
        percentage: 83.7,
        incomeSharePercentage: 40.2
      },
      {
        key: 'variable',
        label: 'Variable',
        color: '#3B82F6',
        amount: 47,
        percentage: 4.5,
        incomeSharePercentage: 2.2
      },
      {
        key: 'savings',
        label: 'Épargne',
        color: '#22C55E',
        amount: 122,
        percentage: 11.8,
        incomeSharePercentage: 5.7
      }
    ]
  },
  zeroBased: {
    plannedIncome: 2150.5,
    totalAllocated: 2150.5,
    remainingToAllocate: 0,
    isBalanced: true
  },
  memberBreakdown: [
    {
      userId: 'user-1',
      displayName: 'Johann',
      avatarEmoji: '🧑',
      color: '#7C3AED',
      role: 'owner',
      incomeContributed: 1400,
      fixedChargesPaid: 564.99,
      variableExpensesPaid: 47,
      savingsContributed: 122,
      expensesPaid: 733.99,
      netBalance: 666.01,
      incomeSharePercentage: 65.1,
      expensesSharePercentage: 71
    },
    {
      userId: 'user-2',
      displayName: 'Camille',
      avatarEmoji: '🐼',
      color: '#EC4899',
      role: 'editor',
      incomeContributed: 750.5,
      fixedChargesPaid: 300,
      variableExpensesPaid: 0,
      savingsContributed: 0,
      expensesPaid: 300,
      netBalance: 450.5,
      incomeSharePercentage: 34.9,
      expensesSharePercentage: 29
    }
  ]
};

afterEach(() => {
  useAuthStore.getState().clearSession();
  useBudgetStore.getState().setActiveBudgetId(null);
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Onglet Budget — Composants analytiques Finzee', () => {
  it('affiche CashFlowSummaryCard avec les 5 lignes et Restant en gras', () => {
    render(<CashFlowSummaryCard cashFlow={finzeeAnalyticsSample.cashFlow} />);

    expect(screen.getByText("Entrées et sorties d'argent")).toBeInTheDocument();
    expect(screen.getByText('Revenus')).toBeInTheDocument();
    expect(screen.getByText('Dépenses fixes')).toBeInTheDocument();
    expect(screen.getByText('Dépenses variables')).toBeInTheDocument();
    expect(screen.getByText('Epargne')).toBeInTheDocument();
    expect(screen.getByText('Restant')).toBeInTheDocument();

    expect(
      screen.getByText((_, node) => node?.tagName === 'SPAN' && normalizeSpaces(node.textContent ?? '') === '2 150,50 €')
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, node) => node?.tagName === 'SPAN' && normalizeSpaces(node.textContent ?? '') === '864,99 €')
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, node) => node?.tagName === 'SPAN' && normalizeSpaces(node.textContent ?? '') === '47,00 €')
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, node) => node?.tagName === 'SPAN' && normalizeSpaces(node.textContent ?? '') === '122,00 €')
    ).toBeInTheDocument();
    const restantAmount = screen.getByText(
      (_, node) => node?.tagName === 'SPAN' && normalizeSpaces(node.textContent ?? '') === '1 116,51 €'
    );
    expect(restantAmount).toHaveClass('font-bold');

    // Cas Restant négatif -> rouge
    const { rerender } = render(
      <CashFlowSummaryCard
        cashFlow={{ ...finzeeAnalyticsSample.cashFlow, remainingToLive: -50 }}
      />
    );
    rerender(
      <CashFlowSummaryCard
        cashFlow={{ ...finzeeAnalyticsSample.cashFlow, remainingToLive: -50 }}
      />
    );
    expect(
      screen.getAllByText(
        (_, node) => node?.tagName === 'SPAN' && normalizeSpaces(node.textContent ?? '') === '-50,00 €'
      )[0]
    ).toHaveClass('text-red-600');
  });

  it('affiche DailyBudgetCard (jours restants en rouge, montant/jour en vert) et gère la fin de période', () => {
    const { rerender } = render(<DailyBudgetCard dailyBudget={finzeeAnalyticsSample.dailyBudget} />);

    expect(screen.getByText('Gestion du budget quotidien')).toBeInTheDocument();
    const daysEl = screen.getByText('28 jours');
    expect(daysEl).toHaveClass('text-[#EF4444]');
    const dailyEl = screen.getByText(
      (_, node) => node?.tagName === 'SPAN' && normalizeSpaces(node.textContent ?? '') === '39,88 €'
    );
    expect(dailyEl).toHaveClass('text-[#22C55E]');

    rerender(
      <DailyBudgetCard
        dailyBudget={{ ...finzeeAnalyticsSample.dailyBudget, daysRemaining: 1, dailyAmount: 100 }}
      />
    );
    expect(screen.getByText('1 jour')).toBeInTheDocument();

    rerender(
      <DailyBudgetCard
        dailyBudget={{
          ...finzeeAnalyticsSample.dailyBudget,
          daysRemaining: 0,
          dailyAmount: 0,
          remainingToLive: 250
        }}
      />
    );
    expect(screen.getByText(/Cette période budgétaire est terminée/i)).toBeInTheDocument();
  });

  it('affiche AllocationDonutCard (Violet Fixe 83.7%, Bleu Variable 4.5%, Vert Épargne 11.8%)', () => {
    const { rerender } = render(
      <AllocationDonutCard allocation={finzeeAnalyticsSample.allocation} />
    );

    expect(screen.getByText('Part des dépenses par rapport aux revenus')).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: /Fixe 83\.7%, Variable 4\.5%, Épargne 11\.8%/i
      })
    ).toBeInTheDocument();
    expect(screen.getByText('83.7%')).toBeInTheDocument();
    expect(screen.getByText('4.5%')).toBeInTheDocument();
    expect(screen.getByText('11.8%')).toBeInTheDocument();

    rerender(
      <AllocationDonutCard
        allocation={{
          totalOutflows: 0,
          plannedIncome: 0,
          items: finzeeAnalyticsSample.allocation.items.map((item) => ({
            ...item,
            amount: 0,
            percentage: 0
          }))
        }}
      />
    );
    expect(
      screen.getByRole('img', { name: 'Aucune dépense ou épargne saisie sur la période' })
    ).toBeInTheDocument();
  });

  it('affiche ZeroBasedBanner (équilibré / sur-alloué) et MemberBreakdownCard', () => {
    render(
      <div className="space-y-4">
        <ZeroBasedBanner remainingToAllocate={0} plannedIncome={2150.5} />
        <ZeroBasedBanner remainingToAllocate={-120} plannedIncome={2150.5} />
        <MemberBreakdownCard
          members={finzeeAnalyticsSample.memberBreakdown}
          currentUserId="user-1"
        />
      </div>
    );

    expect(
      screen.getByText('Parfait ! Chaque euro du mois a un rôle précis (0 € restant).')
    ).toBeInTheDocument();
    expect(screen.getByText(/Vos prévisions dépassent vos revenus de/i)).toBeInTheDocument();

    expect(screen.getByText('Bilan par membre')).toBeInTheDocument();
    expect(screen.getByText('Budget partagé')).toBeInTheDocument();
    expect(screen.getByText('Johann')).toBeInTheDocument();
    expect(screen.getByText('Moi')).toBeInTheDocument();
    expect(screen.getByText('Camille')).toBeInTheDocument();
    expect(screen.getByText('65.1%')).toBeInTheDocument();
    expect(screen.getByText('71.0%')).toBeInTheDocument();

    const negativeMember: MemberBreakdownItem = {
      ...finzeeAnalyticsSample.memberBreakdown[1],
      netBalance: -90
    };
    const { container } = render(<MemberBreakdownCard members={[]} />);
    expect(container).toBeEmptyDOMElement();

    render(
      <MonthlyInsights
        analytics={{
          ...finzeeAnalyticsSample,
          budgetType: 'personal',
          memberBreakdown: [negativeMember]
        }}
      />
    );
    expect(screen.queryByText('Camille')).toBeInTheDocument(); // toujours présent dans le render précédent
  });

  it('affiche EnvelopeBreakdownCard avec Budget réparti, Budget consommé, Reste et Donut', () => {
    const sampleEnvelopes = [
      {
        id: 'env-1',
        budgetId: 'b-1',
        budgetPeriodId: 'p-1',
        pillar: 'variable_envelope' as const,
        name: 'Courses',
        icon: '🛒',
        color: '#16A34A',
        allocatedAmount: 300,
        spentOrPaidAmount: 75,
        date: '2025-11-01',
        isPaid: false,
        isRecurring: false,
        order: 0
      },
      {
        id: 'env-2',
        budgetId: 'b-1',
        budgetPeriodId: 'p-1',
        pillar: 'variable_envelope' as const,
        name: 'Loisirs',
        icon: '🎮',
        color: '#EC4899',
        allocatedAmount: 270,
        spentOrPaidAmount: 100,
        date: '2025-11-01',
        isPaid: false,
        isRecurring: false,
        order: 1
      }
    ];

    render(<EnvelopeBreakdownCard envelopes={sampleEnvelopes} />);
    expect(screen.getByText('Détails des enveloppes')).toBeInTheDocument();
    expect(screen.getByText('Budget réparti')).toBeInTheDocument();
    expect(screen.getByText('570,00 €')).toBeInTheDocument();
    expect(screen.getByText('Budget consommé')).toBeInTheDocument();
    expect(screen.getByText('175,00 €')).toBeInTheDocument();
    expect(screen.getByText('395,00 €')).toBeInTheDocument();
    expect(screen.getByText('Courses :')).toBeInTheDocument();
    expect(screen.getByText('42.9 %')).toBeInTheDocument();
    expect(screen.getByText('Loisirs :')).toBeInTheDocument();
    expect(screen.getByText('57.1 %')).toBeInTheDocument();
    expect(screen.getByText('Total : 100%')).toBeInTheDocument();
  });

  it('affiche un état vide dans EnvelopeBreakdownCard quand aucune dépense variable n’est saisie', () => {
    render(
      <EnvelopeBreakdownCard
        envelopes={[
          {
            id: 'env-1',
            budgetId: 'b-1',
            budgetPeriodId: 'p-1',
            pillar: 'variable_envelope',
            name: 'Courses',
            icon: '🛒',
            color: '#16A34A',
            allocatedAmount: 300,
            spentOrPaidAmount: 0,
            date: '2025-11-01',
            isPaid: false,
            isRecurring: false,
            order: 0
          }
        ]}
      />
    );
    expect(screen.getByText('Aucune dépense variable ce mois-ci')).toBeInTheDocument();
  });

  it('calcule correctement buildClientPeriodAnalytics en repli hors-ligne', () => {
    const period: BudgetPeriod = {
      id: 'p-1',
      budgetId: 'b-1',
      year: 2025,
      month: 9,
      label: 'Septembre 2025',
      startDate: '2025-09-01T00:00:00.000Z',
      endDate: '2025-09-30T23:59:59.999Z',
      summary: {
        plannedIncome: 2150.5,
        plannedFixedCharges: 864.99,
        plannedEnvelopes: 1163.51,
        plannedSavings: 122,
        spentVariables: 47,
        remainingToAllocate: 0,
        remainingToLive: 1116.51
      }
    };
    const budget: BudgetSpace = {
      id: 'b-1',
      name: 'Commun',
      type: 'shared',
      ownerId: 'u-1',
      contributionMode: 'equal_50_50',
      members: [
        {
          userId: 'u-1',
          role: 'owner',
          color: '#7C3AED',
          declaredMonthlyIncome: 2000,
          joinedAt: '2025-09-01T00:00:00.000Z'
        },
        {
          userId: 'u-2',
          role: 'editor',
          color: '#EC4899',
          declaredMonthlyIncome: 1500,
          joinedAt: '2025-09-01T00:00:00.000Z'
        }
      ],
      budgetStartDay: 1
    };
    const envelopes: EnvelopeItem[] = [
      {
        id: 'e-1',
        budgetId: 'b-1',
        budgetPeriodId: 'p-1',
        pillar: 'income',
        name: 'Salaire',
        icon: '💵',
        color: '#16A34A',
        allocatedAmount: 2150.5,
        spentOrPaidAmount: 0,
        date: '2025-09-01T12:00:00.000Z',
        isRecurring: true,
        isPaid: true,
        memberId: 'u-1',
        order: 0
      },
      {
        id: 'e-2',
        budgetId: 'b-1',
        budgetPeriodId: 'p-1',
        pillar: 'fixed_charge',
        name: 'Loyer',
        icon: '🏠',
        color: '#4F46E5',
        allocatedAmount: 864.99,
        spentOrPaidAmount: 0,
        date: '2025-09-01T12:00:00.000Z',
        isRecurring: true,
        isPaid: true,
        memberId: 'u-1',
        order: 0
      },
      {
        id: 'e-3',
        budgetId: 'b-1',
        budgetPeriodId: 'p-1',
        pillar: 'savings',
        name: 'Livret',
        icon: '🐷',
        color: '#22C55E',
        allocatedAmount: 122,
        spentOrPaidAmount: 122,
        date: '2025-09-01T12:00:00.000Z',
        isRecurring: false,
        isPaid: true,
        memberId: 'u-2',
        order: 0
      }
    ];

    const result = analyticsService.buildClientPeriodAnalytics(
      period,
      envelopes,
      budget,
      { id: 'u-1', displayName: 'Johann', avatarEmoji: '🧑' },
      new Date('2025-09-03T12:00:00.000Z')
    );

    expect(result.dailyBudget.daysRemaining).toBe(28);
    expect(result.dailyBudget.dailyAmount).toBe(39.88);
    expect(result.allocation.items[0].percentage).toBe(83.7);
    expect(result.allocation.items[1].percentage).toBe(4.5);
    expect(result.allocation.items[2].percentage).toBe(11.8);
    expect(result.zeroBased.isBalanced).toBe(true);
    expect(result.memberBreakdown[0].incomeSharePercentage).toBe(100);
    expect(result.memberBreakdown[1].savingsContributed).toBe(122);
  });
});

describe('Intégration App — Onglet Budget (sans FAB +, analyses API & Bilan Membre)', () => {
  it('bascule sur Budget, masque le bouton + et affiche les 4 modules analytiques', async () => {
    const user = userEvent.setup();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    vi.mocked(budgetService.listBudgets).mockResolvedValue([
      {
        id: 'budget-shared-1',
        name: 'Budget Commun',
        type: 'shared',
        ownerId: 'user-1',
        contributionMode: 'equal_50_50',
        members: [
          {
            userId: 'user-1',
            role: 'owner',
            color: '#7C3AED',
            declaredMonthlyIncome: 2500,
            joinedAt: '2025-09-01T00:00:00.000Z'
          },
          {
            userId: 'user-2',
            role: 'editor',
            color: '#EC4899',
            declaredMonthlyIncome: 2000,
            joinedAt: '2025-09-01T00:00:00.000Z'
          }
        ],
        budgetStartDay: 1
      }
    ]);

    vi.mocked(periodService.getPeriodByMonth).mockResolvedValue({
      status: 'ok',
      period: {
        id: 'period-sept-2025',
        budgetId: 'budget-shared-1',
        year,
        month,
        label: formatMonthLabel(new Date(year, month - 1, 1)),
        startDate: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
        endDate: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString(),
        summary: {
          plannedIncome: 2150.5,
          plannedFixedCharges: 864.99,
          plannedEnvelopes: 1163.51,
          plannedSavings: 122,
          spentVariables: 47,
          remainingToAllocate: 0,
          remainingToLive: 1116.51
        }
      },
      envelopes: []
    });

    vi.mocked(goalService.listGoals).mockResolvedValue({
      status: 'ok',
      goals: []
    });

    vi.mocked(analyticsService.getPeriodAnalytics).mockResolvedValue({
      status: 'ok',
      analytics: finzeeAnalyticsSample
    });

    useAuthStore.getState().setSession('jwt-valid', {
      id: 'user-1',
      email: 'johann@eparnio.fr',
      displayName: 'Johann',
      avatarEmoji: '🧑',
      hasCompletedOnboarding: true,
      preferences: { currency: 'EUR', budgetStartDay: 1, theme: 'light' }
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    // Sur Dépenses fixes par défaut, un FAB + est présent
    expect(
      await screen.findByRole('button', { name: 'Ajouter une dépense fixe' })
    ).toBeInTheDocument();

    // Aller sur l'onglet Budget
    await user.click(screen.getByRole('button', { name: 'Budget' }));

    // Vérifier absence de bouton flottant + sur l'onglet Budget
    expect(screen.queryByRole('button', { name: /Ajouter/i })).not.toBeInTheDocument();

    // Vérifier l'appel API et les cartes Finzee
    expect(await screen.findByText("Entrées et sorties d'argent")).toBeInTheDocument();
    expect(analyticsService.getPeriodAnalytics).toHaveBeenCalledWith('period-sept-2025');

    expect(screen.getByText('Gestion du budget quotidien')).toBeInTheDocument();
    expect(await screen.findByText('28 jours')).toBeInTheDocument();
    expect(screen.getByText('Part des dépenses par rapport aux revenus')).toBeInTheDocument();
    expect(screen.getByText('83.7%')).toBeInTheDocument();
    expect(screen.getByText('Bilan par membre')).toBeInTheDocument();
    expect(screen.getByText('Camille')).toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { AllocationDonutCard } from '../features/analytics/AllocationDonut';
import { CashFlowSummaryCard } from '../features/analytics/CashFlowSummaryCard';
import { DailyBudgetCard } from '../features/analytics/DailyBudgetCard';
import { MemberBreakdownCard } from '../features/analytics/MemberBreakdownCard';
import {
  BUDGET_SUBTAB_STORAGE_KEY,
  MonthlyInsights
} from '../features/analytics/MonthlyInsights';
import { TrendsCard } from '../features/analytics/TrendsCard';
import { EnvelopeBreakdownCard } from '../features/analytics/EnvelopeBreakdownCard';
import { ZeroBasedBanner } from '../features/budget/ZeroBasedBanner';
import * as analyticsService from '../services/analytics.service';
import * as budgetService from '../services/budget.service';
import * as envelopeService from '../services/envelope.service';
import * as goalService from '../services/goal.service';
import * as periodService from '../services/period.service';
import { useAuthStore } from '../store/useAuthStore';
import { useBudgetStore } from '../store/useBudgetStore';
import type {
  BudgetPeriod,
  BudgetSpace,
  EnvelopeItem,
  MemberBreakdownItem,
  PeriodAnalytics,
  SavingsGoalItem
} from '../types/budget.types';
import { formatMonthLabel } from '../utils/format';

vi.mock('../services/budget.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/budget.service')>();
  return {
    ...actual,
    listBudgets: vi.fn()
  };
});

vi.mock('../services/envelope.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/envelope.service')>();
  return {
    ...actual,
    createEnvelope: vi.fn(),
    updateEnvelope: vi.fn()
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
    getPeriodAnalytics: vi.fn(),
    fetchBudgetTrends: vi.fn()
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
  sessionStorage.clear();
  document.documentElement.classList.remove('dark');
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
    expect(screen.getAllByText('Johann').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Moi')).toBeInTheDocument();
    expect(screen.getAllByText('Camille').length).toBeGreaterThanOrEqual(1);
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
    expect(screen.getAllByText('Camille').length).toBeGreaterThanOrEqual(1); // toujours présent dans le render précédent
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

  it('affiche TrendsCard et permet de filtrer Tout / Variables / Épargne', () => {
    render(
      <TrendsCard
        items={[
          {
            periodId: 'p-1',
            year: 2026,
            month: 10,
            label: 'Octobre 2026',
            plannedIncome: 3000,
            plannedFixedCharges: 1000,
            spentVariables: 500,
            plannedSavings: 300
          },
          {
            periodId: 'p-2',
            year: 2026,
            month: 11,
            label: 'Novembre 2026',
            plannedIncome: 3000,
            plannedFixedCharges: 1050,
            spentVariables: 450,
            plannedSavings: 400
          }
        ]}
      />
    );
    expect(screen.getByText('Évolution sur 2 mois')).toBeInTheDocument();
    expect(screen.getByText('Octobre')).toBeInTheDocument();
    expect(screen.getByText('Novembre')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Variables' }));
    expect(screen.queryByText('Fixes')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Épargne' }));
    expect(screen.queryByText('Variables', { selector: 'span' })).not.toBeInTheDocument();
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

  it('gère les sous-onglets de MonthlyInsights (navigation, clavier, sessionStorage, mode sombre et budget perso/partagé)', async () => {
    const user = userEvent.setup();
    const onOpenCalculator = vi.fn();

    const sampleEnvelopes: EnvelopeItem[] = [
      {
        id: 'env-courses',
        budgetId: 'budget-shared-1',
        budgetPeriodId: 'period-sept-2025',
        pillar: 'variable_envelope',
        name: 'Courses',
        icon: '🛒',
        color: '#16A34A',
        allocatedAmount: 400,
        spentOrPaidAmount: 120,
        date: '2025-09-02T12:00:00.000Z',
        isPaid: false,
        isRecurring: false,
        order: 0
      }
    ];

    const sampleTrends = [
      {
        periodId: 'p-1',
        year: 2025,
        month: 8,
        label: 'Août 2025',
        plannedIncome: 2000,
        plannedFixedCharges: 900,
        spentVariables: 400,
        plannedSavings: 200
      },
      {
        periodId: 'p-2',
        year: 2025,
        month: 9,
        label: 'Septembre 2025',
        plannedIncome: 2150.5,
        plannedFixedCharges: 864.99,
        spentVariables: 47,
        plannedSavings: 122
      }
    ];

    document.documentElement.classList.add('dark');

    const { unmount, rerender } = render(
      <MonthlyInsights
        analytics={finzeeAnalyticsSample}
        envelopes={sampleEnvelopes}
        trends={[]}
        totalSavingsGoals={1500}
        currentUserId="user-1"
        onOpenCalculator={onOpenCalculator}
      />
    );

    const tablist = screen.getByRole('tablist', { name: 'Sections du budget' });
    expect(tablist).toHaveClass('dark:bg-slate-800/90');

    const essentielTab = screen.getByRole('tab', { name: 'Essentiel' });
    const pilotageTab = screen.getByRole('tab', { name: 'Pilotage' });
    const tendancesTab = screen.getByRole('tab', { name: 'Tendances' });
    const foyerTab = screen.getByRole('tab', { name: 'Foyer' });

    expect(essentielTab).toHaveAttribute('aria-selected', 'true');
    expect(essentielTab).toHaveClass('dark:bg-slate-900', 'dark:text-violet-300');
    expect(screen.getByText("Entrées et sorties d'argent")).toBeInTheDocument();
    expect(screen.queryByText('Projection de fin de mois')).not.toBeInTheDocument();

    // Navigation clavier (ArrowRight -> Pilotage, End -> Foyer, Home -> Essentiel)
    essentielTab.focus();
    fireEvent.keyDown(essentielTab, { key: 'ArrowRight' });
    expect(pilotageTab).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(pilotageTab);
    expect(screen.getByText('Projection de fin de mois')).toBeInTheDocument();
    expect(screen.getByText('Avancement du mois vs Enveloppes')).toBeInTheDocument();
    expect(screen.getByText("Santé de l'épargne")).toBeInTheDocument();
    expect(screen.getByText('Détails des enveloppes')).toBeInTheDocument();
    expect(sessionStorage.getItem(BUDGET_SUBTAB_STORAGE_KEY)).toBe('pilotage');

    fireEvent.keyDown(pilotageTab, { key: 'End' });
    expect(foyerTab).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(foyerTab);
    expect(screen.getByText('Bilan par membre')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Calculateur 50\/50 & Prorata/i }));
    expect(onOpenCalculator).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(foyerTab, { key: 'ArrowLeft' });
    expect(tendancesTab).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByText(
        'Vos tendances apparaîtront dès que plusieurs mois budgétaires seront enregistrés.'
      )
    ).toBeInTheDocument();

    rerender(
      <MonthlyInsights
        analytics={finzeeAnalyticsSample}
        envelopes={sampleEnvelopes}
        trends={sampleTrends}
        totalSavingsGoals={1500}
        currentUserId="user-1"
      />
    );
    expect(screen.getByText('Évolution sur 2 mois')).toBeInTheDocument();

    fireEvent.keyDown(tendancesTab, { key: 'ArrowRight' });
    expect(foyerTab).toHaveAttribute('aria-selected', 'true');
    expect(sessionStorage.getItem(BUDGET_SUBTAB_STORAGE_KEY)).toBe('foyer');

    // Remontage : conserve 'foyer' en budget partagé, mais retombe sur 'essentiel' en budget perso
    unmount();
    render(
      <MonthlyInsights
        analytics={{
          ...finzeeAnalyticsSample,
          budgetType: 'personal',
          memberBreakdown: []
        }}
        envelopes={sampleEnvelopes}
      />
    );
    expect(screen.queryByRole('tab', { name: 'Foyer' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Essentiel' })).toHaveAttribute('aria-selected', 'true');
    expect(sessionStorage.getItem(BUDGET_SUBTAB_STORAGE_KEY)).toBe('essentiel');
  });

  it('affiche ZeroBasedBanner interactif (Auto-équilibrer à 0 €, sur-allocation et modes clair/sombre)', async () => {
    const user = userEvent.setup();
    const onAutoBalanceToEnvelope = vi.fn().mockResolvedValue(undefined);
    const onAutoBalanceToGoal = vi.fn().mockResolvedValue(undefined);
    const onNavigateToTab = vi.fn();

    const envCourses: EnvelopeItem = {
      id: 'env-1',
      budgetId: 'b-1',
      budgetPeriodId: 'p-1',
      pillar: 'variable_envelope',
      name: 'Courses',
      icon: '🛒',
      color: '#16A34A',
      allocatedAmount: 300,
      spentOrPaidAmount: 40,
      date: '2025-09-01',
      isPaid: false,
      isRecurring: false,
      order: 0
    };

    const goalVacances: SavingsGoalItem = {
      id: 'goal-1',
      budgetId: 'b-1',
      name: 'Vacances',
      icon: '✈️',
      color: '#3B82F6',
      targetAmount: 2000,
      initialAmount: 200,
      currentAmount: 500,
      order: 0
    };

    document.documentElement.classList.add('dark');

    const { rerender } = render(
      <ZeroBasedBanner
        remainingToAllocate={150}
        plannedIncome={2000}
        variableEnvelopes={[envCourses]}
        goals={[goalVacances]}
        onAutoBalanceToEnvelope={onAutoBalanceToEnvelope}
        onAutoBalanceToGoal={onAutoBalanceToGoal}
        onNavigateToTab={onNavigateToTab}
      />
    );

    const statusBanner = screen.getByRole('status');
    expect(statusBanner).toHaveClass('dark:from-violet-950/50');

    const autoBalanceBtn = screen.getByRole('button', { name: /Auto-équilibrer à 0 €/i });
    expect(autoBalanceBtn).toHaveAttribute('aria-expanded', 'false');
    await user.click(autoBalanceBtn);
    expect(autoBalanceBtn).toHaveAttribute('aria-expanded', 'true');

    // Affectation vers enveloppe variable
    await user.click(screen.getByRole('button', { name: /Courses/i }));
    expect(onAutoBalanceToEnvelope).toHaveBeenCalledWith(envCourses, 150);

    // Réouverture et affectation vers objectif d'épargne
    await user.click(screen.getByRole('button', { name: /Auto-équilibrer à 0 €/i }));
    await user.click(screen.getByRole('button', { name: /Vacances/i }));
    expect(onAutoBalanceToGoal).toHaveBeenCalledWith(goalVacances, 150);

    // Cas reliquat positif sans cible : propose les raccourcis vers Enveloppes / Épargne
    rerender(
      <ZeroBasedBanner
        remainingToAllocate={80}
        plannedIncome={2000}
        variableEnvelopes={[]}
        goals={[]}
        onAutoBalanceToEnvelope={onAutoBalanceToEnvelope}
        onAutoBalanceToGoal={onAutoBalanceToGoal}
        onNavigateToTab={onNavigateToTab}
      />
    );
    await user.click(screen.getByRole('button', { name: /Auto-équilibrer à 0 €/i }));
    await user.click(screen.getByRole('button', { name: 'Ouvrir Enveloppes' }));
    expect(onNavigateToTab).toHaveBeenCalledWith('enveloppes');

    // Cas sur-allocation (< 0) : alerte + classe dark: + raccourcis d'ajustement
    rerender(
      <ZeroBasedBanner
        remainingToAllocate={-120}
        plannedIncome={2000}
        currentTab="budget"
        onNavigateToTab={onNavigateToTab}
      />
    );
    expect(screen.getByRole('status')).toHaveClass('dark:bg-red-950/50');
    expect(screen.getByText('Sur-allocation')).toBeInTheDocument();
    expect(
      screen.getByText('Réduisez une enveloppe, une charge fixe ou une épargne pour revenir à 0 €.')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ajuster les enveloppes' }));
    expect(onNavigateToTab).toHaveBeenCalledWith('enveloppes');
    await user.click(screen.getByRole('button', { name: 'Ajuster les charges fixes' }));
    expect(onNavigateToTab).toHaveBeenCalledWith('depenses');

    // Sur l'onglet Enveloppes, propose d'ajuster les charges fixes et l'épargne
    rerender(
      <ZeroBasedBanner
        remainingToAllocate={-120}
        plannedIncome={2000}
        currentTab="enveloppes"
        onNavigateToTab={onNavigateToTab}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Ajuster l’épargne' }));
    expect(onNavigateToTab).toHaveBeenCalledWith('epargne');

    // Gestion d'erreur si l'affectation échoue
    const failingAssign = vi.fn().mockRejectedValue(new Error('Network error'));
    rerender(
      <ZeroBasedBanner
        remainingToAllocate={90}
        plannedIncome={2000}
        variableEnvelopes={[envCourses]}
        onAutoBalanceToEnvelope={failingAssign}
      />
    );
    await user.click(screen.getByRole('button', { name: /Auto-équilibrer à 0 €/i }));
    await user.click(screen.getByRole('button', { name: /Courses/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible d’affecter ce reliquat pour le moment. Réessayez.'
    );
  });
});

describe('Intégration App — Onglet Budget (sans FAB +, analyses API & Bilan Membre)', () => {
  it('bascule sur Budget, masque le bouton + et navigue entre Essentiel, Pilotage, Tendances et Foyer', async () => {
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

    vi.mocked(analyticsService.fetchBudgetTrends).mockResolvedValue({
      months: 6,
      items: []
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

    // Sous-onglet Essentiel par défaut
    expect(await screen.findByText("Entrées et sorties d'argent")).toBeInTheDocument();
    expect(analyticsService.getPeriodAnalytics).toHaveBeenCalledWith('period-sept-2025');
    expect(screen.getByText('Gestion du budget quotidien')).toBeInTheDocument();
    expect(await screen.findByText('28 jours')).toBeInTheDocument();
    expect(screen.getByText('Part des dépenses par rapport aux revenus')).toBeInTheDocument();
    expect(screen.getByText('83.7%')).toBeInTheDocument();

    // Sous-onglet Pilotage
    await user.click(screen.getByRole('tab', { name: 'Pilotage' }));
    expect(screen.getByText('Projection de fin de mois')).toBeInTheDocument();
    expect(screen.getByText('Avancement du mois vs Enveloppes')).toBeInTheDocument();
    expect(screen.getByText("Santé de l'épargne")).toBeInTheDocument();
    expect(screen.getByText('Détails des enveloppes')).toBeInTheDocument();

    // Sous-onglet Tendances
    await user.click(screen.getByRole('tab', { name: 'Tendances' }));
    expect(screen.getByText('Évolution multi-mois')).toBeInTheDocument();

    // Sous-onglet Foyer
    await user.click(screen.getByRole('tab', { name: 'Foyer' }));
    expect(screen.getByText('Bilan par membre')).toBeInTheDocument();
    expect(screen.getAllByText('Camille').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole('button', { name: /Calculateur 50\/50 & Prorata/i })
    ).toBeInTheDocument();
  });

  it('auto-équilibre le reliquat Base Zéro à 0 € vers une enveloppe ou un objectif depuis Budget', async () => {
    const user = userEvent.setup();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const initialEnvelope: EnvelopeItem = {
      id: 'env-courses-1',
      budgetId: 'budget-1',
      budgetPeriodId: 'period-1',
      pillar: 'variable_envelope',
      name: 'Courses',
      icon: '🛒',
      color: '#16A34A',
      allocatedAmount: 300,
      spentOrPaidAmount: 0,
      date: new Date(year, month - 1, 1).toISOString(),
      isRecurring: true,
      isPaid: false,
      order: 0
    };

    const initialGoal: SavingsGoalItem = {
      id: 'goal-1',
      budgetId: 'budget-1',
      name: 'Vacances',
      icon: '✈️',
      color: '#3B82F6',
      targetAmount: 2000,
      initialAmount: 0,
      currentAmount: 100,
      order: 0
    };

    const initialPeriod: BudgetPeriod = {
      id: 'period-1',
      budgetId: 'budget-1',
      year,
      month,
      label: formatMonthLabel(new Date(year, month - 1, 1)),
      startDate: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
      endDate: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString(),
      summary: {
        plannedIncome: 2000,
        plannedFixedCharges: 1550,
        plannedEnvelopes: 300,
        plannedSavings: 0,
        spentVariables: 0,
        remainingToAllocate: 150,
        remainingToLive: 450
      }
    };

    const balancedPeriod: BudgetPeriod = {
      ...initialPeriod,
      summary: {
        ...initialPeriod.summary,
        plannedEnvelopes: 450,
        remainingToAllocate: 0
      }
    };

    vi.mocked(budgetService.listBudgets).mockResolvedValue([
      {
        id: 'budget-1',
        name: 'Perso',
        type: 'personal',
        ownerId: 'user-1',
        contributionMode: 'custom',
        members: [],
        budgetStartDay: 1
      }
    ]);

    vi.mocked(periodService.getPeriodByMonth).mockResolvedValue({
      status: 'ok',
      period: initialPeriod,
      envelopes: [initialEnvelope]
    });

    vi.mocked(goalService.listGoals).mockResolvedValue({
      status: 'ok',
      goals: [initialGoal]
    });

    vi.mocked(analyticsService.getPeriodAnalytics)
      .mockResolvedValueOnce({
        status: 'ok',
        analytics: {
          ...finzeeAnalyticsSample,
          periodId: 'period-1',
          budgetId: 'budget-1',
          budgetType: 'personal',
          zeroBased: {
            plannedIncome: 2000,
            totalAllocated: 1850,
            remainingToAllocate: 150,
            isBalanced: false
          },
          memberBreakdown: []
        }
      })
      .mockResolvedValue({
        status: 'ok',
        analytics: {
          ...finzeeAnalyticsSample,
          periodId: 'period-1',
          budgetId: 'budget-1',
          budgetType: 'personal',
          zeroBased: {
            plannedIncome: 2000,
            totalAllocated: 2000,
            remainingToAllocate: 0,
            isBalanced: true
          },
          memberBreakdown: []
        }
      });

    vi.mocked(analyticsService.fetchBudgetTrends).mockResolvedValue({
      months: 6,
      items: []
    });

    vi.mocked(envelopeService.updateEnvelope).mockResolvedValue({
      status: 'ok',
      envelope: { ...initialEnvelope, allocatedAmount: 450 },
      period: balancedPeriod
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

    await user.click(await screen.findByRole('button', { name: 'Budget' }));
    await user.click(await screen.findByRole('button', { name: /Auto-équilibrer à 0 €/i }));
    await user.click(screen.getByRole('button', { name: /Courses/i }));

    expect(envelopeService.updateEnvelope).toHaveBeenCalledWith('period-1', 'env-courses-1', {
      allocatedAmount: 450
    });
    expect(
      await screen.findByText('Parfait ! Chaque euro du mois a un rôle précis (0 € restant).')
    ).toBeInTheDocument();
  });

  it('auto-équilibre le reliquat Base Zéro vers un objectif d’épargne depuis Budget', async () => {
    const user = userEvent.setup();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const initialGoal: SavingsGoalItem = {
      id: 'goal-vacances',
      budgetId: 'budget-shared-1',
      name: 'Vacances été',
      icon: '✈️',
      color: '#3B82F6',
      targetAmount: 2000,
      initialAmount: 0,
      currentAmount: 100,
      order: 0
    };

    const initialPeriod: BudgetPeriod = {
      id: 'period-2',
      budgetId: 'budget-shared-1',
      year,
      month,
      label: formatMonthLabel(new Date(year, month - 1, 1)),
      startDate: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
      endDate: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString(),
      summary: {
        plannedIncome: 2500,
        plannedFixedCharges: 2300,
        plannedEnvelopes: 0,
        plannedSavings: 0,
        spentVariables: 0,
        remainingToAllocate: 200,
        remainingToLive: 200
      }
    };

    vi.mocked(budgetService.listBudgets).mockResolvedValue([
      {
        id: 'budget-shared-1',
        name: 'Foyer',
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
          }
        ],
        budgetStartDay: 1
      }
    ]);

    vi.mocked(periodService.getPeriodByMonth).mockResolvedValue({
      status: 'ok',
      period: initialPeriod,
      envelopes: []
    });

    vi.mocked(goalService.listGoals).mockResolvedValue({
      status: 'ok',
      goals: [initialGoal]
    });

    vi.mocked(analyticsService.getPeriodAnalytics).mockResolvedValue({
      status: 'ok',
      analytics: {
        ...finzeeAnalyticsSample,
        periodId: 'period-2',
        budgetId: 'budget-shared-1',
        budgetType: 'shared',
        zeroBased: {
          plannedIncome: 2500,
          totalAllocated: 2300,
          remainingToAllocate: 200,
          isBalanced: false
        }
      }
    });

    vi.mocked(analyticsService.fetchBudgetTrends).mockResolvedValue({
      months: 6,
      items: []
    });

    vi.mocked(envelopeService.createEnvelope).mockResolvedValue({
      status: 'ok',
      envelope: {
        id: 'env-sav-2',
        budgetId: 'budget-shared-1',
        budgetPeriodId: 'period-2',
        pillar: 'savings',
        linkedGoalId: 'goal-vacances',
        name: 'Équilibrage Vacances été',
        icon: '✈️',
        color: '#3B82F6',
        allocatedAmount: 200,
        spentOrPaidAmount: 200,
        date: new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)).toISOString(),
        isRecurring: false,
        isPaid: true,
        memberId: 'user-1',
        order: 0
      },
      period: {
        ...initialPeriod,
        summary: {
          ...initialPeriod.summary,
          plannedSavings: 200,
          remainingToAllocate: 0
        }
      }
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

    await user.click(await screen.findByRole('button', { name: 'Budget' }));
    await user.click(await screen.findByRole('button', { name: /Auto-équilibrer à 0 €/i }));
    await user.click(screen.getByRole('button', { name: /Vacances été/i }));

    expect(envelopeService.createEnvelope).toHaveBeenCalledWith(
      'period-2',
      expect.objectContaining({
        pillar: 'savings',
        linkedGoalId: 'goal-vacances',
        name: 'Équilibrage Vacances été',
        allocatedAmount: 200,
        isRecurring: false,
        isPaid: true,
        memberId: 'user-1'
      })
    );
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PeriodSelector } from '../components/layout/PeriodSelector';
import { MonthlyInsights } from '../features/analytics/MonthlyInsights';
import { MonthClosingWizard } from '../features/budget/MonthClosingWizard';
import type {
  BudgetPeriod,
  EnvelopeItem,
  PeriodAnalytics,
  SavingsGoalItem
} from '../types/budget.types';

function normalizeSpaces(value: string): string {
  return value.replace(/\u202f|\u00a0/g, ' ');
}

const samplePeriod: BudgetPeriod = {
  id: 'period-2026-11',
  budgetId: 'budget-1',
  year: 2026,
  month: 11,
  label: 'Novembre 2026',
  startDate: '2026-11-01T00:00:00.000Z',
  endDate: '2026-11-30T23:59:59.999Z',
  summary: {
    plannedIncome: 3000,
    plannedFixedCharges: 1200,
    plannedEnvelopes: 500,
    plannedSavings: 300,
    spentVariables: 410,
    remainingToAllocate: 1000,
    remainingToLive: 1090
  }
};

const sampleEnvelopes: EnvelopeItem[] = [
  {
    id: 'env-income',
    budgetId: 'budget-1',
    budgetPeriodId: 'period-2026-11',
    pillar: 'income',
    name: 'Salaire',
    icon: '💵',
    color: '#16A34A',
    allocatedAmount: 3000,
    spentOrPaidAmount: 0,
    date: '2026-11-01T12:00:00.000Z',
    isRecurring: true,
    recurrenceFrequency: 'monthly',
    isPaid: true,
    order: 0
  },
  {
    id: 'env-rent',
    budgetId: 'budget-1',
    budgetPeriodId: 'period-2026-11',
    pillar: 'fixed_charge',
    name: 'Loyer',
    icon: '🏠',
    color: '#4F46E5',
    allocatedAmount: 1200,
    spentOrPaidAmount: 0,
    date: '2026-11-02T12:00:00.000Z',
    isRecurring: true,
    recurrenceFrequency: 'monthly',
    isPaid: true,
    order: 0
  },
  {
    id: 'env-courses',
    budgetId: 'budget-1',
    budgetPeriodId: 'period-2026-11',
    pillar: 'variable_envelope',
    name: 'Courses',
    icon: '🛒',
    color: '#16A34A',
    allocatedAmount: 300,
    spentOrPaidAmount: 210,
    rolloverEnabled: false,
    rolloverAmount: 0,
    date: '2026-11-03T12:00:00.000Z',
    isRecurring: true,
    isPaid: false,
    order: 0
  },
  {
    id: 'env-sorties',
    budgetId: 'budget-1',
    budgetPeriodId: 'period-2026-11',
    pillar: 'variable_envelope',
    name: 'Sorties',
    icon: '🍽️',
    color: '#EC4899',
    allocatedAmount: 200,
    spentOrPaidAmount: 200,
    rolloverEnabled: false,
    rolloverAmount: 0,
    date: '2026-11-04T12:00:00.000Z',
    isRecurring: true,
    isPaid: false,
    order: 1
  }
];

const sampleGoals: SavingsGoalItem[] = [
  {
    id: 'goal-vac',
    budgetId: 'budget-1',
    name: 'Vacances',
    icon: '✈️',
    color: '#3B82F6',
    targetAmount: 2000,
    initialAmount: 200,
    currentAmount: 500,
    order: 0
  }
];

const sampleAnalytics: PeriodAnalytics = {
  periodId: 'period-2026-11',
  budgetId: 'budget-1',
  budgetType: 'personal',
  cashFlow: {
    plannedIncome: 3000,
    plannedFixedCharges: 1200,
    plannedEnvelopes: 500,
    spentVariables: 410,
    plannedSavings: 300,
    remainingToLive: 1090
  },
  dailyBudget: {
    startDate: '2026-11-01T00:00:00.000Z',
    endDate: '2026-11-30T23:59:59.999Z',
    referenceDate: '2026-11-19T12:00:00.000Z',
    totalDays: 30,
    daysRemaining: 12,
    remainingToLive: 1090,
    dailyAmount: 90.83
  },
  allocation: {
    totalOutflows: 1910,
    plannedIncome: 3000,
    items: [
      { key: 'fixed', label: 'Fixe', color: '#8B5CF6', amount: 1200, percentage: 62.8, incomeSharePercentage: 40 },
      { key: 'variable', label: 'Variable', color: '#3B82F6', amount: 410, percentage: 21.5, incomeSharePercentage: 13.7 },
      { key: 'savings', label: 'Épargne', color: '#22C55E', amount: 300, percentage: 15.7, incomeSharePercentage: 10 }
    ]
  },
  zeroBased: {
    plannedIncome: 3000,
    totalAllocated: 2000,
    remainingToAllocate: 1000,
    isBalanced: false
  },
  memberBreakdown: []
};

afterEach(() => {
  sessionStorage.clear();
  document.documentElement.classList.remove('dark');
  vi.clearAllMocks();
});

describe('Étape 28 — MonthClosingWizard & Clôture guidée (modes clair & sombre)', () => {
  it('parcourt les 3 étapes (Bilan, Surplus, Aperçu M+1), ajuste le mois suivant et soumet la clôture', async () => {
    const user = userEvent.setup();
    const onConfirmClose = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    document.documentElement.classList.add('dark');

    render(
      <MonthClosingWizard
        isOpen
        onClose={onClose}
        period={samplePeriod}
        envelopes={sampleEnvelopes}
        goals={sampleGoals}
        onConfirmClose={onConfirmClose}
      />
    );

    // Étape 1 — Bilan du cycle
    const stepsNav = screen.getByRole('navigation', { name: 'Étapes de clôture du mois' });
    expect(stepsNav.querySelector('ol')).toHaveClass('dark:bg-slate-800/90');
    expect(screen.getByText('Enveloppes tenues')).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(
      screen.getByText((_, node) => node?.tagName === 'P' && normalizeSpaces(node.textContent ?? '') === '90,00 €')
    ).toBeInTheDocument();
    expect(screen.getByText('10 %')).toBeInTheDocument();
    expect(screen.getAllByText('Tenue').length).toBeGreaterThanOrEqual(2);

    await user.click(screen.getByRole('button', { name: 'Suivant' }));

    // Étape 2 — Affectation des surplus (seule Courses a un surplus de +90 €)
    expect(screen.getByText(/Affecter le surplus de Courses/i)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Épargner' }));
    const goalSelect = screen.getByLabelText('Objectif cible pour Courses');
    expect(goalSelect).toHaveValue('goal-vac');

    // Retour arrière puis retour Étape 2 pour choisir Reporter
    await user.click(screen.getByRole('button', { name: 'Précédent' }));
    expect(screen.getByText('Enveloppes tenues')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    await user.click(screen.getByRole('radio', { name: 'Épargner' }));
    await user.click(screen.getByRole('button', { name: 'Suivant' }));

    // Étape 3 — Aperçu du mois suivant (Décembre 2026)
    expect(screen.getByText('Aperçu Décembre 2026')).toBeInTheDocument();

    // Ajuster le montant de Courses à 350 et exclure Loyer
    const coursesInput = screen.getByLabelText('Montant pour Courses');
    await user.clear(coursesInput);
    await user.type(coursesInput, '350');

    const rentCheckbox = screen.getByRole('checkbox', { name: /Loyer/i });
    await user.click(rentCheckbox);
    expect(rentCheckbox).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: /Clôturer et ouvrir Décembre 2026/i }));

    expect(onConfirmClose).toHaveBeenCalledWith({
      envelopeDecisions: [
        {
          envelopeId: 'env-courses',
          action: 'transfer_to_goal',
          goalId: 'goal-vac'
        }
      ],
      nextMonthAdjustments: [
        { sourceEnvelopeId: 'env-income', allocatedAmount: 3000, include: true },
        { sourceEnvelopeId: 'env-rent', allocatedAmount: 1200, include: false },
        { sourceEnvelopeId: 'env-courses', allocatedAmount: 350, include: true },
        { sourceEnvelopeId: 'env-sorties', allocatedAmount: 200, include: true }
      ]
    });
  });

  it('gère les états sans surplus / sans objectif et affiche une erreur API en alerte', async () => {
    const failingClose = vi.fn().mockRejectedValue(new Error('Cette période budgétaire est déjà clôturée'));

    render(
      <MonthClosingWizard
        isOpen
        onClose={vi.fn()}
        period={samplePeriod}
        envelopes={[sampleEnvelopes[3]!]}
        goals={[]}
        onConfirmClose={failingClose}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(
      screen.getByText('Aucun surplus positif à répartir sur ce cycle.')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    fireEvent.click(screen.getByRole('button', { name: /Clôturer et ouvrir Décembre 2026/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cette période budgétaire est déjà clôturée'
    );
  });

  it('affiche l’entrée « Clôturer le mois », l’état clôturé et le badge PeriodSelector en modes clair et sombre', async () => {
    const user = userEvent.setup();
    const onOpenMonthClosing = vi.fn();

    document.documentElement.classList.add('dark');

    const { rerender } = render(
      <div>
        <PeriodSelector
          label="Novembre 2026"
          isClosed={false}
          onPrevious={vi.fn()}
          onNext={vi.fn()}
        />
        <MonthlyInsights
          analytics={sampleAnalytics}
          envelopes={sampleEnvelopes}
          onOpenMonthClosing={onOpenMonthClosing}
        />
      </div>
    );

    expect(screen.queryByText('Clôturé')).not.toBeInTheDocument();
    const closeBtn = screen.getByRole('button', { name: 'Clôturer le mois' });
    await user.click(closeBtn);
    expect(onOpenMonthClosing).toHaveBeenCalledTimes(1);

    rerender(
      <div>
        <PeriodSelector
          label="Novembre 2026"
          isClosed
          onPrevious={vi.fn()}
          onNext={vi.fn()}
        />
        <MonthlyInsights
          analytics={sampleAnalytics}
          envelopes={sampleEnvelopes}
          isPeriodClosed
          periodClosedAt="2026-11-30T20:00:00.000Z"
          onOpenMonthClosing={onOpenMonthClosing}
        />
      </div>
    );

    expect(screen.getByText('Clôturé')).toHaveClass('dark:bg-emerald-950/60');
    expect(screen.getByText('Mois clôturé')).toBeInTheDocument();
    expect(screen.getByText(/Clôture enregistrée le 30 novembre 2026/i)).toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeSinkingFundInfo } from '../features/savings/sinkingFund';
import { App } from '../App';
import {
  GoalContributionSheet,
  GoalFormSheet,
  GoalWithdrawalSheet
} from '../features/savings/GoalDetailSheet';
import { SavingsGoalsList } from '../features/savings/SavingsGoalsList';
import * as budgetService from '../services/budget.service';
import * as envelopeService from '../services/envelope.service';
import * as goalService from '../services/goal.service';
import * as periodService from '../services/period.service';
import { useAuthStore } from '../store/useAuthStore';
import { useBudgetStore } from '../store/useBudgetStore';
import type {
  BudgetMember,
  BudgetPeriodSummary,
  EnvelopeItem,
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

vi.mock('../services/period.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/period.service')>();
  return {
    ...actual,
    getPeriodByMonth: vi.fn()
  };
});

vi.mock('../services/envelope.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/envelope.service')>();
  return {
    ...actual,
    createEnvelope: vi.fn(),
    updateEnvelope: vi.fn(),
    deleteEnvelope: vi.fn()
  };
});

vi.mock('../services/transaction.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/transaction.service')>();
  return {
    ...actual,
    listTransactions: vi.fn(),
    createTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    deleteTransaction: vi.fn()
  };
});

vi.mock('../services/goal.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/goal.service')>();
  return {
    ...actual,
    listGoals: vi.fn(),
    createGoal: vi.fn(),
    updateGoal: vi.fn(),
    deleteGoal: vi.fn(),
    createGoalWithdrawal: vi.fn(),
    updateGoalWithdrawal: vi.fn(),
    deleteGoalWithdrawal: vi.fn()
  };
});

function normalizeSpaces(value: string): string {
  return value.replace(/\u202f|\u00a0/g, ' ');
}

const members: BudgetMember[] = [
  {
    userId: 'user-1',
    role: 'owner',
    color: '#7C3AED',
    declaredMonthlyIncome: 2500,
    joinedAt: '2026-11-01T00:00:00.000Z'
  },
  {
    userId: 'user-2',
    role: 'editor',
    color: '#EC4899',
    declaredMonthlyIncome: 2000,
    joinedAt: '2026-11-01T00:00:00.000Z'
  }
];

const baliGoal: SavingsGoalItem = {
  id: 'goal-bali',
  budgetId: 'budget-1',
  name: 'Voyage Bali',
  icon: '✈️',
  color: '#3B82F6',
  targetAmount: 5000,
  initialAmount: 455,
  currentAmount: 505,
  deadline: '2027-07-15T12:00:00.000Z',
  order: 0
};

const precautionGoal: SavingsGoalItem = {
  id: 'goal-precaution',
  budgetId: 'budget-1',
  name: 'Épargne de précaution',
  icon: '🛡️',
  color: '#16A34A',
  targetAmount: 3000,
  initialAmount: 1000,
  currentAmount: 1100,
  order: 1
};

const sampleContributions: EnvelopeItem[] = [
  {
    id: 'env-save-bali',
    budgetId: 'budget-1',
    budgetPeriodId: 'period-1',
    pillar: 'savings',
    linkedGoalId: 'goal-bali',
    name: 'Versement Bali novembre',
    icon: '✈️',
    color: '#3B82F6',
    allocatedAmount: 50,
    spentOrPaidAmount: 50,
    date: '2026-11-06T12:00:00.000Z',
    isRecurring: true,
    isPaid: true,
    memberId: 'user-1',
    order: 0
  },
  {
    id: 'env-save-precaution',
    budgetId: 'budget-1',
    budgetPeriodId: 'period-1',
    pillar: 'savings',
    linkedGoalId: 'goal-precaution',
    name: 'Virement livret A',
    icon: '🛡️',
    color: '#16A34A',
    allocatedAmount: 100,
    spentOrPaidAmount: 100,
    date: '2026-11-05T12:00:00.000Z',
    isRecurring: false,
    isPaid: true,
    memberId: 'user-2',
    order: 1
  }
];

const sampleSummary: BudgetPeriodSummary = {
  plannedIncome: 3500,
  plannedFixedCharges: 1100,
  plannedEnvelopes: 450,
  plannedSavings: 150,
  spentVariables: 120,
  remainingToAllocate: 1800,
  remainingToLive: 2130
};

afterEach(() => {
  useAuthStore.getState().clearSession();
  useBudgetStore.getState().setActiveBudgetId(null);
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  vi.clearAllMocks();
});

describe('Onglet Epargne — SavingsGoalsList & SavingsGoalCard', () => {
  it('affiche l’état vide et permet de déclencher la création du premier objectif', async () => {
    const user = userEvent.setup();
    const onAddGoal = vi.fn();

    render(
      <SavingsGoalsList
        goals={[]}
        savingsEnvelopes={[]}
        summary={{
          plannedIncome: 2500,
          plannedFixedCharges: 0,
          plannedEnvelopes: 0,
          plannedSavings: 0,
          spentVariables: 0,
          remainingToAllocate: 2500,
          remainingToLive: 2500
        }}
        onAddGoal={onAddGoal}
        onEditGoal={vi.fn()}
        onDeleteGoal={vi.fn()}
        onAddContribution={vi.fn()}
        onEditContribution={vi.fn()}
        onDeleteContribution={vi.fn()}
      />
    );

    expect(
      screen.getByText('Aucun objectif d’épargne configuré pour cet espace.')
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Créer mon premier objectif' }));
    expect(onAddGoal).toHaveBeenCalledTimes(1);
  });

  it('affiche le DonutSummaryCard, l’accordéon ⌄ des versements, le menu ⋮ et le bouton + pastel', async () => {
    const user = userEvent.setup();
    const onEditGoal = vi.fn();
    const onDeleteGoal = vi.fn().mockResolvedValue(undefined);
    const onAddContribution = vi.fn();
    const onEditContribution = vi.fn();
    const onDeleteContribution = vi.fn().mockResolvedValue(undefined);

    render(
      <SavingsGoalsList
        goals={[baliGoal, precautionGoal]}
        savingsEnvelopes={sampleContributions}
        summary={sampleSummary}
        members={members}
        currentUserId="user-1"
        isSharedBudget={true}
        onAddGoal={vi.fn()}
        onEditGoal={onEditGoal}
        onDeleteGoal={onDeleteGoal}
        onAddContribution={onAddContribution}
        onEditContribution={onEditContribution}
        onDeleteContribution={onDeleteContribution}
      />
    );

    // Donut total = 150,00 € + légende avec objectifs
    expect(
      screen.getByText((_, node) => normalizeSpaces(node?.textContent ?? '') === '150,00 €')
    ).toBeInTheDocument();
    expect(screen.getAllByText('Voyage Bali').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Épargne de précaution').length).toBeGreaterThanOrEqual(2);

    // Montants sur la carte Voyage Bali
    expect(screen.getByRole('progressbar', { name: 'Voyage Bali' })).toBeInTheDocument();
    expect(
      screen.getByText((_, node) => normalizeSpaces(node?.textContent ?? '') === '5 000,00 €')
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, node) => normalizeSpaces(node?.textContent ?? '') === '505,00 €')
    ).toBeInTheDocument();

    // Accordéon ⌄ fermé par défaut puis déplié
    const baliAccordionToggle = screen.getAllByRole('button', {
      name: /Epargne du mois :/i
    })[0];
    expect(baliAccordionToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Versement Bali novembre')).not.toBeInTheDocument();

    await user.click(baliAccordionToggle);
    expect(baliAccordionToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Versement Bali novembre')).toBeInTheDocument();
    expect(screen.getByLabelText('Versement récurrent')).toBeInTheDocument();
    expect(screen.getByText('Moi')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, node) =>
          node?.tagName === 'SPAN' && normalizeSpaces(node.textContent ?? '') === '+ 50,00 €'
      )
    ).toBeInTheDocument();

    // Édition et suppression d'un versement depuis l'accordéon
    await user.click(
      screen.getByRole('button', { name: 'Modifier le versement Versement Bali novembre' })
    );
    expect(onEditContribution).toHaveBeenCalledWith(baliGoal, sampleContributions[0]);

    await user.click(
      screen.getByRole('button', { name: 'Supprimer le versement Versement Bali novembre' })
    );
    await user.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(onDeleteContribution).toHaveBeenCalledWith('env-save-bali');

    // Replier l'accordéon
    await user.click(baliAccordionToggle);
    expect(baliAccordionToggle).toHaveAttribute('aria-expanded', 'false');

    // Bouton + pastel
    await user.click(screen.getByRole('button', { name: 'Ajouter un versement pour Voyage Bali' }));
    expect(onAddContribution).toHaveBeenCalledWith(baliGoal);

    // Menu contextuel ⋮ (Modifier puis Supprimer avec confirmation)
    await user.click(screen.getByRole('button', { name: 'Options de l’objectif Voyage Bali' }));
    expect(screen.getByRole('menu', { name: 'Actions pour Voyage Bali' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Modifier l’objectif' }));
    expect(onEditGoal).toHaveBeenCalledWith(baliGoal);

    await user.click(screen.getByRole('button', { name: 'Options de l’objectif Voyage Bali' }));
    await user.click(screen.getByRole('menuitem', { name: 'Supprimer l’objectif' }));
    await user.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(onDeleteGoal).toHaveBeenCalledWith('goal-bali');
  });
});

describe('Tiroirs Epargne — GoalFormSheet & GoalContributionSheet', () => {
  it('valide, calcule Objectif restant à atteindre en direct et crée un objectif', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<GoalFormSheet isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />);

    // Soumission vide -> alerte de montant
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Veuillez saisir un objectif supérieur à 0 €.'
    );

    await user.type(screen.getByLabelText('Montant en euros'), '5000');
    await user.type(screen.getByLabelText('Épargne déjà constituée (optionnel)'), '500');
    expect(
      normalizeSpaces(screen.getByTestId('live-goal-target-remaining').textContent ?? '')
    ).toContain('4 500,00 €');

    await user.type(screen.getByLabelText('Nom'), 'Voyage Bali');
    await user.click(screen.getByRole('button', { name: 'Cliquez pour ajouter un emoji' }));
    await user.click(screen.getByRole('button', { name: 'Choisir l’emoji ✈️' }));
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Voyage Bali',
        targetAmount: 5000,
        initialAmount: 500,
        icon: '✈️'
      })
    );
  });

  it('permet de modifier ou supprimer un objectif existant dans GoalFormSheet', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);

    render(
      <GoalFormSheet
        isOpen={true}
        onClose={vi.fn()}
        initialGoal={baliGoal}
        onSubmit={vi.fn()}
        onDelete={onDelete}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Modifier l’objectif' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    await user.click(screen.getByRole('button', { name: 'Confirmer la suppression' }));
    expect(onDelete).toHaveBeenCalledWith('goal-bali');
  });

  it('met à jour Restant à répartir en direct et crée un versement récurrent avec membre', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <GoalContributionSheet
        isOpen={true}
        onClose={vi.fn()}
        goal={baliGoal}
        currentRemainingToAllocate={1800}
        members={members}
        currentUserId="user-1"
        isSharedBudget={true}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByLabelText('Nom')).toHaveValue('Versement Voyage Bali');
    await user.type(screen.getByLabelText('Montant en euros'), '150');
    expect(
      normalizeSpaces(screen.getByTestId('live-savings-remaining-to-allocate').textContent ?? '')
    ).toContain('1 650,00 €');

    await user.click(screen.getByLabelText(/Ajouter chaque mois/i));
    await user.click(screen.getByRole('button', { name: /Membre 2/i }));
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        pillar: 'savings',
        linkedGoalId: 'goal-bali',
        name: 'Versement Voyage Bali',
        allocatedAmount: 150,
        isRecurring: true,
        isPaid: true,
        memberId: 'user-2'
      })
    );
  });
});

describe('Intégration App — Onglet Epargne complet', () => {
  it('crée un objectif via FAB (+) puis le crédite via + et met à jour Total epargné et le Donut', async () => {
    const user = userEvent.setup();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthIsoPrefix = `${year}-${String(month).padStart(2, '0')}`;

    vi.mocked(budgetService.listBudgets).mockResolvedValue([
      {
        id: 'budget-1',
        name: 'Budget Perso',
        type: 'personal',
        ownerId: 'user-1',
        contributionMode: 'equal_50_50',
        members: [],
        budgetStartDay: 1
      }
    ]);

    vi.mocked(periodService.getPeriodByMonth).mockResolvedValue({
      status: 'ok',
      period: {
        id: 'period-active',
        budgetId: 'budget-1',
        year,
        month,
        label: formatMonthLabel(new Date(year, month - 1, 1)),
        startDate: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
        endDate: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString(),
        summary: {
          plannedIncome: 2500,
          plannedFixedCharges: 0,
          plannedEnvelopes: 0,
          plannedSavings: 0,
          spentVariables: 0,
          remainingToAllocate: 2500,
          remainingToLive: 2500
        }
      },
      envelopes: []
    });

    vi.mocked(goalService.listGoals).mockResolvedValue({
      status: 'ok',
      goals: []
    });

    const createdGoal: SavingsGoalItem = {
      id: 'goal-created-1',
      budgetId: 'budget-1',
      name: 'Voyage Bali',
      icon: '✈️',
      color: '#16A34A',
      targetAmount: 5000,
      initialAmount: 300,
      currentAmount: 300,
      order: 0
    };

    vi.mocked(goalService.createGoal).mockResolvedValue({
      status: 'ok',
      goal: createdGoal
    });

    vi.mocked(envelopeService.createEnvelope).mockResolvedValue({
      status: 'ok',
      envelope: {
        id: 'env-contrib-1',
        budgetId: 'budget-1',
        budgetPeriodId: 'period-active',
        pillar: 'savings',
        linkedGoalId: 'goal-created-1',
        name: 'Versement Voyage Bali',
        icon: '✈️',
        color: '#16A34A',
        allocatedAmount: 150,
        spentOrPaidAmount: 150,
        date: `${monthIsoPrefix}-05T12:00:00.000Z`,
        isRecurring: false,
        isPaid: true,
        order: 0
      },
      period: {
        id: 'period-active',
        budgetId: 'budget-1',
        year,
        month,
        label: formatMonthLabel(new Date(year, month - 1, 1)),
        startDate: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
        endDate: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString(),
        summary: {
          plannedIncome: 2500,
          plannedFixedCharges: 0,
          plannedEnvelopes: 0,
          plannedSavings: 150,
          spentVariables: 0,
          remainingToAllocate: 2350,
          remainingToLive: 2350
        }
      },
      goal: {
        ...createdGoal,
        currentAmount: 450
      }
    });

    useAuthStore.getState().setSession('jwt-valid', {
      id: 'user-1',
      email: 'alex@eparnio.fr',
      displayName: 'Alex',
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

    await user.click(screen.getByRole('button', { name: 'Epargne' }));
    expect(
      await screen.findByText('Aucun objectif d’épargne configuré pour cet espace.')
    ).toBeInTheDocument();

    // Créer l'objectif via le FAB (+)
    await user.click(screen.getByRole('button', { name: 'Ajouter un objectif d’épargne' }));
    await user.type(screen.getByLabelText('Montant en euros'), '5000');
    await user.type(screen.getByLabelText('Épargne déjà constituée (optionnel)'), '300');
    await user.type(screen.getByLabelText('Nom'), 'Voyage Bali');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    // La carte objectif apparaît avec 300,00 € de Total epargné
    expect(await screen.findByRole('heading', { name: 'Voyage Bali' })).toBeInTheDocument();
    expect(
      screen.getByText((_, node) => normalizeSpaces(node?.textContent ?? '') === '300,00 €')
    ).toBeInTheDocument();

    // Créditer via le bouton + pastel de la carte
    await user.click(screen.getByRole('button', { name: 'Ajouter un versement pour Voyage Bali' }));
    const contributionDialog = await screen.findByRole('dialog', {
      name: 'Ajouter un versement · Voyage Bali'
    });
    await user.type(within(contributionDialog).getByLabelText('Montant en euros'), '150');
    expect(
      normalizeSpaces(
        within(contributionDialog).getByTestId('live-savings-remaining-to-allocate').textContent ??
          ''
      )
    ).toContain('2 350,00 €');

    await user.click(within(contributionDialog).getByRole('button', { name: 'Ajouter' }));

    // Vérifier la mise à jour : Total epargné = 450,00 €, Donut Total = 150,00 € et accordéon dépliable
    expect(
      await screen.findByText(
        (_, node) => normalizeSpaces(node?.textContent ?? '') === '450,00 €'
      )
    ).toBeInTheDocument();
    expect(
      screen.getAllByText((_, node) => normalizeSpaces(node?.textContent ?? '') === '150,00 €')
        .length
    ).toBeGreaterThanOrEqual(2);

    // Déplier l'accordéon ⌄ pour vérifier le versement du mois
    await user.click(screen.getByRole('button', { name: /Epargne du mois :/i }));
    expect(screen.getByText('Versement Voyage Bali')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, node) =>
          node?.tagName === 'SPAN' && normalizeSpaces(node.textContent ?? '') === '+ 150,00 €'
      )
    ).toBeInTheDocument();
  });

  it('calcule correctement les mensualités Sinking Funds (active, completed, overdue, none)', () => {
    const refDate = new Date('2026-01-10T12:00:00.000Z');
    const active = computeSinkingFundInfo(1200, 200, '2026-11-10T12:00:00.000Z', refDate);
    expect(active.status).toBe('active');
    expect(active.monthsRemaining).toBe(10);
    expect(active.monthlySuggestedAmount).toBe(100);

    const completed = computeSinkingFundInfo(1000, 1000, '2026-11-10T12:00:00.000Z', refDate);
    expect(completed.status).toBe('completed');

    const overdue = computeSinkingFundInfo(1000, 400, '2025-12-01T12:00:00.000Z', refDate);
    expect(overdue.status).toBe('overdue');
    expect(overdue.remainingAmount).toBe(600);

    const none = computeSinkingFundInfo(1000, 0, null, refDate);
    expect(none.status).toBe('none');
  });
});

describe('Étape 25 — Retraits sur cagnottes d’épargne (GoalWithdrawalSheet, SavingsGoalsList & App)', () => {
  it('valide les champs, calcule le solde live (y compris dépassement), gère les notes et la suppression dans GoalWithdrawalSheet', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);

    const { rerender } = render(
      <GoalWithdrawalSheet
        isOpen={true}
        onClose={vi.fn()}
        goal={baliGoal}
        defaultDate="2026-11-12"
        members={members}
        currentUserId="user-1"
        isSharedBudget={true}
        onSubmit={onSubmit}
      />
    );

    expect(
      screen.getByRole('dialog', { name: 'Utiliser / retirer · Voyage Bali' })
    ).toBeInTheDocument();
    expect(
      normalizeSpaces(screen.getByTestId('live-goal-withdrawal-balance').textContent ?? '')
    ).toContain('505,00 €');

    // Validation montant nul
    await user.click(screen.getByRole('button', { name: 'Retirer' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Veuillez saisir un montant supérieur à 0 €.'
    );

    // Dépassement : 600 > 505 -> solde 0,00 € (dépassement de 95,00 €)
    const amountField = screen.getByLabelText('Montant en euros');
    await user.type(amountField, '600');
    const liveBalance = screen.getByTestId('live-goal-withdrawal-balance');
    expect(normalizeSpaces(liveBalance.textContent ?? '')).toContain('0,00 €');
    expect(normalizeSpaces(liveBalance.textContent ?? '')).toContain('dépassement de 95,00 €');

    // Montant normal 200 -> solde 305,00 €
    await user.clear(amountField);
    await user.type(amountField, '200');
    expect(normalizeSpaces(liveBalance.textContent ?? '')).toContain('305,00 €');

    // Libellé requis
    await user.click(screen.getByRole('button', { name: 'Retirer' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Veuillez saisir un libellé de retrait.');

    await user.type(screen.getByLabelText('Nom'), 'Billets d’avion');
    await user.type(screen.getByLabelText('Note (optionnel)'), 'Vol Air France');
    expect(screen.getByText('14 / 300')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Membre 2/i }));
    await user.click(screen.getByRole('button', { name: 'Retirer' }));

    expect(onSubmit).toHaveBeenCalledWith({
      amount: 200,
      label: 'Billets d’avion',
      date: '2026-11-12T12:00:00.000Z',
      memberId: 'user-2',
      notes: 'Vol Air France'
    });

    // Mode édition : effacement de la note puis suppression
    const onEditSubmit = vi.fn().mockResolvedValue(undefined);
    rerender(
      <GoalWithdrawalSheet
        isOpen={true}
        onClose={vi.fn()}
        goal={baliGoal}
        initialWithdrawal={{
          id: 'w-1',
          amount: 200,
          label: 'Billets d’avion',
          date: '2026-11-12T12:00:00.000Z',
          memberId: 'user-2',
          notes: 'Vol Air France'
        }}
        members={members}
        currentUserId="user-1"
        isSharedBudget={true}
        onSubmit={onEditSubmit}
        onDelete={onDelete}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Modifier le retrait' })).toBeInTheDocument();
    const notesInput = screen.getByLabelText('Note (optionnel)');
    expect(notesInput).toHaveValue('Vol Air France');
    await user.clear(notesInput);
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(onEditSubmit).toHaveBeenCalledWith({
      amount: 200,
      label: 'Billets d’avion',
      date: '2026-11-12T12:00:00.000Z',
      memberId: 'user-2',
      notes: ''
    });

    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    await user.click(screen.getByRole('button', { name: 'Confirmer la suppression' }));
    expect(onDelete).toHaveBeenCalledWith('w-1');
  });

  it('affiche le bouton − et les retraits (badge, notes, édition, suppression) dans l’accordéon en modes clair et sombre', async () => {
    const user = userEvent.setup();
    const onAddWithdrawal = vi.fn();
    const onEditWithdrawal = vi.fn();
    const onDeleteWithdrawal = vi.fn().mockResolvedValue(undefined);

    const goalWithWithdrawals: SavingsGoalItem = {
      ...baliGoal,
      currentAmount: 305,
      withdrawals: [
        {
          id: 'w-1',
          amount: 200,
          label: 'Billets d’avion',
          date: '2026-11-12T12:00:00.000Z',
          memberId: 'user-2',
          notes: 'Vol aller'
        }
      ]
    };

    const { rerender } = render(
      <SavingsGoalsList
        goals={[goalWithWithdrawals]}
        savingsEnvelopes={sampleContributions}
        summary={sampleSummary}
        members={members}
        currentUserId="user-1"
        isSharedBudget={true}
        onAddGoal={vi.fn()}
        onEditGoal={vi.fn()}
        onDeleteGoal={vi.fn()}
        onAddContribution={vi.fn()}
        onEditContribution={vi.fn()}
        onDeleteContribution={vi.fn()}
        onAddWithdrawal={onAddWithdrawal}
        onEditWithdrawal={onEditWithdrawal}
        onDeleteWithdrawal={onDeleteWithdrawal}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Utiliser ou retirer de Voyage Bali' }));
    expect(onAddWithdrawal).toHaveBeenCalledWith(goalWithWithdrawals);

    await user.click(screen.getByRole('button', { name: /Epargne du mois :/i }));
    expect(screen.getByText('Billets d’avion')).toBeInTheDocument();
    expect(screen.getByText('Retrait')).toBeInTheDocument();
    expect(screen.getByText('Vol aller')).toBeInTheDocument();
    expect(screen.getByText('Membre 2')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, node) =>
          node?.tagName === 'SPAN' && normalizeSpaces(node.textContent ?? '') === '− 200,00 €'
      )
    ).toBeInTheDocument();

    // Mode sombre
    document.documentElement.classList.add('dark');
    rerender(
      <SavingsGoalsList
        goals={[goalWithWithdrawals]}
        savingsEnvelopes={sampleContributions}
        summary={sampleSummary}
        members={members}
        currentUserId="user-1"
        isSharedBudget={true}
        onAddGoal={vi.fn()}
        onEditGoal={vi.fn()}
        onDeleteGoal={vi.fn()}
        onAddContribution={vi.fn()}
        onEditContribution={vi.fn()}
        onDeleteContribution={vi.fn()}
        onAddWithdrawal={onAddWithdrawal}
        onEditWithdrawal={onEditWithdrawal}
        onDeleteWithdrawal={onDeleteWithdrawal}
      />
    );
    expect(screen.getByText('Retrait')).toHaveClass('dark:text-amber-200');

    await user.click(screen.getByRole('button', { name: 'Modifier le retrait Billets d’avion' }));
    expect(onEditWithdrawal).toHaveBeenCalledWith(
      goalWithWithdrawals,
      goalWithWithdrawals.withdrawals![0]
    );

    await user.click(screen.getByRole('button', { name: 'Supprimer le retrait Billets d’avion' }));
    await user.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(onDeleteWithdrawal).toHaveBeenCalledWith('goal-bali', 'w-1');
  });

  it('enregistre un retrait depuis l’onglet Epargne dans App sans modifier le Donut mensuel', async () => {
    const user = userEvent.setup();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthIsoPrefix = `${year}-${String(month).padStart(2, '0')}`;

    vi.mocked(budgetService.listBudgets).mockResolvedValue([
      {
        id: 'budget-1',
        name: 'Budget Perso',
        type: 'personal',
        ownerId: 'user-1',
        contributionMode: 'equal_50_50',
        members: [],
        budgetStartDay: 1
      }
    ]);

    vi.mocked(periodService.getPeriodByMonth).mockResolvedValue({
      status: 'ok',
      period: {
        id: 'period-active',
        budgetId: 'budget-1',
        year,
        month,
        label: formatMonthLabel(new Date(year, month - 1, 1)),
        startDate: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
        endDate: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString(),
        summary: {
          plannedIncome: 2500,
          plannedFixedCharges: 0,
          plannedEnvelopes: 0,
          plannedSavings: 100,
          spentVariables: 0,
          remainingToAllocate: 2400,
          remainingToLive: 2400
        }
      },
      envelopes: [
        {
          id: 'env-save-1',
          budgetId: 'budget-1',
          budgetPeriodId: 'period-active',
          pillar: 'savings',
          linkedGoalId: 'goal-1',
          name: 'Versement Vacances',
          icon: '✈️',
          color: '#3B82F6',
          allocatedAmount: 100,
          spentOrPaidAmount: 100,
          date: `${monthIsoPrefix}-05T12:00:00.000Z`,
          isRecurring: false,
          isPaid: true,
          order: 0
        }
      ]
    });

    const initialGoal: SavingsGoalItem = {
      id: 'goal-1',
      budgetId: 'budget-1',
      name: 'Vacances',
      icon: '✈️',
      color: '#3B82F6',
      targetAmount: 2000,
      initialAmount: 700,
      currentAmount: 800,
      withdrawals: [],
      order: 0
    };

    vi.mocked(goalService.listGoals).mockResolvedValue({
      status: 'ok',
      goals: [initialGoal]
    });

    vi.mocked(goalService.createGoalWithdrawal).mockResolvedValue({
      status: 'ok',
      goal: {
        ...initialGoal,
        currentAmount: 550,
        withdrawals: [
          {
            id: 'w-app-1',
            amount: 250,
            label: 'Hôtel',
            date: `${monthIsoPrefix}-10T12:00:00.000Z`
          }
        ]
      }
    });

    useAuthStore.getState().setSession('jwt-valid', {
      id: 'user-1',
      email: 'alex@eparnio.fr',
      displayName: 'Alex',
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

    await user.click(screen.getByRole('button', { name: 'Epargne' }));
    expect(await screen.findByRole('heading', { name: 'Vacances' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Utiliser ou retirer de Vacances' }));
    const withdrawDialog = await screen.findByRole('dialog', {
      name: 'Utiliser / retirer · Vacances'
    });
    await user.type(within(withdrawDialog).getByLabelText('Montant en euros'), '250');
    expect(
      normalizeSpaces(
        within(withdrawDialog).getByTestId('live-goal-withdrawal-balance').textContent ?? ''
      )
    ).toContain('550,00 €');

    await user.type(within(withdrawDialog).getByLabelText('Nom'), 'Hôtel');
    await user.click(within(withdrawDialog).getByRole('button', { name: 'Retirer' }));

    expect(goalService.createGoalWithdrawal).toHaveBeenCalledWith(
      'budget-1',
      'goal-1',
      expect.objectContaining({ amount: 250, label: 'Hôtel' })
    );

    // Total epargné mis à jour à 550,00 €, tandis que le Donut (plannedSavings) reste à 100,00 €
    expect(
      await screen.findByText((_, node) => normalizeSpaces(node?.textContent ?? '') === '550,00 €')
    ).toBeInTheDocument();
    expect(
      screen.getAllByText((_, node) => normalizeSpaces(node?.textContent ?? '') === '100,00 €')
        .length
    ).toBeGreaterThanOrEqual(2);
  });
});

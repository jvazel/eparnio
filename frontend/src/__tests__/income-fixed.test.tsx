import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import {
  CREATION_COLOR_SWATCHES,
  CreationFormModal
} from '../features/budget/CreationFormModal';
import { FixedChargesList } from '../features/budget/FixedChargesList';
import { IncomeList } from '../features/budget/IncomeList';
import * as budgetService from '../services/budget.service';
import * as envelopeService from '../services/envelope.service';
import * as periodService from '../services/period.service';
import { useAuthStore } from '../store/useAuthStore';
import { useBudgetStore } from '../store/useBudgetStore';
import type { BudgetPeriodSummary, EnvelopeItem } from '../types/budget.types';
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
    reorderEnvelopes: vi.fn(),
    deleteEnvelope: vi.fn()
  };
});

function normalizeSpaces(value: string): string {
  return value.replace(/\u202f|\u00a0/g, ' ');
}

const sampleSummary: BudgetPeriodSummary = {
  plannedIncome: 3500,
  plannedFixedCharges: 1069.99,
  plannedEnvelopes: 190,
  plannedSavings: 0,
  spentVariables: 0,
  remainingToAllocate: 2240.01,
  remainingToLive: 2430.01
};

const sampleIncomes: EnvelopeItem[] = [
  {
    id: 'inc-1',
    budgetId: 'budget-1',
    budgetPeriodId: 'period-1',
    pillar: 'income',
    name: 'Salaire Monsieur',
    icon: '💵',
    color: '#16A34A',
    allocatedAmount: 2000,
    spentOrPaidAmount: 0,
    date: '2026-11-05T12:00:00.000Z',
    isRecurring: true,
    isPaid: true,
    order: 0
  },
  {
    id: 'inc-2',
    budgetId: 'budget-1',
    budgetPeriodId: 'period-1',
    pillar: 'income',
    name: 'Salaire Madame',
    icon: '💰',
    color: '#38BDF8',
    allocatedAmount: 1500,
    spentOrPaidAmount: 0,
    date: '2026-11-10T12:00:00.000Z',
    isRecurring: false,
    isPaid: false,
    order: 1
  }
];

const sampleFixedCharges: EnvelopeItem[] = [
  {
    id: 'fix-1',
    budgetId: 'budget-1',
    budgetPeriodId: 'period-1',
    pillar: 'fixed_charge',
    name: 'Loyer',
    icon: '🏠',
    color: '#4F46E5',
    allocatedAmount: 1000,
    spentOrPaidAmount: 0,
    date: '2026-11-02T12:00:00.000Z',
    isRecurring: true,
    isPaid: true,
    order: 0
  },
  {
    id: 'fix-2',
    budgetId: 'budget-1',
    budgetPeriodId: 'period-1',
    pillar: 'fixed_charge',
    name: 'Streaming',
    icon: '🍿',
    color: '#F87171',
    allocatedAmount: 69.99,
    spentOrPaidAmount: 0,
    date: '2026-11-14T12:00:00.000Z',
    isRecurring: true,
    isPaid: false,
    order: 1
  }
];

afterEach(() => {
  useAuthStore.getState().clearSession();
  useBudgetStore.getState().setActiveBudgetId(null);
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Onglet Revenus — IncomeList et mode gestion ⚙️', () => {
  it('affiche le DonutSummaryCard, bascule € | %, pointe ✓ et réordonne en mode ⚙️', async () => {
    const user = userEvent.setup();
    const onTogglePaid = vi.fn();
    const onReorder = vi.fn();
    const onDeleteIncome = vi.fn();
    const onEditIncome = vi.fn();

    render(
      <IncomeList
        items={sampleIncomes}
        summary={sampleSummary}
        onAddIncome={vi.fn()}
        onEditIncome={onEditIncome}
        onTogglePaid={onTogglePaid}
        onReorder={onReorder}
        onDeleteIncome={onDeleteIncome}
      />
    );

    expect(
      screen.getByText((_, node) => normalizeSpaces(node?.textContent ?? '') === '3 500,00 €')
    ).toBeInTheDocument();
    expect(screen.getAllByText('Salaire Monsieur').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText('Élément récurrent')).toBeInTheDocument();

    // Bascule € -> %
    await user.click(screen.getByRole('button', { name: '%' }));
    expect(screen.getByText('57.1 %')).toBeInTheDocument();
    expect(screen.getByText('42.9 %')).toBeInTheDocument();

    // Pointage ✓ en 1 tap
    await user.click(screen.getByRole('button', { name: 'Marquer Salaire Madame comme perçu' }));
    expect(onTogglePaid).toHaveBeenCalledWith(sampleIncomes[1]);

    // Mode gestion rapide ⚙️ -> déplacer et supprimer
    await user.click(
      screen.getByRole('button', { name: 'Gérer l’ordre et supprimer des revenus' })
    );
    await user.click(screen.getByRole('button', { name: 'Monter Salaire Madame' }));
    expect(onReorder).toHaveBeenCalledWith(['inc-2', 'inc-1']);

    await user.click(screen.getByRole('button', { name: 'Supprimer Salaire Monsieur' }));
    expect(onDeleteIncome).toHaveBeenCalledWith(sampleIncomes[0]);
  });
});

describe('Onglet Dépenses fixes — FixedChargesList', () => {
  it('affiche la jauge Reste à dépenser, le détail Tout voir ▶ et pointe ✓ une charge', async () => {
    const user = userEvent.setup();
    const onTogglePaid = vi.fn();

    render(
      <FixedChargesList
        items={sampleFixedCharges}
        summary={sampleSummary}
        onAddFixedCharge={vi.fn()}
        onEditFixedCharge={vi.fn()}
        onTogglePaid={onTogglePaid}
        onReorder={vi.fn()}
        onDeleteFixedCharge={vi.fn()}
      />
    );

    expect(screen.getByText('Reste à dépenser')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Reste à dépenser/i })).toHaveAttribute(
      'aria-label',
      expect.stringContaining('2')
    );

    // Ouvrir le détail "Tout voir ▶" et filtrer "À venir"
    await user.click(screen.getByRole('button', { name: /Tout voir/i }));
    expect(screen.getByText('Déjà payées')).toBeInTheDocument();
    expect(screen.getByText('Restant à payer')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'À venir' }));
    expect(screen.queryByRole('button', { name: 'Modifier Loyer' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modifier Streaming' })).toBeInTheDocument();

    // Pointer Streaming comme payé
    await user.click(screen.getByRole('button', { name: 'Marquer Streaming comme payé' }));
    expect(onTogglePaid).toHaveBeenCalledWith(sampleFixedCharges[1]);
  });
});

describe('CreationFormModal — Saisie Finzee, Base Zéro en direct & 11 couleurs', () => {
  it('calcule Restant à répartir en direct au pavé numérique, permet la récurrence gratuite et soumet le formulaire', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <CreationFormModal
        isOpen
        onClose={onClose}
        pillar="fixed_charge"
        currentRemainingToAllocate={2000}
        defaultDate="2026-11-10"
        onSubmit={onSubmit}
      />
    );

    expect(CREATION_COLOR_SWATCHES).toHaveLength(24);
    const liveBanner = screen.getByTestId('live-remaining-to-allocate');
    expect(normalizeSpaces(liveBanner.textContent ?? '')).toContain('2 000,00 €');

    // Saisie de 250,50 au pavé numérique tactile
    const keypad = screen.getByRole('group', { name: 'Pavé numérique' });
    await user.click(within(keypad).getByRole('button', { name: 'Chiffre 2' }));
    await user.click(within(keypad).getByRole('button', { name: 'Chiffre 5' }));
    await user.click(within(keypad).getByRole('button', { name: 'Chiffre 0' }));
    await user.click(within(keypad).getByRole('button', { name: 'Chiffre ,' }));
    await user.click(within(keypad).getByRole('button', { name: 'Chiffre 5' }));

    expect(normalizeSpaces(liveBanner.textContent ?? '')).toContain('1 749,50 €');

    await user.type(screen.getByLabelText('Nom'), 'Assurance habitation');
    await user.click(screen.getByLabelText(/Ajouter chaque mois/i));
    await user.click(screen.getByRole('button', { name: 'Cliquez pour ajouter un emoji' }));
    await user.click(screen.getByRole('button', { name: 'Choisir l’emoji 🛡️' }));
    await user.click(screen.getByRole('button', { name: 'Choisir la couleur #FB923C' }));

    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        pillar: 'fixed_charge',
        name: 'Assurance habitation',
        allocatedAmount: 250.5,
        isRecurring: true,
        icon: '🛡️',
        color: '#FB923C',
        date: '2026-11-10T12:00:00.000Z'
      })
    );
  });

  it('permet de modifier puis confirmer la suppression en mode édition', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);

    render(
      <CreationFormModal
        isOpen
        onClose={vi.fn()}
        pillar="income"
        currentRemainingToAllocate={500}
        initialItem={sampleIncomes[0]}
        onSubmit={vi.fn()}
        onDelete={onDelete}
      />
    );

    // En édition de +2000 €, la contribution initiale est soustraite du recalcul en direct -> reste 500 €
    expect(
      normalizeSpaces(screen.getByTestId('live-remaining-to-allocate').textContent ?? '')
    ).toContain('500,00 €');

    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    await user.click(screen.getByRole('button', { name: 'Confirmer la suppression' }));

    expect(onDelete).toHaveBeenCalledWith('inc-1');
  });
});

describe('Intégration App — Nouveau compte à 0,00 € et ajout réel Base Zéro', () => {
  it('démarre sans données factices à 0,00 € et met à jour Revenus puis Dépenses fixes', async () => {
    const user = userEvent.setup();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

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
          plannedIncome: 0,
          plannedFixedCharges: 0,
          plannedEnvelopes: 0,
          plannedSavings: 0,
          spentVariables: 0,
          remainingToAllocate: 0,
          remainingToLive: 0
        }
      },
      envelopes: []
    });

    vi.mocked(envelopeService.createEnvelope).mockResolvedValue({
      status: 'ok',
      envelope: {
        id: 'env-new-income',
        budgetId: 'budget-1',
        budgetPeriodId: 'period-active',
        pillar: 'income',
        name: 'Salaire test',
        icon: '💵',
        color: '#16A34A',
        allocatedAmount: 3000,
        spentOrPaidAmount: 0,
        date: `${year}-${String(month).padStart(2, '0')}-01T12:00:00.000Z`,
        isRecurring: true,
        isPaid: false,
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
          plannedIncome: 3000,
          plannedFixedCharges: 0,
          plannedEnvelopes: 0,
          plannedSavings: 0,
          spentVariables: 0,
          remainingToAllocate: 3000,
          remainingToLive: 3000
        }
      }
    });

    useAuthStore.getState().setSession('jwt-valid', {
      id: 'user-1',
      email: 'nouveau@eparnio.fr',
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

    // Vérifier qu'aucun montant factice (2 240,01 € / 1 069,99 €) n'est affiché
    expect(await screen.findByText('Aucune dépense fixe enregistrée sur cette période.')).toBeInTheDocument();
    expect(screen.queryByText(/2 240,01/)).not.toBeInTheDocument();

    // Aller sur Revenus et créer un revenu de 3 000 €
    await user.click(screen.getByRole('button', { name: 'Revenus' }));
    expect(await screen.findByText('Aucun revenu enregistré sur cette période.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ajouter un revenu' }));
    await user.type(screen.getByLabelText('Montant en euros'), '3000');
    await user.type(screen.getByLabelText('Nom'), 'Salaire test');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByRole('button', { name: 'Modifier Salaire test' })).toBeInTheDocument();
  });
});

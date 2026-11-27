import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MonthlyInsights } from '../features/analytics/MonthlyInsights';
import { ProfileSheet } from '../features/auth/ProfileSheet';
import { BudgetSettingsSheet } from '../features/budget/BudgetSettingsSheet';
import { CreationFormModal } from '../features/budget/CreationFormModal';
import * as authService from '../services/auth.service';
import { useAuthStore } from '../store/useAuthStore';
import type { BudgetSpace, PeriodAnalytics, UserProfile } from '../types/budget.types';

vi.mock('../services/auth.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/auth.service')>();
  return {
    ...actual,
    updateMe: vi.fn()
  };
});

const mockUser: UserProfile = {
  id: 'u1',
  email: 'test@eparnio.fr',
  displayName: 'Alex',
  avatarEmoji: '🧑',
  hasCompletedOnboarding: true,
  preferences: {
    currency: 'EUR',
    budgetStartDay: 1,
    theme: 'light',
    defaultTab: 'depenses',
    budgetViewMode: 'essential'
  }
};

const mockAnalytics: PeriodAnalytics = {
  periodId: 'p1',
  budgetId: 'b1',
  budgetType: 'personal',
  cashFlow: {
    plannedIncome: 2500,
    plannedFixedCharges: 1000,
    plannedEnvelopes: 800,
    spentVariables: 300,
    plannedSavings: 400,
    remainingToLive: 800
  },
  dailyBudget: {
    startDate: '2026-11-01T00:00:00.000Z',
    endDate: '2026-11-30T23:59:59.999Z',
    referenceDate: '2026-11-20T00:00:00.000Z',
    totalDays: 30,
    daysRemaining: 10,
    remainingToLive: 800,
    dailyAmount: 80
  },
  allocation: {
    totalOutflows: 1700,
    plannedIncome: 2500,
    items: [
      { key: 'fixed', label: 'Fixe', color: '#8B5CF6', amount: 1000, percentage: 58.8, incomeSharePercentage: 40 },
      { key: 'variable', label: 'Variable', color: '#3B82F6', amount: 300, percentage: 17.6, incomeSharePercentage: 12 },
      { key: 'savings', label: 'Épargne', color: '#22C55E', amount: 400, percentage: 23.6, incomeSharePercentage: 16 }
    ]
  },
  zeroBased: {
    plannedIncome: 2500,
    totalAllocated: 2200,
    remainingToAllocate: 300,
    isBalanced: false
  },
  memberBreakdown: []
};

const mockBudget: BudgetSpace = {
  id: 'b1',
  name: 'Budget Perso',
  type: 'personal',
  ownerId: 'u1',
  budgetStartDay: 1,
  contributionMode: 'custom',
  members: [
    {
      userId: 'u1',
      role: 'owner',
      color: '#7C3AED',
      declaredMonthlyIncome: 2500,
      joinedAt: '2026-01-01T00:00:00.000Z',
      displayName: 'Alex',
      avatarEmoji: '🧑'
    }
  ]
};

function renderWithQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('Mode essentiel / Mode détaillé (Étape 63)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: 'tok', user: mockUser });
  });

  it('permet de basculer Mode essentiel ↔ Mode détaillé depuis ProfileSheet et persiste via updateMe', async () => {
    vi.mocked(authService.updateMe).mockResolvedValue({
      ...mockUser,
      preferences: { ...mockUser.preferences, budgetViewMode: 'advanced' }
    });

    renderWithQueryClient(<ProfileSheet isOpen onClose={vi.fn()} />);

    const essentialBtn = screen.getByRole('button', { name: 'Mode essentiel' });
    const detailedBtn = screen.getByRole('button', { name: 'Mode détaillé' });

    expect(essentialBtn).toHaveAttribute('aria-pressed', 'true');
    expect(detailedBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(detailedBtn);

    await waitFor(() => {
      expect(authService.updateMe).toHaveBeenCalledWith({ budgetViewMode: 'advanced' });
    });
    expect(useAuthStore.getState().user?.preferences.budgetViewMode).toBe('advanced');
  });

  it('ne rend aucun toggle Essentiel/Avancé dans MonthlyInsights et masque Pilotage/Tendances/Import CSV en mode essentiel', () => {
    render(
      <MonthlyInsights
        analytics={mockAnalytics}
        budgetViewMode="essential"
        onOpenCsvImport={vi.fn()}
        onOpenBalanceReconcile={vi.fn()}
        onOpenMonthClosing={vi.fn()}
        onExportCsv={vi.fn()}
        onExportPdf={vi.fn()}
      />
    );

    expect(screen.queryByRole('group', { name: /mode d'affichage du budget/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Pilotage' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Tendances' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /importer un relevé csv/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /réconcilier mon solde bancaire/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clôturer le mois/i })).toBeInTheDocument();
  });

  it('affiche Pilotage, Tendances et Import CSV en mode détaillé dans MonthlyInsights', () => {
    render(
      <MonthlyInsights
        analytics={mockAnalytics}
        budgetViewMode="advanced"
        onOpenCsvImport={vi.fn()}
        onOpenBalanceReconcile={vi.fn()}
      />
    );

    expect(screen.getByRole('tab', { name: 'Pilotage' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tendances' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /importer un relevé csv/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /réconcilier mon solde bancaire/i })).toBeInTheDocument();
  });

  it('masque Scénarios, Règles et Apple Pay dans BudgetSettingsSheet en mode essentiel et les affiche en mode détaillé', () => {
    const { rerender } = renderWithQueryClient(
      <BudgetSettingsSheet
        isOpen
        onClose={vi.fn()}
        budget={mockBudget}
        canDelete={false}
        currentUserId="u1"
        onBudgetCreated={vi.fn()}
        onBudgetDeleted={vi.fn()}
        budgetViewMode="essential"
      />
    );

    expect(screen.queryByText(/scénarios de budget/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/règles d’auto-catégorisation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/apple pay/i)).not.toBeInTheDocument();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <BudgetSettingsSheet
          isOpen
          onClose={vi.fn()}
          budget={mockBudget}
          canDelete={false}
          currentUserId="u1"
          onBudgetCreated={vi.fn()}
          onBudgetDeleted={vi.fn()}
          budgetViewMode="advanced"
        />
      </QueryClientProvider>
    );

    expect(screen.getByText(/scénarios de budget/i)).toBeInTheDocument();
    expect(screen.getByText(/règles d’auto-catégorisation/i)).toBeInTheDocument();
    expect(screen.getByText(/apple pay/i)).toBeInTheDocument();
  });

  it('masque l’option Rollover dans CreationFormModal quand showRolloverOption est false', () => {
    const { rerender } = render(
      <CreationFormModal
        isOpen
        onClose={vi.fn()}
        pillar="variable_envelope"
        currentRemainingToAllocate={500}
        showRolloverOption={false}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.queryByText(/reporter le solde au mois suivant/i)).not.toBeInTheDocument();

    rerender(
      <CreationFormModal
        isOpen
        onClose={vi.fn()}
        pillar="variable_envelope"
        currentRemainingToAllocate={500}
        showRolloverOption
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText(/reporter le solde au mois suivant/i)).toBeInTheDocument();
  });
});

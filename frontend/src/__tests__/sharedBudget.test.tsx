import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { ShareBudgetModal } from '../components/layout/BudgetSwitcher';
import { ContributionCalculatorSheet } from '../features/shared-budget/ContributionCalculatorSheet';
import { InvitePartnerSheet } from '../features/shared-budget/InvitePartnerSheet';
import { MembersList } from '../features/shared-budget/MembersList';
import { QrCodeModal } from '../features/shared-budget/QrCodeModal';
import * as analyticsService from '../services/analytics.service';
import * as budgetService from '../services/budget.service';
import * as goalService from '../services/goal.service';
import * as periodService from '../services/period.service';
import { useAuthStore } from '../store/useAuthStore';
import { useBudgetStore } from '../store/useBudgetStore';
import type { BudgetPeriod, BudgetSpace, UserProfile } from '../types/budget.types';
import { buildQrMatrix } from '../utils/qrCode';

vi.mock('../services/budget.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/budget.service')>();
  return {
    ...actual,
    listBudgets: vi.fn(),
    generateBudgetInvite: vi.fn(),
    joinBudgetByCode: vi.fn(),
    updateContributionSplit: vi.fn(),
    removeBudgetMember: vi.fn()
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

function renderWithQuery(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const sampleUser: UserProfile = {
  id: 'u-johann',
  email: 'johann@eparnio.fr',
  displayName: 'Johann',
  avatarEmoji: '🧑',
  hasCompletedOnboarding: true,
  preferences: { currency: 'EUR', budgetStartDay: 1, theme: 'light' }
};

const sharedBudget: BudgetSpace = {
  id: 'budget-shared-1',
  name: 'Budget Couple',
  type: 'shared',
  ownerId: 'u-johann',
  contributionMode: 'equal_50_50',
  inviteCode: 'COUPLE26',
  budgetStartDay: 1,
  members: [
    {
      userId: 'u-johann',
      displayName: 'Johann',
      avatarEmoji: '🧑',
      role: 'owner',
      color: '#7C3AED',
      declaredMonthlyIncome: 2400,
      joinedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      userId: 'u-claire',
      displayName: 'Claire',
      avatarEmoji: '👩',
      role: 'editor',
      color: '#EC4899',
      declaredMonthlyIncome: 1600,
      joinedAt: '2026-01-02T00:00:00.000Z'
    }
  ]
};

const samplePeriod: BudgetPeriod = {
  id: 'period-1',
  budgetId: 'budget-shared-1',
  year: 2026,
  month: 3,
  label: 'Mars 2026',
  startDate: '2026-03-01T00:00:00.000Z',
  endDate: '2026-03-31T23:59:59.999Z',
  summary: {
    plannedIncome: 2000,
    plannedFixedCharges: 1200,
    plannedEnvelopes: 500,
    plannedSavings: 300,
    spentVariables: 0,
    remainingToAllocate: 0,
    remainingToLive: 800
  }
};

afterEach(() => {
  useAuthStore.getState().clearSession();
  useBudgetStore.getState().setActiveBudgetId(null);
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  vi.clearAllMocks();
});

describe('Étape 7 — Partage Complet (QR Code, Lien, Membres, Calculateur 50/50 & Prorata)', () => {
  it('génère un QR Code SVG déterministe client-side et gère ShareBudgetModal & QrCodeModal', async () => {
    const user = userEvent.setup();
    const matrix = buildQrMatrix('https://eparnio.app/?invite=COUPLE26');
    expect(matrix.length).toBeGreaterThanOrEqual(21);
    expect(matrix[0]?.[0]).toBe(true); // Finder pattern coin supérieur gauche

    const onGenerateInvite = vi.fn().mockResolvedValue('NEWCODE9');

    renderWithQuery(
      <ShareBudgetModal
        isOpen
        budget={sharedBudget}
        onGenerateInvite={onGenerateInvite}
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByText('Partagez votre espace Eparnio avec vos proches !')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Scanner le QR Code' }));
    expect(
      await screen.findByRole('img', { name: 'QR Code d’invitation pour Budget Couple' })
    ).toBeInTheDocument();
    expect(screen.getByText('COUPLE26')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Régénérer un nouveau code' }));
    await waitFor(() => {
      expect(onGenerateInvite).toHaveBeenCalledWith('budget-shared-1');
    });
    expect(await screen.findByText('NEWCODE9')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copier le lien complet' }));
    expect(await screen.findByText('URL d’invitation copiée !')).toBeInTheDocument();
  });

  it('rend QrCodeModal de manière autonome et permet la fermeture', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <QrCodeModal
        isOpen
        budgetName="Colocation"
        inviteCode="COLOC77"
        inviteUrl="https://eparnio.app/?invite=COLOC77"
        onClose={onClose}
      />
    );

    expect(screen.getByRole('img', { name: 'QR Code d’invitation pour Colocation' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('permet de rejoindre un budget depuis un lien complet saisi manuellement', async () => {
    const user = userEvent.setup();
    const onJoined = vi.fn();
    vi.mocked(budgetService.joinBudgetByCode).mockResolvedValue({
      status: 'ok',
      alreadyMember: false,
      budget: sharedBudget
    });

    renderWithQuery(
      <InvitePartnerSheet isOpen initialCode="" onClose={vi.fn()} onJoined={onJoined} />
    );

    await user.type(
      screen.getByLabelText('Code ou lien d’invitation'),
      'https://eparnio.app/?invite=couple26'
    );
    expect(screen.getByText('Code détecté : COUPLE26')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Rejoindre cet espace' }));
    await waitFor(() => {
      expect(budgetService.joinBudgetByCode).toHaveBeenCalledWith('COUPLE26');
      expect(onJoined).toHaveBeenCalledWith(sharedBudget);
    });
  });

  it('détecte automatiquement ?invite= dans App et ouvre le tiroir pré-rempli', async () => {
    window.history.replaceState({}, '', '/?invite=AUTOJOIN');
    useAuthStore.getState().setSession('jwt-1', sampleUser);
    vi.mocked(budgetService.listBudgets).mockResolvedValue([sharedBudget]);
    vi.mocked(periodService.getPeriodByMonth).mockResolvedValue({
      status: 'ok',
      period: samplePeriod,
      envelopes: []
    });
    vi.mocked(goalService.listGoals).mockResolvedValue({ status: 'ok', goals: [] });
    vi.mocked(analyticsService.getPeriodAnalytics).mockResolvedValue({
      status: 'ok',
      analytics: analyticsService.buildClientPeriodAnalytics(samplePeriod, [], sharedBudget, sampleUser)
    });

    renderWithQuery(<App />);
    expect(await screen.findByText('Rejoindre un espace partagé')).toBeInTheDocument();
    expect(screen.getByText('Code détecté : AUTOJOIN')).toBeInTheDocument();
  });

  it('gère MembersList (rôles, régénération du code, retrait et départ volontaire)', async () => {
    const user = userEvent.setup();
    const onChangeMemberRole = vi.fn();
    const onRemoveMember = vi.fn();
    const onRegenerateInvite = vi.fn();

    const { rerender } = render(
      <MembersList
        members={sharedBudget.members}
        ownerId="u-johann"
        currentUserId="u-johann"
        inviteCode="COUPLE26"
        onChangeMemberRole={onChangeMemberRole}
        onRemoveMember={onRemoveMember}
        onRegenerateInvite={onRegenerateInvite}
      />
    );

    expect(screen.getByText('Membres (2)')).toBeInTheDocument();
    expect(screen.getByText('Propriétaire')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Rôle de Claire'), 'viewer');
    expect(onChangeMemberRole).toHaveBeenCalledWith('u-claire', 'viewer');

    await user.click(screen.getByRole('button', { name: 'Retirer Claire' }));
    expect(onRemoveMember).toHaveBeenCalledWith('u-claire');

    await user.click(
      screen.getByRole('button', { name: 'Régénérer le code (révoquer l’ancien lien)' })
    );
    expect(onRegenerateInvite).toHaveBeenCalledTimes(1);

    // Vue d'un membre non-propriétaire : bouton Quitter
    rerender(
      <MembersList
        members={sharedBudget.members}
        ownerId="u-johann"
        currentUserId="u-claire"
        onRemoveMember={onRemoveMember}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Quitter cet espace partagé' }));
    expect(onRemoveMember).toHaveBeenCalledWith('u-claire');
  });

  it('calcule en direct la répartition 50/50 puis Prorata 60/40 et enregistre via updateContributionSplit', async () => {
    const user = userEvent.setup();
    vi.mocked(budgetService.updateContributionSplit).mockResolvedValue({
      status: 'ok',
      budget: { ...sharedBudget, contributionMode: 'income_prorata' },
      split: {
        mode: 'income_prorata',
        targetAmount: 2000,
        totalDeclaredIncome: 4000,
        members: []
      }
    });

    const { container } = renderWithQuery(
      <ContributionCalculatorSheet
        isOpen
        budget={sharedBudget}
        periodId="period-1"
        defaultTargetAmount={2000}
        currentUserId="u-johann"
        onClose={vi.fn()}
      />
    );

    // En mode initial 50/50 sur 2 000 € -> 1 000,00 € chacun
    expect(screen.getAllByText('50 %')).toHaveLength(2);
    expect(
      normalizeSpaces(container.textContent ?? '')
    ).toContain('1 000,00 €');

    // Bascule vers Prorata des salaires (2400 € vs 1600 € -> 60% / 40% soit 1 200 € / 800 €)
    await user.click(screen.getByRole('button', { name: 'Prorata des salaires' }));
    expect(screen.getByText('60 %')).toBeInTheDocument();
    expect(screen.getByText('40 %')).toBeInTheDocument();
    const text = normalizeSpaces(container.textContent ?? '');
    expect(text).toContain('1 200,00 €');
    expect(text).toContain('800,00 €');

    // Met à jour le salaire de Claire à 2400 -> repasse à 50 % / 50 %
    const claireIncomeInput = screen.getByLabelText('Revenu net mensuel de Claire (€)');
    await user.clear(claireIncomeInput);
    await user.type(claireIncomeInput, '2400');
    expect(screen.getAllByText('50 %')).toHaveLength(2);

    // Remet Claire à 1600 et valide
    await user.clear(claireIncomeInput);
    await user.type(claireIncomeInput, '1600');
    await user.click(screen.getByRole('button', { name: 'Appliquer cette répartition' }));

    await waitFor(() => {
      expect(budgetService.updateContributionSplit).toHaveBeenCalledWith('budget-shared-1', {
        contributionMode: 'income_prorata',
        targetAmount: 2000,
        periodId: 'period-1',
        applyToPeriod: true,
        members: [
          { userId: 'u-johann', declaredMonthlyIncome: 2400 },
          { userId: 'u-claire', declaredMonthlyIncome: 1600 }
        ]
      });
    });
  });
});

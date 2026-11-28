import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { CreationFormModal } from '../features/budget/CreationFormModal';
import { EnvelopesList } from '../features/budget/EnvelopesList';
import { AddExpenseSheet } from '../features/transactions/AddExpenseSheet';
import { EnvelopeDetailPage } from '../features/transactions/EnvelopeDetailPage';
import { TransactionHistory } from '../features/transactions/TransactionHistory';
import * as budgetService from '../services/budget.service';
import * as envelopeService from '../services/envelope.service';
import * as periodService from '../services/period.service';
import * as transactionService from '../services/transaction.service';
import { useAuthStore } from '../store/useAuthStore';
import { useBudgetStore } from '../store/useBudgetStore';
import type {
  BudgetMember,
  BudgetPeriodSummary,
  EnvelopeItem,
  TransactionItem
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

const coursesEnvelope: EnvelopeItem = {
  id: 'env-courses',
  budgetId: 'budget-1',
  budgetPeriodId: 'period-1',
  pillar: 'variable_envelope',
  name: 'Courses',
  icon: '🛒',
  color: '#16A34A',
  allocatedAmount: 400,
  spentOrPaidAmount: 120,
  date: '2026-11-01T12:00:00.000Z',
  isRecurring: true,
  isPaid: false,
  order: 0
};

const sortiesOverspentEnvelope: EnvelopeItem = {
  id: 'env-sorties',
  budgetId: 'budget-1',
  budgetPeriodId: 'period-1',
  pillar: 'variable_envelope',
  name: 'Sorties',
  icon: '🍽️',
  color: '#F472B6',
  allocatedAmount: 150,
  spentOrPaidAmount: 175,
  date: '2026-11-01T12:00:00.000Z',
  isRecurring: true,
  isPaid: false,
  order: 1
};

const sampleTransactions: TransactionItem[] = [
  {
    id: 'tx-1',
    budgetId: 'budget-1',
    budgetPeriodId: 'period-1',
    envelopeId: 'env-courses',
    authorId: 'user-1',
    paidByUserId: 'user-2',
    type: 'expense',
    amount: 120,
    label: 'Supermarché',
    date: '2026-11-08T12:00:00.000Z'
  }
];

afterEach(() => {
  useAuthStore.getState().clearSession();
  useBudgetStore.getState().setActiveBudgetId(null);
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  vi.clearAllMocks();
});

describe('Onglet Enveloppes — EnvelopesList & PastelEnvelopeCard', () => {
  it('affiche la jauge Reste dans les enveloppes et les tuiles pastel avec alerte de dépassement', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    const summary: BudgetPeriodSummary = {
      plannedIncome: 3000,
      plannedFixedCharges: 1000,
      plannedEnvelopes: 550,
      plannedSavings: 0,
      spentVariables: 295,
      remainingToAllocate: 1450,
      remainingToLive: 1705
    };

    render(
      <EnvelopesList
        items={[coursesEnvelope, sortiesOverspentEnvelope]}
        summary={summary}
        onAddEnvelope={vi.fn()}
        onSelectEnvelope={onSelect}
      />
    );

    expect(screen.getByText('Reste dans les enveloppes')).toBeInTheDocument();
    // 550 - 295 = 255,00 €
    expect(screen.getByRole('img', { name: /Reste dans les enveloppes/i })).toHaveAttribute(
      'aria-label',
      expect.stringContaining('255,00')
    );

    const coursesTile = screen.getByRole('button', { name: 'Ouvrir l’enveloppe Courses' });
    expect(normalizeSpaces(coursesTile.textContent ?? '')).toContain('400,00 €');
    expect(normalizeSpaces(coursesTile.textContent ?? '')).toContain('280,00 €');

    const sortiesTile = screen.getByRole('button', { name: 'Ouvrir l’enveloppe Sorties' });
    expect(sortiesTile).toHaveTextContent('Dépassée');
    expect(normalizeSpaces(sortiesTile.textContent ?? '')).toContain('-25,00 €');

    await user.click(coursesTile);
    expect(onSelect).toHaveBeenCalledWith(coursesEnvelope);
  });
});

describe('Saisie au pouce — AddExpenseSheet, NumericKeypad & EnvelopeDetailSheet', () => {
  it('calcule Restant dans l’enveloppe en direct et sélectionne Payé par en budget commun', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <AddExpenseSheet
        isOpen
        onClose={vi.fn()}
        envelope={coursesEnvelope}
        defaultDate="2026-11-12"
        members={members}
        currentUserId="user-1"
        isSharedBudget
        onSubmit={onSubmit}
      />
    );

    const liveBanner = screen.getByTestId('live-remaining-in-envelope');
    // 400 - 120 = 280,00 € restants initialement
    expect(normalizeSpaces(liveBanner.textContent ?? '')).toContain('280,00 €');

    const keypad = screen.getByRole('group', { name: 'Pavé numérique' });
    await user.click(within(keypad).getByRole('button', { name: 'Chiffre 3' }));
    await user.click(within(keypad).getByRole('button', { name: 'Chiffre 0' }));
    await user.click(within(keypad).getByRole('button', { name: 'Chiffre 0' }));

    // 280 - 300 = -20,00 € (dépassement)
    expect(normalizeSpaces(liveBanner.textContent ?? '')).toContain('-20,00 €');
    expect(liveBanner).toHaveTextContent(/dépassement/i);

    // Effacer 1 chiffre ('0') -> montant = 30 -> reste 250,00 €
    await user.click(within(keypad).getByRole('button', { name: 'Effacer un chiffre' }));
    expect(normalizeSpaces(liveBanner.textContent ?? '')).toContain('250,00 €');

    await user.type(screen.getByLabelText('Nom'), 'Primeur');
    await user.click(screen.getByRole('button', { name: 'Membre 2' }));
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(onSubmit).toHaveBeenCalledWith({
      envelopeId: 'env-courses',
      type: 'expense',
      amount: 30,
      label: 'Primeur',
      date: '2026-11-12T12:00:00.000Z',
      paidByUserId: 'user-2'
    });
  });

  it('inclut le rolloverAmount (positif et négatif) dans le calcul live d’AddExpenseSheet', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { rerender } = render(
      <AddExpenseSheet
        isOpen
        onClose={onClose}
        envelope={{ ...coursesEnvelope, rolloverAmount: 50 }}
        defaultDate="2026-11-12"
        onSubmit={vi.fn()}
      />
    );

    // 400 + 50 (rollover) - 120 (dépensé) = 330,00 €
    const liveBanner = screen.getByTestId('live-remaining-in-envelope');
    expect(normalizeSpaces(liveBanner.textContent ?? '')).toContain('330,00 €');

    await user.type(screen.getByLabelText('Montant en euros'), '30');
    expect(normalizeSpaces(liveBanner.textContent ?? '')).toContain('300,00 €');

    // Rollover négatif (-20 €) : 400 - 20 - 120 = 260,00 € ; -30 -> 230,00 €
    rerender(
      <AddExpenseSheet
        isOpen
        onClose={onClose}
        envelope={{ ...coursesEnvelope, rolloverAmount: -20 }}
        defaultDate="2026-11-12"
        onSubmit={vi.fn()}
      />
    );
    expect(normalizeSpaces(screen.getByTestId('live-remaining-in-envelope').textContent ?? '')).toContain(
      '230,00 €'
    );
  });

  it('permet de saisir un remboursement avec note, puis de modifier et effacer la note en édition', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    const { rerender } = render(
      <AddExpenseSheet
        isOpen
        onClose={vi.fn()}
        envelope={coursesEnvelope}
        defaultDate="2026-11-12"
        members={members}
        currentUserId="user-1"
        isSharedBudget
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole('radio', { name: 'Remboursement' }));
    expect(screen.getByRole('dialog', { name: 'Ajouter un remboursement · Courses' })).toBeInTheDocument();
    expect(screen.getByText('Reçu par')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Montant en euros'), '35');
    // 280 + 35 = 315,00 €
    expect(normalizeSpaces(screen.getByTestId('live-remaining-in-envelope').textContent ?? '')).toContain(
      '315,00 €'
    );

    await user.type(screen.getByLabelText('Nom'), 'Avoir magasin');
    await user.type(screen.getByLabelText('Note (optionnel)'), 'Ticket retour #12');
    expect(screen.getByText('17 / 300')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(onSubmit).toHaveBeenCalledWith({
      envelopeId: 'env-courses',
      type: 'income',
      amount: 35,
      label: 'Avoir magasin',
      date: '2026-11-12T12:00:00.000Z',
      paidByUserId: 'user-1',
      notes: 'Ticket retour #12'
    });

    const existingRefund: TransactionItem = {
      id: 'tx-refund-1',
      budgetId: 'budget-1',
      budgetPeriodId: 'period-1',
      envelopeId: 'env-courses',
      authorId: 'user-1',
      paidByUserId: 'user-2',
      type: 'income',
      amount: 35,
      label: 'Avoir magasin',
      date: '2026-11-12T12:00:00.000Z',
      notes: 'Ticket retour #12'
    };

    const onEditSubmit = vi.fn().mockResolvedValue(undefined);
    rerender(
      <AddExpenseSheet
        isOpen
        onClose={vi.fn()}
        envelope={coursesEnvelope}
        initialTransaction={existingRefund}
        members={members}
        currentUserId="user-1"
        isSharedBudget
        onSubmit={onEditSubmit}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Modifier le remboursement' })).toBeInTheDocument();
    const notesField = screen.getByLabelText('Note (optionnel)');
    expect(notesField).toHaveValue('Ticket retour #12');

    await user.clear(notesField);
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onEditSubmit).toHaveBeenCalledWith({
      envelopeId: 'env-courses',
      type: 'income',
      amount: 35,
      label: 'Avoir magasin',
      date: '2026-11-12T12:00:00.000Z',
      paidByUserId: 'user-2',
      notes: ''
    });
  });

  it('affiche les remboursements (+ X € et badge) et les notes dans TransactionHistory en modes clair et sombre', () => {
    const mixedTransactions: TransactionItem[] = [
      ...sampleTransactions,
      {
        id: 'tx-refund',
        budgetId: 'budget-1',
        budgetPeriodId: 'period-1',
        envelopeId: 'env-courses',
        authorId: 'user-1',
        paidByUserId: 'user-1',
        type: 'income',
        amount: 25.5,
        label: 'Remboursement mutuelle',
        date: '2026-11-10T12:00:00.000Z',
        notes: 'Dossier optique'
      }
    ];

    const { rerender } = render(
      <TransactionHistory
        transactions={mixedTransactions}
        members={members}
        currentUserId="user-1"
        isSharedBudget
        onEditTransaction={vi.fn()}
        onDeleteTransaction={vi.fn()}
      />
    );

    expect(screen.getByText('Remboursement')).toBeInTheDocument();
    expect(screen.getByText('Dossier optique')).toBeInTheDocument();
    const refundAmount = screen.getByText((_, node) =>
      normalizeSpaces(node?.textContent ?? '') === '+25,50 €'
    );
    expect(refundAmount.className).toContain('text-emerald-600');
    expect(refundAmount.className).toContain('dark:text-emerald-400');

    // Vérification en mode sombre
    document.documentElement.classList.add('dark');
    rerender(
      <TransactionHistory
        transactions={mixedTransactions}
        members={members}
        currentUserId="user-1"
        isSharedBudget
        onEditTransaction={vi.fn()}
        onDeleteTransaction={vi.fn()}
      />
    );
    expect(screen.getByText('Remboursement')).toHaveClass('dark:text-emerald-300');
    expect(screen.getByText('Dossier optique')).toBeInTheDocument();
  });

  it('filtre aussi par note et calcule le sous-total net dans EnvelopeDetailPage', async () => {
    const user = userEvent.setup();
    const detailTxs: TransactionItem[] = [
      {
        id: 'tx-a',
        budgetId: 'budget-1',
        budgetPeriodId: 'period-1',
        envelopeId: 'env-courses',
        authorId: 'user-1',
        paidByUserId: 'user-1',
        type: 'expense',
        amount: 100,
        label: 'Pharmacie',
        date: '2026-11-08T12:00:00.000Z',
        notes: 'Ordonnance optique'
      },
      {
        id: 'tx-b',
        budgetId: 'budget-1',
        budgetPeriodId: 'period-1',
        envelopeId: 'env-courses',
        authorId: 'user-1',
        paidByUserId: 'user-1',
        type: 'income',
        amount: 40,
        label: 'Mutuelle',
        date: '2026-11-09T12:00:00.000Z',
        notes: 'Remboursement optique'
      },
      {
        id: 'tx-c',
        budgetId: 'budget-1',
        budgetPeriodId: 'period-1',
        envelopeId: 'env-courses',
        authorId: 'user-1',
        paidByUserId: 'user-1',
        type: 'expense',
        amount: 20,
        label: 'Boulangerie',
        date: '2026-11-10T12:00:00.000Z'
      }
    ];

    render(
      <EnvelopeDetailPage
        envelope={{ ...coursesEnvelope, spentOrPaidAmount: 80 }}
        allEnvelopes={[coursesEnvelope]}
        transactions={detailTxs}
        members={members}
        currentUserId="user-1"
        isSharedBudget={false}
        onBack={vi.fn()}
        onAddExpense={vi.fn()}
        onEditExpense={vi.fn()}
        onDeleteExpense={vi.fn()}
        onEditEnvelope={vi.fn()}
        onRebalanceEnvelope={vi.fn()}
        onDeleteEnvelope={vi.fn()}
      />
    );

    // Recherche par texte dans `notes` ("optique") -> Pharmacie (100 €) + Mutuelle (-40 €) = net 60,00 €
    const searchInput = screen.getByPlaceholderText('Rechercher une dépense…');
    await user.type(searchInput, 'optique');

    expect(screen.getByText('Pharmacie')).toBeInTheDocument();
    expect(screen.getByText('Mutuelle')).toBeInTheDocument();
    expect(screen.queryByText('Boulangerie')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        (_, node) =>
          node?.tagName.toLowerCase() === 'span' &&
          normalizeSpaces(node.textContent ?? '') === '2 éléments · Total : 60,00 €'
      )
    ).toBeInTheDocument();
  });

  it('affiche la jauge verte en crédit net sur EnvelopeDetailPage lorsque les remboursements dépassent les dépenses', () => {
    render(
      <EnvelopeDetailPage
        envelope={{ ...coursesEnvelope, spentOrPaidAmount: -25 }}
        allEnvelopes={[coursesEnvelope]}
        transactions={[]}
        members={members}
        currentUserId="user-1"
        isSharedBudget={false}
        onBack={vi.fn()}
        onAddExpense={vi.fn()}
        onEditExpense={vi.fn()}
        onDeleteExpense={vi.fn()}
        onEditEnvelope={vi.fn()}
        onRebalanceEnvelope={vi.fn()}
        onDeleteEnvelope={vi.fn()}
      />
    );

    const gaugeValue = screen.getByText(
      (_, node) =>
        node?.tagName.toLowerCase() === 'span' &&
        normalizeSpaces(node.textContent ?? '') === '-25,00 €'
    );
    expect(gaugeValue.className).toContain('text-emerald-600');
  });

  it('masque Date et récurrence lors de la création d’une enveloppe variable dans CreationFormModal', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <CreationFormModal
        isOpen
        onClose={vi.fn()}
        pillar="variable_envelope"
        currentRemainingToAllocate={1500}
        onSubmit={onSubmit}
      />
    );

    expect(screen.queryByLabelText(/Ajouter chaque mois/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Montant en euros'), '400');
    expect(
      normalizeSpaces(screen.getByTestId('live-remaining-to-allocate').textContent ?? '')
    ).toContain('1 100,00 €');

    await user.type(screen.getByLabelText('Nom'), 'Courses');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        pillar: 'variable_envelope',
        name: 'Courses',
        allocatedAmount: 400
      })
    );
  });
});

describe('Intégration App — Onglet Enveloppes & Saisie complète', () => {
  it('crée une enveloppe via FAB (+) puis saisit une dépense et met à jour le restant en temps réel', async () => {
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

    vi.mocked(envelopeService.createEnvelope).mockResolvedValue({
      status: 'ok',
      envelope: {
        id: 'env-new-courses',
        budgetId: 'budget-1',
        budgetPeriodId: 'period-active',
        pillar: 'variable_envelope',
        name: 'Courses',
        icon: '🛒',
        color: '#16A34A',
        allocatedAmount: 400,
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
          plannedIncome: 2500,
          plannedFixedCharges: 0,
          plannedEnvelopes: 400,
          plannedSavings: 0,
          spentVariables: 0,
          remainingToAllocate: 2100,
          remainingToLive: 2500
        }
      }
    });

    vi.mocked(transactionService.listTransactions).mockResolvedValue({
      status: 'ok',
      transactions: []
    });

    vi.mocked(transactionService.createTransaction).mockResolvedValue({
      status: 'ok',
      transaction: {
        id: 'tx-new-1',
        budgetId: 'budget-1',
        budgetPeriodId: 'period-active',
        envelopeId: 'env-new-courses',
        authorId: 'user-1',
        paidByUserId: 'user-1',
        type: 'expense',
        amount: 42.8,
        label: 'Marché',
        date: `${year}-${String(month).padStart(2, '0')}-05T12:00:00.000Z`
      },
      envelope: {
        id: 'env-new-courses',
        budgetId: 'budget-1',
        budgetPeriodId: 'period-active',
        pillar: 'variable_envelope',
        name: 'Courses',
        icon: '🛒',
        color: '#16A34A',
        allocatedAmount: 400,
        spentOrPaidAmount: 42.8,
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
          plannedIncome: 2500,
          plannedFixedCharges: 0,
          plannedEnvelopes: 400,
          plannedSavings: 0,
          spentVariables: 42.8,
          remainingToAllocate: 2100,
          remainingToLive: 2457.2
        }
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

    await user.click(screen.getByRole('button', { name: 'Enveloppes' }));
    expect(
      await screen.findByText('Aucune enveloppe budgétaire sur cette période.')
    ).toBeInTheDocument();

    // Créer l'enveloppe Courses via FAB (+)
    await user.click(screen.getByRole('button', { name: 'Ajouter une enveloppe' }));
    await user.type(screen.getByLabelText('Montant en euros'), '400');
    await user.type(screen.getByLabelText('Nom'), 'Courses');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    // Taper sur la tuile pastel Courses -> ouvrir EnvelopeDetailSheet
    const coursesTile = await screen.findByRole('button', { name: 'Ouvrir l’enveloppe Courses' });
    await user.click(coursesTile);

    // Ouvrir les réglages ⚙️ et vérifier les options
    await user.click(await screen.findByRole('button', { name: 'Réglages de l’enveloppe' }));
    expect(await screen.findByRole('button', { name: 'Modifier l’enveloppe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Supprimer l’enveloppe' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fermer le tiroir' }));

    // Retour sur EnvelopeDetailPage -> ouvrir Ajouter une dépense via FAB (+)
    await user.click(await screen.findByRole('button', { name: 'Ajouter une dépense dans Courses' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      screen.getByRole('dialog', { name: 'Ajouter une dépense · Courses' })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Montant en euros'), '42,80');
    await user.type(screen.getByLabelText('Nom'), 'Marché');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByText('Marché')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, node) => normalizeSpaces(node?.textContent ?? '') === '357,20 €'
      )
    ).toBeInTheDocument();

    // Revenir à la page des enveloppes avec < et vérifier la jauge globale (400 - 42,80 = 357,20 €)
    await user.click(screen.getByRole('button', { name: 'Retour aux enveloppes' }));
    expect(screen.getByRole('img', { name: /Reste dans les enveloppes/i })).toHaveAttribute(
      'aria-label',
      expect.stringContaining('357,20')
    );
  });
});

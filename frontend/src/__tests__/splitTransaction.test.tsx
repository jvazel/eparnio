import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuickAddExpenseSheet } from '../features/transactions/QuickAddExpenseSheet';
import { TransactionHistory } from '../features/transactions/TransactionHistory';
import type { EnvelopeItem, TransactionItem } from '../types/budget.types';

const ENVELOPES = [
  {
    id: 'env-1',
    budgetId: 'budget-1',
    budgetPeriodId: 'period-1',
    pillar: 'variable_envelope',
    name: 'Courses',
    allocatedAmount: 300,
    spentOrPaidAmount: 50,
    icon: '🛒',
    color: '#22C55E',
    date: '2026-11-01',
    isPaid: false,
    isRecurring: false
  },
  {
    id: 'env-2',
    budgetId: 'budget-1',
    budgetPeriodId: 'period-1',
    pillar: 'variable_envelope',
    name: 'Maison',
    allocatedAmount: 200,
    spentOrPaidAmount: 0,
    icon: '🏠',
    color: '#3B82F6',
    date: '2026-11-01',
    isPaid: false,
    isRecurring: false
  }
] as unknown as EnvelopeItem[];

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove('dark');
});

describe('Étape 33 — Fractionnement de Ticket (Frontend)', () => {
  it('répartit un ticket sur 2 enveloppes avec calcul live du reste à répartir (mode clair)', async () => {
    const onSplitSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <QuickAddExpenseSheet
        isOpen={true}
        onClose={onClose}
        envelopes={ENVELOPES}
        onSplitSubmit={onSplitSubmit}
        onSubmit={vi.fn()}
      />
    );

    // Saisir un total de 100 €
    fireEvent.click(screen.getByRole('button', { name: 'Chiffre 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chiffre 0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chiffre 0' }));

    fireEvent.change(screen.getByLabelText('Libellé de la dépense'), {
      target: { value: 'Leclerc' }
    });

    // Activer le mode fractionné
    fireEvent.click(screen.getByRole('button', { name: /Répartir sur plusieurs enveloppes/i }));

    fireEvent.change(screen.getByLabelText('Montant part 1'), { target: { value: '70' } });
    expect(screen.getByText(/30,00\s*€/)).toBeInTheDocument();

    // Compléter la dernière part en 1 tap
    fireEvent.click(screen.getByRole('button', { name: 'Compléter' }));
    expect(screen.getByText(/^0,00\s*€$/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la dépense' }));

    await waitFor(() => {
      expect(onSplitSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Leclerc',
          parts: [
            { envelopeId: 'env-1', amount: 70 },
            { envelopeId: 'env-2', amount: 30 }
          ]
        })
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('affiche le badge ✂️ Ticket partagé dans TransactionHistory (mode sombre)', () => {
    document.documentElement.classList.add('dark');

    const txs: TransactionItem[] = [
      {
        id: 'tx-1',
        budgetId: 'budget-1',
        budgetPeriodId: 'period-1',
        envelopeId: 'env-1',
        authorId: 'user-1',
        paidByUserId: 'user-1',
        type: 'expense',
        amount: 70,
        label: 'Leclerc',
        date: '2026-11-12T00:00:00.000Z',
        splitGroupId: 'group-1'
      }
    ];

    render(
      <TransactionHistory
        transactions={txs}
        onEditTransaction={vi.fn()}
        onDeleteTransaction={vi.fn()}
      />
    );
    expect(screen.getByText('✂️ Ticket partagé')).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuickAddButton } from '../components/layout/QuickAddButton';
import {
  evaluateArithmeticExpression,
  NumericKeypad
} from '../components/ui/NumericKeypad';
import { QuickAddExpenseSheet } from '../features/transactions/QuickAddExpenseSheet';
import type { EnvelopeItem } from '../types/budget.types';

const ENVELOPES = [
  {
    id: 'env-1',
    budgetId: 'budget-1',
    budgetPeriodId: 'period-1',
    pillar: 'variable_envelope',
    name: 'Courses',
    allocatedAmount: 300,
    rolloverAmount: 50,
    spentOrPaidAmount: 100,
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
    name: 'Sorties',
    allocatedAmount: 120,
    rolloverAmount: 0,
    spentOrPaidAmount: 20,
    icon: '🍕',
    color: '#F59E0B',
    date: '2026-11-01',
    isPaid: false,
    isRecurring: false
  }
] as unknown as EnvelopeItem[];

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove('dark');
});

describe('Étape 31 — Calculatrice intégrée, FAB 2 actions & QuickAddExpenseSheet', () => {
  it('évalue les expressions arithmétiques de façon sécurisée (+, −, ×, ÷, arrondis, div/0)', () => {
    expect(evaluateArithmeticExpression('12 + 8')).toBe(20);
    expect(evaluateArithmeticExpression('10 + 2 × 5')).toBe(20);
    expect(evaluateArithmeticExpression('50 − 12,5')).toBe(37.5);
    expect(evaluateArithmeticExpression('10 ÷ 3')).toBe(3.33);
    expect(evaluateArithmeticExpression('10 ÷ 0')).toBeNull();
    expect(evaluateArithmeticExpression('5 − 20')).toBe(0);
  });

  it('calcule une expression dans NumericKeypad en mode sombre', () => {
    document.documentElement.classList.add('dark');

    function Wrapper() {
      const [val, setVal] = useState('');
      return (
        <div>
          <span data-testid="amount-display">{val || '0'}</span>
          <NumericKeypad value={val} onChange={setVal} />
        </div>
      );
    }

    render(<Wrapper />);

    fireEvent.click(screen.getByRole('button', { name: 'Chiffre 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chiffre 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Opérateur +' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chiffre 8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Opérateur =' }));

    expect(screen.getByTestId('amount-display')).toHaveTextContent('20');
  });

  it('déploie le mini-menu à 2 actions sur QuickAddButton', () => {
    const onExpense = vi.fn();
    const onEnvelope = vi.fn();

    render(
      <QuickAddButton
        onClick={vi.fn()}
        ariaLabel="Actions Enveloppes"
        menuActions={[
          { label: 'Ajouter une dépense', primary: true, onClick: onExpense },
          { label: 'Nouvelle enveloppe', onClick: onEnvelope }
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Actions Enveloppes' }));
    expect(screen.getByRole('menuitem', { name: 'Ajouter une dépense' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Nouvelle enveloppe' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Ajouter une dépense' }));
    expect(onExpense).toHaveBeenCalledTimes(1);
  });

  it('affiche les chips pastel avec restant live (incluant rollover) et soumet dans QuickAddExpenseSheet', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <QuickAddExpenseSheet
        isOpen={true}
        onClose={onClose}
        envelopes={ENVELOPES}
        onSubmit={onSubmit}
      />
    );

    // Courses : 300 + 50 (rollover) - 100 = 250 €
    expect(screen.getByText(/Restant dans Courses : 250,00\s*€/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Chiffre 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chiffre 0' }));
    expect(screen.getByText(/Restant dans Courses : 200,00\s*€/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Libellé de la dépense'), {
      target: { value: 'Super U' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la dépense' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          envelopeId: 'env-1',
          amount: 50,
          label: 'Super U',
          type: 'expense'
        })
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnomalousExpensesCard } from '../features/analytics/AnomalousExpensesCard';
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
    spentOrPaidAmount: 50,
    icon: '🛒',
    color: '#22C55E',
    date: '2026-11-01',
    isPaid: false,
    isRecurring: false
  }
] as unknown as EnvelopeItem[];

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove('dark');
});

describe('Étape 34 — Détection des Dépenses Atypiques (Frontend)', () => {
  it('affiche le bandeau préventif en temps réel dans QuickAddExpenseSheet (mode clair)', () => {
    render(
      <QuickAddExpenseSheet
        isOpen={true}
        onClose={vi.fn()}
        envelopes={ENVELOPES}
        anomalyThresholds={{
          'env-1': { median: 25, historyCount: 6, warningThreshold: 50 }
        }}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Chiffre 8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chiffre 0' }));

    expect(screen.getByRole('status')).toHaveTextContent(/Montant inhabituel/);
  });

  it('affiche AnomalousExpensesCard et acquitte une alerte (mode sombre)', () => {
    document.documentElement.classList.add('dark');
    const onDismiss = vi.fn();

    render(
      <AnomalousExpensesCard
        anomalies={[
          {
            transactionId: 'tx-1',
            envelopeId: 'env-1',
            envelopeName: 'Courses',
            label: 'Traiteur',
            amount: 160,
            date: '2026-11-15T00:00:00.000Z',
            severity: 'warning',
            reason: '4x superieur a la mediane habituelle'
          }
        ]}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByText('Dépenses atypiques du mois')).toBeInTheDocument();
    expect(screen.getByText(/Traiteur/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: "C'est normal" }));
    expect(onDismiss).toHaveBeenCalledWith('tx-1');
  });
});

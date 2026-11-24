import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { simulateWhatIf } from '../features/budget/whatIfSimulator';
import { WhatIfSimulatorSheet } from '../features/budget/WhatIfSimulatorSheet';
import * as envelopeService from '../services/envelope.service';
import * as transactionService from '../services/transaction.service';

describe('Simulateur Et si... ?', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calcule correctement achat ponctuel, mensuel, Nx et seuils de faisabilité', () => {
    const oneTime = simulateWhatIf({
      type: 'one_time',
      amount: 100,
      remainingToLive: 500,
      remainingToAllocate: 0,
      daysRemaining: 10,
      totalIncome: 2000,
    });
    expect(oneTime.monthlyImpact).toBe(100);
    expect(oneTime.remainingToLiveAfter).toBe(400);
    expect(oneTime.dailyBudgetAfter).toBe(40);
    expect(oneTime.remainingToAllocateAfter).toBe(0);
    expect(oneTime.feasibility).toBe('compatible');

    const installments = simulateWhatIf({
      type: 'installments',
      amount: 400,
      installmentsCount: 4,
      remainingToLive: 150,
      remainingToAllocate: 100,
      daysRemaining: 10,
      totalIncome: 2000,
    });
    expect(installments.monthlyImpact).toBe(100);
    expect(installments.remainingToLiveAfter).toBe(50);
    expect(installments.remainingToAllocateAfter).toBe(0);
    expect(installments.feasibility).toBe('tight');

    const risk = simulateWhatIf({
      type: 'recurring_fixed',
      amount: 300,
      remainingToLive: 200,
      remainingToAllocate: 0,
      daysRemaining: 10,
      totalIncome: 2000,
    });
    expect(risk.remainingToLiveAfter).toBe(-100);
    expect(risk.feasibility).toBe('risk');
  });

  it('permet de saisir au NumericKeypad et d enregistrer réellement', async () => {
    const txSpy = vi
      .spyOn(transactionService, 'createTransaction')
      .mockResolvedValue({} as never);
    const envSpy = vi
      .spyOn(envelopeService, 'createEnvelope')
      .mockResolvedValue({} as never);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WhatIfSimulatorSheet
          isOpen
          onClose={vi.fn()}
          periodId="p1"
          remainingToLive={500}
          remainingToAllocate={0}
          daysRemaining={10}
          totalIncome={2000}
          variableEnvelopes={[
            {
              id: 'env1',
              budgetId: 'b1',
              budgetPeriodId: 'p1',
              pillar: 'variable_envelope',
              name: 'Courses',
              icon: '🛒',
              color: '#3B82F6',
              allocatedAmount: 300,
              spentOrPaidAmount: 50,
              rolloverEnabled: false,
              rolloverMode: 'positive_only',
              rolloverAmount: 0,
              date: '2026-11-01',
              isRecurring: false,
              recurrenceFrequency: 'monthly',
              isPaid: false,
              order: 0,
            },
          ]}
        />
      </QueryClientProvider>
    );

    // Saisir 50 au pavé numérique
    fireEvent.click(screen.getByRole('button', { name: 'Chiffre 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chiffre 0' }));

    fireEvent.click(screen.getByText('Enregistrer réellement'));

    await waitFor(() => {
      expect(txSpy).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          envelopeId: 'env1',
          amount: 50,
        })
      );
    });
    expect(envSpy).not.toHaveBeenCalled();
  });
});

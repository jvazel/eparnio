import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoBalanceSheet } from '../features/budget/AutoBalanceSheet';
import * as autoBalanceService from '../services/autoBalance.service';

describe('AutoBalanceSheet', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('affiche la suggestion, permet de changer de cible et de confirmer', async () => {
    vi.spyOn(autoBalanceService, 'fetchAutoBalanceSuggestion').mockResolvedValue({
      periodId: 'p1',
      remainingToAllocate: 120,
      isBalanced: false,
      mode: 'surplus',
      recommended: {
        envelopeId: 'e1',
        name: 'Précaution',
        icon: '🐷',
        pillar: 'savings',
        currentAllocated: 100,
        spentOrPaidAmount: 0,
        availableMargin: 0,
        suggestedDelta: 120,
        newAllocated: 220,
      },
      alternatives: [
        {
          envelopeId: 'e2',
          name: 'Courses',
          icon: '🛒',
          pillar: 'variable_envelope',
          currentAllocated: 300,
          spentOrPaidAmount: 50,
          availableMargin: 250,
          suggestedDelta: 120,
          newAllocated: 420,
        },
      ],
    });

    const applySpy = vi
      .spyOn(autoBalanceService, 'applyAutoBalance')
      .mockResolvedValue();

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AutoBalanceSheet isOpen onClose={vi.fn()} periodId="p1" />
      </QueryClientProvider>
    );

    expect(
      await screen.findByText(/Ajouter \+120\.00 € à 🐷 Précaution/)
    ).toBeInTheDocument();

    // Changer de cible vers Courses
    fireEvent.click(screen.getByRole('button', { name: '🛒 Courses' }));
    expect(
      screen.getByText(/Ajouter \+120\.00 € à 🛒 Courses/)
    ).toBeInTheDocument();

    // Confirmer
    fireEvent.click(screen.getByText('Confirmer l’équilibrage'));
    await waitFor(() => {
      expect(applySpy).toHaveBeenCalledWith('p1', 'e2', 120);
    });
  });
});

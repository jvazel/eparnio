import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WrappedModal } from '../features/budget/WrappedModal';
import * as wrappedService from '../services/wrapped.service';

describe('WrappedModal (Eparnio Wrapped)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('affiche les 5 slides, permet de naviguer et de changer d année', async () => {
    const fetchSpy = vi.spyOn(wrappedService, 'fetchAnnualWrapped').mockResolvedValue({
      budgetId: 'b1',
      budgetName: 'Mon Budget',
      budgetType: 'personal',
      year: 2026,
      availableYears: [2025, 2026],
      periodsCount: 12,
      macro: {
        totalIncome: 36000,
        totalFixedCharges: 14000,
        totalVariableSpent: 10000,
        totalSaved: 6000,
        savingsRate: 16.7,
      },
      highlights: {
        bestMonth: {
          periodId: 'p1',
          label: 'Août 2026',
          month: 8,
          remainingToLive: 950,
        },
        topEnvelopes: [
          { name: 'Courses', icon: '🛒', color: '#3B82F6', totalSpent: 4800 },
        ],
        bestControlledEnvelope: {
          name: 'Loisirs',
          icon: '🎮',
          usagePercentage: 65,
        },
        zeroBasedScore: 10,
      },
      topTags: [{ tag: 'vacances', totalSpent: 1200, count: 4 }],
      memberBreakdown: [],
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WrappedModal isOpen onClose={vi.fn()} budgetId="b1" />
      </QueryClientProvider>
    );

    expect(await screen.findByText('2026 en un coup d’œil')).toBeInTheDocument();

    // Slide 2 : Épargne
    fireEvent.click(screen.getByLabelText('Slide suivant'));
    expect(screen.getByText('Votre épargne 2026')).toBeInTheDocument();

    // Slide 3 : Enveloppes phares
    fireEvent.click(screen.getByLabelText('Slide suivant'));
    expect(screen.getByText('Vos enveloppes phares')).toBeInTheDocument();
    expect(screen.getByText('Courses')).toBeInTheDocument();

    // Changement d'année vers 2025
    fireEvent.click(screen.getByRole('button', { name: '2025' }));
    expect(fetchSpy).toHaveBeenCalledWith('b1', 2025);
  });
});

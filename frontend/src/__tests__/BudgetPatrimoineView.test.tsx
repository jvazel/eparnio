import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetPatrimoineView } from '../features/budget/BudgetPatrimoineView';
import * as netWorthService from '../services/netWorth.service';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 320, height: 150 }}>{children}</div>
    ),
  };
});

describe('BudgetPatrimoineView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('affiche le patrimoine net, les projets liés et permet de mettre à jour un solde', async () => {
    vi.spyOn(netWorthService, 'fetchBudgetNetWorth').mockResolvedValue({
      budgetId: 'b1',
      totalAssets: 5000,
      totalLiabilities: 2000,
      netWorth: 3000,
      byCategory: [{ category: 'cash', label: 'Liquidités', amount: 5000 }],
      history: [{ dateKey: '2026-11-24', netWorth: 3000 }],
      accounts: [
        {
          id: 'a1',
          budgetId: 'b1',
          name: 'Livret A',
          category: 'cash',
          icon: '🏦',
          color: '#3B82F6',
          currentBalance: 5000,
          linkedGoals: [
            { id: 'g1', name: 'Vacances Italie', icon: '🇮🇹', currentAmount: 800 },
          ],
          updatedAt: '2026-11-24T12:00:00.000Z',
        },
      ],
    });

    const updateSpy = vi
      .spyOn(netWorthService, 'recordAssetOperation')
      .mockResolvedValue();

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BudgetPatrimoineView budgetId="b1" />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Patrimoine Net')).toBeInTheDocument();
    expect(screen.getByText('Livret A')).toBeInTheDocument();
    expect(screen.getByText(/• Projets : Vacances Italie/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Modifier Livret A'));
    expect(await screen.findByLabelText('Paramètres du compte')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Chiffre 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chiffre 0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chiffre 0' }));
    fireEvent.click(screen.getByText('Enregistrer'));
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalled();
    });
  });
});

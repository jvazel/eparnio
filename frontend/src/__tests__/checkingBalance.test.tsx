import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CheckingAccountCard } from '../features/budget/CheckingAccountCard';
import { apiClient } from '../services/api';

describe('CheckingAccountCard (Étape 59)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('affiche un message de confirmation obligatoire avant d’appeler PUT /checking-balance', async () => {
    const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValueOnce({
      data: {
        status: 'ok',
        checkingAccount: {
          id: 'acc-1',
          name: 'Compte courant',
          currentBalance: 1450.5,
          isCheckingAccount: true,
          updatedAt: '2026-11-26T15:00:00.000Z'
        }
      }
    });

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <CheckingAccountCard budgetId="b1" currentBalance={1200} />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Mettre à jour/i }));
    fireEvent.change(screen.getByLabelText(/Nouveau solde de votre compte courant/i), {
      target: { value: '1450,50' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    // Étape de confirmation obligatoire : aucun appel API encore !
    expect(screen.getByText(/Confirmez-vous la mise à jour du solde/i)).toBeInTheDocument();
    expect(putSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Confirmer la mise à jour/i }));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith('/budgets/b1/checking-balance', {
        balance: 1450.5
      });
    });
  });
});

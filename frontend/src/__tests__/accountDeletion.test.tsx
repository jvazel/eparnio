import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileSheet } from '../features/auth/ProfileSheet';
import { apiClient } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

describe('Suppression de compte RGPD dans ProfileSheet (Étape 56)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 'jwt-test',
      user: {
        id: 'u1',
        email: 'alice@eparnio.test',
        displayName: 'Alice',
        avatarEmoji: '👩',
        hasBiometrics: false,
        hasCompletedOnboarding: true,
        preferences: {
          currency: 'EUR',
          budgetStartDay: 1,
          theme: 'light'
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession();
  });

  it('bloque le bouton tant que SUPPRIMER + mot de passe ne sont pas saisis puis appelle DELETE /auth/me', async () => {
    const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({
      data: {
        status: 'ok',
        message: 'Compte supprimé',
        summary: {
          deletedBudgetsCount: 1,
          transferredBudgetsCount: 0,
          leftSharedBudgetsCount: 0
        }
      }
    });
    const onClose = vi.fn();
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <ProfileSheet isOpen={true} onClose={onClose} />
      </QueryClientProvider>
    );

    // Aller dans l'onglet Sécurité
    fireEvent.click(screen.getByRole('tab', { name: /Sécurité/i }));

    // Déplier la zone danger
    fireEvent.click(screen.getByRole('button', { name: /Supprimer définitivement mon compte/i }));

    const confirmBtn = screen.getByRole('button', {
      name: /Confirmer la suppression définitive/i
    });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Mot de passe actuel pour supprimer/i), {
      target: { value: 'Password123' }
    });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Tapez SUPPRIMER pour confirmer/i), {
      target: { value: 'SUPPRIMER' }
    });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('/auth/me', {
        data: { currentPassword: 'Password123', confirmation: 'SUPPRIMER' }
      });
    });
    expect(useAuthStore.getState().token).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

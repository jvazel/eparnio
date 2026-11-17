import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthScreen } from '../features/auth/AuthScreen';
import { ProfileSheet } from '../features/auth/ProfileSheet';
import * as authService from '../services/auth.service';
import { useAuthStore } from '../store/useAuthStore';

describe('Étape 12 — Connexion Biométrique Mobile (WebAuthn)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession();
  });

  it('affiche le bouton Face ID / Empreinte sur AuthScreen et connecte l’utilisateur', async () => {
    vi.spyOn(authService, 'browserSupportsWebAuthn').mockReturnValue(true);
    const loginBioSpy = vi.spyOn(authService, 'loginWithBiometrics').mockResolvedValue({
      token: 'jwt-bio',
      user: {
        id: 'u-1',
        email: 'bio@eparnio.fr',
        displayName: 'Bio User',
        avatarEmoji: '🧑',
        hasBiometrics: true,
        hasCompletedOnboarding: true,
        preferences: { currency: 'EUR', budgetStartDay: 1, theme: 'light' }
      }
    });

    render(<AuthScreen />);
    fireEvent.change(screen.getByLabelText(/adresse e-mail/i), {
      target: { value: 'bio@eparnio.fr' }
    });
    fireEvent.click(screen.getByRole('button', { name: /face id \/ empreinte/i }));

    await waitFor(() => {
      expect(loginBioSpy).toHaveBeenCalledWith('bio@eparnio.fr');
      expect(useAuthStore.getState().token).toBe('jwt-bio');
    });
  });

  it('permet d’activer la biométrie depuis ProfileSheet', async () => {
    vi.spyOn(authService, 'browserSupportsWebAuthn').mockReturnValue(true);
    const registerBioSpy = vi.spyOn(authService, 'registerBiometrics').mockResolvedValue({
      user: {
        id: 'u-1',
        email: 'bio@eparnio.fr',
        displayName: 'Bio User',
        avatarEmoji: '🧑',
        hasBiometrics: true,
        hasCompletedOnboarding: true,
        preferences: { currency: 'EUR', budgetStartDay: 1, theme: 'light' }
      }
    });

    useAuthStore.getState().setSession('jwt-1', {
      id: 'u-1',
      email: 'bio@eparnio.fr',
      displayName: 'Bio User',
      avatarEmoji: '🧑',
      hasBiometrics: false,
      hasCompletedOnboarding: true,
      preferences: { currency: 'EUR', budgetStartDay: 1, theme: 'light' }
    });

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ProfileSheet isOpen onClose={() => undefined} />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /activer face id \/ empreinte/i }));
    await waitFor(() => {
      expect(registerBioSpy).toHaveBeenCalledTimes(1);
    });
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileSheet } from '../features/auth/ProfileSheet';
import { useAuthStore } from '../store/useAuthStore';

describe('Étape 14 — Rappels & Notifications PWA', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    useAuthStore.getState().setSession('jwt-1', {
      id: 'u-1',
      email: 'test@eparnio.fr',
      displayName: 'Test User',
      avatarEmoji: '🧑',
      hasCompletedOnboarding: true,
      preferences: { currency: 'EUR', budgetStartDay: 1, theme: 'light' }
    });
  });

  it('permet d’activer et désactiver les rappels locaux dans ProfileSheet', async () => {
    Object.defineProperty(window, 'Notification', {
      value: {
        permission: 'granted',
        requestPermission: vi.fn().mockResolvedValue('granted')
      },
      configurable: true
    });

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ProfileSheet isOpen onClose={() => undefined} />
      </QueryClientProvider>
    );

    const enableBtn = screen.getByRole('button', { name: /activer les rappels/i });
    fireEvent.click(enableBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /désactiver les rappels/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/fréquence des rappels/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/fréquence des rappels/i), {
      target: { value: 'weekly' }
    });

    const saved = JSON.parse(window.localStorage.getItem('eparnio-reminders') ?? '{}') as {
      enabled?: boolean;
      frequency?: string;
    };
    expect(saved.enabled).toBe(true);
    expect(saved.frequency).toBe('weekly');

    fireEvent.click(screen.getByRole('button', { name: /désactiver les rappels/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /activer les rappels/i })).toBeInTheDocument();
    });
  });
});

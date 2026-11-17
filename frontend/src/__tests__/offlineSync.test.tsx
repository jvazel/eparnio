import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineBanner } from '../components/pwa/OfflineBanner';
import { apiClient } from '../services/api';
import { clearOfflineQueue, enqueueOfflineAction, getOfflineQueue } from '../utils/offlineQueue';

describe('Étape 15 — Mode Hors-Ligne & File de synchronisation (PWA)', () => {
  beforeEach(() => {
    clearOfflineQueue();
    vi.restoreAllMocks();
    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true
    });
  });

  it('ne rend rien quand on est en ligne et sans action en attente', () => {
    const queryClient = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <OfflineBanner />
      </QueryClientProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le bandeau hors-ligne et synchronise la file au retour du réseau', async () => {
    const requestSpy = vi.spyOn(apiClient, 'request').mockResolvedValue({ data: {} });
    enqueueOfflineAction({
      method: 'POST',
      url: '/periods/p-1/transactions',
      payload: { label: 'Pain', amount: 2.5 }
    });

    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      configurable: true
    });

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <OfflineBanner />
      </QueryClientProvider>
    );

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByText(/Mode hors-ligne — 1 action\(s\) en attente/i)).toBeInTheDocument();

    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true
    });

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(requestSpy).toHaveBeenCalledWith({
        method: 'POST',
        url: '/periods/p-1/transactions',
        data: { label: 'Pain', amount: 2.5 }
      });
      expect(getOfflineQueue()).toHaveLength(0);
    });
  });

  it('permet de déclencher la synchronisation manuellement via le bouton Synchroniser', async () => {
    const requestSpy = vi.spyOn(apiClient, 'request').mockResolvedValue({ data: {} });
    enqueueOfflineAction({
      method: 'PATCH',
      url: '/periods/p-1/envelopes/e-1',
      payload: { isPaid: true }
    });

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <OfflineBanner />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /synchroniser/i }));

    await waitFor(() => {
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(getOfflineQueue()).toHaveLength(0);
    });
  });
});

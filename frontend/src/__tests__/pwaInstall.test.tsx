import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PwaInstallBanner } from '../components/pwa/PwaInstallBanner';

describe('Étape 11 — Installation PWA sur Mobile (PwaInstallBanner & usePwaInstall)', () => {
  const originalUserAgent = navigator.userAgent;

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true
    });
  });

  it('ne rend rien par défaut sur desktop sans événement beforeinstallprompt', () => {
    const { container } = render(<PwaInstallBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le bouton Installer sur Android/Chrome quand beforeinstallprompt est déclenché', async () => {
    render(<PwaInstallBanner />);

    const promptMock = vi.fn().mockResolvedValue(undefined);
    const installEvent = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
    };
    installEvent.prompt = promptMock;
    installEvent.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });

    act(() => {
      window.dispatchEvent(installEvent);
    });

    expect(screen.getByText('Installer Eparnio')).toBeInTheDocument();
    const installButton = screen.getByRole('button', { name: /installer/i });
    await act(async () => {
      fireEvent.click(installButton);
    });

    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Installer Eparnio')).not.toBeInTheDocument();
  });

  it('affiche le guide iOS Safari quand le navigateur est Safari sur iPhone', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true
    });

    render(<PwaInstallBanner />);
    expect(screen.getByText('Installer Eparnio')).toBeInTheDocument();
    expect(screen.getByText(/Sur l’écran d’accueil/i)).toBeInTheDocument();
  });

  it('masque le bandeau et mémorise la fermeture dans localStorage', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true
    });

    render(<PwaInstallBanner />);
    fireEvent.click(screen.getByRole('button', { name: /fermer la suggestion/i }));

    expect(screen.queryByText('Installer Eparnio')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('eparnio-pwa-install-dismissed')).toBe('true');
  });
});

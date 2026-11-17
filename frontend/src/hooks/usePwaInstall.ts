import { useCallback, useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
}

const DISMISSED_STORAGE_KEY = 'eparnio-pwa-install-dismissed';

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const matchStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  return Boolean(nav.standalone || matchStandalone);
}

function checkIsIosSafari(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const ua = window.navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isWebkit = /webkit/i.test(ua);
  const isOtherBrowser = /crios|fxios|edgios|opios/i.test(ua);
  return isIos && isWebkit && !isOtherBrowser;
}

/**
 * Hook gérant l'installation PWA sur mobile :
 * - Intercepte `beforeinstallprompt` sur Android / Chrome / Edge
 * - Détecte iOS Safari pour afficher le guide « Sur l'écran d'accueil »
 * - Masque le bandeau si l'app est déjà installée ou si l'utilisateur l'a fermé
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => checkIsStandalone());
  const [isIosSafari] = useState<boolean>(() => checkIsIosSafari());
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem(DISMISSED_STORAGE_KEY) === 'true';
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return false;
    }
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'accepted') {
      setIsStandalone(true);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISSED_STORAGE_KEY, 'true');
    }
  }, []);

  return {
    canInstall: Boolean(deferredPrompt),
    isIosSafari,
    isStandalone,
    isDismissed,
    promptInstall,
    dismiss
  };
}

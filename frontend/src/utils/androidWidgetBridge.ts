import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Pont sécurisé entre React et le plugin natif Android `WidgetBridgePlugin.kt`.
 * Sur navigateur Web / PWA (PC, iOS, Android Chrome), toutes les fonctions sont des no-op silencieux.
 */

export interface AndroidWidgetPayload {
  dailyBudget: number;
  remainingToLive: number;
  daysRemaining: number;
  budgetName: string;
  isNegative: boolean;
}

interface NativeWidgetBridgePlugin {
  updateWidgetData: (payload: AndroidWidgetPayload) => Promise<void>;
}

const RegisteredWidgetBridge = registerPlugin<NativeWidgetBridgePlugin>('WidgetBridge');

interface NativeCapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: {
    WidgetBridge?: NativeWidgetBridgePlugin;
    App?: {
      addListener: (
        eventName: 'appUrlOpen',
        listenerFunc: (event: { url: string }) => void
      ) => Promise<{ remove: () => Promise<void> }>;
    };
  };
}

function getCapacitorGlobal(): NativeCapacitorGlobal | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { Capacitor?: NativeCapacitorGlobal }).Capacitor;
}

export function isAndroidNativeApp(): boolean {
  try {
    return Boolean(getCapacitorGlobal()?.isNativePlatform?.() || Capacitor.isNativePlatform());
  } catch {
    return false;
  }
}

/**
 * Synchronise les indicateurs du jour vers les widgets d'écran d'accueil Android.
 * Ne fait rien sur navigateur web.
 */
export async function syncAndroidWidgetData(payload: AndroidWidgetPayload): Promise<boolean> {
  if (!isAndroidNativeApp()) {
    return false;
  }
  const bridge = getCapacitorGlobal()?.Plugins?.WidgetBridge ?? RegisteredWidgetBridge;
  if (!bridge?.updateWidgetData) {
    return false;
  }
  try {
    await bridge.updateWidgetData({
      dailyBudget: Math.round(payload.dailyBudget * 100) / 100,
      remainingToLive: Math.round(payload.remainingToLive * 100) / 100,
      daysRemaining: Math.max(0, Math.round(payload.daysRemaining)),
      budgetName: payload.budgetName.slice(0, 40),
      isNegative: Boolean(payload.isNegative)
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Écoute les deep-links natifs Android (`eparnio://quick-add?...`) déclenchés par les widgets.
 */
export function subscribeNativeAppUrlOpen(
  onUrlOpen: (url: string) => void
): () => void {
  if (!isAndroidNativeApp()) {
    return () => {};
  }
  const appPlugin = getCapacitorGlobal()?.Plugins?.App;
  if (!appPlugin?.addListener) {
    return () => {};
  }

  let cleanup: (() => Promise<void>) | null = null;
  let cancelled = false;

  void appPlugin
    .addListener('appUrlOpen', (event) => {
      if (event?.url) {
        onUrlOpen(event.url);
      }
    })
    .then((handle) => {
      if (cancelled) {
        void handle.remove();
      } else {
        cleanup = handle.remove;
      }
    })
    .catch(() => {
      // Ignorer si le plugin App n'est pas disponible
    });

  return () => {
    cancelled = true;
    if (cleanup) {
      void cleanup();
    }
  };
}

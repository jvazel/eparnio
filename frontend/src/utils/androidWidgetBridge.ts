import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Pont sécurisé entre React et le plugin natif Android `WidgetBridgePlugin.kt`.
 * Sur navigateur Web / PWA (PC, iOS, Android Chrome), toutes les fonctions sont des no-op silencieux.
 */

export interface AndroidWidgetEnvelopeItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  allocated: number;
  spent: number;
  remaining: number;
  percentUsed: number;
}

export interface AndroidWidgetPayload {
  budgetId?: string;
  dailyBudget: number;
  remainingToLive: number;
  daysRemaining: number;
  budgetName: string;
  isNegative: boolean;
  envelopes?: AndroidWidgetEnvelopeItem[];
}

export interface WidgetEnvelopeSource {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  allocatedAmount: number;
  rolloverAmount?: number;
  spentOrPaidAmount: number;
}

/**
 * Sélectionne jusqu'à `limit` enveloppes prioritaires pour le widget Android « Mes Enveloppes »,
 * en incluant `rolloverAmount` dans le disponible et en triant par taux d'utilisation décroissant.
 */
export function selectTopWidgetEnvelopes(
  envelopes: WidgetEnvelopeSource[],
  limit = 4
): AndroidWidgetEnvelopeItem[] {
  return envelopes
    .map((env) => {
      const allocated =
        Math.round(((env.allocatedAmount || 0) + (env.rolloverAmount || 0)) * 100) / 100;
      const spent = Math.round((env.spentOrPaidAmount || 0) * 100) / 100;
      const remaining = Math.round((allocated - spent) * 100) / 100;
      const percentUsed =
        allocated > 0 ? Math.max(0, Math.round((spent / allocated) * 100)) : spent > 0 ? 100 : 0;
      return {
        id: env.id,
        name: env.name.slice(0, 28),
        icon: env.icon || '💳',
        color: env.color || '#7C3AED',
        allocated,
        spent,
        remaining,
        percentUsed
      };
    })
    .sort((a, b) => b.percentUsed - a.percentUsed || b.allocated - a.allocated)
    .slice(0, Math.max(1, limit));
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
      ...(payload.budgetId ? { budgetId: payload.budgetId } : {}),
      dailyBudget: Math.round(payload.dailyBudget * 100) / 100,
      remainingToLive: Math.round(payload.remainingToLive * 100) / 100,
      daysRemaining: Math.max(0, Math.round(payload.daysRemaining)),
      budgetName: payload.budgetName.slice(0, 40),
      isNegative: Boolean(payload.isNegative),
      ...(payload.envelopes ? { envelopes: payload.envelopes.slice(0, 4) } : {})
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

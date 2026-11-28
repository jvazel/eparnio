import { useEffect } from 'react';
import { subscribeNativeAppUrlOpen } from '../utils/androidWidgetBridge';
import {
  clearQuickAddUrl,
  consumePendingQuickAddPrefill,
  parseNativeQuickAddUrl,
  parseQuickAddUrlParams,
  savePendingQuickAddPrefill,
  type QuickAddPrefill
} from '../utils/quickAddDeepLink';

interface UseQuickAddDeepLinkParams {
  canLoadApp: boolean;
  availableBudgetIds: string[];
  onSelectBudget: (budgetId: string) => void;
  onOpenQuickAdd: (prefill: QuickAddPrefill) => void;
}

/**
 * Intercepte les deep-links `/quick-add` (Web / PWA) et `eparnio://quick-add` (Widgets Android),
 * bascule sur `budgetId` si demandé et ouvre la saisie rapide pré-remplie.
 */
export function useQuickAddDeepLink({
  canLoadApp,
  availableBudgetIds,
  onSelectBudget,
  onOpenQuickAdd
}: UseQuickAddDeepLinkParams): void {
  // 1. Deep-link Web au chargement (/quick-add?...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlPrefill = parseQuickAddUrlParams(window.location.pathname, window.location.search);
    if (!urlPrefill) return;

    clearQuickAddUrl();
    if (!canLoadApp) {
      savePendingQuickAddPrefill(urlPrefill);
      return;
    }

    if (urlPrefill.budgetId && availableBudgetIds.includes(urlPrefill.budgetId)) {
      onSelectBudget(urlPrefill.budgetId);
    }
    onOpenQuickAdd(urlPrefill);
  }, [canLoadApp, availableBudgetIds, onSelectBudget, onOpenQuickAdd]);

  // 2. Consommation d'un deep-link mis en attente pendant la reconnexion
  useEffect(() => {
    if (!canLoadApp) return;
    const pending = consumePendingQuickAddPrefill();
    if (!pending) return;

    if (pending.budgetId && availableBudgetIds.includes(pending.budgetId)) {
      onSelectBudget(pending.budgetId);
    }
    onOpenQuickAdd(pending);
  }, [canLoadApp, availableBudgetIds, onSelectBudget, onOpenQuickAdd]);

  // 3. Deep-links natifs Android (eparnio://quick-add?...) depuis les widgets
  useEffect(() => {
    return subscribeNativeAppUrlOpen((rawUrl) => {
      const prefill = parseNativeQuickAddUrl(rawUrl);
      if (!prefill) return;

      if (!canLoadApp) {
        savePendingQuickAddPrefill(prefill);
        return;
      }

      if (prefill.budgetId && availableBudgetIds.includes(prefill.budgetId)) {
        onSelectBudget(prefill.budgetId);
      }
      onOpenQuickAdd(prefill);
    });
  }, [canLoadApp, availableBudgetIds, onSelectBudget, onOpenQuickAdd]);
}

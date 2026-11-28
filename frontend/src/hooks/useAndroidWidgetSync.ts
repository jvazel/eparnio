import { useEffect } from 'react';
import type { BudgetPeriod, EnvelopeItem, PeriodAnalytics } from '../types/budget.types';
import { selectTopWidgetEnvelopes, syncAndroidWidgetData } from '../utils/androidWidgetBridge';

interface UseAndroidWidgetSyncParams {
  canLoadApp: boolean;
  activeBudget: { id: string; name: string } | null;
  activePeriod: BudgetPeriod | null;
  analyticsDaily?: PeriodAnalytics['dailyBudget'];
  remainingToLive: number;
  variableEnvelopes: EnvelopeItem[];
}

/**
 * Synchronise automatiquement les indicateurs du jour et les 4 enveloppes prioritaires
 * vers les widgets natifs Android (no-op silencieux sur navigateur Web / PWA).
 */
export function useAndroidWidgetSync({
  canLoadApp,
  activeBudget,
  activePeriod,
  analyticsDaily,
  remainingToLive,
  variableEnvelopes
}: UseAndroidWidgetSyncParams): void {
  useEffect(() => {
    if (!canLoadApp || !activeBudget || !activePeriod) return;

    const endDateMs = new Date(activePeriod.endDate).getTime();
    const daysRemaining =
      analyticsDaily?.daysRemaining ??
      Math.max(1, Math.ceil((endDateMs - Date.now()) / (1000 * 60 * 60 * 24)));
    const resolvedRemainingToLive = analyticsDaily?.remainingToLive ?? remainingToLive;
    const dailyBudget =
      analyticsDaily?.dailyAmount ??
      (daysRemaining > 0 ? Math.max(0, resolvedRemainingToLive / daysRemaining) : 0);

    void syncAndroidWidgetData({
      budgetId: activeBudget.id,
      dailyBudget,
      remainingToLive: resolvedRemainingToLive,
      daysRemaining,
      budgetName: activeBudget.name,
      isNegative: resolvedRemainingToLive < 0,
      envelopes: selectTopWidgetEnvelopes(variableEnvelopes, 4)
    });
  }, [canLoadApp, activeBudget, activePeriod, analyticsDaily, remainingToLive, variableEnvelopes]);
}

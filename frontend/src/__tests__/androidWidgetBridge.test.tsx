import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isAndroidNativeApp,
  selectTopWidgetEnvelopes,
  subscribeNativeAppUrlOpen,
  syncAndroidWidgetData
} from '../utils/androidWidgetBridge';
import { parseNativeQuickAddUrl } from '../utils/quickAddDeepLink';

describe('androidWidgetBridge & Deep-Link natif Android', () => {
  afterEach(() => {
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  });

  it('est un no-op sûr sur navigateur web (hors Capacitor)', async () => {
    expect(isAndroidNativeApp()).toBe(false);

    const synced = await syncAndroidWidgetData({
      dailyBudget: 28.5,
      remainingToLive: 420,
      daysRemaining: 15,
      budgetName: 'Budget Perso',
      isNegative: false
    });
    expect(synced).toBe(false);

    const unsubscribe = subscribeNativeAppUrlOpen(() => {});
    expect(() => unsubscribe()).not.toThrow();
  });

  it('transmet les données au plugin WidgetBridge sur plateforme native', async () => {
    const updateWidgetData = vi.fn().mockResolvedValue(undefined);
    (window as unknown as { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        WidgetBridge: { updateWidgetData }
      }
    };

    expect(isAndroidNativeApp()).toBe(true);
    const synced = await syncAndroidWidgetData({
      dailyBudget: 28.556,
      remainingToLive: 420.123,
      daysRemaining: 15,
      budgetName: 'Budget Perso',
      isNegative: false
    });

    expect(synced).toBe(true);
    expect(updateWidgetData).toHaveBeenCalledWith({
      dailyBudget: 28.56,
      remainingToLive: 420.12,
      daysRemaining: 15,
      budgetName: 'Budget Perso',
      isNegative: false
    });
  });

  it('parse correctement les deep-links natifs eparnio://quick-add (voice & ocr)', () => {
    const voice = parseNativeQuickAddUrl('eparnio://quick-add?mode=voice');
    expect(voice).toEqual({
      source: 'deep_link',
      mode: 'voice'
    });

    const ocr = parseNativeQuickAddUrl('eparnio://quick-add?mode=ocr&envelope=Courses');
    expect(ocr).toEqual({
      source: 'deep_link',
      mode: 'ocr',
      envelopeName: 'Courses'
    });

    const fromEnvelopeWidget = parseNativeQuickAddUrl(
      'eparnio://quick-add?envelopeId=env-123&budgetId=bud-456'
    );
    expect(fromEnvelopeWidget).toEqual({
      source: 'deep_link',
      envelopeId: 'env-123',
      budgetId: 'bud-456'
    });
  });

  it('sélectionne jusqu’à 4 enveloppes prioritaires avec rolloverAmount', () => {
    const result = selectTopWidgetEnvelopes([
      { id: '1', name: 'Loisirs', icon: '🎮', allocatedAmount: 100, spentOrPaidAmount: 20 },
      { id: '2', name: 'Courses', icon: '🛒', allocatedAmount: 400, rolloverAmount: 50, spentOrPaidAmount: 405 },
      { id: '3', name: 'Sorties', icon: '🍔', allocatedAmount: 150, spentOrPaidAmount: 165 },
      { id: '4', name: 'Essence', icon: '⛽', allocatedAmount: 120, spentOrPaidAmount: 60 },
      { id: '5', name: 'Santé', icon: '💊', allocatedAmount: 80, spentOrPaidAmount: 0 }
    ]);

    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({ id: '3', remaining: -15, percentUsed: 110 });
    expect(result[1]).toMatchObject({ id: '2', allocated: 450, remaining: 45, percentUsed: 90 });
    expect(result[2]).toMatchObject({ id: '4', remaining: 60, percentUsed: 50 });
    expect(result[3]).toMatchObject({ id: '1', remaining: 80, percentUsed: 20 });
  });
});

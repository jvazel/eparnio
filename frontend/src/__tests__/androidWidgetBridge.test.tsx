import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isAndroidNativeApp,
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
  });
});

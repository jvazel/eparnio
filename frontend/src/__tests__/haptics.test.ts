import { afterEach, describe, expect, it, vi } from 'vitest';
import { triggerHaptic } from '../utils/haptics';

describe('triggerHaptic', () => {
  const originalVibrate = navigator.vibrate;

  afterEach(() => {
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: originalVibrate,
    });
  });

  it('déclenche navigator.vibrate avec les bons motifs', () => {
    const vibrateMock = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vibrateMock,
    });

    triggerHaptic('light');
    expect(vibrateMock).toHaveBeenCalledWith(10);

    triggerHaptic('medium');
    expect(vibrateMock).toHaveBeenCalledWith(20);

    triggerHaptic('success');
    expect(vibrateMock).toHaveBeenCalledWith([12, 30, 12]);
  });

  it('ne lève pas d’erreur si navigator.vibrate est absent', () => {
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: undefined,
    });

    expect(() => triggerHaptic('light')).not.toThrow();
  });
});

export type HapticPattern = 'light' | 'medium' | 'success';

const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  success: [12, 30, 12],
};

/**
 * Déclenche une micro-vibration haptique sur les appareils compatibles
 * (`navigator.vibrate`), sans jamais lever d'erreur si non supporté.
 */
export function triggerHaptic(pattern: HapticPattern = 'light'): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }

  try {
    navigator.vibrate(HAPTIC_PATTERNS[pattern]);
  } catch {
    // Ignore les environnements où navigator.vibrate est bloqué
  }
}

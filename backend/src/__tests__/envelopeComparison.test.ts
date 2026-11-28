import { describe, expect, it } from 'vitest';
import { computeEnvelopeComparisonItem } from '../services/envelopeComparison.service';

describe('Étape 77 — Comparaison par enveloppe (envelopeComparison.service)', () => {
  it('calcule correctement une hausse par rapport à la moyenne sur 3 mois et au mois précédent', () => {
    const res = computeEnvelopeComparisonItem({
      envelopeId: 'env-1',
      name: 'Courses',
      icon: '🛒',
      color: '#22C55E',
      currentSpent: 332,
      previousMonthSpent: 310,
      historySpents: [310, 290, 300] // moyenne = 300
    });

    expect(res.average3mSpent).toBe(300);
    expect(res.deltaVsPrevious).toBe(22);
    expect(res.deltaVsAverage3m).toBe(32);
    expect(res.percentVsAverage3m).toBe(11);
  });

  it('calcule correctement une économie (delta négatif)', () => {
    const res = computeEnvelopeComparisonItem({
      envelopeId: 'env-2',
      name: 'Sorties',
      icon: '🍕',
      color: '#F59E0B',
      currentSpent: 80,
      previousMonthSpent: 100,
      historySpents: [100, 100]
    });

    expect(res.average3mSpent).toBe(100);
    expect(res.deltaVsAverage3m).toBe(-20);
    expect(res.percentVsAverage3m).toBe(-20);
  });

  it('protège la division par 0 lorsque l’historique est à 0 € ou vide', () => {
    const emptyRes = computeEnvelopeComparisonItem({
      envelopeId: 'env-3',
      name: 'Nouvelle',
      icon: '✨',
      color: '#3B82F6',
      currentSpent: 50,
      previousMonthSpent: null,
      historySpents: []
    });
    expect(emptyRes.average3mSpent).toBeNull();
    expect(emptyRes.deltaVsAverage3m).toBeNull();
    expect(emptyRes.percentVsAverage3m).toBeNull();

    const zeroRes = computeEnvelopeComparisonItem({
      envelopeId: 'env-4',
      name: 'Zero',
      icon: '✨',
      color: '#3B82F6',
      currentSpent: 50,
      previousMonthSpent: 0,
      historySpents: [0, 0]
    });
    expect(zeroRes.average3mSpent).toBe(0);
    expect(zeroRes.deltaVsAverage3m).toBe(50);
    expect(zeroRes.percentVsAverage3m).toBeNull();
  });
});

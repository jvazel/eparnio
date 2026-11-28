import { describe, expect, it } from 'vitest';
import { computeGoalProjection } from '../services/goalProjection.service';

describe('Étape 75 — Projection réelle d’atteinte des objectifs d’épargne (goalProjection.service)', () => {
  it('calcule la date estimée et le nombre de mois selon la moyenne sur 3 mois', () => {
    const res = computeGoalProjection({
      currentAmount: 1000,
      targetAmount: 2200,
      totalContributionsInWindow: 360, // 120 €/mois sur 3 mois
      windowMonthsCount: 3,
      referenceDate: new Date('2026-11-15T00:00:00.000Z')
    });

    expect(res.averageMonthlyContribution3m).toBe(120);
    expect(res.monthsToTarget).toBe(10);
    expect(res.estimatedCompletionDate).toBe('2027-09-01');
  });

  it('retourne null si aucun versement récent n’a été enregistré', () => {
    const res = computeGoalProjection({
      currentAmount: 200,
      targetAmount: 1000,
      totalContributionsInWindow: 0,
      windowMonthsCount: 3,
      referenceDate: new Date('2026-11-15T00:00:00.000Z')
    });

    expect(res.averageMonthlyContribution3m).toBe(0);
    expect(res.monthsToTarget).toBeNull();
    expect(res.estimatedCompletionDate).toBeNull();
  });

  it('retourne monthsToTarget=0 et date null si l’objectif est déjà atteint', () => {
    const res = computeGoalProjection({
      currentAmount: 1500,
      targetAmount: 1000,
      totalContributionsInWindow: 300,
      windowMonthsCount: 3,
      referenceDate: new Date('2026-11-15T00:00:00.000Z')
    });

    expect(res.averageMonthlyContribution3m).toBe(100);
    expect(res.monthsToTarget).toBe(0);
    expect(res.estimatedCompletionDate).toBeNull();
  });

  it('ne dilue pas la moyenne lorsqu’il y a moins de 3 mois d’historique', () => {
    const res = computeGoalProjection({
      currentAmount: 200,
      targetAmount: 800,
      totalContributionsInWindow: 200, // 1 seul mois d'historique -> 200 €/mois
      windowMonthsCount: 1,
      referenceDate: new Date('2026-11-15T00:00:00.000Z')
    });

    expect(res.averageMonthlyContribution3m).toBe(200);
    expect(res.monthsToTarget).toBe(3);
    expect(res.estimatedCompletionDate).toBe('2027-02-01');
  });
});

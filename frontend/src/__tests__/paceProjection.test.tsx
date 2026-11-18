import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  computePaceProjection,
  PaceProjectionCard
} from '../features/analytics/PaceProjectionCard';

describe('Étape 21 — Projection de Fin de Mois & Rythme de Dépense (Burn Rate)', () => {
  it('calcule correctement les 4 états de projection (healthy, warning, already_negative, no_data)', () => {
    const startDate = '2026-11-01T00:00:00.000Z';
    const today = new Date('2026-11-11T00:00:00.000Z'); // 11 jours écoulés

    // 1. no_data (0 € dépensé)
    expect(
      computePaceProjection({
        remainingToLive: 1000,
        spentVariables: 0,
        remainingDays: 19,
        startDate,
        today
      }).status
    ).toBe('no_data');

    // 2. already_negative
    expect(
      computePaceProjection({
        remainingToLive: -50,
        spentVariables: 400,
        remainingDays: 19,
        startDate,
        today
      }).status
    ).toBe('already_negative');

    // 3. warning : 550 € dépensés en 11 jours => 50 €/jour, reste 200 € => 4 jours (15 nov.)
    const warning = computePaceProjection({
      remainingToLive: 200,
      spentVariables: 550,
      remainingDays: 19,
      startDate,
      today
    });
    expect(warning.status).toBe('warning');
    expect(warning.burnRate).toBe(50);
    expect(warning.daysUntilNegative).toBe(4);

    // 4. healthy : 110 € dépensés en 11 jours => 10 €/jour, reste 500 € sur 19 jours => +310 €
    const healthy = computePaceProjection({
      remainingToLive: 500,
      spentVariables: 110,
      remainingDays: 19,
      startDate,
      today
    });
    expect(healthy.status).toBe('healthy');
    expect(healthy.burnRate).toBe(10);
    expect(healthy.projectedEndBalance).toBe(310);
  });

  it('affiche le message d’alerte avec la date de passage en négatif', () => {
    render(
      <PaceProjectionCard
        remainingToLive={200}
        spentVariables={550}
        remainingDays={19}
        startDate="2026-11-01T00:00:00.000Z"
        today={new Date('2026-11-11T00:00:00.000Z')}
      />
    );

    expect(screen.getByText('Projection de fin de mois')).toBeInTheDocument();
    expect(screen.getByText(/tu passeras en négatif à partir du/i)).toBeInTheDocument();
    expect(screen.getByText(/dans/i)).toBeInTheDocument();
    expect(screen.getByText(/4 jours/i)).toBeInTheDocument();
  });
});

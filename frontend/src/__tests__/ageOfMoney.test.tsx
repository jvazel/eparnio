import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SavingsHealthCard } from '../features/analytics/SavingsHealthCard';

describe('SavingsHealthCard — Indicateur Âge de l’Argent (Étape 60)', () => {
  it('affiche l’état d’apprentissage lorsque le nombre de dépenses est insuffisant', () => {
    render(
      <SavingsHealthCard
        plannedIncome={3000}
        plannedSavings={450}
        plannedFixedCharges={1200}
        ageOfMoney={{
          ageDays: null,
          status: 'learning',
          sampleSize: 4,
          minSamples: 10,
          inflowsCount: 1,
          deltaDays: null
        }}
      />
    );

    expect(screen.getByText(/Âge de l'argent/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Encore 6 dépenses pour calculer l'âge de ton argent/i)
    ).toBeInTheDocument();
  });

  it('affiche le message dédié si aucun revenu perçu n’est pointé', () => {
    render(
      <SavingsHealthCard
        plannedIncome={3000}
        plannedSavings={450}
        plannedFixedCharges={1200}
        ageOfMoney={{
          ageDays: null,
          status: 'learning',
          sampleSize: 0,
          minSamples: 10,
          inflowsCount: 0,
          deltaDays: null
        }}
      />
    );

    expect(
      screen.getByText(/Pointez au moins un revenu perçu pour démarrer le calcul/i)
    ).toBeInTheDocument();
  });

  it('affiche le palier Flux tendu (< 15 j) et ouvre l’infobulle pédagogique au clic sur ⓘ', () => {
    render(
      <SavingsHealthCard
        plannedIncome={3000}
        plannedSavings={300}
        plannedFixedCharges={1200}
        ageOfMoney={{
          ageDays: 9,
          status: 'tight',
          sampleSize: 12,
          minSamples: 10,
          inflowsCount: 2,
          deltaDays: -3
        }}
      />
    );

    expect(screen.getByText('9 jours')).toBeInTheDocument();
    expect(screen.getByText('Flux tendu (< 15 j)')).toBeInTheDocument();
    expect(screen.getByText('-3 j')).toBeInTheDocument();

    const progressbar = screen.getByRole('progressbar', {
      name: /Progression vers l'objectif des 30 jours/i
    });
    expect(progressbar).toHaveAttribute('aria-valuenow', '9');

    const infoButton = screen.getByRole('button', {
      name: /En savoir plus sur l'âge de l'argent/i
    });
    expect(infoButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(infoButton);
    expect(infoButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/méthode FIFO sur les 10 dernières sorties/i)).toBeInTheDocument();
  });

  it('affiche les paliers En progression (15–29 j) et Objectif atteint (≥ 30 j) en mode sombre', () => {
    document.documentElement.classList.add('dark');
    const { rerender } = render(
      <SavingsHealthCard
        plannedIncome={3000}
        plannedSavings={600}
        plannedFixedCharges={1200}
        ageOfMoney={{
          ageDays: 22,
          status: 'growing',
          sampleSize: 15,
          minSamples: 10,
          inflowsCount: 2,
          deltaDays: 5
        }}
      />
    );

    expect(screen.getByText('22 jours')).toBeInTheDocument();
    expect(screen.getByText('En progression (15–29 j)')).toBeInTheDocument();
    expect(screen.getByText('+5 j')).toBeInTheDocument();

    rerender(
      <SavingsHealthCard
        plannedIncome={3000}
        plannedSavings={600}
        plannedFixedCharges={1200}
        ageOfMoney={{
          ageDays: 38,
          status: 'target_reached',
          sampleSize: 25,
          minSamples: 10,
          inflowsCount: 3,
          deltaDays: 8
        }}
      />
    );

    expect(screen.getByText('38 jours')).toBeInTheDocument();
    expect(screen.getByText('Objectif atteint (≥ 30 j)')).toBeInTheDocument();
    const progressbar = screen.getByRole('progressbar', {
      name: /Progression vers l'objectif des 30 jours/i
    });
    expect(progressbar).toHaveAttribute('aria-valuenow', '30');

    document.documentElement.classList.remove('dark');
  });
});

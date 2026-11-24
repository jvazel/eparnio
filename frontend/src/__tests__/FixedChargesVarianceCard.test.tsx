import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  FixedChargesVarianceCard,
  VariancePill,
} from '../features/budget/FixedChargesVarianceCard';

describe('FixedChargesVarianceCard & VariancePill', () => {
  it('affiche les pilules hausse (↗) et baisse (↘)', () => {
    render(
      <div>
        <VariancePill deltaAmount={2} />
        <VariancePill deltaAmount={-5} />
      </div>
    );
    expect(screen.getByText(/↗ \+2,00 €/)).toBeInTheDocument();
    expect(screen.getByText(/↘ -5,00 €/)).toBeInTheDocument();
  });

  it('affiche la carte Évolution des charges fixes quand il y a des écarts', () => {
    render(
      <FixedChargesVarianceCard
        summary={{
          netDelta: 2,
          increasesCount: 1,
          decreasesCount: 0,
          items: [
            {
              envelopeId: 'e1',
              name: 'Netflix',
              icon: '🍿',
              pillar: 'fixed_charge',
              previousAmount: 13.99,
              currentAmount: 15.99,
              deltaAmount: 2,
              deltaPercent: 14.3,
            },
          ],
        }}
      />
    );

    expect(screen.getByText('Évolution des charges fixes')).toBeInTheDocument();
    expect(screen.getByText('Netflix')).toBeInTheDocument();
    expect(screen.getByText('Mois précédent : 13.99 €')).toBeInTheDocument();
  });
});

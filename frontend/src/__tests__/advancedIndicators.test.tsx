import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EnvelopesAtRiskCard } from '../features/analytics/EnvelopesAtRiskCard';
import { MonthVsEnvelopesCard } from '../features/analytics/MonthVsEnvelopesCard';
import {
  SavingsHealthCard,
  computeEmergencyFundAmount
} from '../features/analytics/SavingsHealthCard';
import type { EnvelopeItem } from '../types/budget.types';

describe('Étape 22 — Indicateurs Avancés de Pilotage (Onglet Budget)', () => {
  it('affiche MonthVsEnvelopesCard avec alerte Rythme élevé quand la consommation dépasse le mois', () => {
    render(
      <MonthVsEnvelopesCard
        totalDays={30}
        daysRemaining={15}
        spentVariables={400}
        plannedEnvelopes={500}
      />
    );

    expect(screen.getByText('Avancement du mois vs Enveloppes')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('Rythme élevé')).toBeInTheDocument();
  });

  it('affiche SavingsHealthCard avec le taux d’épargne et le matelas de sécurité', () => {
    render(
      <SavingsHealthCard
        plannedIncome={2000}
        plannedSavings={400}
        plannedFixedCharges={1000}
        totalSavingsGoals={3200}
      />
    );

    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText('Excellent (≥ 20%)')).toBeInTheDocument();
    expect(screen.getByText('3.2 mois')).toBeInTheDocument();
  });

  it('calcule le matelas d’urgence en incluant uniquement les comptes liquidités (cash) sans double comptage', () => {
    const result = computeEmergencyFundAmount(
      [
        { currentAmount: 1000, assetAccountId: 'acc-livret' }, // déjà compté dans acc-livret
        { currentAmount: 500 }, // objectif non lié -> ajouté
        { currentAmount: 700, assetAccountId: 'acc-pea' } // lié à un compte non-liquide -> ajouté
      ],
      [
        { id: 'acc-livret', category: 'cash', currentBalance: 3000 },
        { id: 'acc-courant', category: 'cash', currentBalance: 1000 },
        { id: 'acc-pea', category: 'investment', currentBalance: 15000 },
        { id: 'acc-immo', category: 'real_estate', currentBalance: 200000 },
        { id: 'acc-crypto', category: 'crypto', currentBalance: 4000 },
        { id: 'acc-pret', category: 'liability', currentBalance: 10000 }
      ]
    );

    // liquidités = 3000 + 1000 = 4000 ; objectifs non liés à un compte cash = 500 + 700 = 1200
    expect(result.liquidAssetsTotal).toBe(4000);
    expect(result.totalAmount).toBe(5200);
  });

  it('affiche SavingsHealthCard avec le matelas combinant épargne et liquidités', () => {
    render(
      <SavingsHealthCard
        plannedIncome={2000}
        plannedSavings={300}
        plannedFixedCharges={1000}
        totalSavingsGoals={1000}
        emergencyFundAmount={5200}
        hasLiquidAssets={true}
      />
    );

    expect(screen.getByText('5.2 mois')).toBeInTheDocument();
    expect(screen.getByText('de charges fixes (incl. liquidités)')).toBeInTheDocument();
  });

  it('affiche EnvelopesAtRiskCard uniquement pour les enveloppes en tension (max 3)', () => {
    const envelopes: EnvelopeItem[] = [
      {
        id: '1',
        budgetId: 'b1',
        budgetPeriodId: 'p1',
        pillar: 'variable_envelope',
        name: 'Courses',
        icon: '🛒',
        color: '#34D399',
        allocatedAmount: 300,
        spentOrPaidAmount: 270,
        date: '2026-11-01',
        isRecurring: true,
        isPaid: false,
        order: 0
      },
      {
        id: '2',
        budgetId: 'b1',
        budgetPeriodId: 'p1',
        pillar: 'variable_envelope',
        name: 'Sorties',
        icon: '🍻',
        color: '#F472B6',
        allocatedAmount: 100,
        spentOrPaidAmount: 20,
        date: '2026-11-01',
        isRecurring: true,
        isPaid: false,
        order: 1
      }
    ];

    render(<EnvelopesAtRiskCard envelopes={envelopes} totalDays={30} daysRemaining={15} />);

    expect(screen.getByText('Enveloppes en tension')).toBeInTheDocument();
    expect(screen.getByText('Courses')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.queryByText('Sorties')).not.toBeInTheDocument();
  });
});

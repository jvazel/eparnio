import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  computeSettlementSuggestion,
  MemberBreakdownCard
} from '../features/analytics/MemberBreakdownCard';
import { SharedActivityCard } from '../features/analytics/SharedActivityCard';
import type { EnvelopeItem, MemberBreakdownItem } from '../types/budget.types';

describe('Étape 23 — Améliorations Budget Commun (Équilibrage & Activité)', () => {
  const members: MemberBreakdownItem[] = [
    {
      userId: 'u1',
      displayName: 'Johann',
      avatarEmoji: '🧑',
      color: '#8B5CF6',
      role: 'owner',
      incomeContributed: 1500,
      fixedChargesPaid: 600,
      variableExpensesPaid: 200,
      savingsContributed: 0,
      expensesPaid: 800,
      netBalance: 700,
      incomeSharePercentage: 50,
      expensesSharePercentage: 80
    },
    {
      userId: 'u2',
      displayName: 'Claire',
      avatarEmoji: '👩',
      color: '#EC4899',
      role: 'editor',
      incomeContributed: 1500,
      fixedChargesPaid: 0,
      variableExpensesPaid: 200,
      savingsContributed: 0,
      expensesPaid: 200,
      netBalance: 1300,
      incomeSharePercentage: 50,
      expensesSharePercentage: 20
    }
  ];

  it('calcule qui doit à qui et permet de marquer comme réglé', async () => {
    const user = userEvent.setup();
    const suggestion = computeSettlementSuggestion(members);
    expect(suggestion).toEqual({ fromName: 'Claire', toName: 'Johann', amount: 300 });

    render(<MemberBreakdownCard members={members} currentUserId="u1" />);
    expect(screen.getAllByText(/Claire/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Marquer comme réglé/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Marquer comme réglé/i }));
    expect(screen.getByText(/Équilibre réglé pour ce mois/i)).toBeInTheDocument();
  });

  it('affiche SharedActivityCard avec les dernières activités du foyer', () => {
    const envelopes: EnvelopeItem[] = [
      {
        id: 'e1',
        budgetId: 'b1',
        budgetPeriodId: 'p1',
        pillar: 'variable_envelope',
        name: 'Courses',
        icon: '🛒',
        color: '#34D399',
        allocatedAmount: 400,
        spentOrPaidAmount: 120,
        date: '2026-11-10',
        isRecurring: true,
        isPaid: false,
        order: 0
      }
    ];

    render(<SharedActivityCard envelopes={envelopes} />);
    expect(screen.getByText('Activité récente du foyer')).toBeInTheDocument();
    expect(screen.getByText('Courses')).toBeInTheDocument();
  });
});

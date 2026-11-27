import type { BudgetPeriodSummary, EnvelopeItem } from '../types/budget.types';

export interface ActiveBalanceMetrics {
  receivedIncome: number;
  paidFixedCharges: number;
  upcomingFixedCharges: number;
  activeBalance: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calcule le solde actif estimé sur le compte bancaire (sans les dépenses fixes futures) :
 * Revenus perçus (✓) − Dépenses fixes payées (✓) − Épargne du mois − Dépenses variables saisies.
 */
export function computeActiveAccountBalance(
  envelopes: EnvelopeItem[],
  summary: Pick<BudgetPeriodSummary, 'plannedSavings' | 'spentVariables'>
): ActiveBalanceMetrics {
  const receivedIncome = round2(
    envelopes
      .filter((item) => item.pillar === 'income' && item.isPaid)
      .reduce((acc, item) => acc + item.allocatedAmount, 0)
  );

  const paidFixedCharges = round2(
    envelopes
      .filter((item) => item.pillar === 'fixed_charge' && item.isPaid)
      .reduce((acc, item) => acc + item.allocatedAmount, 0)
  );

  const upcomingFixedCharges = round2(
    envelopes
      .filter((item) => item.pillar === 'fixed_charge' && !item.isPaid)
      .reduce((acc, item) => acc + item.allocatedAmount, 0)
  );

  const activeBalance = round2(
    receivedIncome - paidFixedCharges - summary.plannedSavings - summary.spentVariables
  );

  return {
    receivedIncome,
    paidFixedCharges,
    upcomingFixedCharges,
    activeBalance
  };
}

import type { IEnvelope } from '../models/Envelope.model';

export type EnvelopeAmountInput = Pick<
  IEnvelope,
  'pillar' | 'allocatedAmount' | 'spentOrPaidAmount'
>;

export interface ZeroBasedCalculationResult {
  plannedIncome: number;
  plannedFixedCharges: number;
  plannedEnvelopes: number;
  plannedSavings: number;
  spentVariables: number;
  remainingToAllocate: number;
}

/**
 * Arrondit un montant financier à 2 décimales sans dérive IEEE 754 ni `-0`.
 */
export function roundCurrency(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

/**
 * Calcule les totaux par pilier et le « Restant à répartir » (Budget Base Zéro)
 * selon la formule : Revenus - Dépenses fixes - Enveloppes variables - Épargne.
 */
export function calculateZeroBasedSummary(
  envelopes: ReadonlyArray<EnvelopeAmountInput>
): ZeroBasedCalculationResult {
  let plannedIncome = 0;
  let plannedFixedCharges = 0;
  let plannedEnvelopes = 0;
  let plannedSavings = 0;
  let spentVariables = 0;

  for (const item of envelopes) {
    switch (item.pillar) {
      case 'income':
        plannedIncome += item.allocatedAmount;
        break;
      case 'fixed_charge':
        plannedFixedCharges += item.allocatedAmount;
        break;
      case 'variable_envelope':
        plannedEnvelopes += item.allocatedAmount;
        spentVariables += item.spentOrPaidAmount;
        break;
      case 'savings':
        plannedSavings += item.allocatedAmount;
        break;
    }
  }

  plannedIncome = roundCurrency(plannedIncome);
  plannedFixedCharges = roundCurrency(plannedFixedCharges);
  plannedEnvelopes = roundCurrency(plannedEnvelopes);
  plannedSavings = roundCurrency(plannedSavings);
  spentVariables = roundCurrency(spentVariables);

  const remainingToAllocate = roundCurrency(
    plannedIncome - plannedFixedCharges - plannedEnvelopes - plannedSavings
  );

  return {
    plannedIncome,
    plannedFixedCharges,
    plannedEnvelopes,
    plannedSavings,
    spentVariables,
    remainingToAllocate
  };
}

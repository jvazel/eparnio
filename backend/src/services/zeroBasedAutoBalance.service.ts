import { EnvelopeModel, type IEnvelope } from '../models/Envelope.model';
import { assertPeriodAccess } from './budgetAccess.service';
import { recalculatePeriodSummary } from './remainingToLive.service';
import { roundCurrency } from './zeroBasedBudget.service';

export interface AutoBalanceTarget {
  envelopeId: string;
  name: string;
  icon: string;
  pillar: 'variable_envelope' | 'savings';
  currentAllocated: number;
  spentOrPaidAmount: number;
  availableMargin: number;
  suggestedDelta: number;
  newAllocated: number;
}

export interface AutoBalanceSuggestionResponse {
  periodId: string;
  remainingToAllocate: number;
  isBalanced: boolean;
  mode: 'surplus' | 'deficit' | 'balanced';
  recommended: AutoBalanceTarget | null;
  alternatives: AutoBalanceTarget[];
}

export async function getAutoBalanceSuggestion(
  periodId: string,
  userId: string
): Promise<AutoBalanceSuggestionResponse> {
  await assertPeriodAccess(periodId, userId);
  const period = await recalculatePeriodSummary(periodId);
  const remaining = roundCurrency(period.summary.remainingToAllocate);

  if (Math.abs(remaining) < 0.01) {
    return {
      periodId,
      remainingToAllocate: 0,
      isBalanced: true,
      mode: 'balanced',
      recommended: null,
      alternatives: [],
    };
  }

  const envelopes = await EnvelopeModel.find({
    budgetPeriodId: periodId,
    pillar: { $in: ['savings', 'variable_envelope'] },
  }).lean<IEnvelope[]>();

  if (remaining > 0) {
    // Surplus : proposer épargne en priorité, puis variables
    const sorted = [...envelopes].sort((a, b) => {
      if (a.pillar === b.pillar) return 0;
      return a.pillar === 'savings' ? -1 : 1;
    });

    const targets: AutoBalanceTarget[] = sorted.map((env) => ({
      envelopeId: String(env._id),
      name: env.name,
      icon: env.icon || '💰',
      pillar: env.pillar as 'variable_envelope' | 'savings',
      currentAllocated: roundCurrency(env.allocatedAmount || 0),
      spentOrPaidAmount: roundCurrency(env.spentOrPaidAmount || 0),
      availableMargin: 0,
      suggestedDelta: remaining,
      newAllocated: roundCurrency((env.allocatedAmount || 0) + remaining),
    }));

    return {
      periodId,
      remainingToAllocate: remaining,
      isBalanced: false,
      mode: 'surplus',
      recommended: targets[0] ?? null,
      alternatives: targets.slice(1),
    };
  }

  // Déficit (remaining < 0) : ne jamais modifier fixed_charge ni descendre sous spentOrPaidAmount
  const deficit = Math.abs(remaining);
  const withMargin = envelopes
    .map((env) => {
      const current = roundCurrency(env.allocatedAmount || 0);
      const spent = roundCurrency(env.spentOrPaidAmount || 0);
      const margin = roundCurrency(Math.max(0, current - spent));
      return { env, current, spent, margin };
    })
    .filter((item) => item.margin > 0)
    .sort((a, b) => {
      // Variables avec la plus grande marge en priorité, puis savings en dernier recours
      if (a.env.pillar !== b.env.pillar) {
        return a.env.pillar === 'variable_envelope' ? -1 : 1;
      }
      return b.margin - a.margin;
    });

  const targets: AutoBalanceTarget[] = withMargin.map(({ env, current, spent, margin }) => {
    const reduction = roundCurrency(Math.min(deficit, margin));
    return {
      envelopeId: String(env._id),
      name: env.name,
      icon: env.icon || '🛒',
      pillar: env.pillar as 'variable_envelope' | 'savings',
      currentAllocated: current,
      spentOrPaidAmount: spent,
      availableMargin: margin,
      suggestedDelta: -reduction,
      newAllocated: roundCurrency(current - reduction),
    };
  });

  return {
    periodId,
    remainingToAllocate: remaining,
    isBalanced: false,
    mode: 'deficit',
    recommended: targets[0] ?? null,
    alternatives: targets.slice(1),
  };
}

export async function applyAutoBalance(
  periodId: string,
  userId: string,
  targetEnvelopeId: string,
  deltaAmount: number
) {
  await assertPeriodAccess(periodId, userId);

  const envelope = await EnvelopeModel.findOne({
    _id: targetEnvelopeId,
    budgetPeriodId: periodId,
  });

  if (!envelope) {
    throw new Error('Enveloppe cible introuvable.');
  }
  if (envelope.pillar !== 'variable_envelope' && envelope.pillar !== 'savings') {
    throw new Error('Seules les enveloppes variables et d’épargne peuvent être ajustées.');
  }

  const nextAllocated = roundCurrency((envelope.allocatedAmount || 0) + deltaAmount);
  const spent = roundCurrency(envelope.spentOrPaidAmount || 0);
  if (nextAllocated < spent) {
    throw new Error('Impossible de réduire sous le montant déjà dépensé.');
  }

  envelope.allocatedAmount = nextAllocated;
  await envelope.save();

  const updatedPeriod = await recalculatePeriodSummary(periodId);
  return {
    envelopeId: String(envelope._id),
    newAllocated: nextAllocated,
    summary: updatedPeriod.summary,
  };
}

import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel, type IEnvelope } from '../models/Envelope.model';
import { roundCurrency } from './zeroBasedBudget.service';

export interface EnvelopeVariance {
  previousAmount: number;
  deltaAmount: number;
  deltaPercent: number;
}

export interface FixedChargeVarianceItem {
  envelopeId: string;
  name: string;
  icon: string;
  pillar: 'income' | 'fixed_charge';
  previousAmount: number;
  currentAmount: number;
  deltaAmount: number;
  deltaPercent: number;
}

export interface FixedChargesVarianceSummary {
  netDelta: number;
  increasesCount: number;
  decreasesCount: number;
  items: FixedChargeVarianceItem[];
}

export function calculateVariance(
  currentAmount: number,
  previousAmount: number
): EnvelopeVariance | null {
  const deltaAmount = roundCurrency(currentAmount - previousAmount);
  if (Math.abs(deltaAmount) < 0.01) {
    return null;
  }
  const deltaPercent =
    previousAmount > 0
      ? Math.round((deltaAmount / previousAmount) * 1000) / 10
      : 0;
  return {
    previousAmount: roundCurrency(previousAmount),
    deltaAmount,
    deltaPercent,
  };
}

export async function computePeriodEnvelopesVariance(
  periodId: string,
  envelopes: Array<Pick<IEnvelope, '_id' | 'pillar' | 'name' | 'icon' | 'allocatedAmount' | 'previousEnvelopeId'>>
): Promise<{
  varianceByEnvelopeId: Map<string, EnvelopeVariance>;
  fixedChargesVarianceSummary: FixedChargesVarianceSummary;
}> {
  const varianceByEnvelopeId = new Map<string, EnvelopeVariance>();
  const emptySummary: FixedChargesVarianceSummary = {
    netDelta: 0,
    increasesCount: 0,
    decreasesCount: 0,
    items: [],
  };

  const targetEnvelopes = envelopes.filter(
    (e) => e.pillar === 'fixed_charge' || e.pillar === 'income'
  );
  if (targetEnvelopes.length === 0) {
    return { varianceByEnvelopeId, fixedChargesVarianceSummary: emptySummary };
  }

  const currentPeriod = await BudgetPeriodModel.findById(periodId)
    .select('budgetId startDate')
    .lean();
  if (!currentPeriod) {
    return { varianceByEnvelopeId, fixedChargesVarianceSummary: emptySummary };
  }

  const prevPeriod = await BudgetPeriodModel.findOne({
    budgetId: currentPeriod.budgetId,
    startDate: { $lt: currentPeriod.startDate },
  })
    .sort({ startDate: -1 })
    .select('_id')
    .lean();

  const prevEnvelopes = prevPeriod
    ? await EnvelopeModel.find({
        budgetPeriodId: prevPeriod._id,
        pillar: { $in: ['fixed_charge', 'income'] },
      })
        .select('_id pillar name allocatedAmount')
        .lean()
    : [];

  const prevById = new Map(prevEnvelopes.map((e) => [String(e._id), e]));
  const prevByKey = new Map(
    prevEnvelopes.map((e) => [`${e.pillar}:${e.name.trim().toLowerCase()}`, e])
  );

  let netDelta = 0;
  let increasesCount = 0;
  let decreasesCount = 0;
  const items: FixedChargeVarianceItem[] = [];

  for (const env of targetEnvelopes) {
    const prevMatch =
      (env.previousEnvelopeId ? prevById.get(String(env.previousEnvelopeId)) : undefined) ??
      prevByKey.get(`${env.pillar}:${env.name.trim().toLowerCase()}`);

    if (!prevMatch) continue;

    const variance = calculateVariance(env.allocatedAmount || 0, prevMatch.allocatedAmount || 0);
    if (!variance) continue;

    const envId = String(env._id);
    varianceByEnvelopeId.set(envId, variance);

    if (env.pillar === 'fixed_charge') {
      netDelta = roundCurrency(netDelta + variance.deltaAmount);
      if (variance.deltaAmount > 0) increasesCount += 1;
      if (variance.deltaAmount < 0) decreasesCount += 1;
    }

    items.push({
      envelopeId: envId,
      name: env.name,
      icon: env.icon || '📌',
      pillar: env.pillar as 'income' | 'fixed_charge',
      previousAmount: variance.previousAmount,
      currentAmount: roundCurrency(env.allocatedAmount || 0),
      deltaAmount: variance.deltaAmount,
      deltaPercent: variance.deltaPercent,
    });
  }

  return {
    varianceByEnvelopeId,
    fixedChargesVarianceSummary: {
      netDelta,
      increasesCount,
      decreasesCount,
      items,
    },
  };
}

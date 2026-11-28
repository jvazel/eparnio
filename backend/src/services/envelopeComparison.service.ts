import type { Types } from 'mongoose';
import { BudgetPeriodModel, type IBudgetPeriod } from '../models/BudgetPeriod.model';
import { EnvelopeModel, type IEnvelope } from '../models/Envelope.model';

export interface EnvelopeComparisonItem {
  envelopeId: string;
  name: string;
  icon: string;
  color: string;
  currentSpent: number;
  previousMonthSpent: number | null;
  average3mSpent: number | null;
  deltaVsPrevious: number | null;
  deltaVsAverage3m: number | null;
  percentVsAverage3m: number | null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calcul pur de la comparaison d'une enveloppe variable face au mois précédent et à la moyenne 3 mois.
 */
export function computeEnvelopeComparisonItem(params: {
  envelopeId: string;
  name: string;
  icon: string;
  color: string;
  currentSpent: number;
  previousMonthSpent: number | null;
  historySpents: number[];
}): EnvelopeComparisonItem {
  const { envelopeId, name, icon, color, currentSpent, previousMonthSpent, historySpents } = params;

  const average3mSpent =
    historySpents.length > 0
      ? round2(historySpents.reduce((sum, v) => sum + v, 0) / historySpents.length)
      : null;

  const deltaVsPrevious =
    previousMonthSpent !== null ? round2(currentSpent - previousMonthSpent) : null;

  const deltaVsAverage3m =
    average3mSpent !== null ? round2(currentSpent - average3mSpent) : null;

  const percentVsAverage3m =
    average3mSpent !== null && average3mSpent > 0 && deltaVsAverage3m !== null
      ? Math.round((deltaVsAverage3m / average3mSpent) * 100)
      : null;

  return {
    envelopeId,
    name,
    icon,
    color,
    currentSpent: round2(currentSpent),
    previousMonthSpent: previousMonthSpent !== null ? round2(previousMonthSpent) : null,
    average3mSpent,
    deltaVsPrevious,
    deltaVsAverage3m,
    percentVsAverage3m
  };
}

/**
 * Calcule les comparaisons (vs M-1 et moyenne jusqu'à 3 mois précédents) pour les enveloppes
 * variables de la période active (chaînage `previousEnvelopeId` + fallback sur nom normalisé).
 */
export async function computeBudgetEnvelopeComparisons(
  budgetId: Types.ObjectId | string,
  currentPeriod: Pick<IBudgetPeriod, 'year' | 'month'>,
  currentVariableEnvelopes: Pick<
    IEnvelope,
    '_id' | 'name' | 'icon' | 'color' | 'spentOrPaidAmount' | 'previousEnvelopeId'
  >[]
): Promise<EnvelopeComparisonItem[]> {
  if (currentVariableEnvelopes.length === 0) return [];

  const previousPeriods = await BudgetPeriodModel.find({
    budgetId,
    $or: [
      { year: { $lt: currentPeriod.year } },
      { year: currentPeriod.year, month: { $lt: currentPeriod.month } }
    ]
  })
    .sort({ year: -1, month: -1 })
    .limit(3)
    .select('_id year month')
    .lean();

  if (previousPeriods.length === 0) {
    return currentVariableEnvelopes.map((env) =>
      computeEnvelopeComparisonItem({
        envelopeId: env._id.toString(),
        name: env.name,
        icon: env.icon,
        color: env.color,
        currentSpent: env.spentOrPaidAmount,
        previousMonthSpent: null,
        historySpents: []
      })
    );
  }

  const prevEnvelopes = await EnvelopeModel.find({
    budgetPeriodId: { $in: previousPeriods.map((p) => p._id) },
    pillar: 'variable_envelope'
  })
    .select('_id budgetPeriodId name spentOrPaidAmount previousEnvelopeId')
    .lean();

  const byId = new Map(prevEnvelopes.map((e) => [e._id.toString(), e]));
  const byPeriodAndName = new Map<string, (typeof prevEnvelopes)[number]>();
  for (const e of prevEnvelopes) {
    byPeriodAndName.set(`${e.budgetPeriodId.toString()}:${e.name.trim().toLowerCase()}`, e);
  }

  const m1PeriodId = previousPeriods[0]._id.toString();

  return currentVariableEnvelopes.map((env) => {
    const historySpents: number[] = [];
    let previousMonthSpent: number | null = null;

    // 1. Essayer le chaînage par previousEnvelopeId en priorité
    let cursorPrevId = env.previousEnvelopeId?.toString();
    const matchedPeriodIds = new Set<string>();

    while (cursorPrevId && matchedPeriodIds.size < previousPeriods.length) {
      const prevDoc = byId.get(cursorPrevId);
      if (!prevDoc) break;
      const pId = prevDoc.budgetPeriodId.toString();
      if (!matchedPeriodIds.has(pId)) {
        matchedPeriodIds.add(pId);
        historySpents.push(prevDoc.spentOrPaidAmount);
        if (pId === m1PeriodId) {
          previousMonthSpent = prevDoc.spentOrPaidAmount;
        }
      }
      cursorPrevId = prevDoc.previousEnvelopeId?.toString();
    }

    // 2. Compléter par fallback sur nom normalisé pour les périodes restantes
    const normalizedName = env.name.trim().toLowerCase();
    for (const p of previousPeriods) {
      const pId = p._id.toString();
      if (matchedPeriodIds.has(pId)) continue;
      const match = byPeriodAndName.get(`${pId}:${normalizedName}`);
      if (match) {
        matchedPeriodIds.add(pId);
        historySpents.push(match.spentOrPaidAmount);
        if (pId === m1PeriodId) {
          previousMonthSpent = match.spentOrPaidAmount;
        }
      }
    }

    return computeEnvelopeComparisonItem({
      envelopeId: env._id.toString(),
      name: env.name,
      icon: env.icon,
      color: env.color,
      currentSpent: env.spentOrPaidAmount,
      previousMonthSpent,
      historySpents
    });
  });
}

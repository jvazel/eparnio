import type { Types } from 'mongoose';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import type { ISavingsGoal } from '../models/SavingsGoal.model';

export interface GoalProjection {
  averageMonthlyContribution3m: number;
  estimatedCompletionDate: string | null;
  monthsToTarget: number | null;
}

const MAX_PROJECTION_MONTHS = 600;

/**
 * Calcule la projection réelle d'atteinte d'un objectif d'épargne à partir de la moyenne
 * des versements réels observés sur les dernières périodes (jusqu'à 3 mois).
 */
export function computeGoalProjection(params: {
  currentAmount: number;
  targetAmount: number;
  totalContributionsInWindow: number;
  windowMonthsCount: number;
  referenceDate?: Date;
}): GoalProjection {
  const {
    currentAmount,
    targetAmount,
    totalContributionsInWindow,
    windowMonthsCount,
    referenceDate = new Date()
  } = params;

  const divisor = Math.max(1, Math.min(3, windowMonthsCount));
  const averageMonthlyContribution3m =
    Math.round((Math.max(0, totalContributionsInWindow) / divisor) * 100) / 100;

  if (currentAmount >= targetAmount) {
    return {
      averageMonthlyContribution3m,
      estimatedCompletionDate: null,
      monthsToTarget: 0
    };
  }

  if (averageMonthlyContribution3m <= 0) {
    return {
      averageMonthlyContribution3m: 0,
      estimatedCompletionDate: null,
      monthsToTarget: null
    };
  }

  const remaining = Math.max(0, targetAmount - currentAmount);
  const rawMonths = Math.ceil(remaining / averageMonthlyContribution3m);
  const monthsToTarget = Math.min(MAX_PROJECTION_MONTHS, Math.max(1, rawMonths));

  const targetDate = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + monthsToTarget, 1)
  );
  const estimatedCompletionDate = targetDate.toISOString().slice(0, 10);

  return {
    averageMonthlyContribution3m,
    estimatedCompletionDate,
    monthsToTarget
  };
}

/**
 * Calcule les projections pour tous les objectifs d'un budget à partir des 3 dernières périodes.
 */
export async function computeBudgetGoalsProjections(
  budgetId: Types.ObjectId | string,
  goals: ISavingsGoal[],
  referenceDate: Date = new Date()
): Promise<Map<string, GoalProjection>> {
  const result = new Map<string, GoalProjection>();
  if (goals.length === 0) return result;

  const recentPeriods = await BudgetPeriodModel.find({ budgetId })
    .sort({ year: -1, month: -1 })
    .limit(3)
    .select('_id')
    .lean();

  const periodIds = recentPeriods.map((p) => p._id);
  const windowMonthsCount = Math.max(1, periodIds.length);

  const contributionsByGoalId = new Map<string, number>();
  if (periodIds.length > 0) {
    const savingsEnvelopes = await EnvelopeModel.find({
      budgetId,
      budgetPeriodId: { $in: periodIds },
      pillar: 'savings',
      linkedGoalId: { $exists: true, $ne: null }
    })
      .select('linkedGoalId allocatedAmount')
      .lean();

    for (const env of savingsEnvelopes) {
      if (!env.linkedGoalId) continue;
      const key = env.linkedGoalId.toString();
      contributionsByGoalId.set(
        key,
        (contributionsByGoalId.get(key) ?? 0) + Math.max(0, env.allocatedAmount)
      );
    }
  }

  for (const goal of goals) {
    const goalId = goal._id.toString();
    result.set(
      goalId,
      computeGoalProjection({
        currentAmount: goal.currentAmount,
        targetAmount: goal.targetAmount,
        totalContributionsInWindow: contributionsByGoalId.get(goalId) ?? 0,
        windowMonthsCount,
        referenceDate
      })
    );
  }

  return result;
}

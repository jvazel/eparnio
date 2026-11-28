import { Types } from 'mongoose';
import { AppError } from '../middlewares/error.middleware';
import type { IBudget } from '../models/Budget.model';
import { BudgetPeriodModel, type IBudgetPeriod } from '../models/BudgetPeriod.model';
import { EnvelopeModel, type IEnvelope } from '../models/Envelope.model';
import { type ISavingsGoal, SavingsGoalModel } from '../models/SavingsGoal.model';
import { computeEnvelopeRolloverAmount } from './envelopeRollover.service';
import {
  buildTargetItemDate,
  collectRolloverCandidates,
  computeCycleBounds,
  computeMonthsDifference,
  computeNextRecurrenceRemainingCount,
  shiftYearMonth
} from './periodRollover.service';
import {
  recalculatePeriodSummary,
  recalculateSavingsGoalCurrentAmount
} from './remainingToLive.service';
import { roundCurrency } from './zeroBasedBudget.service';

export type CloseEnvelopeAction = 'rollover_next_month' | 'transfer_to_goal' | 'reset_zero';

export interface CloseEnvelopeDecisionInput {
  envelopeId: string;
  action: CloseEnvelopeAction;
  goalId?: string;
}

export interface CloseNextMonthAdjustmentInput {
  sourceEnvelopeId: string;
  allocatedAmount: number;
  include?: boolean;
}

export interface ClosePeriodResult {
  closedPeriod: IBudgetPeriod;
  nextPeriod: IBudgetPeriod;
  nextEnvelopes: IEnvelope[];
  updatedGoals: ISavingsGoal[];
  transferredTotal: number;
}

/**
 * Exécute le rituel guidé de clôture de fin de mois en une opération cohérente :
 * applique les décisions sur les surplus (report sur M+1, versement vers un objectif d'épargne,
 * ou remise à zéro), ajuste/reconduit les postes récurrents sur M+1 et marque `closedAt`.
 */
export async function closePeriodAndRollover(params: {
  budget: IBudget;
  sourcePeriod: IBudgetPeriod;
  actorUserId?: string;
  envelopeDecisions?: CloseEnvelopeDecisionInput[];
  nextMonthAdjustments?: CloseNextMonthAdjustmentInput[];
}): Promise<ClosePeriodResult> {
  const {
    budget,
    sourcePeriod,
    actorUserId,
    envelopeDecisions = [],
    nextMonthAdjustments = []
  } = params;

  if (sourcePeriod.closedAt) {
    throw new AppError('Cette période budgétaire est déjà clôturée', 409);
  }

  const sourceEnvelopes = await EnvelopeModel.find({ budgetPeriodId: sourcePeriod._id }).sort({
    pillar: 1,
    order: 1
  });
  const sourceEnvById = new Map(sourceEnvelopes.map((item) => [item._id.toString(), item]));

  const decisionsByEnvId = new Map<string, CloseEnvelopeDecisionInput>();
  const goalsById = new Map<string, ISavingsGoal>();

  for (const decision of envelopeDecisions) {
    const targetEnv = sourceEnvById.get(decision.envelopeId);
    if (!targetEnv || targetEnv.pillar !== 'variable_envelope') {
      throw new AppError('Enveloppe variable introuvable sur cette période', 404);
    }
    if (decision.action === 'transfer_to_goal') {
      if (!decision.goalId) {
        throw new AppError('Veuillez sélectionner un objectif d’épargne pour le transfert', 400);
      }
      if (!goalsById.has(decision.goalId)) {
        const goal = await SavingsGoalModel.findOne({
          _id: decision.goalId,
          budgetId: budget._id
        });
        if (!goal) {
          throw new AppError('Objectif d’épargne introuvable sur ce budget', 404);
        }
        goalsById.set(decision.goalId, goal);
      }
    }
    decisionsByEnvId.set(decision.envelopeId, decision);
  }

  const adjustmentsBySourceId = new Map<string, CloseNextMonthAdjustmentInput>();
  for (const adj of nextMonthAdjustments) {
    adjustmentsBySourceId.set(adj.sourceEnvelopeId, adj);
  }

  const next = shiftYearMonth(sourcePeriod.year, sourcePeriod.month, 1);
  let targetPeriod = await BudgetPeriodModel.findOne({
    budgetId: budget._id,
    year: next.year,
    month: next.month
  });

  if (!targetPeriod) {
    const bounds = computeCycleBounds(next.year, next.month, budget.budgetStartDay);
    targetPeriod = await BudgetPeriodModel.create({
      budgetId: budget._id,
      year: bounds.year,
      month: bounds.month,
      label: bounds.label,
      startDate: bounds.startDate,
      endDate: bounds.endDate
    });
  }

  const { candidates, existingTargetByKey } = await collectRolloverCandidates(
    sourcePeriod._id,
    targetPeriod
  );

  const insertedKeys = new Set<string>(existingTargetByKey.keys());
  const toInsert: Array<Record<string, unknown>> = [];
  const existingUpdates: Promise<IEnvelope>[] = [];

  for (const { item, periodYear, periodMonth } of candidates) {
    const itemId = item._id.toString();
    const key = `${item.pillar}:${item.name.trim().toLowerCase()}`;
    const adjustment = adjustmentsBySourceId.get(itemId);

    if (adjustment?.include === false) {
      continue;
    }

    const allocatedAmount = adjustment
      ? roundCurrency(adjustment.allocatedAmount)
      : item.allocatedAmount;

    const isVariable = item.pillar === 'variable_envelope';
    const decision = isVariable ? decisionsByEnvId.get(itemId) : undefined;
    const surplus = isVariable
      ? roundCurrency(item.allocatedAmount + (item.rolloverAmount ?? 0) - item.spentOrPaidAmount)
      : 0;

    let targetRolloverAmount = computeEnvelopeRolloverAmount(item);
    let linkPrevious = isVariable;

    if (isVariable && decision) {
      if (decision.action === 'rollover_next_month') {
        targetRolloverAmount = Math.max(0, surplus);
        linkPrevious = Boolean(item.rolloverEnabled);
      } else {
        targetRolloverAmount = 0;
        linkPrevious = false;
      }
    }

    const existingTarget = existingTargetByKey.get(key);
    if (existingTarget) {
      let modified = false;
      if (adjustment) {
        existingTarget.allocatedAmount = allocatedAmount;
        modified = true;
      }
      if (isVariable && decision) {
        existingTarget.rolloverAmount = targetRolloverAmount;
        existingTarget.previousEnvelopeId = linkPrevious ? item._id : undefined;
        modified = true;
      }
      if (modified) {
        existingUpdates.push(existingTarget.save());
      }
      continue;
    }

    if (insertedKeys.has(key)) {
      continue;
    }
    insertedKeys.add(key);

    const monthsDiff =
      periodYear !== undefined && periodMonth !== undefined
        ? computeMonthsDifference(
            { year: periodYear, month: periodMonth },
            { year: targetPeriod.year, month: targetPeriod.month }
          )
        : 1;
    const nextRemainingCount = isVariable
      ? undefined
      : computeNextRecurrenceRemainingCount(item, monthsDiff);

    toInsert.push({
      budgetId: targetPeriod.budgetId,
      budgetPeriodId: targetPeriod._id,
      pillar: item.pillar,
      name: item.name,
      icon: item.icon,
      color: item.color,
      allocatedAmount,
      spentOrPaidAmount: 0,
      rolloverEnabled: isVariable ? Boolean(item.rolloverEnabled) : false,
      rolloverMode: item.rolloverMode ?? 'positive_only',
      rolloverAmount: targetRolloverAmount,
      ...(linkPrevious ? { previousEnvelopeId: item._id } : {}),
      date: buildTargetItemDate(item.date, targetPeriod.year, targetPeriod.month),
      isRecurring: item.isRecurring,
      recurrenceFrequency: isVariable ? 'monthly' : (item.recurrenceFrequency ?? 'monthly'),
      ...(!isVariable && item.recurrenceEndDate
        ? { recurrenceEndDate: item.recurrenceEndDate }
        : {}),
      ...(!isVariable && nextRemainingCount !== undefined
        ? { recurrenceRemainingCount: nextRemainingCount }
        : {}),
      isPaid: false,
      memberId: item.memberId,
      linkedGoalId: item.linkedGoalId,
      order: item.order
    });
  }

  if (existingUpdates.length > 0) {
    await Promise.all(existingUpdates);
  }
  if (toInsert.length > 0) {
    await EnvelopeModel.insertMany(toInsert);
  }

  // Exécute les transferts de surplus positifs vers les objectifs d'épargne
  let savingsOrderCursor =
    sourceEnvelopes
      .filter((item) => item.pillar === 'savings')
      .reduce((max, item) => Math.max(max, item.order), -1) + 1;
  let transferredTotal = 0;
  const affectedGoalIds = new Set<string>(
    toInsert
      .map((item) =>
        item.linkedGoalId ? (item.linkedGoalId as Types.ObjectId).toString() : undefined
      )
      .filter((value): value is string => Boolean(value))
  );
  const transferEnvelopesToCreate: Array<Record<string, unknown>> = [];

  for (const decision of decisionsByEnvId.values()) {
    if (decision.action !== 'transfer_to_goal' || !decision.goalId) continue;
    const sourceEnv = sourceEnvById.get(decision.envelopeId);
    const goal = goalsById.get(decision.goalId);
    if (!sourceEnv || !goal) continue;

    const surplus = roundCurrency(
      sourceEnv.allocatedAmount + (sourceEnv.rolloverAmount ?? 0) - sourceEnv.spentOrPaidAmount
    );
    if (surplus <= 0) continue;

    transferEnvelopesToCreate.push({
      budgetId: budget._id,
      budgetPeriodId: sourcePeriod._id,
      pillar: 'savings',
      name: `Surplus ${sourceEnv.name}`.slice(0, 80),
      icon: goal.icon,
      color: goal.color,
      allocatedAmount: surplus,
      spentOrPaidAmount: surplus,
      rolloverEnabled: false,
      rolloverMode: 'positive_only',
      rolloverAmount: 0,
      date: sourcePeriod.endDate,
      isRecurring: false,
      recurrenceFrequency: 'monthly',
      isPaid: true,
      ...(budget.type === 'shared' && actorUserId && Types.ObjectId.isValid(actorUserId)
        ? { memberId: new Types.ObjectId(actorUserId) }
        : {}),
      linkedGoalId: goal._id,
      order: savingsOrderCursor++
    });
    transferredTotal = roundCurrency(transferredTotal + surplus);
    affectedGoalIds.add(goal._id.toString());
  }

  if (transferEnvelopesToCreate.length > 0) {
    await EnvelopeModel.insertMany(transferEnvelopesToCreate);
  }

  const updatedGoals = (
    await Promise.all(
      Array.from(affectedGoalIds).map((goalId) => recalculateSavingsGoalCurrentAmount(goalId))
    )
  ).filter((goal): goal is ISavingsGoal => Boolean(goal));

  sourcePeriod.closedAt = new Date();
  await sourcePeriod.save();

  const [closedPeriod, nextPeriod, nextEnvelopes] = await Promise.all([
    recalculatePeriodSummary(sourcePeriod._id),
    recalculatePeriodSummary(targetPeriod._id),
    EnvelopeModel.find({ budgetPeriodId: targetPeriod._id }).sort({
      pillar: 1,
      order: 1,
      createdAt: 1
    })
  ]);

  return {
    closedPeriod,
    nextPeriod,
    nextEnvelopes,
    updatedGoals,
    transferredTotal
  };
}

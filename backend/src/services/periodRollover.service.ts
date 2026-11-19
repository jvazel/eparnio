import { Types } from 'mongoose';
import { AppError } from '../middlewares/error.middleware';
import type { IBudget } from '../models/Budget.model';
import { BudgetPeriodModel, type IBudgetPeriod } from '../models/BudgetPeriod.model';
import {
  EnvelopeModel,
  type IEnvelope,
  type RecurrenceFrequency
} from '../models/Envelope.model';
import { type ISavingsGoal, SavingsGoalModel } from '../models/SavingsGoal.model';
import {
  recalculatePeriodSummary,
  recalculateSavingsGoalCurrentAmount
} from './remainingToLive.service';
import { roundCurrency } from './zeroBasedBudget.service';

const FRENCH_MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre'
] as const;

export interface CycleBounds {
  year: number;
  month: number;
  label: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Retourne le nombre de jours d'un mois donné (1..12) sans décalage horaire.
 */
export function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Décale `(year, month)` d'un delta de mois (ex. -1 ou +1).
 */
export function shiftYearMonth(
  year: number,
  month: number,
  deltaMonths: number
): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + deltaMonths;
  const nextYear = Math.floor(zeroBased / 12);
  const nextMonth = ((zeroBased % 12) + 12) % 12 + 1;
  return { year: nextYear, month: nextMonth };
}

/**
 * Calcule les bornes exactes (`startDate`, `endDate`) et le libellé d'un mois budgétaire
 * en tenant compte du `budgetStartDay` (y compris les fins de mois 29/30/31 en février).
 */
export function computeCycleBounds(
  year: number,
  month: number,
  budgetStartDay: number
): CycleBounds {
  const safeStartDay = Math.min(Math.max(Math.trunc(budgetStartDay), 1), 31);
  const label = `${FRENCH_MONTH_NAMES[month - 1]} ${year}`;

  if (safeStartDay === 1) {
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month - 1, daysInUtcMonth(year, month), 23, 59, 59, 999));
    return { year, month, label, startDate, endDate };
  }

  const prev = shiftYearMonth(year, month, -1);
  const prevClampedDay = Math.min(safeStartDay, daysInUtcMonth(prev.year, prev.month));
  const currentClampedDay = Math.min(safeStartDay, daysInUtcMonth(year, month));

  const startDate = new Date(Date.UTC(prev.year, prev.month - 1, prevClampedDay, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month - 1, currentClampedDay, 0, 0, 0, 0) - 1);

  return { year, month, label, startDate, endDate };
}

/**
 * Détermine `(year, month)` actif à une date donnée selon `budgetStartDay`.
 */
export function resolveCycleYearMonthForDate(
  date: Date,
  budgetStartDay: number
): { year: number; month: number } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  if (budgetStartDay <= 1) {
    return { year, month };
  }

  const anchorDay = Math.min(budgetStartDay, daysInUtcMonth(year, month));
  if (date.getUTCDate() >= anchorDay) {
    return shiftYearMonth(year, month, 1);
  }

  return { year, month };
}

export const RECURRENCE_FREQUENCY_MONTHS: Record<RecurrenceFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12
};

export interface RolloverContext {
  sourceYear: number;
  sourceMonth: number;
  targetYear: number;
  targetMonth: number;
}

export function computeMonthsDifference(
  from: { year: number; month: number },
  to: { year: number; month: number }
): number {
  return (to.year - from.year) * 12 + (to.month - from.month);
}

function buildTargetItemDate(sourceDate: Date, targetYear: number, targetMonth: number): Date {
  const day = Math.min(sourceDate.getUTCDate(), daysInUtcMonth(targetYear, targetMonth));
  return new Date(Date.UTC(targetYear, targetMonth - 1, day, 12, 0, 0, 0));
}

export function computeNextRecurrenceRemainingCount(
  envelope: Pick<IEnvelope, 'recurrenceFrequency' | 'recurrenceRemainingCount'>,
  monthsDiff = 1
): number | undefined {
  if (typeof envelope.recurrenceRemainingCount !== 'number') {
    return undefined;
  }
  const interval = RECURRENCE_FREQUENCY_MONTHS[envelope.recurrenceFrequency ?? 'monthly'];
  const steps = Math.max(1, Math.floor(monthsDiff / interval));
  const nextCount = envelope.recurrenceRemainingCount - steps;
  return nextCount >= 1 ? nextCount : undefined;
}

export function isRolloverCandidate(
  envelope: Pick<
    IEnvelope,
    | 'pillar'
    | 'isRecurring'
    | 'recurrenceFrequency'
    | 'recurrenceEndDate'
    | 'recurrenceRemainingCount'
    | 'date'
  >,
  context?: RolloverContext
): boolean {
  if (envelope.pillar === 'variable_envelope') {
    return true;
  }
  if (
    envelope.pillar !== 'income' &&
    envelope.pillar !== 'fixed_charge' &&
    envelope.pillar !== 'savings'
  ) {
    return false;
  }
  if (!envelope.isRecurring) {
    return false;
  }

  if (context) {
    const monthsDiff = computeMonthsDifference(
      { year: context.sourceYear, month: context.sourceMonth },
      { year: context.targetYear, month: context.targetMonth }
    );
    if (monthsDiff <= 0) {
      return false;
    }

    const interval = RECURRENCE_FREQUENCY_MONTHS[envelope.recurrenceFrequency ?? 'monthly'];
    if (monthsDiff % interval !== 0) {
      return false;
    }

    const steps = monthsDiff / interval;
    if (
      typeof envelope.recurrenceRemainingCount === 'number' &&
      envelope.recurrenceRemainingCount - steps < 1
    ) {
      return false;
    }

    if (envelope.recurrenceEndDate) {
      const targetDate = buildTargetItemDate(
        envelope.date,
        context.targetYear,
        context.targetMonth
      );
      const end = new Date(envelope.recurrenceEndDate);
      const endOfDayUtc = Date.UTC(
        end.getUTCFullYear(),
        end.getUTCMonth(),
        end.getUTCDate(),
        23,
        59,
        59,
        999
      );
      if (targetDate.getTime() > endOfDayUtc) {
        return false;
      }
    }

    return true;
  }

  if (
    typeof envelope.recurrenceRemainingCount === 'number' &&
    envelope.recurrenceRemainingCount <= 1
  ) {
    return false;
  }

  return true;
}

/**
 * Calcule le montant de report (rollover) qu'une enveloppe variable transmet au mois suivant.
 */
export function computeEnvelopeRolloverAmount(envelope: {
  pillar: string;
  allocatedAmount: number;
  rolloverAmount?: number;
  spentOrPaidAmount: number;
  rolloverEnabled?: boolean;
  rolloverMode?: string;
}): number {
  if (envelope.pillar !== 'variable_envelope' || !envelope.rolloverEnabled) {
    return 0;
  }
  const available = envelope.allocatedAmount + (envelope.rolloverAmount ?? 0);
  const remaining = Math.round((available - envelope.spentOrPaidAmount) * 100) / 100;
  if (envelope.rolloverMode === 'both') {
    return remaining;
  }
  return Math.max(0, remaining);
}

/**
 * Propage le recalcul de `rolloverAmount` vers les périodes suivantes chaînées via `previousEnvelopeId`.
 */
export async function propagateEnvelopeRollover(envelopeId: Types.ObjectId | string): Promise<void> {
  let current = await EnvelopeModel.findById(envelopeId);
  const visited = new Set<string>();

  while (current && !visited.has(current._id.toString())) {
    visited.add(current._id.toString());
    const next = await EnvelopeModel.findOne({ previousEnvelopeId: current._id });
    if (!next) break;

    const nextRollover = computeEnvelopeRolloverAmount(current);
    if (next.rolloverAmount !== nextRollover) {
      next.rolloverAmount = nextRollover;
      await next.save();
    }
    current = next;
  }
}

interface RolloverCandidateEntry {
  item: IEnvelope;
  periodYear?: number;
  periodMonth?: number;
}

async function collectRolloverCandidates(
  sourcePeriodId: Types.ObjectId,
  targetPeriod: IBudgetPeriod
): Promise<{
  sourcePeriod: IBudgetPeriod | null;
  sourceEnvelopes: IEnvelope[];
  candidates: RolloverCandidateEntry[];
  existingTargetByKey: Map<string, IEnvelope>;
}> {
  const [sourcePeriod, sourceEnvelopes, existingTargetEnvelopes] = await Promise.all([
    BudgetPeriodModel.findById(sourcePeriodId),
    EnvelopeModel.find({ budgetPeriodId: sourcePeriodId }).sort({ pillar: 1, order: 1 }),
    EnvelopeModel.find({ budgetPeriodId: targetPeriod._id })
  ]);

  const existingTargetByKey = new Map<string, IEnvelope>();
  for (const item of existingTargetEnvelopes) {
    existingTargetByKey.set(`${item.pillar}:${item.name.trim().toLowerCase()}`, item);
  }

  const seenKeys = new Set<string>();
  const candidates: RolloverCandidateEntry[] = [];

  for (const item of sourceEnvelopes) {
    const key = `${item.pillar}:${item.name.trim().toLowerCase()}`;
    seenKeys.add(key);

    const context = sourcePeriod
      ? {
          sourceYear: sourcePeriod.year,
          sourceMonth: sourcePeriod.month,
          targetYear: targetPeriod.year,
          targetMonth: targetPeriod.month
        }
      : undefined;

    if (isRolloverCandidate(item, context)) {
      candidates.push({
        item,
        periodYear: sourcePeriod?.year,
        periodMonth: sourcePeriod?.month
      });
    }
  }

  // Permet la reconduction des fréquences pluri-mensuelles (trimestrielle, semestrielle, annuelle)
  // même lorsque l'utilisateur navigue mois par mois entre deux échéances.
  if (sourcePeriod) {
    const minWindow = shiftYearMonth(targetPeriod.year, targetPeriod.month, -12);
    const priorPeriods = await BudgetPeriodModel.find({
      budgetId: targetPeriod.budgetId,
      $and: [
        {
          $or: [
            { year: { $gt: minWindow.year } },
            { year: minWindow.year, month: { $gte: minWindow.month } }
          ]
        },
        {
          $or: [
            { year: { $lt: sourcePeriod.year } },
            { year: sourcePeriod.year, month: { $lt: sourcePeriod.month } }
          ]
        }
      ]
    }).sort({ year: -1, month: -1 });

    if (priorPeriods.length > 0) {
      const periodMetaById = new Map(
        priorPeriods.map((period) => [period._id.toString(), period])
      );
      const priorEnvelopes = await EnvelopeModel.find({
        budgetPeriodId: { $in: priorPeriods.map((period) => period._id) },
        pillar: { $in: ['income', 'fixed_charge', 'savings'] }
      }).sort({ pillar: 1, order: 1 });

      // Trier du cycle le plus récent au plus ancien pour que la plus récente occurrence fasse foi
      priorEnvelopes.sort((a, b) => {
        const periodA = periodMetaById.get(a.budgetPeriodId.toString());
        const periodB = periodMetaById.get(b.budgetPeriodId.toString());
        const ymA = periodA ? periodA.year * 12 + periodA.month : 0;
        const ymB = periodB ? periodB.year * 12 + periodB.month : 0;
        if (ymA !== ymB) return ymB - ymA;
        return a.order - b.order;
      });

      for (const item of priorEnvelopes) {
        const key = `${item.pillar}:${item.name.trim().toLowerCase()}`;
        if (seenKeys.has(key)) {
          continue;
        }
        seenKeys.add(key);

        const freq = item.recurrenceFrequency ?? 'monthly';
        if (!item.isRecurring || freq === 'monthly') {
          continue;
        }

        const originPeriod = periodMetaById.get(item.budgetPeriodId.toString());
        if (!originPeriod) continue;

        const context: RolloverContext = {
          sourceYear: originPeriod.year,
          sourceMonth: originPeriod.month,
          targetYear: targetPeriod.year,
          targetMonth: targetPeriod.month
        };

        if (isRolloverCandidate(item, context)) {
          candidates.push({
            item,
            periodYear: originPeriod.year,
            periodMonth: originPeriod.month
          });
        }
      }
    }
  }

  return { sourcePeriod, sourceEnvelopes, candidates, existingTargetByKey };
}

/**
 * Duplique vers `targetPeriod` les revenus/charges récurrents, les versements d'épargne récurrents
 * (en tenant compte de la fréquence, date de fin et mensualités restantes) et la structure des
 * enveloppes variables de `sourcePeriodId`, sans créer de doublons.
 */
export async function cloneRolloverEnvelopes(
  sourcePeriodId: Types.ObjectId,
  targetPeriod: IBudgetPeriod
): Promise<number> {
  const { candidates, existingTargetByKey } = await collectRolloverCandidates(
    sourcePeriodId,
    targetPeriod
  );

  const insertedKeys = new Set<string>(existingTargetByKey.keys());
  const toInsert = candidates
    .filter(({ item }) => {
      const key = `${item.pillar}:${item.name.trim().toLowerCase()}`;
      if (insertedKeys.has(key)) return false;
      insertedKeys.add(key);
      return true;
    })
    .map(({ item, periodYear, periodMonth }) => {
      const monthsDiff =
        periodYear !== undefined && periodMonth !== undefined
          ? computeMonthsDifference(
              { year: periodYear, month: periodMonth },
              { year: targetPeriod.year, month: targetPeriod.month }
            )
          : 1;
      const isVariable = item.pillar === 'variable_envelope';
      const nextRemainingCount = isVariable
        ? undefined
        : computeNextRecurrenceRemainingCount(item, monthsDiff);

      return {
        budgetId: targetPeriod.budgetId,
        budgetPeriodId: targetPeriod._id,
        pillar: item.pillar,
        name: item.name,
        icon: item.icon,
        color: item.color,
        allocatedAmount: item.allocatedAmount,
        spentOrPaidAmount: 0,
        rolloverEnabled: isVariable ? Boolean(item.rolloverEnabled) : false,
        rolloverMode: item.rolloverMode ?? 'positive_only',
        rolloverAmount: computeEnvelopeRolloverAmount(item),
        ...(isVariable ? { previousEnvelopeId: item._id } : {}),
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
      };
    });

  if (toInsert.length > 0) {
    await EnvelopeModel.insertMany(toInsert);
    const goalIds = Array.from(
      new Set(
        toInsert
          .map((item) => item.linkedGoalId?.toString())
          .filter((value): value is string => Boolean(value))
      )
    );
    await Promise.all(goalIds.map((goalId) => recalculateSavingsGoalCurrentAmount(goalId)));
  }

  return toInsert.length;
}

/**
 * Récupère une période `(year, month)` ou la crée en reconduisant automatiquement
 * les postes récurrents et enveloppes depuis la période antérieure la plus récente.
 */
export async function getOrCreatePeriodWithRollover(
  budget: IBudget,
  year: number,
  month: number
): Promise<IBudgetPeriod> {
  const existing = await BudgetPeriodModel.findOne({ budgetId: budget._id, year, month });
  if (existing) {
    return existing;
  }

  const bounds = computeCycleBounds(year, month, budget.budgetStartDay);

  let created: IBudgetPeriod;
  try {
    created = await BudgetPeriodModel.create({
      budgetId: budget._id,
      year: bounds.year,
      month: bounds.month,
      label: bounds.label,
      startDate: bounds.startDate,
      endDate: bounds.endDate
    });
  } catch (error) {
    // Gère les appels concurrents sur la même période
    const raced = await BudgetPeriodModel.findOne({ budgetId: budget._id, year, month });
    if (raced) return raced;
    throw error;
  }

  const previousPeriod = await BudgetPeriodModel.findOne({
    budgetId: budget._id,
    $or: [{ year: { $lt: year } }, { year, month: { $lt: month } }]
  }).sort({ year: -1, month: -1 });

  if (previousPeriod) {
    await cloneRolloverEnvelopes(previousPeriod._id, created);
    return recalculatePeriodSummary(created._id);
  }

  return created;
}

/**
 * Reconduit explicitement les récurrents et enveloppes d'une période source vers le mois suivant.
 */
export async function rolloverToNextPeriod(
  budget: IBudget,
  sourcePeriod: IBudgetPeriod
): Promise<IBudgetPeriod> {
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

  await cloneRolloverEnvelopes(sourcePeriod._id, targetPeriod);
  return recalculatePeriodSummary(targetPeriod._id);
}

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


/**
 * Propage un revenu ou une dépense fixe récurrente nouvellement créé(e) ou modifié(e)
 * vers les périodes futures déjà créées du même budget (sans écraser l'existant).
 */
export async function propagateRecurringEnvelopeToFuturePeriods(
  envelope: {
    budgetId: Types.ObjectId | string;
    pillar: string;
    name: string;
    icon: string;
    color: string;
    allocatedAmount: number;
    date: Date;
    isRecurring: boolean;
    recurrenceFrequency?: string;
    recurrenceEndDate?: Date | null;
    recurrenceRemainingCount?: number | null;
    memberId?: Types.ObjectId | string | null;
    order?: number;
  },
  sourcePeriod: { _id: Types.ObjectId; year: number; month: number }
): Promise<number> {
  if (
    !envelope.isRecurring ||
    (envelope.pillar !== 'income' && envelope.pillar !== 'fixed_charge')
  ) {
    return 0;
  }

  const futurePeriods = await BudgetPeriodModel.find({
    budgetId: envelope.budgetId,
    $or: [
      { year: { $gt: sourcePeriod.year } },
      { year: sourcePeriod.year, month: { $gt: sourcePeriod.month } }
    ]
  })
    .sort({ year: 1, month: 1 })
    .lean();

  let createdCount = 0;
  const sourceDay = new Date(envelope.date).getUTCDate();
  const normalizedName = envelope.name.trim().toLowerCase();

  for (const targetPeriod of futurePeriods) {
    const existingEnvelopes = await EnvelopeModel.find({
      budgetPeriodId: targetPeriod._id,
      pillar: envelope.pillar
    })
      .select('name')
      .lean();

    const alreadyExists = existingEnvelopes.some(
      (item) => item.name.trim().toLowerCase() === normalizedName
    );
    if (alreadyExists) continue;

    const maxDay = new Date(Date.UTC(targetPeriod.year, targetPeriod.month, 0)).getUTCDate();
    const targetDate = new Date(
      Date.UTC(targetPeriod.year, targetPeriod.month - 1, Math.min(sourceDay, maxDay), 12, 0, 0)
    );

    await EnvelopeModel.create({
      budgetId: envelope.budgetId,
      budgetPeriodId: targetPeriod._id,
      pillar: envelope.pillar,
      name: envelope.name,
      icon: envelope.icon,
      color: envelope.color,
      allocatedAmount: envelope.allocatedAmount,
      spentOrPaidAmount: 0,
      date: targetDate,
      isRecurring: true,
      recurrenceFrequency: envelope.recurrenceFrequency ?? 'monthly',
      recurrenceEndDate: envelope.recurrenceEndDate ?? null,
      recurrenceRemainingCount: envelope.recurrenceRemainingCount ?? null,
      isPaid: false,
      ...(envelope.memberId ? { memberId: envelope.memberId } : {}),
      order: envelope.order ?? 0
    });

    createdCount += 1;
  }

  return createdCount;
}

/**
 * Copie dans `targetPeriod` les revenus et dépenses fixes récurrents du mois précédent
 * qui n'y figurent pas encore.
 */
export async function syncMissingRecurringFromPreviousPeriod(
  budgetId: Types.ObjectId | string,
  targetPeriod: { _id: Types.ObjectId; year: number; month: number }
): Promise<number> {
  const prevMonth = targetPeriod.month === 1 ? 12 : targetPeriod.month - 1;
  const prevYear = targetPeriod.month === 1 ? targetPeriod.year - 1 : targetPeriod.year;

  const previousPeriod = await BudgetPeriodModel.findOne({
    budgetId,
    year: prevYear,
    month: prevMonth
  }).lean();

  if (!previousPeriod) {
    return 0;
  }

  const [sourceRecurring, targetExisting] = await Promise.all([
    EnvelopeModel.find({
      budgetPeriodId: previousPeriod._id,
      pillar: { $in: ['income', 'fixed_charge'] },
      isRecurring: true
    }).lean(),
    EnvelopeModel.find({
      budgetPeriodId: targetPeriod._id,
      pillar: { $in: ['income', 'fixed_charge'] }
    })
      .select('pillar name')
      .lean()
  ]);

  const existingKeys = new Set(
    targetExisting.map((item) => `${item.pillar}::${item.name.trim().toLowerCase()}`)
  );

  let addedCount = 0;
  for (const item of sourceRecurring) {
    const key = `${item.pillar}::${item.name.trim().toLowerCase()}`;
    if (existingKeys.has(key)) continue;

    const sourceDay = new Date(item.date).getUTCDate();
    const maxDay = new Date(Date.UTC(targetPeriod.year, targetPeriod.month, 0)).getUTCDate();
    const targetDate = new Date(
      Date.UTC(targetPeriod.year, targetPeriod.month - 1, Math.min(sourceDay, maxDay), 12, 0, 0)
    );

    await EnvelopeModel.create({
      budgetId: item.budgetId,
      budgetPeriodId: targetPeriod._id,
      pillar: item.pillar,
      name: item.name,
      icon: item.icon,
      color: item.color,
      allocatedAmount: item.allocatedAmount,
      spentOrPaidAmount: 0,
      date: targetDate,
      isRecurring: true,
      recurrenceFrequency: item.recurrenceFrequency ?? 'monthly',
      recurrenceEndDate: item.recurrenceEndDate ?? null,
      recurrenceRemainingCount: item.recurrenceRemainingCount ?? null,
      isPaid: false,
      ...(item.memberId ? { memberId: item.memberId } : {}),
      order: item.order ?? 0
    });

    existingKeys.add(key);
    addedCount += 1;
  }

  return addedCount;
}

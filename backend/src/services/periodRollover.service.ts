import { type Types } from 'mongoose';
import type { IBudget } from '../models/Budget.model';
import { BudgetPeriodModel, type IBudgetPeriod } from '../models/BudgetPeriod.model';
import { EnvelopeModel, type IEnvelope } from '../models/Envelope.model';
import {
  recalculatePeriodSummary,
  recalculateSavingsGoalCurrentAmount
} from './remainingToLive.service';

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

function buildTargetItemDate(sourceDate: Date, targetYear: number, targetMonth: number): Date {
  const day = Math.min(sourceDate.getUTCDate(), daysInUtcMonth(targetYear, targetMonth));
  return new Date(Date.UTC(targetYear, targetMonth - 1, day, 12, 0, 0, 0));
}

function isRolloverCandidate(envelope: IEnvelope): boolean {
  if (envelope.pillar === 'variable_envelope') {
    return true;
  }
  return (
    (envelope.pillar === 'income' ||
      envelope.pillar === 'fixed_charge' ||
      envelope.pillar === 'savings') &&
    envelope.isRecurring
  );
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

/**
 * Duplique vers `targetPeriod` les revenus/charges récurrents, les versements d'épargne récurrents
 * et la structure des enveloppes variables de `sourcePeriodId`, sans créer de doublons.
 */
export async function cloneRolloverEnvelopes(
  sourcePeriodId: Types.ObjectId,
  targetPeriod: IBudgetPeriod
): Promise<number> {
  const [sourceEnvelopes, existingTargetEnvelopes] = await Promise.all([
    EnvelopeModel.find({ budgetPeriodId: sourcePeriodId }).sort({ pillar: 1, order: 1 }),
    EnvelopeModel.find({ budgetPeriodId: targetPeriod._id })
  ]);

  const existingKeys = new Set(
    existingTargetEnvelopes.map((item) => `${item.pillar}:${item.name.trim().toLowerCase()}`)
  );

  const toInsert = sourceEnvelopes
    .filter((item) => {
      if (!isRolloverCandidate(item)) return false;
      const key = `${item.pillar}:${item.name.trim().toLowerCase()}`;
      return !existingKeys.has(key);
    })
    .map((item) => ({
      budgetId: targetPeriod.budgetId,
      budgetPeriodId: targetPeriod._id,
      pillar: item.pillar,
      name: item.name,
      icon: item.icon,
      color: item.color,
      allocatedAmount: item.allocatedAmount,
      spentOrPaidAmount: 0,
      rolloverEnabled: item.pillar === 'variable_envelope' ? Boolean(item.rolloverEnabled) : false,
      rolloverMode: item.rolloverMode ?? 'positive_only',
      rolloverAmount: computeEnvelopeRolloverAmount(item),
      ...(item.pillar === 'variable_envelope' ? { previousEnvelopeId: item._id } : {}),
      date: buildTargetItemDate(item.date, targetPeriod.year, targetPeriod.month),
      isRecurring: item.isRecurring,
      isPaid: false,
      memberId: item.memberId,
      linkedGoalId: item.linkedGoalId,
      order: item.order
    }));

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

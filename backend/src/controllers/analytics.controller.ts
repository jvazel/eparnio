import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { BudgetPeriodModel, type IBudgetPeriodSummary } from '../models/BudgetPeriod.model';
import { EnvelopeModel, type IEnvelope } from '../models/Envelope.model';
import { TransactionModel, type ITransaction } from '../models/Transaction.model';
import { UserModel } from '../models/User.model';
import { assertPeriodAccess } from '../services/budgetAccess.service';
import { computeBudgetAgeOfMoney } from '../services/ageOfMoney.service';
import { recalculatePeriodSummary } from '../services/remainingToLive.service';
import { roundCurrency } from '../services/zeroBasedBudget.service';

const MS_PER_DAY = 86_400_000;

const objectIdSchema = z
  .string()
  .refine((value) => Types.ObjectId.isValid(value), 'Identifiant invalide');

export const periodAnalyticsParamsSchema = z.object({
  periodId: objectIdSchema
});

export const periodAnalyticsQuerySchema = z.object({
  referenceDate: z.string().datetime({ offset: true }).optional()
});

export interface DailyBudgetMetrics {
  startDate: string;
  endDate: string;
  referenceDate: string;
  totalDays: number;
  daysRemaining: number;
  remainingToLive: number;
  dailyAmount: number;
}

export interface AllocationSlice {
  key: 'fixed' | 'variable' | 'savings';
  label: string;
  color: string;
  amount: number;
  percentage: number;
  incomeSharePercentage: number;
}

export interface AllocationBreakdown {
  totalOutflows: number;
  plannedIncome: number;
  items: AllocationSlice[];
}

export interface MemberBreakdownItem {
  userId: string;
  displayName: string;
  avatarEmoji: string;
  color: string;
  role: string;
  incomeContributed: number;
  fixedChargesPaid: number;
  variableExpensesPaid: number;
  savingsContributed: number;
  expensesPaid: number;
  netBalance: number;
  incomeSharePercentage: number;
  expensesSharePercentage: number;
}

function roundPercentage(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10;
  return rounded === 0 ? 0 : rounded;
}

function toUtcMidnightMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Calcule le nombre de jours restants dans le cycle et le montant quotidien disponible
 * à partir des bornes UTC de la période (insensible aux changements d'heure été/hiver).
 */
export function computeDailyBudgetMetrics(
  startDate: Date,
  endDate: Date,
  remainingToLive: number,
  referenceDate: Date = new Date()
): DailyBudgetMetrics {
  const startUtc = toUtcMidnightMs(startDate);
  const endUtc = toUtcMidnightMs(endDate);
  const refUtc = toUtcMidnightMs(referenceDate);

  const totalDays = Math.max(1, Math.round((endUtc - startUtc) / MS_PER_DAY) + 1);

  let daysRemaining: number;
  if (refUtc > endUtc) {
    daysRemaining = 0;
  } else if (refUtc <= startUtc) {
    daysRemaining = totalDays;
  } else {
    daysRemaining = Math.max(1, Math.round((endUtc - refUtc) / MS_PER_DAY) + 1);
  }

  const dailyAmount =
    daysRemaining > 0 ? Math.max(0, roundCurrency(remainingToLive / daysRemaining)) : 0;

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    referenceDate: referenceDate.toISOString(),
    totalDays,
    daysRemaining,
    remainingToLive: roundCurrency(remainingToLive),
    dailyAmount
  };
}

/**
 * Calcule la répartition des sorties (Fixe Violet, Variable Bleu, Épargne Vert)
 * en valeur absolue, en % du total des sorties et en % des revenus.
 */
export function computeAllocationBreakdown(summary: IBudgetPeriodSummary): AllocationBreakdown {
  const fixedAmount = roundCurrency(summary.plannedFixedCharges);
  const variableAmount = Math.max(0, roundCurrency(summary.spentVariables));
  const savingsAmount = roundCurrency(summary.plannedSavings);
  const totalOutflows = roundCurrency(fixedAmount + variableAmount + savingsAmount);
  const plannedIncome = roundCurrency(summary.plannedIncome);

  const toOutflowPct = (amount: number): number =>
    totalOutflows > 0 ? roundPercentage((amount / totalOutflows) * 100) : 0;
  const toIncomePct = (amount: number): number =>
    plannedIncome > 0 ? roundPercentage((amount / plannedIncome) * 100) : 0;

  return {
    totalOutflows,
    plannedIncome,
    items: [
      {
        key: 'fixed',
        label: 'Fixe',
        color: '#8B5CF6',
        amount: fixedAmount,
        percentage: toOutflowPct(fixedAmount),
        incomeSharePercentage: toIncomePct(fixedAmount)
      },
      {
        key: 'variable',
        label: 'Variable',
        color: '#3B82F6',
        amount: variableAmount,
        percentage: toOutflowPct(variableAmount),
        incomeSharePercentage: toIncomePct(variableAmount)
      },
      {
        key: 'savings',
        label: 'Épargne',
        color: '#22C55E',
        amount: savingsAmount,
        percentage: toOutflowPct(savingsAmount),
        incomeSharePercentage: toIncomePct(savingsAmount)
      }
    ]
  };
}

/**
 * Retourne l'analyse complète d'une période budgétaire pour l'onglet « Budget »
 * (Entrées et sorties d'argent, Budget quotidien, Part des dépenses, Base Zéro et Bilan par membre).
 */
export async function getPeriodAnalytics(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { periodId } = req.params as z.infer<typeof periodAnalyticsParamsSchema>;
    const { referenceDate: referenceDateRaw } = req.query as z.infer<
      typeof periodAnalyticsQuerySchema
    >;

    const { budget } = await assertPeriodAccess(periodId, req.user?.id);
    const period = await recalculatePeriodSummary(periodId);

    const [envelopes, transactions, users] = await Promise.all([
      EnvelopeModel.find({ budgetPeriodId: period._id }),
      TransactionModel.find({ budgetPeriodId: period._id }),
      UserModel.find({
        _id: { $in: budget.members.map((member) => member.userId) }
      }).select('_id displayName avatarEmoji')
    ]);

    const referenceDate = referenceDateRaw ? new Date(referenceDateRaw) : new Date();
    const dailyBudget = computeDailyBudgetMetrics(
      period.startDate,
      period.endDate,
      period.summary.remainingToLive,
      referenceDate
    );
    const allocation = computeAllocationBreakdown(period.summary);

    const totalAllocated = roundCurrency(
      period.summary.plannedFixedCharges +
        period.summary.plannedEnvelopes +
        period.summary.plannedSavings
    );

    const envelopeById = new Map<string, IEnvelope>(
      envelopes.map((env) => [env._id.toString(), env])
    );
    const txBySavingsEnvelopeId = new Map<string, ITransaction[]>();
    for (const tx of transactions) {
      const env = envelopeById.get(tx.envelopeId.toString());
      if (env?.pillar === 'savings') {
        const list = txBySavingsEnvelopeId.get(env._id.toString()) ?? [];
        list.push(tx);
        txBySavingsEnvelopeId.set(env._id.toString(), list);
      }
    }

    const userById = new Map(
      users.map((u) => [
        u._id.toString(),
        { displayName: u.displayName, avatarEmoji: u.avatarEmoji }
      ])
    );

    const rawMemberStats = budget.members.map((member, index) => {
      const uid = member.userId.toString();
      const profile = userById.get(uid);

      let incomeContributed = 0;
      let fixedChargesPaid = 0;
      let variableExpensesPaid = 0;
      let savingsContributed = 0;

      for (const env of envelopes) {
        const envMemberId = env.memberId?.toString();
        if (env.pillar === 'income' && envMemberId === uid) {
          incomeContributed += env.allocatedAmount;
        } else if (env.pillar === 'fixed_charge' && envMemberId === uid) {
          fixedChargesPaid += env.allocatedAmount;
        } else if (env.pillar === 'savings') {
          const linkedTxs = txBySavingsEnvelopeId.get(env._id.toString());
          if (linkedTxs && linkedTxs.length > 0) {
            for (const tx of linkedTxs) {
              if (tx.paidByUserId.toString() === uid) {
                savingsContributed += tx.type === 'income' ? -tx.amount : tx.amount;
              }
            }
          } else if (envMemberId === uid) {
            savingsContributed += env.allocatedAmount;
          }
        }
      }

      for (const tx of transactions) {
        const env = envelopeById.get(tx.envelopeId.toString());
        if (env?.pillar === 'variable_envelope' && tx.paidByUserId.toString() === uid) {
          variableExpensesPaid += tx.type === 'income' ? -tx.amount : tx.amount;
        }
      }

      const safeIncome = Math.max(0, roundCurrency(incomeContributed));
      const safeFixed = Math.max(0, roundCurrency(fixedChargesPaid));
      const netVariable = roundCurrency(variableExpensesPaid);
      const safeSavings = Math.max(0, roundCurrency(savingsContributed));
      const expensesPaid = Math.max(0, roundCurrency(safeFixed + netVariable + safeSavings));

      return {
        userId: uid,
        displayName: profile?.displayName ?? `Membre ${index + 1}`,
        avatarEmoji: profile?.avatarEmoji ?? '🧑',
        color: member.color,
        role: member.role,
        incomeContributed: safeIncome,
        fixedChargesPaid: safeFixed,
        variableExpensesPaid: netVariable,
        savingsContributed: safeSavings,
        expensesPaid,
        netBalance: roundCurrency(safeIncome - expensesPaid)
      };
    });

    const totalMembersIncome = rawMemberStats.reduce((sum, m) => sum + m.incomeContributed, 0);
    const totalMembersExpenses = rawMemberStats.reduce((sum, m) => sum + m.expensesPaid, 0);

    const memberBreakdown: MemberBreakdownItem[] = rawMemberStats.map((item) => ({
      ...item,
      incomeSharePercentage:
        totalMembersIncome > 0
          ? roundPercentage((item.incomeContributed / totalMembersIncome) * 100)
          : 0,
      expensesSharePercentage:
        totalMembersExpenses > 0
          ? roundPercentage((item.expensesPaid / totalMembersExpenses) * 100)
          : 0
    }));

    res.status(200).json({
      status: 'ok',
      analytics: {
        periodId: period._id.toString(),
        budgetId: budget._id.toString(),
        budgetType: budget.type,
        cashFlow: {
          plannedIncome: period.summary.plannedIncome,
          plannedFixedCharges: period.summary.plannedFixedCharges,
          plannedEnvelopes: period.summary.plannedEnvelopes,
          spentVariables: period.summary.spentVariables,
          plannedSavings: period.summary.plannedSavings,
          remainingToLive: period.summary.remainingToLive
        },
        dailyBudget,
        allocation,
        zeroBased: {
          plannedIncome: period.summary.plannedIncome,
          totalAllocated,
          remainingToAllocate: period.summary.remainingToAllocate,
          isBalanced:
            period.summary.plannedIncome > 0 &&
            Math.abs(period.summary.remainingToAllocate) < 0.01
        },
        memberBreakdown,
        ageOfMoney: await computeBudgetAgeOfMoney(budget._id.toString()),
        fixedChargesVarianceSummary: await (async () => {
          const { computePeriodEnvelopesVariance } = await import(
            '../services/fixedChargeVariance.service'
          );
          const { fixedChargesVarianceSummary } = await computePeriodEnvelopesVariance(
            String(period._id),
            envelopes
          );
          return fixedChargesVarianceSummary;
        })()
      }
    });
  } catch (err) {
    next(err);
  }
}

const trendsQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(36).default(6)
});

/**
 * GET /api/budgets/:budgetId/trends?months=6
 * Retourne l'historique mensuel (Revenus, Fixes, Variables, Épargne) sur N mois.
 */
export async function getBudgetTrends(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const budgetId = String(req.params.budgetId);
    const { months } = trendsQuerySchema.parse(req.query);

    const periods = await BudgetPeriodModel.find({ budgetId })
      .sort({ year: -1, month: -1 })
      .limit(months);

    const items = periods
      .reverse()
      .map((p) => ({
        periodId: p._id.toString(),
        year: p.year,
        month: p.month,
        label: p.label,
        plannedIncome: p.summary.plannedIncome,
        plannedFixedCharges: p.summary.plannedFixedCharges,
        spentVariables: p.summary.spentVariables,
        plannedSavings: p.summary.plannedSavings
      }));

    res.json({ months, items });
  } catch (err) {
    next(err);
  }
}

export async function getTagsSummary(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Authentification requise.' });
      return;
    }

    const { id } = req.params as { id: string };
    const { BudgetModel } = await import('../models/Budget.model');
    const budget = await BudgetModel.findOne({
      _id: id,
      'members.userId': userId
    })
      .select('_id')
      .lean();

    if (!budget) {
      res.status(404).json({ message: 'Budget introuvable.' });
      return;
    }

    const { getBudgetTagsSummary } = await import('../services/tagAnalytics.service');
    const tags = await getBudgetTagsSummary(id);
    res.status(200).json({ status: 'ok', tags });
  } catch (err) {
    next(err);
  }
}

export async function getTagDetailAnalytics(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Authentification requise.' });
      return;
    }

    const { id, tag } = req.params as { id: string; tag: string };
    const { BudgetModel } = await import('../models/Budget.model');
    const budget = await BudgetModel.findOne({
      _id: id,
      'members.userId': userId
    })
      .select('_id')
      .lean();

    if (!budget) {
      res.status(404).json({ message: 'Budget introuvable.' });
      return;
    }

    const { getBudgetTagDetailAnalytics } = await import('../services/tagAnalytics.service');
    const analytics = await getBudgetTagDetailAnalytics(id, tag);
    res.status(200).json({ status: 'ok', analytics });
  } catch (err) {
    next(err);
  }
}

export async function getPeriodCalendarHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Authentification requise.' });
      return;
    }

    const { periodId } = req.params as { periodId: string };
    const referenceDateParam = req.query.referenceDate as string | undefined;
    const referenceDate = referenceDateParam ? new Date(referenceDateParam) : new Date();

    const { getPeriodCalendar } = await import('../services/calendar.service');
    const calendar = await getPeriodCalendar(periodId, userId, referenceDate);
    res.status(200).json({ status: 'ok', calendar });
  } catch (err) {
    next(err);
  }
}

export async function getBudgetWrappedHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Authentification requise.' });
      return;
    }

    const { budgetId } = req.params as { budgetId: string };
    const yearParam = req.query.year as string | undefined;
    const year = yearParam ? Number.parseInt(yearParam, 10) : undefined;

    const { getAnnualWrapped } = await import('../services/annualWrapped.service');
    const wrapped = await getAnnualWrapped(
      budgetId,
      userId,
      Number.isFinite(year) ? year : undefined
    );
    res.status(200).json({ status: 'ok', wrapped });
  } catch (err) {
    next(err);
  }
}

export async function getBudgetStreakHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Authentification requise.' });
      return;
    }

    const { id: budgetId } = req.params as { id: string };
    const { BudgetModel } = await import('../models/Budget.model');
    const budget = await BudgetModel.findOne({
      _id: budgetId,
      'members.userId': userId
    }).select('_id');
    if (!budget) {
      res.status(404).json({ message: 'Budget introuvable ou accès refusé.' });
      return;
    }

    const { computeBudgetStreak } = await import('../services/streak.service');
    const streak = await computeBudgetStreak(budgetId);
    res.status(200).json({ status: 'ok', streak });
  } catch (err) {
    next(err);
  }
}

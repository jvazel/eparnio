import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../middlewares/error.middleware';
import { BudgetModel } from '../models/Budget.model';
import { recalculatePeriodSummary } from '../services/remainingToLive.service';
import { BudgetPeriodModel, toBudgetPeriodResponse } from '../models/BudgetPeriod.model';
import { EnvelopeModel, toEnvelopeResponse } from '../models/Envelope.model';
import { toSavingsGoalResponse } from '../models/SavingsGoal.model';
import { assertBudgetAccess } from '../services/budgetAccess.service';
import {
  closePeriodAndRollover,
  computeCycleBounds,
  getOrCreatePeriodWithRollover,
  resolveCycleYearMonthForDate,
  rolloverToNextPeriod,
  syncMissingRecurringFromPreviousPeriod
} from '../services/periodRollover.service';

const objectIdSchema = z
  .string()
  .refine((value) => Types.ObjectId.isValid(value), 'Identifiant invalide');

export const budgetPeriodParamsSchema = z.object({
  budgetId: objectIdSchema
});

export const periodRolloverParamsSchema = z.object({
  budgetId: objectIdSchema,
  periodId: objectIdSchema
});

export const byMonthQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12)
});

export const createPeriodBodySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12)
});

export const closePeriodBodySchema = z.object({
  envelopeDecisions: z
    .array(
      z
        .object({
          envelopeId: objectIdSchema,
          action: z.enum(['rollover_next_month', 'transfer_to_goal', 'reset_zero']),
          goalId: objectIdSchema.optional()
        })
        .refine((item) => item.action !== 'transfer_to_goal' || Boolean(item.goalId), {
          message: 'Un objectif d’épargne cible est requis pour transférer un surplus'
        })
    )
    .optional(),
  nextMonthAdjustments: z
    .array(
      z.object({
        sourceEnvelopeId: objectIdSchema,
        allocatedAmount: z.coerce.number().min(0, 'Le montant doit être positif ou nul'),
        include: z.boolean().optional()
      })
    )
    .optional()
});

async function loadPeriodPayload(budgetPeriodId: Types.ObjectId) {
  return EnvelopeModel.find({ budgetPeriodId }).sort({ pillar: 1, order: 1, createdAt: 1 });
}

/**
 * Récupère ou initialise la période courante selon le `budgetStartDay` de l'espace.
 */
export async function getCurrentPeriod(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { budgetId } = req.params as z.infer<typeof budgetPeriodParamsSchema>;
    const { budget } = await assertBudgetAccess(budgetId, req.user?.id);

    const { year, month } = resolveCycleYearMonthForDate(new Date(), budget.budgetStartDay);
    const period = await getOrCreatePeriodWithRollover(budget, year, month);
    const envelopes = await loadPeriodPayload(period._id);

    res.status(200).json({
      status: 'ok',
      period: toBudgetPeriodResponse(period),
      envelopes: envelopes.map(toEnvelopeResponse)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Récupère (ou crée avec reconduction automatique) la période du mois demandé (`year`, `month`).
 */
export async function getPeriodByMonth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { budgetId } = req.params as z.infer<typeof budgetPeriodParamsSchema>;
    const { year, month } = req.query as unknown as z.infer<typeof byMonthQuerySchema>;

    const { budget } = await assertBudgetAccess(budgetId, req.user?.id);
    const period = await getOrCreatePeriodWithRollover(budget, year, month);
    const envelopes = await loadPeriodPayload(period._id);

    res.status(200).json({
      status: 'ok',
      period: toBudgetPeriodResponse(period),
      envelopes: envelopes.map(toEnvelopeResponse)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Crée explicitement une nouvelle période mensuelle pour un budget donné.
 */
export async function createPeriod(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { budgetId } = req.params as z.infer<typeof budgetPeriodParamsSchema>;
    const { year, month } = req.body as z.infer<typeof createPeriodBodySchema>;

    const { budget } = await assertBudgetAccess(budgetId, req.user?.id, { requireWrite: true });

    const existing = await BudgetPeriodModel.findOne({ budgetId: budget._id, year, month });
    if (existing) {
      throw new AppError('Cette période budgétaire existe déjà', 409);
    }

    const bounds = computeCycleBounds(year, month, budget.budgetStartDay);
    const period = await BudgetPeriodModel.create({
      budgetId: budget._id,
      year: bounds.year,
      month: bounds.month,
      label: bounds.label,
      startDate: bounds.startDate,
      endDate: bounds.endDate
    });

    res.status(201).json({
      status: 'ok',
      period: toBudgetPeriodResponse(period),
      envelopes: []
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Force la reconduction des revenus récurrents, dépenses fixes récurrentes et enveloppes
 * d'une période source vers le mois suivant.
 */
export async function triggerRollover(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { budgetId, periodId } = req.params as z.infer<typeof periodRolloverParamsSchema>;
    const { budget } = await assertBudgetAccess(budgetId, req.user?.id, { requireWrite: true });

    const sourcePeriod = await BudgetPeriodModel.findOne({
      _id: periodId,
      budgetId: budget._id
    });
    if (!sourcePeriod) {
      throw new AppError('Période source introuvable pour cet espace budgétaire', 404);
    }

    const targetPeriod = await rolloverToNextPeriod(budget, sourcePeriod);
    const envelopes = await loadPeriodPayload(targetPeriod._id);

    res.status(200).json({
      status: 'ok',
      period: toBudgetPeriodResponse(targetPeriod),
      envelopes: envelopes.map(toEnvelopeResponse)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Clôture la période budgétaire en cours en appliquant les choix de surplus,
 * les ajustements du cycle suivant M+1 et le marquage `closedAt`.
 */
export async function closePeriod(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { budgetId, periodId } = req.params as z.infer<typeof periodRolloverParamsSchema>;
    const payload = req.body as z.infer<typeof closePeriodBodySchema>;

    const { budget } = await assertBudgetAccess(budgetId, req.user?.id, { requireWrite: true });

    const sourcePeriod = await BudgetPeriodModel.findOne({
      _id: periodId,
      budgetId: budget._id
    });
    if (!sourcePeriod) {
      throw new AppError('Période source introuvable pour cet espace budgétaire', 404);
    }

    const result = await closePeriodAndRollover({
      budget,
      sourcePeriod,
      actorUserId: req.user?.id,
      envelopeDecisions: payload.envelopeDecisions,
      nextMonthAdjustments: payload.nextMonthAdjustments
    });

    res.status(200).json({
      status: 'ok',
      closedPeriod: toBudgetPeriodResponse(result.closedPeriod),
      nextPeriod: toBudgetPeriodResponse(result.nextPeriod),
      nextEnvelopes: result.nextEnvelopes.map(toEnvelopeResponse),
      updatedGoals: result.updatedGoals.map(toSavingsGoalResponse),
      transferredTotal: result.transferredTotal
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Synchronise dans la période cible les revenus et dépenses fixes récurrents
 * manquants depuis le mois précédent.
 */
export async function syncRecurringFromPrevious(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { budgetId, periodId } = req.params as { budgetId: string; periodId: string };
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Authentification requise.' });
      return;
    }

    const budget = await BudgetModel.findOne({
      _id: budgetId,
      'members.userId': userId
    }).lean();
    if (!budget) {
      res.status(404).json({ message: 'Budget introuvable.' });
      return;
    }

    const targetPeriod = await BudgetPeriodModel.findOne({
      _id: periodId,
      budgetId: budget._id
    }).lean();
    if (!targetPeriod) {
      res.status(404).json({ message: 'Période introuvable.' });
      return;
    }

    const addedCount = await syncMissingRecurringFromPreviousPeriod(budget._id, targetPeriod);
    if (addedCount > 0) {
      await recalculatePeriodSummary(targetPeriod._id);
    }
    res.status(200).json({ status: 'ok', addedCount });
  } catch (err) {
    next(err);
  }
}

export async function getAutoBalanceSuggestionHandler(
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
    const { getAutoBalanceSuggestion } = await import(
      '../services/zeroBasedAutoBalance.service'
    );
    const suggestion = await getAutoBalanceSuggestion(periodId, userId);
    res.status(200).json({ status: 'ok', suggestion });
  } catch (err) {
    next(err);
  }
}

export async function applyAutoBalanceHandler(
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
    const { targetEnvelopeId, deltaAmount } = req.body as {
      targetEnvelopeId: string;
      deltaAmount: number;
    };
    if (!targetEnvelopeId || typeof deltaAmount !== 'number') {
      res.status(400).json({ message: 'Paramètres invalides.' });
      return;
    }
    const { applyAutoBalance } = await import('../services/zeroBasedAutoBalance.service');
    const result = await applyAutoBalance(periodId, userId, targetEnvelopeId, deltaAmount);
    res.status(200).json({ status: 'ok', result });
  } catch (err) {
    next(err);
  }
}

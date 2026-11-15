import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../middlewares/error.middleware';
import { BudgetPeriodModel, toBudgetPeriodResponse } from '../models/BudgetPeriod.model';
import { EnvelopeModel, toEnvelopeResponse } from '../models/Envelope.model';
import { assertBudgetAccess } from '../services/budgetAccess.service';
import {
  computeCycleBounds,
  getOrCreatePeriodWithRollover,
  resolveCycleYearMonthForDate,
  rolloverToNextPeriod
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

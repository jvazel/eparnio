import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../middlewares/error.middleware';
import {
  BudgetTemplateModel,
  toBudgetTemplateResponse,
  type IBudgetTemplateItem
} from '../models/BudgetTemplate.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { assertBudgetAccess } from '../services/budgetAccess.service';
import {
  buildTemplateItemsFromPeriod,
  previewOrApplyTemplate
} from '../services/budgetTemplate.service';

const objectIdSchema = z
  .string()
  .refine((v) => Types.ObjectId.isValid(v), 'Identifiant invalide');

export const templateBudgetParamsSchema = z.object({
  budgetId: objectIdSchema
});

export const templateItemParamsSchema = z.object({
  budgetId: objectIdSchema,
  templateId: objectIdSchema
});

export const applyTemplateParamsSchema = z.object({
  periodId: objectIdSchema
});

const templateItemBodySchema = z.object({
  pillar: z.enum(['variable_envelope', 'savings']),
  name: z.string().trim().min(1, 'Le nom du poste est requis').max(120),
  icon: z.string().trim().max(16).optional().default('💡'),
  color: z.string().trim().max(32).optional().default('#38BDF8'),
  allocatedAmount: z
    .number()
    .refine((v) => Number.isFinite(v) && v >= 0, 'Le montant doit être positif ou nul'),
  linkedGoalId: objectIdSchema.optional(),
  rolloverEnabled: z.boolean().optional(),
  rolloverMode: z.enum(['positive_only', 'both']).optional(),
  order: z.number().int().min(0).optional()
});

export const createBudgetTemplateBodySchema = z
  .object({
    name: z.string().trim().min(1, 'Le nom du scénario est requis').max(60),
    icon: z.string().trim().max(16).optional().default('🎭'),
    color: z.string().trim().max(32).optional().default('#7C3AED'),
    description: z.string().trim().max(160).optional(),
    sourcePeriodId: objectIdSchema.optional(),
    items: z.array(templateItemBodySchema).max(100).optional()
  })
  .refine((data) => Boolean(data.sourcePeriodId) || Array.isArray(data.items), {
    message: 'Fournissez soit une période source (`sourcePeriodId`), soit une liste `items`.'
  });

export const updateBudgetTemplateBodySchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  icon: z.string().trim().max(16).optional(),
  color: z.string().trim().max(32).optional(),
  description: z.string().trim().max(160).nullable().optional(),
  items: z.array(templateItemBodySchema).max(100).optional()
});

export const applyBudgetTemplateBodySchema = z.object({
  templateId: objectIdSchema,
  dryRun: z.boolean().optional().default(false)
});

function assertCanWrite(role?: string, isOwner?: boolean): void {
  if (isOwner) return;
  if (role === 'viewer') {
    throw new AppError('Accès en lecture seule : vous ne pouvez pas modifier ce budget', 403);
  }
}

export async function listBudgetTemplates(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { budgetId } = req.params as z.infer<typeof templateBudgetParamsSchema>;
    const { budget } = await assertBudgetAccess(budgetId, req.user?.id);

    const templates = await BudgetTemplateModel.find({ budgetId: budget._id }).sort({
      updatedAt: -1,
      name: 1
    });

    res.status(200).json({
      status: 'ok',
      templates: templates.map(toBudgetTemplateResponse)
    });
  } catch (err) {
    next(err);
  }
}

export async function createBudgetTemplate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.id) {
      throw new AppError('Authentification requise', 401);
    }

    const { budgetId } = req.params as z.infer<typeof templateBudgetParamsSchema>;
    const body = req.body as z.infer<typeof createBudgetTemplateBodySchema>;
    const { budget, member } = await assertBudgetAccess(budgetId, req.user.id);
    assertCanWrite(member?.role, budget.ownerId.toString() === req.user.id);

    let items: IBudgetTemplateItem[];
    if (body.sourcePeriodId) {
      items = await buildTemplateItemsFromPeriod(budget._id, body.sourcePeriodId);
    } else {
      items = (body.items ?? []).map((item, idx) => ({
        pillar: item.pillar,
        name: item.name,
        icon: item.icon ?? '💡',
        color: item.color ?? '#38BDF8',
        allocatedAmount: item.allocatedAmount,
        ...(item.linkedGoalId ? { linkedGoalId: new Types.ObjectId(item.linkedGoalId) } : {}),
        ...(item.rolloverEnabled !== undefined ? { rolloverEnabled: item.rolloverEnabled } : {}),
        ...(item.rolloverMode ? { rolloverMode: item.rolloverMode } : {}),
        order: item.order ?? idx
      }));
    }

    const created = await BudgetTemplateModel.create({
      budgetId: budget._id,
      name: body.name,
      icon: body.icon ?? '🎭',
      color: body.color ?? '#7C3AED',
      ...(body.description ? { description: body.description } : {}),
      items,
      createdBy: new Types.ObjectId(req.user.id)
    });

    res.status(201).json({
      status: 'ok',
      template: toBudgetTemplateResponse(created)
    });
  } catch (err) {
    next(err);
  }
}

export async function updateBudgetTemplate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.id) {
      throw new AppError('Authentification requise', 401);
    }

    const { budgetId, templateId } = req.params as z.infer<typeof templateItemParamsSchema>;
    const body = req.body as z.infer<typeof updateBudgetTemplateBodySchema>;
    const { budget, member } = await assertBudgetAccess(budgetId, req.user.id);
    assertCanWrite(member?.role, budget.ownerId.toString() === req.user.id);

    const existing = await BudgetTemplateModel.findOne({
      _id: templateId,
      budgetId: budget._id
    });
    if (!existing) {
      throw new AppError('Scénario de budget introuvable', 404);
    }

    if (body.name !== undefined) existing.name = body.name;
    if (body.icon !== undefined) existing.icon = body.icon;
    if (body.color !== undefined) existing.color = body.color;
    if (body.description !== undefined) {
      existing.description = body.description === null ? undefined : body.description;
    }
    if (body.items !== undefined) {
      existing.items = body.items.map((item, idx) => ({
        pillar: item.pillar,
        name: item.name,
        icon: item.icon ?? '💡',
        color: item.color ?? '#38BDF8',
        allocatedAmount: item.allocatedAmount,
        ...(item.linkedGoalId ? { linkedGoalId: new Types.ObjectId(item.linkedGoalId) } : {}),
        ...(item.rolloverEnabled !== undefined ? { rolloverEnabled: item.rolloverEnabled } : {}),
        ...(item.rolloverMode ? { rolloverMode: item.rolloverMode } : {}),
        order: item.order ?? idx
      }));
    }

    await existing.save();

    res.status(200).json({
      status: 'ok',
      template: toBudgetTemplateResponse(existing)
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteBudgetTemplate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.id) {
      throw new AppError('Authentification requise', 401);
    }

    const { budgetId, templateId } = req.params as z.infer<typeof templateItemParamsSchema>;
    const { budget, member } = await assertBudgetAccess(budgetId, req.user.id);
    assertCanWrite(member?.role, budget.ownerId.toString() === req.user.id);

    const deleted = await BudgetTemplateModel.findOneAndDelete({
      _id: templateId,
      budgetId: budget._id
    });
    if (!deleted) {
      throw new AppError('Scénario de budget introuvable', 404);
    }

    res.status(200).json({
      status: 'ok',
      deletedId: templateId
    });
  } catch (err) {
    next(err);
  }
}

export async function applyBudgetTemplateHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.id) {
      throw new AppError('Authentification requise', 401);
    }

    const { periodId } = req.params as z.infer<typeof applyTemplateParamsSchema>;
    const { templateId, dryRun } = req.body as z.infer<typeof applyBudgetTemplateBodySchema>;

    const period = await BudgetPeriodModel.findById(periodId);
    if (!period) {
      throw new AppError('Période budgétaire introuvable', 404);
    }

    const { budget, member } = await assertBudgetAccess(period.budgetId.toString(), req.user.id);
    if (!dryRun) {
      assertCanWrite(member?.role, budget.ownerId.toString() === req.user.id);
    }

    const result = await previewOrApplyTemplate({
      budgetId: budget._id,
      periodId: period._id,
      templateId,
      dryRun: Boolean(dryRun)
    });

    res.status(200).json({
      status: 'ok',
      ...result
    });
  } catch (err) {
    next(err);
  }
}

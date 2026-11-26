import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../middlewares/error.middleware';
import { PayeeRuleModel, toPayeeRuleResponse } from '../models/PayeeRule.model';
import { assertBudgetAccess } from '../services/budgetAccess.service';

const MAX_RULES_PER_BUDGET = 100;

const objectIdSchema = z
  .string()
  .refine((v) => Types.ObjectId.isValid(v), 'Identifiant invalide');

export const payeeRuleBudgetParamsSchema = z.object({
  budgetId: objectIdSchema
});

export const payeeRuleItemParamsSchema = z.object({
  budgetId: objectIdSchema,
  ruleId: objectIdSchema
});

function normalizeTags(tags?: string[]): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const cleaned = raw.trim().replace(/^#+/, '').replace(/\s+/g, '-').toLowerCase().slice(0, 40);
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      result.push(cleaned);
    }
    if (result.length >= 5) break;
  }
  return result;
}

export const createPayeeRuleBodySchema = z
  .object({
    pattern: z.string().trim().min(1, 'Le texte à rechercher est requis').max(80),
    matchType: z.enum(['contains', 'starts_with', 'exact']).optional().default('contains'),
    transactionType: z.enum(['all', 'expense', 'income']).optional().default('all'),
    targetEnvelopeName: z.string().trim().max(120).optional(),
    renameLabel: z.string().trim().max(80).optional(),
    addTags: z.array(z.string().trim().min(1).max(40)).max(5).optional().default([]),
    autoExcludeFromImport: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true)
  })
  .refine(
    (data) =>
      Boolean(data.targetEnvelopeName && data.targetEnvelopeName.length > 0) ||
      Boolean(data.renameLabel && data.renameLabel.length > 0) ||
      (data.addTags && data.addTags.length > 0) ||
      Boolean(data.autoExcludeFromImport),
    {
      message:
        'Définissez au moins une action (enveloppe cible, renommage, tag ou exclusion à l’import).'
    }
  );

export const updatePayeeRuleBodySchema = z.object({
  pattern: z.string().trim().min(1).max(80).optional(),
  matchType: z.enum(['contains', 'starts_with', 'exact']).optional(),
  transactionType: z.enum(['all', 'expense', 'income']).optional(),
  targetEnvelopeName: z.string().trim().max(120).nullable().optional(),
  renameLabel: z.string().trim().max(80).nullable().optional(),
  addTags: z.array(z.string().trim().min(1).max(40)).max(5).optional(),
  autoExcludeFromImport: z.boolean().optional(),
  isActive: z.boolean().optional()
});

export const reorderPayeeRulesBodySchema = z.object({
  orderedIds: z.array(objectIdSchema).min(1).max(MAX_RULES_PER_BUDGET)
});

function assertCanWrite(role?: string, isOwner?: boolean): void {
  if (isOwner) return;
  if (role === 'viewer') {
    throw new AppError('Accès en lecture seule : vous ne pouvez pas modifier ces règles', 403);
  }
}

export async function listPayeeRules(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { budgetId } = req.params as z.infer<typeof payeeRuleBudgetParamsSchema>;
    const { budget } = await assertBudgetAccess(budgetId, req.user?.id);

    const rules = await PayeeRuleModel.find({ budgetId: budget._id }).sort({
      order: 1,
      createdAt: 1
    });

    res.status(200).json({
      status: 'ok',
      rules: rules.map(toPayeeRuleResponse)
    });
  } catch (err) {
    next(err);
  }
}

export async function createPayeeRule(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.id) {
      throw new AppError('Authentification requise', 401);
    }

    const { budgetId } = req.params as z.infer<typeof payeeRuleBudgetParamsSchema>;
    const body = req.body as z.infer<typeof createPayeeRuleBodySchema>;
    const { budget, member } = await assertBudgetAccess(budgetId, req.user.id);
    assertCanWrite(member?.role, budget.ownerId.toString() === req.user.id);

    const existingCount = await PayeeRuleModel.countDocuments({ budgetId: budget._id });
    if (existingCount >= MAX_RULES_PER_BUDGET) {
      throw new AppError(`Limite atteinte (${MAX_RULES_PER_BUDGET} règles par budget).`, 400);
    }

    const created = await PayeeRuleModel.create({
      budgetId: budget._id,
      pattern: body.pattern,
      matchType: body.matchType ?? 'contains',
      transactionType: body.transactionType ?? 'all',
      ...(body.targetEnvelopeName ? { targetEnvelopeName: body.targetEnvelopeName } : {}),
      ...(body.renameLabel ? { renameLabel: body.renameLabel } : {}),
      addTags: normalizeTags(body.addTags),
      autoExcludeFromImport: Boolean(body.autoExcludeFromImport),
      isActive: body.isActive ?? true,
      order: existingCount,
      createdBy: new Types.ObjectId(req.user.id)
    });

    res.status(201).json({
      status: 'ok',
      rule: toPayeeRuleResponse(created)
    });
  } catch (err) {
    next(err);
  }
}

export async function updatePayeeRule(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.id) {
      throw new AppError('Authentification requise', 401);
    }

    const { budgetId, ruleId } = req.params as z.infer<typeof payeeRuleItemParamsSchema>;
    const body = req.body as z.infer<typeof updatePayeeRuleBodySchema>;
    const { budget, member } = await assertBudgetAccess(budgetId, req.user.id);
    assertCanWrite(member?.role, budget.ownerId.toString() === req.user.id);

    const existing = await PayeeRuleModel.findOne({ _id: ruleId, budgetId: budget._id });
    if (!existing) {
      throw new AppError('Règle introuvable', 404);
    }

    if (body.pattern !== undefined) existing.pattern = body.pattern;
    if (body.matchType !== undefined) existing.matchType = body.matchType;
    if (body.transactionType !== undefined) existing.transactionType = body.transactionType;
    if (body.targetEnvelopeName !== undefined) {
      existing.targetEnvelopeName =
        body.targetEnvelopeName === null || body.targetEnvelopeName === ''
          ? undefined
          : body.targetEnvelopeName;
    }
    if (body.renameLabel !== undefined) {
      existing.renameLabel =
        body.renameLabel === null || body.renameLabel === '' ? undefined : body.renameLabel;
    }
    if (body.addTags !== undefined) existing.addTags = normalizeTags(body.addTags);
    if (body.autoExcludeFromImport !== undefined) {
      existing.autoExcludeFromImport = body.autoExcludeFromImport;
    }
    if (body.isActive !== undefined) existing.isActive = body.isActive;

    await existing.save();

    res.status(200).json({
      status: 'ok',
      rule: toPayeeRuleResponse(existing)
    });
  } catch (err) {
    next(err);
  }
}

export async function deletePayeeRule(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.id) {
      throw new AppError('Authentification requise', 401);
    }

    const { budgetId, ruleId } = req.params as z.infer<typeof payeeRuleItemParamsSchema>;
    const { budget, member } = await assertBudgetAccess(budgetId, req.user.id);
    assertCanWrite(member?.role, budget.ownerId.toString() === req.user.id);

    const deleted = await PayeeRuleModel.findOneAndDelete({ _id: ruleId, budgetId: budget._id });
    if (!deleted) {
      throw new AppError('Règle introuvable', 404);
    }

    res.status(200).json({
      status: 'ok',
      deletedId: ruleId
    });
  } catch (err) {
    next(err);
  }
}

export async function reorderPayeeRules(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.id) {
      throw new AppError('Authentification requise', 401);
    }

    const { budgetId } = req.params as z.infer<typeof payeeRuleBudgetParamsSchema>;
    const { orderedIds } = req.body as z.infer<typeof reorderPayeeRulesBodySchema>;
    const { budget, member } = await assertBudgetAccess(budgetId, req.user.id);
    assertCanWrite(member?.role, budget.ownerId.toString() === req.user.id);

    await Promise.all(
      orderedIds.map((id, index) =>
        PayeeRuleModel.updateOne(
          { _id: id, budgetId: budget._id },
          { $set: { order: index } }
        )
      )
    );

    const updated = await PayeeRuleModel.find({ budgetId: budget._id }).sort({
      order: 1,
      createdAt: 1
    });

    res.status(200).json({
      status: 'ok',
      rules: updated.map(toPayeeRuleResponse)
    });
  } catch (err) {
    next(err);
  }
}

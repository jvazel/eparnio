import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../middlewares/error.middleware';
import { BudgetModel } from '../models/Budget.model';
import { BudgetPeriodModel, toBudgetPeriodResponse } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { SavingsGoalModel } from '../models/SavingsGoal.model';
import { TransactionModel } from '../models/Transaction.model';
import {
  buildBudgetResponseWithUsers,
  buildBudgetsListResponseWithUsers,
  generateOrRegenerateInviteCode,
  joinBudgetByInviteCode,
  removeBudgetMember,
  updateBudgetContributionSplit
} from '../services/invite.service';

const objectIdSchema = z
  .string()
  .refine((value) => Types.ObjectId.isValid(value), 'Identifiant invalide');

export const budgetIdParamsSchema = z.object({
  id: z.string().refine((value) => Types.ObjectId.isValid(value), 'Identifiant de budget invalide')
});

export const inviteCodeParamsSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .min(4, 'Le code d’invitation est trop court')
    .max(32, 'Le code d’invitation est trop long')
});

export const removeMemberParamsSchema = z.object({
  id: z.string().refine((value) => Types.ObjectId.isValid(value), 'Identifiant de budget invalide'),
  userId: objectIdSchema
});

export const createBudgetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Le nom de l’espace budget est requis')
    .max(60, 'Le nom ne doit pas dépasser 60 caractères'),
  type: z.enum(['personal', 'shared']).default('personal'),
  budgetStartDay: z.coerce.number().int().min(1).max(31).default(1),
  contributionMode: z.enum(['equal_50_50', 'income_prorata', 'custom']).default('equal_50_50')
});

export const updateBudgetSchema = z.object({
  name: z.string().trim().min(1, 'Le nom ne peut pas être vide').max(60).optional(),
  budgetStartDay: z.coerce.number().int().min(1).max(31).optional(),
  contributionMode: z.enum(['equal_50_50', 'income_prorata', 'custom']).optional()
});

export const contributionSplitBodySchema = z.object({
  contributionMode: z.enum(['equal_50_50', 'income_prorata', 'custom']),
  targetAmount: z.coerce.number().min(0).max(10_000_000).optional(),
  periodId: objectIdSchema.optional(),
  applyToPeriod: z.boolean().optional(),
  members: z
    .array(
      z.object({
        userId: objectIdSchema,
        declaredMonthlyIncome: z.coerce.number().min(0).max(10_000_000).optional(),
        role: z.enum(['editor', 'viewer']).optional(),
        customAmount: z.coerce.number().min(0).max(10_000_000).optional()
      })
    )
    .optional()
});

/**
 * Liste tous les espaces budgétaires auxquels appartient l'utilisateur connecté.
 */
export async function listBudgets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    const budgets = await BudgetModel.find({ 'members.userId': userId }).sort({ createdAt: 1 });

    res.status(200).json({
      status: 'ok',
      budgets: await buildBudgetsListResponseWithUsers(budgets)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Crée un nouvel espace budgétaire (personnel ou partagé) dont l'utilisateur est propriétaire.
 */
export async function createBudget(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    const { name, type, budgetStartDay, contributionMode } = req.body as z.infer<
      typeof createBudgetSchema
    >;

    const budget = await BudgetModel.create({
      name,
      type,
      ownerId: userId,
      contributionMode,
      members: [
        {
          userId,
          role: 'owner',
          color: '#7C3AED',
          declaredMonthlyIncome: 0,
          joinedAt: new Date()
        }
      ],
      budgetStartDay
    });

    res.status(201).json({
      status: 'ok',
      budget: await buildBudgetResponseWithUsers(budget)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Met à jour le nom, le jour de début de cycle ou le mode de répartition d'un budget.
 */
export async function updateBudget(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    const { id } = req.params as z.infer<typeof budgetIdParamsSchema>;
    const payload = req.body as z.infer<typeof updateBudgetSchema>;

    const budget = await BudgetModel.findById(id);
    if (!budget) {
      throw new AppError('Espace budgétaire introuvable', 404);
    }

    const member = budget.members.find((m) => m.userId.toString() === userId);
    if (!member || member.role === 'viewer') {
      throw new AppError('Vous n’avez pas les droits pour modifier cet espace budgétaire', 403);
    }

    if (payload.name !== undefined) {
      budget.name = payload.name;
    }
    if (payload.budgetStartDay !== undefined) {
      budget.budgetStartDay = payload.budgetStartDay;
    }
    if (payload.contributionMode !== undefined) {
      budget.contributionMode = payload.contributionMode;
    }

    await budget.save();

    res.status(200).json({
      status: 'ok',
      budget: await buildBudgetResponseWithUsers(budget)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Supprime un espace budgétaire secondaire (réservé au propriétaire et impossible pour le dernier espace).
 */
export async function deleteBudget(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    const { id } = req.params as z.infer<typeof budgetIdParamsSchema>;

    const budget = await BudgetModel.findById(id);
    if (!budget) {
      throw new AppError('Espace budgétaire introuvable', 404);
    }

    if (budget.ownerId.toString() !== userId) {
      throw new AppError('Seul le propriétaire peut supprimer cet espace budgétaire', 403);
    }

    const accessibleCount = await BudgetModel.countDocuments({ 'members.userId': userId });
    if (accessibleCount <= 1) {
      throw new AppError('Impossible de supprimer votre dernier espace budgétaire', 400);
    }

    await TransactionModel.deleteMany({ budgetId: budget._id });
    await EnvelopeModel.deleteMany({ budgetId: budget._id });
    await SavingsGoalModel.deleteMany({ budgetId: budget._id });
    await BudgetPeriodModel.deleteMany({ budgetId: budget._id });
    await budget.deleteOne();

    res.status(200).json({
      status: 'ok',
      message: 'Espace budgétaire supprimé'
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Génère ou régénère un code d'invitation unique pour partager l'espace budgétaire.
 */
export async function generateInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params as z.infer<typeof budgetIdParamsSchema>;
    const result = await generateOrRegenerateInviteCode(id, req.user?.id);

    res.status(200).json({
      status: 'ok',
      inviteCode: result.inviteCode,
      inviteExpiresAt: result.inviteExpiresAt,
      budget: result.budget
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Permet à un utilisateur authentifié de rejoindre un budget partagé via son code d'invitation.
 */
export async function joinBudget(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { inviteCode } = req.params as z.infer<typeof inviteCodeParamsSchema>;
    const result = await joinBudgetByInviteCode(inviteCode, req.user?.id);

    res.status(200).json({
      status: 'ok',
      alreadyMember: result.alreadyMember,
      budget: result.budget
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Calcule et sauvegarde la répartition 50/50 ou au prorata des revenus des membres.
 */
export async function updateContributionSplit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params as z.infer<typeof budgetIdParamsSchema>;
    const payload = req.body as z.infer<typeof contributionSplitBodySchema>;
    const result = await updateBudgetContributionSplit(id, req.user?.id, payload);

    res.status(200).json({
      status: 'ok',
      budget: result.budget,
      split: result.split,
      ...(result.period ? { period: toBudgetPeriodResponse(result.period) } : {})
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Retire un membre d'un budget partagé (par le propriétaire ou départ volontaire).
 */
export async function removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, userId } = req.params as z.infer<typeof removeMemberParamsSchema>;
    const result = await removeBudgetMember(id, req.user?.id, userId);

    res.status(200).json({
      status: 'ok',
      removedUserId: result.removedUserId,
      budget: result.budget
    });
  } catch (err) {
    next(err);
  }
}

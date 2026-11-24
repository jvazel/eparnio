import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../middlewares/error.middleware';
import { EnvelopeModel } from '../models/Envelope.model';
import { SavingsGoalModel, toSavingsGoalResponse } from '../models/SavingsGoal.model';
import { TransactionModel } from '../models/Transaction.model';
import { assertBudgetAccess } from '../services/budgetAccess.service';
import {
  recalculatePeriodSummary,
  recalculateSavingsGoalCurrentAmount
} from '../services/remainingToLive.service';
import { roundCurrency } from '../services/zeroBasedBudget.service';

const objectIdSchema = z
  .string()
  .refine((value) => Types.ObjectId.isValid(value), 'Identifiant invalide');

const optionalDeadlineSchema = z.preprocess(
  (value) => (value === '' ? null : value),
  z.coerce.date().nullable().optional()
);

export const goalBudgetParamsSchema = z.object({
  budgetId: objectIdSchema
});

export const goalItemParamsSchema = z.object({
  budgetId: objectIdSchema,
  id: objectIdSchema
});

export const goalWithdrawalParamsSchema = z.object({
  budgetId: objectIdSchema,
  id: objectIdSchema,
  withdrawalId: objectIdSchema
});

export const createWithdrawalBodySchema = z.object({
  amount: z.coerce.number().positive('Le montant du retrait doit être strictement positif'),
  label: z
    .string()
    .trim()
    .min(1, 'Le libellé du retrait est requis')
    .max(100, 'Le libellé ne doit pas dépasser 100 caractères'),
  date: z.coerce.date().optional(),
  memberId: objectIdSchema.optional(),
  notes: z.string().trim().max(300, 'Les notes ne doivent pas dépasser 300 caractères').optional()
});

export const updateWithdrawalBodySchema = z.object({
  amount: z.coerce
    .number()
    .positive('Le montant du retrait doit être strictement positif')
    .optional(),
  label: z
    .string()
    .trim()
    .min(1, 'Le libellé ne peut pas être vide')
    .max(100, 'Le libellé ne doit pas dépasser 100 caractères')
    .optional(),
  date: z.coerce.date().optional(),
  memberId: objectIdSchema.nullable().optional(),
  notes: z
    .string()
    .trim()
    .max(300, 'Les notes ne doivent pas dépasser 300 caractères')
    .nullable()
    .optional()
});

export const createGoalBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Le nom de l’objectif est requis')
    .max(80, 'Le nom ne doit pas dépasser 80 caractères'),
  targetAmount: z.coerce.number().positive('Le montant cible doit être strictement positif'),
  initialAmount: z.coerce.number().min(0, 'Le montant initial doit être positif ou nul').optional(),
  currentAmount: z.coerce.number().min(0, 'Le montant actuel doit être positif ou nul').optional(),
  icon: z.string().trim().min(1).max(16).optional(),
  color: z.string().trim().min(1).max(32).optional(),
  deadline: optionalDeadlineSchema,
  assetAccountId: objectIdSchema.nullable().optional()
});

export const updateGoalBodySchema = z.object({
  name: z.string().trim().min(1, 'Le nom ne peut pas être vide').max(80).optional(),
  targetAmount: z.coerce
    .number()
    .positive('Le montant cible doit être strictement positif')
    .optional(),
  initialAmount: z.coerce.number().min(0, 'Le montant initial doit être positif ou nul').optional(),
  currentAmount: z.coerce.number().min(0, 'Le montant actuel doit être positif ou nul').optional(),
  icon: z.string().trim().min(1).max(16).optional(),
  color: z.string().trim().min(1).max(32).optional(),
  deadline: optionalDeadlineSchema,
  assetAccountId: objectIdSchema.nullable().optional(),
  order: z.coerce.number().int().min(0).optional()
});

/**
 * Liste tous les objectifs d'épargne d'un budget, triés par `order`.
 */
export async function listGoals(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { budgetId } = req.params as z.infer<typeof goalBudgetParamsSchema>;
    const { budget } = await assertBudgetAccess(budgetId, req.user?.id);

    const goals = await SavingsGoalModel.find({ budgetId: budget._id }).sort({
      order: 1,
      createdAt: 1
    });

    res.status(200).json({
      status: 'ok',
      goals: goals.map(toSavingsGoalResponse)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Crée un nouvel objectif d'épargne pour le budget actif.
 */
export async function createGoal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { budgetId } = req.params as z.infer<typeof goalBudgetParamsSchema>;
    const payload = req.body as z.infer<typeof createGoalBodySchema>;

    const { budget } = await assertBudgetAccess(budgetId, req.user?.id, { requireWrite: true });

    const lastGoal = await SavingsGoalModel.findOne({ budgetId: budget._id }).sort({ order: -1 });
    const resolvedInitial = roundCurrency(payload.initialAmount ?? payload.currentAmount ?? 0);

    const goal = await SavingsGoalModel.create({
      budgetId: budget._id,
      name: payload.name,
      targetAmount: roundCurrency(payload.targetAmount),
      initialAmount: resolvedInitial,
      currentAmount: resolvedInitial,
      icon: payload.icon ?? '🐷',
      color: payload.color ?? '#16A34A',
      ...(payload.deadline ? { deadline: payload.deadline } : {}),
      ...(payload.assetAccountId ? { assetAccountId: payload.assetAccountId } : {}),
      order: (lastGoal?.order ?? -1) + 1
    });

    res.status(201).json({
      status: 'ok',
      goal: toSavingsGoalResponse(goal)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Met à jour un objectif d'épargne et resynchronise son montant cumulé.
 */
export async function updateGoal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { budgetId, id } = req.params as z.infer<typeof goalItemParamsSchema>;
    const payload = req.body as z.infer<typeof updateGoalBodySchema>;

    const { budget } = await assertBudgetAccess(budgetId, req.user?.id, { requireWrite: true });

    const goal = await SavingsGoalModel.findOne({ _id: id, budgetId: budget._id });
    if (!goal) {
      throw new AppError('Objectif d’épargne introuvable', 404);
    }

    if (payload.name !== undefined) goal.name = payload.name;
    if (payload.targetAmount !== undefined) {
      goal.targetAmount = roundCurrency(payload.targetAmount);
    }
    if (payload.icon !== undefined) goal.icon = payload.icon;
    if (payload.color !== undefined) goal.color = payload.color;
    if (payload.order !== undefined) goal.order = payload.order;
    if (payload.deadline !== undefined) {
      goal.deadline = payload.deadline ?? undefined;
    }
    if (payload.assetAccountId !== undefined) {
      goal.assetAccountId = payload.assetAccountId
        ? (payload.assetAccountId as unknown as typeof goal.assetAccountId)
        : undefined;
    }

    if (payload.initialAmount !== undefined) {
      goal.initialAmount = roundCurrency(payload.initialAmount);
    } else if (payload.currentAmount !== undefined) {
      const linkedEnvelopes = await EnvelopeModel.find({
        budgetId: budget._id,
        pillar: 'savings',
        linkedGoalId: goal._id
      });
      const totalLinked = linkedEnvelopes.reduce((acc, env) => acc + env.allocatedAmount, 0);
      const totalWithdrawals = (goal.withdrawals ?? []).reduce((acc, item) => acc + item.amount, 0);
      goal.initialAmount = Math.max(
        0,
        roundCurrency(payload.currentAmount - totalLinked + totalWithdrawals)
      );
    }

    await goal.save();
    const recalculated = await recalculateSavingsGoalCurrentAmount(goal._id);

    res.status(200).json({
      status: 'ok',
      goal: toSavingsGoalResponse(recalculated ?? goal)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Supprime un objectif d'épargne ainsi que les versements liés et recalcule les périodes affectées.
 */
export async function deleteGoal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { budgetId, id } = req.params as z.infer<typeof goalItemParamsSchema>;

    const { budget } = await assertBudgetAccess(budgetId, req.user?.id, { requireWrite: true });

    const goal = await SavingsGoalModel.findOne({ _id: id, budgetId: budget._id });
    if (!goal) {
      throw new AppError('Objectif d’épargne introuvable', 404);
    }

    const linkedEnvelopes = await EnvelopeModel.find({
      budgetId: budget._id,
      linkedGoalId: goal._id
    });

    if (linkedEnvelopes.length > 0) {
      const envelopeIds = linkedEnvelopes.map((item) => item._id);
      const impactedPeriodIds = Array.from(
        new Set(linkedEnvelopes.map((item) => item.budgetPeriodId.toString()))
      );

      await TransactionModel.deleteMany({ envelopeId: { $in: envelopeIds } });
      await EnvelopeModel.deleteMany({ _id: { $in: envelopeIds } });
      await Promise.all(impactedPeriodIds.map((periodId) => recalculatePeriodSummary(periodId)));
    }

    await goal.deleteOne();

    res.status(200).json({
      status: 'ok',
      deletedId: id
    });
  } catch (err) {
    next(err);
  }
}

function assertValidBudgetMemberId(
  members: Array<{ userId: Types.ObjectId }>,
  memberId: string
): Types.ObjectId {
  const isMember = members.some((member) => member.userId.toString() === memberId);
  if (!isMember) {
    throw new AppError('Le membre sélectionné n’appartient pas à cet espace budgétaire', 400);
  }
  return new Types.ObjectId(memberId);
}

/**
 * Enregistre un retrait / utilisation sur une cagnotte d'épargne sans altérer le Reste à vivre du mois.
 */
export async function addGoalWithdrawal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { budgetId, id } = req.params as z.infer<typeof goalItemParamsSchema>;
    const payload = req.body as z.infer<typeof createWithdrawalBodySchema>;

    const { budget } = await assertBudgetAccess(budgetId, req.user?.id, { requireWrite: true });

    const goal = await SavingsGoalModel.findOne({ _id: id, budgetId: budget._id });
    if (!goal) {
      throw new AppError('Objectif d’épargne introuvable', 404);
    }

    const memberObjectId = payload.memberId
      ? assertValidBudgetMemberId(budget.members, payload.memberId)
      : undefined;

    goal.withdrawals.push({
      _id: new Types.ObjectId(),
      amount: roundCurrency(payload.amount),
      label: payload.label,
      date: payload.date ?? new Date(),
      ...(memberObjectId ? { memberId: memberObjectId } : {}),
      ...(payload.notes ? { notes: payload.notes } : {}),
      createdAt: new Date()
    });

    await goal.save();
    const recalculated = await recalculateSavingsGoalCurrentAmount(goal._id);

    res.status(201).json({
      status: 'ok',
      goal: toSavingsGoalResponse(recalculated ?? goal)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Met à jour un retrait existant sur une cagnotte d'épargne et recalcule `currentAmount`.
 */
export async function updateGoalWithdrawal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { budgetId, id, withdrawalId } = req.params as z.infer<typeof goalWithdrawalParamsSchema>;
    const payload = req.body as z.infer<typeof updateWithdrawalBodySchema>;

    const { budget } = await assertBudgetAccess(budgetId, req.user?.id, { requireWrite: true });

    const goal = await SavingsGoalModel.findOne({ _id: id, budgetId: budget._id });
    if (!goal) {
      throw new AppError('Objectif d’épargne introuvable', 404);
    }

    const withdrawal = goal.withdrawals.find((item) => item._id.toString() === withdrawalId);
    if (!withdrawal) {
      throw new AppError('Retrait d’épargne introuvable', 404);
    }

    if (payload.amount !== undefined) withdrawal.amount = roundCurrency(payload.amount);
    if (payload.label !== undefined) withdrawal.label = payload.label;
    if (payload.date !== undefined) withdrawal.date = payload.date;
    if (payload.notes !== undefined) {
      withdrawal.notes = payload.notes ? payload.notes : undefined;
    }
    if (payload.memberId !== undefined) {
      withdrawal.memberId = payload.memberId
        ? assertValidBudgetMemberId(budget.members, payload.memberId)
        : undefined;
    }

    await goal.save();
    const recalculated = await recalculateSavingsGoalCurrentAmount(goal._id);

    res.status(200).json({
      status: 'ok',
      goal: toSavingsGoalResponse(recalculated ?? goal)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Supprime un retrait d'une cagnotte d'épargne et rétablit `currentAmount`.
 */
export async function deleteGoalWithdrawal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { budgetId, id, withdrawalId } = req.params as z.infer<typeof goalWithdrawalParamsSchema>;

    const { budget } = await assertBudgetAccess(budgetId, req.user?.id, { requireWrite: true });

    const goal = await SavingsGoalModel.findOne({ _id: id, budgetId: budget._id });
    if (!goal) {
      throw new AppError('Objectif d’épargne introuvable', 404);
    }

    const exists = goal.withdrawals.some((item) => item._id.toString() === withdrawalId);
    if (!exists) {
      throw new AppError('Retrait d’épargne introuvable', 404);
    }

    goal.withdrawals = goal.withdrawals.filter((item) => item._id.toString() !== withdrawalId);
    await goal.save();
    const recalculated = await recalculateSavingsGoalCurrentAmount(goal._id);

    res.status(200).json({
      status: 'ok',
      deletedId: withdrawalId,
      goal: toSavingsGoalResponse(recalculated ?? goal)
    });
  } catch (err) {
    next(err);
  }
}

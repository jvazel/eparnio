import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../middlewares/error.middleware';
import type { IBudget } from '../models/Budget.model';
import { toBudgetPeriodResponse } from '../models/BudgetPeriod.model';
import { EnvelopeModel, toEnvelopeResponse } from '../models/Envelope.model';
import { toSavingsGoalResponse } from '../models/SavingsGoal.model';
import { toTransactionResponse, TransactionModel } from '../models/Transaction.model';
import { assertPeriodAccess } from '../services/budgetAccess.service';
import { recalculateEnvelopeAndPeriod } from '../services/remainingToLive.service';
import { roundCurrency } from '../services/zeroBasedBudget.service';

const objectIdSchema = z
  .string()
  .refine((value) => Types.ObjectId.isValid(value), 'Identifiant invalide');

const transactionTypeEnum = z.enum(['expense', 'income', 'transfer']);

export const transactionPeriodParamsSchema = z.object({
  periodId: objectIdSchema
});

export const transactionItemParamsSchema = z.object({
  periodId: objectIdSchema,
  id: objectIdSchema
});

export const listTransactionsQuerySchema = z.object({
  envelopeId: objectIdSchema.optional(),
  type: transactionTypeEnum.optional(),
  authorId: objectIdSchema.optional(),
  paidByUserId: objectIdSchema.optional()
});

export const createTransactionBodySchema = z.object({
  envelopeId: objectIdSchema,
  amount: z.coerce.number().positive('Le montant doit être strictement positif'),
  label: z
    .string()
    .trim()
    .min(1, 'Le libellé est requis')
    .max(100, 'Le libellé ne doit pas dépasser 100 caractères'),
  date: z.coerce.date().optional(),
  type: transactionTypeEnum.optional(),
  paidByUserId: objectIdSchema.optional(),
  notes: z.string().trim().max(300, 'Les notes ne doivent pas dépasser 300 caractères').optional()
});

export const updateTransactionBodySchema = z.object({
  envelopeId: objectIdSchema.optional(),
  amount: z.coerce.number().positive('Le montant doit être strictement positif').optional(),
  label: z
    .string()
    .trim()
    .min(1, 'Le libellé ne peut pas être vide')
    .max(100, 'Le libellé ne doit pas dépasser 100 caractères')
    .optional(),
  date: z.coerce.date().optional(),
  type: transactionTypeEnum.optional(),
  paidByUserId: objectIdSchema.optional(),
  notes: z.string().trim().max(300).optional()
});

function resolveValidPaidByMemberId(
  budget: IBudget,
  requestedUserId: string | undefined,
  fallbackUserId: string
): Types.ObjectId {
  const candidateId = requestedUserId ?? fallbackUserId;
  const isMember = budget.members.some((member) => member.userId.toString() === candidateId);
  if (!isMember) {
    throw new AppError('Le membre payeur n’appartient pas à cet espace budgétaire', 400);
  }
  return new Types.ObjectId(candidateId);
}

/**
 * Liste les transactions d'une période budgétaire avec filtrage optionnel par enveloppe, type ou membre.
 */
export async function listTransactions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { periodId } = req.params as z.infer<typeof transactionPeriodParamsSchema>;
    const query = req.query as z.infer<typeof listTransactionsQuerySchema>;

    const { period } = await assertPeriodAccess(periodId, req.user?.id);

    const filter: Record<string, unknown> = { budgetPeriodId: period._id };
    if (query.envelopeId) filter.envelopeId = new Types.ObjectId(query.envelopeId);
    if (query.type) filter.type = query.type;
    if (query.authorId) filter.authorId = new Types.ObjectId(query.authorId);
    if (query.paidByUserId) filter.paidByUserId = new Types.ObjectId(query.paidByUserId);

    const transactions = await TransactionModel.find(filter).sort({ date: -1, createdAt: -1 });

    res.status(200).json({
      status: 'ok',
      transactions: transactions.map(toTransactionResponse)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Crée une transaction dans une enveloppe, met à jour `spentOrPaidAmount` et recalcule la période.
 */
export async function createTransaction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { periodId } = req.params as z.infer<typeof transactionPeriodParamsSchema>;
    const payload = req.body as z.infer<typeof createTransactionBodySchema>;

    const { period, budget } = await assertPeriodAccess(periodId, req.user?.id, {
      requireWrite: true
    });

    const envelope = await EnvelopeModel.findOne({
      _id: payload.envelopeId,
      budgetPeriodId: period._id
    });
    if (!envelope) {
      throw new AppError('Enveloppe introuvable sur cette période', 404);
    }

    const authorObjectId = new Types.ObjectId(req.user!.id);
    const paidByObjectId = resolveValidPaidByMemberId(
      budget,
      payload.paidByUserId,
      req.user!.id
    );

    const transaction = await TransactionModel.create({
      budgetId: period.budgetId,
      budgetPeriodId: period._id,
      envelopeId: envelope._id,
      authorId: authorObjectId,
      paidByUserId: paidByObjectId,
      type: payload.type ?? 'expense',
      amount: roundCurrency(payload.amount),
      label: payload.label,
      date: payload.date ?? new Date(),
      ...(payload.notes ? { notes: payload.notes } : {})
    });

    const {
      envelope: updatedEnvelope,
      period: updatedPeriod,
      goal: updatedGoal
    } = await recalculateEnvelopeAndPeriod(envelope._id, period._id);

    res.status(201).json({
      status: 'ok',
      transaction: toTransactionResponse(transaction),
      envelope: toEnvelopeResponse(updatedEnvelope),
      period: toBudgetPeriodResponse(updatedPeriod),
      ...(updatedGoal ? { goal: toSavingsGoalResponse(updatedGoal) } : {})
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Met à jour une transaction existante et recalcule `spentOrPaidAmount` et `remainingToLive`.
 */
export async function updateTransaction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { periodId, id } = req.params as z.infer<typeof transactionItemParamsSchema>;
    const payload = req.body as z.infer<typeof updateTransactionBodySchema>;

    const { period, budget } = await assertPeriodAccess(periodId, req.user?.id, {
      requireWrite: true
    });

    const transaction = await TransactionModel.findOne({ _id: id, budgetPeriodId: period._id });
    if (!transaction) {
      throw new AppError('Transaction introuvable', 404);
    }

    const previousEnvelopeId = transaction.envelopeId.toString();
    let targetEnvelopeId = previousEnvelopeId;

    if (payload.envelopeId && payload.envelopeId !== previousEnvelopeId) {
      const targetEnvelope = await EnvelopeModel.findOne({
        _id: payload.envelopeId,
        budgetPeriodId: period._id
      });
      if (!targetEnvelope) {
        throw new AppError('Enveloppe cible introuvable sur cette période', 404);
      }
      transaction.envelopeId = targetEnvelope._id;
      targetEnvelopeId = targetEnvelope._id.toString();
    }

    if (payload.amount !== undefined) transaction.amount = roundCurrency(payload.amount);
    if (payload.label !== undefined) transaction.label = payload.label;
    if (payload.date !== undefined) transaction.date = payload.date;
    if (payload.type !== undefined) transaction.type = payload.type;
    if (payload.notes !== undefined) transaction.notes = payload.notes;
    if (payload.paidByUserId !== undefined) {
      transaction.paidByUserId = resolveValidPaidByMemberId(
        budget,
        payload.paidByUserId,
        req.user!.id
      );
    }

    await transaction.save();

    if (targetEnvelopeId !== previousEnvelopeId) {
      await recalculateEnvelopeAndPeriod(previousEnvelopeId, period._id);
    }

    const {
      envelope: updatedEnvelope,
      period: updatedPeriod,
      goal: updatedGoal
    } = await recalculateEnvelopeAndPeriod(targetEnvelopeId, period._id);

    res.status(200).json({
      status: 'ok',
      transaction: toTransactionResponse(transaction),
      envelope: toEnvelopeResponse(updatedEnvelope),
      period: toBudgetPeriodResponse(updatedPeriod),
      ...(updatedGoal ? { goal: toSavingsGoalResponse(updatedGoal) } : {})
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Supprime une transaction et rétablit les montants sur l'enveloppe et la période.
 */
export async function deleteTransaction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { periodId, id } = req.params as z.infer<typeof transactionItemParamsSchema>;

    const { period } = await assertPeriodAccess(periodId, req.user?.id, {
      requireWrite: true
    });

    const transaction = await TransactionModel.findOne({ _id: id, budgetPeriodId: period._id });
    if (!transaction) {
      throw new AppError('Transaction introuvable', 404);
    }

    const envelopeId = transaction.envelopeId;
    await transaction.deleteOne();

    const {
      envelope: updatedEnvelope,
      period: updatedPeriod,
      goal: updatedGoal
    } = await recalculateEnvelopeAndPeriod(envelopeId, period._id);

    res.status(200).json({
      status: 'ok',
      deletedId: id,
      envelope: toEnvelopeResponse(updatedEnvelope),
      period: toBudgetPeriodResponse(updatedPeriod),
      ...(updatedGoal ? { goal: toSavingsGoalResponse(updatedGoal) } : {})
    });
  } catch (err) {
    next(err);
  }
}

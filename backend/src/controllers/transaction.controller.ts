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
import { computeBalanceReconciliation, importTransactionsBatch } from '../services/csvImport.service';
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
  notes: z.string().trim().max(300, 'Les notes ne doivent pas dépasser 300 caractères').optional(),
  tags: z.array(z.string().trim().max(32)).max(5).optional()
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
  notes: z
    .string()
    .trim()
    .max(300, 'Les notes ne doivent pas dépasser 300 caractères')
    .nullable()
    .optional(),
  tags: z.array(z.string().trim().max(32)).max(5).optional()
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
      ...(payload.notes ? { notes: payload.notes } : {}),
      ...(payload.tags
        ? {
            tags: Array.from(
              new Set(
                payload.tags
                  .map((t) => t.replace(/^#+/, '').trim().toLowerCase().replace(/\s+/g, '-'))
                  .filter(Boolean)
              )
            ).slice(0, 5)
          }
        : {})
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
    if (payload.notes !== undefined) {
      transaction.notes = payload.notes ? payload.notes : undefined;
    }
    if (payload.tags !== undefined) {
      transaction.tags = Array.from(
        new Set(
          payload.tags
            .map((t) => t.trim().toLowerCase().replace(/^#+/, ''))
            .filter(Boolean)
        )
      ).slice(0, 5);
    }
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
export const importTransactionsBodySchema = z.object({
  items: z
    .array(
      z.object({
        envelopeId: objectIdSchema,
        amount: z.coerce.number().positive('Le montant doit être strictement positif'),
        label: z
          .string()
          .trim()
          .min(1, 'Le libellé est requis')
          .max(100, 'Le libellé ne doit pas dépasser 100 caractères'),
        date: z.coerce.date(),
        paidByUserId: objectIdSchema.optional(),
        notes: z.string().trim().max(300).optional(),
        tags: z.array(z.string().trim().max(32)).max(5).optional()
      })
    )
    .max(500, 'Maximum 500 transactions par import')
});

export const reconcileBalanceBodySchema = z.object({
  bankBalance: z.coerce.number().finite('Le solde bancaire est invalide')
});

export async function importTransactions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { periodId } = req.params as z.infer<typeof transactionPeriodParamsSchema>;
    const body = req.body as z.infer<typeof importTransactionsBodySchema>;

    const { budget, period } = await assertPeriodAccess(periodId, req.user?.id, {
      requireWrite: true
    });

    const result = await importTransactionsBatch({
      budget,
      periodId: period._id,
      userId: req.user!.id,
      items: body.items
    });

    res.status(201).json({
      status: 'ok',
      ...result
    });
  } catch (err) {
    next(err);
  }
}

export async function reconcilePeriodBalance(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { periodId } = req.params as z.infer<typeof transactionPeriodParamsSchema>;
    const { bankBalance } = req.body as z.infer<typeof reconcileBalanceBodySchema>;

    const { period } = await assertPeriodAccess(periodId, req.user?.id, {
      requireWrite: false
    });

    const periodResponse = toBudgetPeriodResponse(period);
    const reconciliation = computeBalanceReconciliation(
      periodResponse.summary.remainingToLive,
      bankBalance
    );

    res.status(200).json({
      status: 'ok',
      reconciliation
    });
  } catch (err) {
    next(err);
  }
}

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

    const scope = req.query.scope === 'group' ? 'group' : 'single';
    const splitGroupId = transaction.splitGroupId;

    if (scope === 'group' && splitGroupId) {
      const groupTxs = await TransactionModel.find({
        budgetPeriodId: period._id,
        splitGroupId
      });
      const touchedEnvelopeIds = Array.from(
        new Set(groupTxs.map((tx) => tx.envelopeId.toString()))
      );
      await TransactionModel.deleteMany({ budgetPeriodId: period._id, splitGroupId });

      let latestPeriod = period;
      const updatedEnvelopes: ReturnType<typeof toEnvelopeResponse>[] = [];
      for (const envId of touchedEnvelopeIds) {
        const result = await recalculateEnvelopeAndPeriod(new Types.ObjectId(envId), period._id);
        updatedEnvelopes.push(toEnvelopeResponse(result.envelope));
        latestPeriod = result.period;
      }

      res.status(200).json({
        status: 'ok',
        deletedId: id,
        deletedGroupId: splitGroupId,
        envelopes: updatedEnvelopes,
        period: toBudgetPeriodResponse(latestPeriod)
      });
      return;
    }

    const envelopeId = transaction.envelopeId;
    await transaction.deleteOne();

    if (splitGroupId) {
      const remainingInGroup = await TransactionModel.find({
        budgetPeriodId: period._id,
        splitGroupId
      });
      if (remainingInGroup.length === 1) {
        remainingInGroup[0].splitGroupId = undefined;
        await remainingInGroup[0].save();
      }
    }

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


export const transactionSuggestionsParamsSchema = z.object({
  id: objectIdSchema
});

export async function getTransactionSuggestions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params as z.infer<typeof transactionSuggestionsParamsSchema>;
    const { assertBudgetAccess } = await import('../services/budgetAccess.service');
    await assertBudgetAccess(id, req.user?.id, { requireWrite: false });

    const recentTransactions = await TransactionModel.find({
      budgetId: new Types.ObjectId(id),
      type: 'expense'
    })
      .sort({ date: -1, createdAt: -1 })
      .limit(200)
      .select('label amount envelopeId date');

    const envelopeIds = Array.from(new Set(recentTransactions.map((tx) => tx.envelopeId.toString())));
    const envelopes = await EnvelopeModel.find({
      _id: { $in: envelopeIds.map((envId) => new Types.ObjectId(envId)) }
    }).select('name');
    const envelopeNameById = new Map(envelopes.map((env) => [env._id.toString(), env.name]));

    const grouped = new Map<
      string,
      { label: string; envelopeName: string; lastAmount: number; count: number }
    >();

    for (const tx of recentTransactions) {
      const envName = envelopeNameById.get(tx.envelopeId.toString());
      if (!envName) continue;
      const key = tx.label.trim().toLowerCase();
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          label: tx.label.trim(),
          envelopeName: envName,
          lastAmount: tx.amount,
          count: 1
        });
      } else {
        existing.count += 1;
      }
    }

    const suggestions = Array.from(grouped.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    res.status(200).json({
      status: 'ok',
      suggestions
    });
  } catch (err) {
    next(err);
  }
}


export const splitTransactionBodySchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Le libellé est requis')
    .max(100, 'Le libellé ne doit pas dépasser 100 caractères'),
  date: z.coerce.date().optional(),
  paidByUserId: objectIdSchema.optional(),
  notes: z.string().trim().max(300).optional(),
  parts: z
    .array(
      z.object({
        envelopeId: objectIdSchema,
        amount: z.coerce.number().positive('Chaque part doit être strictement positive')
      })
    )
    .min(2, 'Un fractionnement nécessite au moins 2 enveloppes')
});

export async function splitTransaction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { periodId } = req.params as z.infer<typeof transactionPeriodParamsSchema>;
    const body = req.body as z.infer<typeof splitTransactionBodySchema>;

    const { budget, period } = await assertPeriodAccess(periodId, req.user?.id, {
      requireWrite: true
    });

    const uniqueEnvelopeIds = Array.from(new Set(body.parts.map((p) => p.envelopeId)));
    if (uniqueEnvelopeIds.length < 2) {
      throw new AppError('Un fractionnement nécessite au moins 2 enveloppes distinctes', 400);
    }

    const envelopes = await EnvelopeModel.find({
      _id: { $in: uniqueEnvelopeIds.map((id) => new Types.ObjectId(id)) },
      budgetPeriodId: period._id
    });
    if (envelopes.length !== uniqueEnvelopeIds.length) {
      throw new AppError('Enveloppe introuvable dans cette période', 404);
    }

    const memberIds = new Set<string>([budget.ownerId.toString()]);
    for (const m of budget.members) {
      memberIds.add(m.userId.toString());
    }
    const paidByUserId = body.paidByUserId ?? req.user!.id;
    if (!memberIds.has(paidByUserId)) {
      throw new AppError('Le membre sélectionné ne fait pas partie de ce budget', 400);
    }

    const splitGroupId = new Types.ObjectId().toString();
    const txDate = body.date ?? new Date();
    const createdTransactions: ReturnType<typeof toTransactionResponse>[] = [];

    for (const part of body.parts) {
      const created = await TransactionModel.create({
        budgetId: budget._id,
        budgetPeriodId: period._id,
        envelopeId: new Types.ObjectId(part.envelopeId),
        authorId: new Types.ObjectId(req.user!.id),
        paidByUserId: new Types.ObjectId(paidByUserId),
        type: 'expense',
        amount: roundCurrency(part.amount),
        label: body.label.trim(),
        date: txDate,
        ...(body.notes ? { notes: body.notes.trim() } : {}),
        splitGroupId
      });
      createdTransactions.push(toTransactionResponse(created));
    }

    let latestPeriod = period;
    const updatedEnvelopes: ReturnType<typeof toEnvelopeResponse>[] = [];
    for (const envId of uniqueEnvelopeIds) {
      const result = await recalculateEnvelopeAndPeriod(new Types.ObjectId(envId), period._id);
      updatedEnvelopes.push(toEnvelopeResponse(result.envelope));
      latestPeriod = result.period;
    }

    res.status(201).json({
      status: 'ok',
      splitGroupId,
      transactions: createdTransactions,
      envelopes: updatedEnvelopes,
      period: toBudgetPeriodResponse(latestPeriod)
    });
  } catch (err) {
    next(err);
  }
}


export async function getPeriodAnomalies(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { periodId } = req.params as z.infer<typeof transactionPeriodParamsSchema>;
    const { budget, period } = await assertPeriodAccess(periodId, req.user?.id, {
      requireWrite: false
    });

    const { detectPeriodAnomalies } = await import('../services/anomalyDetection.service');
    const result = await detectPeriodAnomalies({
      budgetId: budget._id,
      periodId: period._id
    });

    res.status(200).json({
      status: 'ok',
      ...result
    });
  } catch (err) {
    next(err);
  }
}

export async function dismissTransactionAnomaly(
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

    transaction.isAnomalyDismissed = true;
    await transaction.save();

    res.status(200).json({
      status: 'ok',
      transactionId: id,
      isAnomalyDismissed: true
    });
  } catch (err) {
    next(err);
  }
}

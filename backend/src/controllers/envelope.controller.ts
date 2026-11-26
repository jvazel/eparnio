import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { propagateRecurringEnvelopeToFuturePeriods } from '../services/periodRollover.service';
import { AppError } from '../middlewares/error.middleware';
import { toBudgetPeriodResponse } from '../models/BudgetPeriod.model';
import { EnvelopeModel, toEnvelopeResponse } from '../models/Envelope.model';
import {
  type ISavingsGoal,
  SavingsGoalModel,
  toSavingsGoalResponse
} from '../models/SavingsGoal.model';
import { TransactionModel } from '../models/Transaction.model';
import { assertPeriodAccess } from '../services/budgetAccess.service';
import { syncLinkedAssetAccountForGoalDelta } from '../services/netWorth.service';
import {
  recalculatePeriodSummary,
  recalculateSavingsGoalCurrentAmount
} from '../services/remainingToLive.service';
import { roundCurrency } from '../services/zeroBasedBudget.service';
import { propagateEnvelopeRollover } from '../services/periodRollover.service';

const objectIdSchema = z
  .string()
  .refine((value) => Types.ObjectId.isValid(value), 'Identifiant invalide');

const pillarEnum = z.enum(['income', 'fixed_charge', 'variable_envelope', 'savings']);
const recurrenceFrequencyEnum = z.enum(['monthly', 'quarterly', 'semiannual', 'yearly']);

export const periodParamsSchema = z.object({
  periodId: objectIdSchema
});

export const envelopeItemParamsSchema = z.object({
  periodId: objectIdSchema,
  id: objectIdSchema
});

export const listEnvelopesQuerySchema = z.object({
  pillar: pillarEnum.optional()
});

export const createEnvelopeBodySchema = z.object({
  pillar: pillarEnum,
  name: z
    .string()
    .trim()
    .min(1, 'Le nom est requis')
    .max(80, 'Le nom ne doit pas dépasser 80 caractères'),
  allocatedAmount: z.coerce.number().min(0, 'Le montant doit être positif ou nul'),
  icon: z.string().trim().min(1).max(16).optional(),
  color: z.string().trim().min(1).max(32).optional(),
  date: z.coerce.date().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceFrequency: recurrenceFrequencyEnum.optional(),
  recurrenceEndDate: z.coerce.date().nullable().optional(),
  recurrenceRemainingCount: z.coerce.number().int().min(1).max(600).nullable().optional(),
  isPaid: z.boolean().optional(),
  rolloverEnabled: z.boolean().optional(),
  rolloverMode: z.enum(['positive_only', 'both']).optional(),
  memberId: objectIdSchema.optional(),
  linkedGoalId: objectIdSchema.optional()
});

export const updateEnvelopeBodySchema = z.object({
  name: z.string().trim().min(1, 'Le nom ne peut pas être vide').max(80).optional(),
  allocatedAmount: z.coerce.number().min(0, 'Le montant doit être positif ou nul').optional(),
  icon: z.string().trim().min(1).max(16).optional(),
  color: z.string().trim().min(1).max(32).optional(),
  date: z.coerce.date().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceFrequency: recurrenceFrequencyEnum.optional(),
  recurrenceEndDate: z.coerce.date().nullable().optional(),
  recurrenceRemainingCount: z.coerce.number().int().min(1).max(600).nullable().optional(),
  isPaid: z.boolean().optional(),
  rolloverEnabled: z.boolean().optional(),
  rolloverMode: z.enum(['positive_only', 'both']).optional(),
  order: z.coerce.number().int().min(0).optional(),
  memberId: objectIdSchema.nullable().optional(),
  linkedGoalId: objectIdSchema.nullable().optional()
});

export const reorderEnvelopesBodySchema = z.object({
  orderedIds: z.array(objectIdSchema).min(1, 'La liste des éléments à réorganiser est requise')
});

/**
 * Liste les postes/enveloppes d'une période, filtrables par pilier, triés par `order`.
 */
export async function listEnvelopes(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { periodId } = req.params as z.infer<typeof periodParamsSchema>;
    const { pillar } = req.query as z.infer<typeof listEnvelopesQuerySchema>;

    const { period } = await assertPeriodAccess(periodId, req.user?.id);

    const filter: Record<string, unknown> = { budgetPeriodId: period._id };
    if (pillar) {
      filter.pillar = pillar;
    }

    const envelopes = await EnvelopeModel.find(filter).sort({ order: 1, createdAt: 1 });
    const { computePeriodEnvelopesVariance } = await import(
      '../services/fixedChargeVariance.service'
    );
    const { varianceByEnvelopeId } = await computePeriodEnvelopesVariance(
      String(period._id),
      envelopes
    );

    res.status(200).json({
      status: 'ok',
      envelopes: envelopes.map((env) => {
        const base = toEnvelopeResponse(env);
        const variance = varianceByEnvelopeId.get(base.id);
        return variance ? { ...base, variance } : base;
      }),
      period: toBudgetPeriodResponse(period)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Crée un nouveau poste (revenu, charge fixe, enveloppe ou épargne) et recalcule le Base Zéro.
 */
export async function createEnvelope(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { periodId } = req.params as z.infer<typeof periodParamsSchema>;
    const payload = req.body as z.infer<typeof createEnvelopeBodySchema>;

    const { period } = await assertPeriodAccess(periodId, req.user?.id, { requireWrite: true });

    if (payload.linkedGoalId) {
      const targetGoal = await SavingsGoalModel.findOne({
        _id: payload.linkedGoalId,
        budgetId: period.budgetId
      });
      if (!targetGoal) {
        throw new AppError('Objectif d’épargne introuvable sur ce budget', 404);
      }
    }

    const lastInPillar = await EnvelopeModel.findOne({
      budgetPeriodId: period._id,
      pillar: payload.pillar
    }).sort({ order: -1 });

    const isRecurring = payload.isRecurring ?? false;
    const supportsAdvancedRecurrence = isRecurring && payload.pillar !== 'variable_envelope';

    const envelope = await EnvelopeModel.create({
      budgetId: period.budgetId,
      budgetPeriodId: period._id,
      pillar: payload.pillar,
      name: payload.name,
      allocatedAmount: roundCurrency(payload.allocatedAmount),
      spentOrPaidAmount: 0,
      icon:
        payload.icon ??
        (payload.pillar === 'income' ? '💵' : payload.pillar === 'savings' ? '🐷' : '💡'),
      color: payload.color ?? '#38BDF8',
      date: payload.date ?? new Date(),
      isRecurring,
      recurrenceFrequency: supportsAdvancedRecurrence
        ? (payload.recurrenceFrequency ?? 'monthly')
        : 'monthly',
      recurrenceEndDate: supportsAdvancedRecurrence
        ? (payload.recurrenceEndDate ?? undefined)
        : undefined,
      recurrenceRemainingCount: supportsAdvancedRecurrence
        ? (payload.recurrenceRemainingCount ?? undefined)
        : undefined,
      isPaid: payload.isPaid ?? false,
      rolloverEnabled: payload.pillar === 'variable_envelope' ? (payload.rolloverEnabled ?? false) : false,
      rolloverMode: payload.rolloverMode ?? 'positive_only',
      rolloverAmount: 0,
      memberId: payload.memberId,
      linkedGoalId: payload.linkedGoalId,
      order: (lastInPillar?.order ?? -1) + 1
    });

    const updatedPeriod = await recalculatePeriodSummary(period._id);
    const updatedGoal = envelope.linkedGoalId
      ? await recalculateSavingsGoalCurrentAmount(envelope.linkedGoalId)
      : null;

    if (updatedGoal && envelope.pillar === 'savings' && envelope.allocatedAmount > 0) {
      await syncLinkedAssetAccountForGoalDelta(
        updatedGoal,
        envelope.allocatedAmount,
        `Versement épargne : ${envelope.name}`
      );
    }

    await propagateRecurringEnvelopeToFuturePeriods(envelope, period);

    res.status(201).json({
      status: 'ok',
      envelope: toEnvelopeResponse(envelope),
      period: toBudgetPeriodResponse(updatedPeriod),
      ...(updatedGoal ? { goal: toSavingsGoalResponse(updatedGoal) } : {})
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Met à jour un poste budgétaire (montant, nom, date, icône, couleur, récurrence, pointage `isPaid`)
 * et recalcule les agrégats de la période.
 */
export async function updateEnvelope(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { periodId, id } = req.params as z.infer<typeof envelopeItemParamsSchema>;
    const payload = req.body as z.infer<typeof updateEnvelopeBodySchema>;

    const { period } = await assertPeriodAccess(periodId, req.user?.id, { requireWrite: true });

    const envelope = await EnvelopeModel.findOne({ _id: id, budgetPeriodId: period._id });
    if (!envelope) {
      throw new AppError('Poste budgétaire introuvable', 404);
    }

    const previousGoalId = envelope.linkedGoalId?.toString();
    const previousAllocatedAmount = envelope.allocatedAmount;

    if (payload.linkedGoalId) {
      const targetGoal = await SavingsGoalModel.findOne({
        _id: payload.linkedGoalId,
        budgetId: period.budgetId
      });
      if (!targetGoal) {
        throw new AppError('Objectif d’épargne introuvable sur ce budget', 404);
      }
    }

    if (payload.name !== undefined) envelope.name = payload.name;
    if (payload.allocatedAmount !== undefined) {
      envelope.allocatedAmount = roundCurrency(payload.allocatedAmount);
    }
    if (payload.icon !== undefined) envelope.icon = payload.icon;
    if (payload.color !== undefined) envelope.color = payload.color;
    if (payload.date !== undefined) envelope.date = payload.date;
    if (payload.isRecurring !== undefined) envelope.isRecurring = payload.isRecurring;
    if (envelope.pillar === 'variable_envelope' || !envelope.isRecurring) {
      envelope.recurrenceFrequency = 'monthly';
      envelope.recurrenceEndDate = undefined;
      envelope.recurrenceRemainingCount = undefined;
    } else {
      if (payload.recurrenceFrequency !== undefined) {
        envelope.recurrenceFrequency = payload.recurrenceFrequency;
      }
      if (payload.recurrenceEndDate !== undefined) {
        envelope.recurrenceEndDate = payload.recurrenceEndDate ?? undefined;
      }
      if (payload.recurrenceRemainingCount !== undefined) {
        envelope.recurrenceRemainingCount = payload.recurrenceRemainingCount ?? undefined;
      }
    }
    if (payload.isPaid !== undefined) envelope.isPaid = payload.isPaid;
    if (payload.rolloverEnabled !== undefined) envelope.rolloverEnabled = payload.rolloverEnabled;
    if (payload.rolloverMode !== undefined) envelope.rolloverMode = payload.rolloverMode;
    if (payload.order !== undefined) envelope.order = payload.order;
    if (payload.memberId !== undefined) {
      envelope.memberId = payload.memberId ? new Types.ObjectId(payload.memberId) : undefined;
    }
    if (payload.linkedGoalId !== undefined) {
      envelope.linkedGoalId = payload.linkedGoalId
        ? new Types.ObjectId(payload.linkedGoalId)
        : undefined;
    }

    await envelope.save();
    await propagateEnvelopeRollover(envelope._id);
    const updatedPeriod = await recalculatePeriodSummary(period._id);

    let updatedGoal: ISavingsGoal | null = null;
    const nextGoalId = envelope.linkedGoalId?.toString();
    if (previousGoalId && previousGoalId !== nextGoalId) {
      const prevGoal = await recalculateSavingsGoalCurrentAmount(previousGoalId);
      updatedGoal = prevGoal;
      if (prevGoal && envelope.pillar === 'savings' && previousAllocatedAmount > 0) {
        await syncLinkedAssetAccountForGoalDelta(
          prevGoal,
          -previousAllocatedAmount,
          `Retrait liaison épargne : ${envelope.name}`
        );
      }
    }
    if (envelope.linkedGoalId) {
      updatedGoal = await recalculateSavingsGoalCurrentAmount(envelope.linkedGoalId);
      if (updatedGoal && envelope.pillar === 'savings') {
        const delta =
          previousGoalId === nextGoalId
            ? roundCurrency(envelope.allocatedAmount - previousAllocatedAmount)
            : envelope.allocatedAmount;
        if (Math.abs(delta) >= 0.005) {
          await syncLinkedAssetAccountForGoalDelta(
            updatedGoal,
            delta,
            `Ajustement épargne : ${envelope.name}`
          );
        }
      }
    }

    await propagateRecurringEnvelopeToFuturePeriods(envelope, period);

    res.status(200).json({
      status: 'ok',
      envelope: toEnvelopeResponse(envelope),
      period: toBudgetPeriodResponse(updatedPeriod),
      ...(updatedGoal ? { goal: toSavingsGoalResponse(updatedGoal) } : {})
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Réorganise l'ordre d'affichage des postes via la liste ordonnée d'identifiants.
 */
export async function reorderEnvelopes(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { periodId } = req.params as z.infer<typeof periodParamsSchema>;
    const { orderedIds } = req.body as z.infer<typeof reorderEnvelopesBodySchema>;

    const { period } = await assertPeriodAccess(periodId, req.user?.id, { requireWrite: true });

    const operations = orderedIds.map((id, index) => ({
      updateOne: {
        filter: {
          _id: new Types.ObjectId(id),
          budgetPeriodId: period._id
        },
        update: { $set: { order: index } }
      }
    }));

    await EnvelopeModel.bulkWrite(operations);

    const updated = await EnvelopeModel.find({
      budgetPeriodId: period._id,
      _id: { $in: orderedIds }
    }).sort({ order: 1, createdAt: 1 });

    res.status(200).json({
      status: 'ok',
      envelopes: updated.map(toEnvelopeResponse)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Supprime un poste budgétaire et met à jour les agrégats `remainingToAllocate` et `remainingToLive`.
 */
export async function deleteEnvelope(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { periodId, id } = req.params as z.infer<typeof envelopeItemParamsSchema>;
    const { period } = await assertPeriodAccess(periodId, req.user?.id, { requireWrite: true });

    const envelope = await EnvelopeModel.findOne({ _id: id, budgetPeriodId: period._id });
    if (!envelope) {
      throw new AppError('Poste budgétaire introuvable', 404);
    }

    const linkedGoalId = envelope.linkedGoalId;

    await TransactionModel.deleteMany({ envelopeId: envelope._id, budgetPeriodId: period._id });
    await envelope.deleteOne();
    const updatedPeriod = await recalculatePeriodSummary(period._id);
    const updatedGoal = linkedGoalId
      ? await recalculateSavingsGoalCurrentAmount(linkedGoalId)
      : null;

    if (updatedGoal && envelope.pillar === 'savings' && envelope.allocatedAmount > 0) {
      await syncLinkedAssetAccountForGoalDelta(
        updatedGoal,
        -envelope.allocatedAmount,
        `Suppression versement épargne : ${envelope.name}`
      );
    }

    await propagateRecurringEnvelopeToFuturePeriods(envelope, period);

    res.status(200).json({
      status: 'ok',
      deletedId: id,
      period: toBudgetPeriodResponse(updatedPeriod),
      ...(updatedGoal ? { goal: toSavingsGoalResponse(updatedGoal) } : {})
    });
  } catch (err) {
    next(err);
  }
}

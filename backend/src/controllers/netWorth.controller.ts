import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middlewares/error.middleware';
import { AssetAccountModel } from '../models/AssetAccount.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { assertBudgetAccess } from '../services/budgetAccess.service';
import { recalculatePeriodSummary } from '../services/remainingToLive.service';
import {
  createAssetAccount,
  deleteAssetAccount,
  deleteAssetOperation,
  getBudgetNetWorth,
  importSavingsGoalsToAssets,
  recordAssetOperation,
  updateAssetAccount,
} from '../services/netWorth.service';

export const createAssetSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.enum(['cash', 'investment', 'real_estate', 'crypto', 'liability']),
  icon: z.string().trim().optional(),
  color: z.string().trim().optional(),
  currentBalance: z.number().min(0),
});

export const updateAssetSchema = createAssetSchema.partial();

export const recordAssetOperationSchema = z.object({
  mode: z.enum(['add', 'withdraw', 'set']),
  amount: z.number().min(0),
  label: z.string().trim().max(120).optional(),
  counterpartyType: z
    .enum(['external', 'asset', 'savings_goal', 'budget_period'])
    .optional(),
  counterpartyId: z.string().optional(),
  periodId: z.string().optional(),
});

export async function getNetWorthHandler(
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
    const netWorth = await getBudgetNetWorth(budgetId, userId);
    res.status(200).json({ status: 'ok', netWorth });
  } catch (err) {
    next(err);
  }
}

export async function createAssetHandler(
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
    const payload = req.body as z.infer<typeof createAssetSchema>;
    const asset = await createAssetAccount(budgetId, userId, payload);
    res.status(201).json({ status: 'ok', asset });
  } catch (err) {
    next(err);
  }
}

export async function updateAssetHandler(
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
    const { budgetId, assetId } = req.params as { budgetId: string; assetId: string };
    const payload = req.body as z.infer<typeof updateAssetSchema>;
    const asset = await updateAssetAccount(budgetId, assetId, userId, payload);
    res.status(200).json({ status: 'ok', asset });
  } catch (err) {
    next(err);
  }
}

export async function deleteAssetHandler(
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
    const { budgetId, assetId } = req.params as { budgetId: string; assetId: string };
    await deleteAssetAccount(budgetId, assetId, userId);
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
}

export async function deleteAssetOperationHandler(
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
    const { budgetId, assetId, operationId } = req.params as {
      budgetId: string;
      assetId: string;
      operationId: string;
    };
    const asset = await deleteAssetOperation(budgetId, assetId, operationId, userId);
    res.status(200).json({ status: 'ok', asset });
  } catch (err) {
    next(err);
  }
}

export async function importGoalsToAssetsHandler(
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
    const result = await importSavingsGoalsToAssets(budgetId, userId);
    res.status(200).json({ status: 'ok', ...result });
  } catch (err) {
    next(err);
  }
}

export async function recordAssetOperationHandler(
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
    const { budgetId, assetId } = req.params as { budgetId: string; assetId: string };
    const payload = req.body as z.infer<typeof recordAssetOperationSchema>;
    const asset = await recordAssetOperation(budgetId, assetId, userId, payload);
    res.status(200).json({ status: 'ok', asset });
  } catch (err) {
    next(err);
  }
}

export const updateCheckingBalanceSchema = z.object({
  balance: z.number().refine((v) => Number.isFinite(v), 'Solde invalide'),
  periodId: z.string().optional(),
  label: z.string().trim().max(120).optional()
});

/**
 * Ajuste directement le solde disponible (Reste à vivre) de la période active
 * en créant une ligne « Ajustement de solde » (revenu si positif, charge si négatif),
 * ou met à jour le compte courant patrimonial si `periodId` n'est pas fourni.
 */
export async function updateCheckingBalanceHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Authentification requise.', 401);
    }

    const { budgetId } = req.params as { budgetId: string };
    const { balance, periodId, label } = req.body as z.infer<typeof updateCheckingBalanceSchema>;
    const { budget, member } = await assertBudgetAccess(budgetId, userId);

    if (budget.ownerId.toString() !== userId && member?.role === 'viewer') {
      throw new AppError('Accès en lecture seule : impossible de modifier le solde', 403);
    }

    const roundedBalance = Math.round(balance * 100) / 100;
    const now = new Date();

    if (periodId) {
      const period = await BudgetPeriodModel.findOne({ _id: periodId, budgetId: budget._id });
      if (!period) {
        throw new AppError('Période budgétaire introuvable sur ce budget', 404);
      }

      const beforePeriod = await recalculatePeriodSummary(period._id);
      const currentRemaining = beforePeriod.summary.remainingToLive;
      const delta = Math.round((roundedBalance - currentRemaining) * 100) / 100;

      if (Math.abs(delta) >= 0.01) {
        await EnvelopeModel.create({
          budgetId: budget._id,
          budgetPeriodId: period._id,
          pillar: delta > 0 ? 'income' : 'fixed_charge',
          name: label || 'Ajustement de solde',
          icon: '⚖️',
          color: delta > 0 ? '#2563EB' : '#F59E0B',
          allocatedAmount: Math.abs(delta),
          spentOrPaidAmount: Math.abs(delta),
          date: now,
          isRecurring: false,
          recurrenceFrequency: 'monthly',
          isPaid: true
        });
      }

      const updatedPeriod = await recalculatePeriodSummary(period._id);

      res.status(200).json({
        status: 'ok',
        checkingAccount: {
          id: period._id.toString(),
          name: budget.name,
          currentBalance: updatedPeriod.summary.remainingToLive,
          delta,
          isCheckingAccount: true,
          updatedAt: now.toISOString()
        }
      });
      return;
    }

    let account = await AssetAccountModel.findOne({
      budgetId: budget._id,
      isCheckingAccount: true
    });

    if (account) {
      account.currentBalance = roundedBalance;
      account.history.push({ date: now, balance: roundedBalance });
      account.operations.push({
        date: now,
        type: 'set',
        amount: roundedBalance,
        label: label || 'Mise à jour du solde',
        balanceAfter: roundedBalance,
        counterpartyType: 'external'
      });
      await account.save();
    } else {
      account = await AssetAccountModel.create({
        budgetId: budget._id,
        name: 'Compte courant',
        category: 'cash',
        icon: '🏦',
        color: '#2563EB',
        isCheckingAccount: true,
        currentBalance: roundedBalance,
        history: [{ date: now, balance: roundedBalance }],
        operations: [
          {
            date: now,
            type: 'set',
            amount: roundedBalance,
            label: label || 'Solde initial du compte courant',
            balanceAfter: roundedBalance,
            counterpartyType: 'external'
          }
        ]
      });
    }

    res.status(200).json({
      status: 'ok',
      checkingAccount: {
        id: account._id.toString(),
        name: account.name,
        currentBalance: account.currentBalance,
        isCheckingAccount: true,
        updatedAt: account.updatedAt.toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
}

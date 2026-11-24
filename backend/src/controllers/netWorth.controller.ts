import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
  createAssetAccount,
  deleteAssetAccount,
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

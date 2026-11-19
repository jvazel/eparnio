import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { BudgetModel } from '../models/Budget.model';
import {
  type GlobalSearchFilterType,
  searchBudgetItems
} from '../services/search.service';

export const searchBudgetParamsSchema = z.object({
  id: z.string().refine((val) => Types.ObjectId.isValid(val), 'Identifiant de budget invalide')
});

export const searchBudgetQuerySchema = z.object({
  q: z.string().max(120).optional().default(''),
  type: z
    .enum(['all', 'variable_expense', 'fixed_charge', 'income', 'notes'])
    .optional()
    .default('all'),
  limit: z.coerce.number().int().min(1).max(50).optional().default(30)
});

export async function searchBudget(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Authentification requise.' });
    return;
  }

  const { id } = req.params as z.infer<typeof searchBudgetParamsSchema>;
  const { q, type, limit } = searchBudgetQuerySchema.parse(req.query);

  const budget = await BudgetModel.findOne({
    _id: new Types.ObjectId(id),
    'members.userId': new Types.ObjectId(userId)
  })
    .select('_id')
    .lean();

  if (!budget) {
    res.status(404).json({ message: 'Budget introuvable.' });
    return;
  }

  const result = await searchBudgetItems({
    budgetId: id,
    query: q,
    type: type as GlobalSearchFilterType,
    limit
  });

  res.json(result);
}

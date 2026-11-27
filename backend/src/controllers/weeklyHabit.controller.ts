import type { NextFunction, Request, Response } from 'express';
import { assertBudgetAccess } from './budget.controller';
import { getBudgetWeeklyHabit } from '../services/weeklyHabit.service';

export async function getWeeklyDigestHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    const budgetId = String(req.params.budgetId ?? '');

    if (!userId) {
      res.status(401).json({ message: 'Authentification requise.' });
      return;
    }

    const budget = await assertBudgetAccess(budgetId, userId);
    if (!budget) {
      res.status(403).json({ message: 'Accès refusé à cet espace budgétaire.' });
      return;
    }

    const data = await getBudgetWeeklyHabit(budgetId);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

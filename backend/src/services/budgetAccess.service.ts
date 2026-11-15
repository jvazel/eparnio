import { Types } from 'mongoose';
import { AppError } from '../middlewares/error.middleware';
import { BudgetModel, type IBudget, type IBudgetMember } from '../models/Budget.model';
import { BudgetPeriodModel, type IBudgetPeriod } from '../models/BudgetPeriod.model';

export interface BudgetAccessResult {
  budget: IBudget;
  member: IBudgetMember;
}

export interface PeriodAccessResult extends BudgetAccessResult {
  period: IBudgetPeriod;
}

/**
 * Vérifie que l'utilisateur appartient à l'espace budgétaire et possède les droits demandés.
 */
export async function assertBudgetAccess(
  budgetId: string | Types.ObjectId,
  userId: string | undefined,
  options: { requireWrite?: boolean } = {}
): Promise<BudgetAccessResult> {
  const budget = await BudgetModel.findById(budgetId);
  if (!budget) {
    throw new AppError('Espace budgétaire introuvable', 404);
  }

  const member = budget.members.find((m) => m.userId.toString() === userId);
  if (!member) {
    throw new AppError('Vous n’avez pas accès à cet espace budgétaire', 403);
  }

  if (options.requireWrite && member.role === 'viewer') {
    throw new AppError('Droits insuffisants pour modifier cet espace budgétaire', 403);
  }

  return { budget, member };
}

/**
 * Vérifie qu'une période existe et que l'utilisateur est membre de son budget parent.
 */
export async function assertPeriodAccess(
  periodId: string | Types.ObjectId,
  userId: string | undefined,
  options: { requireWrite?: boolean } = {}
): Promise<PeriodAccessResult> {
  if (!Types.ObjectId.isValid(periodId.toString())) {
    throw new AppError('Identifiant de période budgétaire invalide', 400);
  }

  const period = await BudgetPeriodModel.findById(periodId);
  if (!period) {
    throw new AppError('Période budgétaire introuvable', 404);
  }

  const { budget, member } = await assertBudgetAccess(period.budgetId, userId, options);
  return { period, budget, member };
}

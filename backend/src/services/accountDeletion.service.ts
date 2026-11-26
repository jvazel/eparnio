import { Types } from 'mongoose';
import { AssetAccountModel } from '../models/AssetAccount.model';
import { BudgetModel } from '../models/Budget.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { BudgetTemplateModel } from '../models/BudgetTemplate.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { PayeeRuleModel } from '../models/PayeeRule.model';
import { PushSubscriptionModel } from '../models/PushSubscription.model';
import { SavingsGoalModel } from '../models/SavingsGoal.model';
import { TransactionModel } from '../models/Transaction.model';
import { UserModel } from '../models/User.model';
import { disconnectUserFromBudget } from './realtime.service';

export interface AccountDeletionSummary {
  deletedBudgetsCount: number;
  transferredBudgetsCount: number;
  leftSharedBudgetsCount: number;
}

/**
 * Supprime définitivement un compte utilisateur et ses données (RGPD Art. 17) :
 * - Budgets personnels ou sans autre membre : suppression en cascade complète.
 * - Budgets partagés dont l'utilisateur est `owner` avec d'autres membres : transfert automatique
 *   de propriété au premier `editor` (ou premier membre restant).
 * - Budgets partagés dont l'utilisateur est simple membre : retrait sans altérer le foyer.
 */
export async function deleteUserAccountCascade(userId: string): Promise<AccountDeletionSummary> {
  const userObjectId = new Types.ObjectId(userId);

  const budgets = await BudgetModel.find({
    $or: [{ ownerId: userObjectId }, { 'members.userId': userObjectId }]
  });

  let deletedBudgetsCount = 0;
  let transferredBudgetsCount = 0;
  let leftSharedBudgetsCount = 0;

  for (const budget of budgets) {
    const budgetIdStr = budget._id.toString();
    disconnectUserFromBudget(budgetIdStr, userId);

    const otherMembers = budget.members.filter((m) => m.userId.toString() !== userId);

    if (budget.type === 'personal' || otherMembers.length === 0) {
      await Promise.all([
        TransactionModel.deleteMany({ budgetId: budget._id }),
        EnvelopeModel.deleteMany({ budgetId: budget._id }),
        SavingsGoalModel.deleteMany({ budgetId: budget._id }),
        AssetAccountModel.deleteMany({ budgetId: budget._id }),
        BudgetPeriodModel.deleteMany({ budgetId: budget._id }),
        BudgetTemplateModel.deleteMany({ budgetId: budget._id }),
        PayeeRuleModel.deleteMany({ budgetId: budget._id }),
        BudgetModel.deleteOne({ _id: budget._id })
      ]);
      deletedBudgetsCount += 1;
    } else if (budget.ownerId.toString() === userId) {
      const nextOwner =
        otherMembers.find((m) => m.role === 'editor') ?? otherMembers[0];

      budget.ownerId = nextOwner.userId;
      budget.members = otherMembers.map((m) => ({
        userId: m.userId,
        role: m.userId.equals(nextOwner.userId) ? 'owner' : m.role,
        color: m.color,
        declaredMonthlyIncome: m.declaredMonthlyIncome,
        joinedAt: m.joinedAt
      }));
      await budget.save();
      transferredBudgetsCount += 1;
    } else {
      budget.members = otherMembers;
      await budget.save();
      leftSharedBudgetsCount += 1;
    }
  }

  await Promise.all([
    PushSubscriptionModel.deleteMany({ userId: userObjectId }),
    UserModel.deleteOne({ _id: userObjectId })
  ]);

  return {
    deletedBudgetsCount,
    transferredBudgetsCount,
    leftSharedBudgetsCount
  };
}

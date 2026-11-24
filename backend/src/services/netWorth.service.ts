import {
  AssetAccountModel,
  type AssetCategory,
  type AssetCounterpartyType,
  type AssetOperationType,
} from '../models/AssetAccount.model';
import { BudgetModel } from '../models/Budget.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { SavingsGoalModel } from '../models/SavingsGoal.model';
import { recalculatePeriodSummary } from './remainingToLive.service';
import { roundCurrency } from './zeroBasedBudget.service';

export interface LinkedGoalSummary {
  id: string;
  name: string;
  icon: string;
  currentAmount: number;
}

export interface AssetOperationDTO {
  id: string;
  date: string;
  type: AssetOperationType;
  amount: number;
  label: string;
  balanceAfter: number;
  counterpartyType: AssetCounterpartyType;
  counterpartyId?: string;
  counterpartyName?: string;
}

export interface AssetAccountDTO {
  id: string;
  budgetId: string;
  name: string;
  category: AssetCategory;
  icon: string;
  color: string;
  currentBalance: number;
  linkedGoals: LinkedGoalSummary[];
  operations: AssetOperationDTO[];
  updatedAt: string;
}

export interface NetWorthResponse {
  budgetId: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  byCategory: Array<{ category: AssetCategory; label: string; amount: number }>;
  history: Array<{ dateKey: string; netWorth: number }>;
  accounts: AssetAccountDTO[];
}

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  cash: 'Liquidités',
  investment: 'Placements',
  real_estate: 'Immobilier',
  crypto: 'Crypto',
  liability: 'Crédits / Passifs',
};

async function assertBudgetMember(budgetId: string, userId: string) {
  const budget = await BudgetModel.findOne({
    _id: budgetId,
    'members.userId': userId,
  })
    .select('_id')
    .lean();
  if (!budget) {
    throw new Error('Budget introuvable ou accès refusé.');
  }
}

export async function getBudgetNetWorth(
  budgetId: string,
  userId: string
): Promise<NetWorthResponse> {
  await assertBudgetMember(budgetId, userId);

  const [accounts, goals] = await Promise.all([
    AssetAccountModel.find({ budgetId }).sort({ category: 1, name: 1 }).lean(),
    SavingsGoalModel.find({ budgetId, assetAccountId: { $exists: true, $ne: null } })
      .select('_id name icon currentAmount assetAccountId')
      .lean(),
  ]);

  const goalsByAsset = new Map<string, LinkedGoalSummary[]>();
  for (const g of goals) {
    const aId = g.assetAccountId ? String(g.assetAccountId) : '';
    if (!aId) continue;
    const list = goalsByAsset.get(aId) ?? [];
    list.push({
      id: String(g._id),
      name: g.name,
      icon: g.icon || '🎯',
      currentAmount: roundCurrency(g.currentAmount || 0),
    });
    goalsByAsset.set(aId, list);
  }

  let totalAssets = 0;
  let totalLiabilities = 0;
  const catTotals = new Map<AssetCategory, number>();
  const historyMap = new Map<string, number>();

  const accountDTOs: AssetAccountDTO[] = accounts.map((acc) => {
    const bal = roundCurrency(acc.currentBalance || 0);
    if (acc.category === 'liability') {
      totalLiabilities = roundCurrency(totalLiabilities + bal);
    } else {
      totalAssets = roundCurrency(totalAssets + bal);
    }
    catTotals.set(acc.category, roundCurrency((catTotals.get(acc.category) ?? 0) + bal));

    for (const pt of acc.history ?? []) {
      const key = new Date(pt.date).toISOString().slice(0, 10);
      const signed = acc.category === 'liability' ? -(pt.balance || 0) : pt.balance || 0;
      historyMap.set(key, roundCurrency((historyMap.get(key) ?? 0) + signed));
    }

    return {
      id: String(acc._id),
      budgetId: String(acc.budgetId),
      name: acc.name,
      category: acc.category,
      icon: acc.icon || '🏦',
      color: acc.color || '#3B82F6',
      currentBalance: bal,
      linkedGoals: goalsByAsset.get(String(acc._id)) ?? [],
      operations: [...(acc.operations ?? [])]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map((op) => ({
          id: String(op._id ?? ''),
          date: new Date(op.date).toISOString(),
          type: op.type,
          amount: roundCurrency(op.amount),
          label: op.label,
          balanceAfter: roundCurrency(op.balanceAfter),
          counterpartyType: op.counterpartyType,
          counterpartyId: op.counterpartyId,
          counterpartyName: op.counterpartyName,
        })),
      updatedAt: new Date(acc.updatedAt).toISOString(),
    };
  });

  const byCategory = Array.from(catTotals.entries()).map(([category, amount]) => ({
    category,
    label: CATEGORY_LABELS[category],
    amount,
  }));

  const history = Array.from(historyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, netWorth]) => ({ dateKey, netWorth }));

  return {
    budgetId,
    totalAssets,
    totalLiabilities,
    netWorth: roundCurrency(totalAssets - totalLiabilities),
    byCategory,
    history,
    accounts: accountDTOs,
  };
}

export async function createAssetAccount(
  budgetId: string,
  userId: string,
  input: {
    name: string;
    category: AssetCategory;
    icon?: string;
    color?: string;
    currentBalance: number;
  }
) {
  await assertBudgetMember(budgetId, userId);
  const balance = roundCurrency(input.currentBalance);
  const account = await AssetAccountModel.create({
    budgetId,
    name: input.name.trim(),
    category: input.category,
    icon: input.icon || '🏦',
    color: input.color || '#3B82F6',
    currentBalance: balance,
    history: [{ date: new Date(), balance }],
  });
  return account;
}

export async function updateAssetAccount(
  budgetId: string,
  assetId: string,
  userId: string,
  updates: {
    name?: string;
    category?: AssetCategory;
    icon?: string;
    color?: string;
    currentBalance?: number;
  }
) {
  await assertBudgetMember(budgetId, userId);
  const account = await AssetAccountModel.findOne({ _id: assetId, budgetId });
  if (!account) {
    throw new Error('Compte patrimonial introuvable.');
  }

  if (updates.name !== undefined) account.name = updates.name.trim();
  if (updates.category !== undefined) account.category = updates.category;
  if (updates.icon !== undefined) account.icon = updates.icon;
  if (updates.color !== undefined) account.color = updates.color;
  if (updates.currentBalance !== undefined) {
    const nextBalance = roundCurrency(updates.currentBalance);
    account.currentBalance = nextBalance;
    account.history.push({ date: new Date(), balance: nextBalance });
  }

  await account.save();
  return account;
}

export async function deleteAssetAccount(
  budgetId: string,
  assetId: string,
  userId: string
): Promise<void> {
  await assertBudgetMember(budgetId, userId);
  await AssetAccountModel.deleteOne({ _id: assetId, budgetId });
  await SavingsGoalModel.updateMany(
    { budgetId, assetAccountId: assetId },
    { $unset: { assetAccountId: 1 } }
  );
}

export async function importSavingsGoalsToAssets(
  budgetId: string,
  userId: string
): Promise<{ importedCount: number }> {
  await assertBudgetMember(budgetId, userId);
  const unlinkedGoals = await SavingsGoalModel.find({
    budgetId,
    $or: [{ assetAccountId: { $exists: false } }, { assetAccountId: null }],
  });

  let importedCount = 0;
  for (const goal of unlinkedGoals) {
    const balance = roundCurrency(goal.currentAmount || 0);
    const account = await AssetAccountModel.create({
      budgetId,
      name: goal.name,
      category: 'cash',
      icon: goal.icon || '🏦',
      color: goal.color || '#3B82F6',
      currentBalance: balance,
      history: [{ date: new Date(), balance }],
    });
    goal.assetAccountId = account._id;
    await goal.save();
    importedCount += 1;
  }

  return { importedCount };
}

export async function recordAssetOperation(
  budgetId: string,
  assetId: string,
  userId: string,
  input: {
    mode: 'add' | 'withdraw' | 'set';
    amount: number;
    label?: string;
    counterpartyType?: AssetCounterpartyType;
    counterpartyId?: string;
    periodId?: string;
  }
) {
  await assertBudgetMember(budgetId, userId);

  const account = await AssetAccountModel.findOne({ _id: assetId, budgetId });
  if (!account) {
    throw new Error('Compte patrimonial introuvable.');
  }

  const now = new Date();
  const safeAmount = roundCurrency(Math.max(0, input.amount));
  const counterpartyType: AssetCounterpartyType = input.counterpartyType ?? 'external';
  const defaultLabel =
    input.mode === 'add'
      ? 'Ajout manuel'
      : input.mode === 'withdraw'
        ? 'Retrait manuel'
        : 'Mise à jour du solde';
  const label = input.label?.trim() || defaultLabel;

  const prevBalance = roundCurrency(account.currentBalance || 0);
  const nextBalance =
    input.mode === 'add'
      ? roundCurrency(prevBalance + safeAmount)
      : input.mode === 'withdraw'
        ? roundCurrency(Math.max(0, prevBalance - safeAmount))
        : safeAmount;

  let counterpartyName: string | undefined;

  if (counterpartyType === 'asset' && input.counterpartyId && input.mode !== 'set') {
    const other = await AssetAccountModel.findOne({
      _id: input.counterpartyId,
      budgetId,
    });
    if (!other) {
      throw new Error('Compte contrepartie introuvable.');
    }
    counterpartyName = other.name;
    const otherDelta = input.mode === 'add' ? -safeAmount : safeAmount;
    const otherNext = roundCurrency(Math.max(0, (other.currentBalance || 0) + otherDelta));
    other.currentBalance = otherNext;
    other.history.push({ date: now, balance: otherNext });
    other.operations.push({
      date: now,
      type: input.mode === 'add' ? 'transfer_out' : 'transfer_in',
      amount: safeAmount,
      label,
      balanceAfter: otherNext,
      counterpartyType: 'asset',
      counterpartyId: String(account._id),
      counterpartyName: account.name,
    });
    await other.save();
  } else if (
    counterpartyType === 'savings_goal' &&
    input.counterpartyId &&
    input.mode !== 'set'
  ) {
    const goal = await SavingsGoalModel.findOne({
      _id: input.counterpartyId,
      budgetId,
    });
    if (!goal) {
      throw new Error('Objectif d’épargne introuvable.');
    }
    counterpartyName = goal.name;
    // Si on ajoute au patrimoine depuis l'épargne -> on retire de l'épargne
    // Si on retire du patrimoine vers l'épargne -> on ajoute à l'épargne
    const goalDelta = input.mode === 'add' ? -safeAmount : safeAmount;
    goal.currentAmount = roundCurrency(Math.max(0, (goal.currentAmount || 0) + goalDelta));
    await goal.save();
  } else if (
    counterpartyType === 'budget_period' &&
    input.periodId &&
    input.mode !== 'set'
  ) {
    counterpartyName = 'Budget du mois';
    if (input.mode === 'add') {
      // Versement du restant à répartir vers le patrimoine -> crée une enveloppe savings
      await EnvelopeModel.create({
        budgetId,
        budgetPeriodId: input.periodId,
        pillar: 'savings',
        name: `${account.name} (${label})`,
        icon: account.icon || '🏦',
        color: account.color || '#06B6D4',
        allocatedAmount: safeAmount,
        spentOrPaidAmount: 0,
        isPaid: true,
        date: now,
      });
    } else {
      // Retrait du patrimoine vers le budget du mois -> crée un revenu
      await EnvelopeModel.create({
        budgetId,
        budgetPeriodId: input.periodId,
        pillar: 'income',
        name: `Retrait ${account.name} (${label})`,
        icon: account.icon || '💵',
        color: '#22C55E',
        allocatedAmount: safeAmount,
        spentOrPaidAmount: 0,
        isPaid: true,
        date: now,
      });
    }
    await recalculatePeriodSummary(input.periodId);
  }

  account.currentBalance = nextBalance;
  account.history.push({ date: now, balance: nextBalance });
  account.operations.push({
    date: now,
    type:
      counterpartyType === 'asset' && input.mode !== 'set'
        ? input.mode === 'add'
          ? 'transfer_in'
          : 'transfer_out'
        : input.mode,
    amount: safeAmount,
    label,
    balanceAfter: nextBalance,
    counterpartyType,
    counterpartyId: input.counterpartyId,
    counterpartyName,
  });

  await account.save();
  return account;
}

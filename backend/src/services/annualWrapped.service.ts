import { AssetAccountModel } from '../models/AssetAccount.model';
import { BudgetModel } from '../models/Budget.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel, type IEnvelope } from '../models/Envelope.model';
import { TransactionModel, type ITransaction } from '../models/Transaction.model';
import { UserModel } from '../models/User.model';
import { roundCurrency } from './zeroBasedBudget.service';

export interface WrappedTopEnvelope {
  name: string;
  icon: string;
  color: string;
  totalSpent: number;
}

export interface WrappedBestMonth {
  periodId: string;
  label: string;
  month: number;
  remainingToLive: number;
}

export interface WrappedTagItem {
  tag: string;
  totalSpent: number;
  count: number;
}

export interface WrappedMemberItem {
  userId: string;
  displayName: string;
  avatarEmoji: string;
  incomeContributed: number;
  expensesPaid: number;
}

export interface AnnualWrappedResponse {
  budgetId: string;
  budgetName: string;
  budgetType: 'personal' | 'shared';
  year: number;
  availableYears: number[];
  periodsCount: number;
  macro: {
    totalIncome: number;
    totalFixedCharges: number;
    totalVariableSpent: number;
    totalSaved: number;
    savingsRate: number;
  };
  highlights: {
    bestMonth: WrappedBestMonth | null;
    topEnvelopes: WrappedTopEnvelope[];
    bestControlledEnvelope: {
      name: string;
      icon: string;
      usagePercentage: number;
    } | null;
    zeroBasedScore: number;
  };
  topTags: WrappedTagItem[];
  memberBreakdown: WrappedMemberItem[];
  patrimoine?: {
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
  };
}

export async function getAnnualWrapped(
  budgetId: string,
  userId: string,
  requestedYear?: number
): Promise<AnnualWrappedResponse> {
  const budget = await BudgetModel.findOne({
    _id: budgetId,
    'members.userId': userId,
  }).lean();

  if (!budget) {
    throw new Error('Budget introuvable ou accès refusé.');
  }

  const allPeriods = await BudgetPeriodModel.find({ budgetId })
    .select('_id year month label summary')
    .sort({ year: 1, month: 1 })
    .lean();

  const availableYears = Array.from(new Set(allPeriods.map((p) => p.year))).sort(
    (a, b) => a - b
  );
  const year = requestedYear ?? new Date().getUTCFullYear();
  const periods = allPeriods.filter((p) => p.year === year);

  if (periods.length === 0) {
    return {
      budgetId: String(budget._id),
      budgetName: budget.name,
      budgetType: budget.type as 'personal' | 'shared',
      year,
      availableYears,
      periodsCount: 0,
      macro: {
        totalIncome: 0,
        totalFixedCharges: 0,
        totalVariableSpent: 0,
        totalSaved: 0,
        savingsRate: 0,
      },
      highlights: {
        bestMonth: null,
        topEnvelopes: [],
        bestControlledEnvelope: null,
        zeroBasedScore: 0,
      },
      topTags: [],
      memberBreakdown: [],
    };
  }

  const periodIds = periods.map((p) => p._id);

  const [envelopes, transactions, assetAccounts] = await Promise.all([
    EnvelopeModel.find({ budgetPeriodId: { $in: periodIds } }).lean<IEnvelope[]>(),
    TransactionModel.find({ budgetPeriodId: { $in: periodIds } }).lean<ITransaction[]>(),
    AssetAccountModel.find({ budgetId }).lean(),
  ]);

  let totalAssets = 0;
  let totalLiabilities = 0;
  for (const acc of assetAccounts) {
    if (acc.category === 'liability') {
      totalLiabilities += acc.currentBalance || 0;
    } else {
      totalAssets += acc.currentBalance || 0;
    }
  }
  totalAssets = roundCurrency(totalAssets);
  totalLiabilities = roundCurrency(totalLiabilities);

  let totalIncome = 0;
  let totalFixedCharges = 0;
  let totalVariableSpent = 0;
  let totalSaved = 0;

  const envAgg = new Map<
    string,
    { name: string; icon: string; color: string; allocated: number; spent: number }
  >();

  for (const env of envelopes) {
    if (env.pillar === 'income') {
      totalIncome += env.allocatedAmount || 0;
    } else if (env.pillar === 'fixed_charge') {
      totalFixedCharges += env.allocatedAmount || 0;
    } else if (env.pillar === 'savings') {
      totalSaved += env.allocatedAmount || 0;
    } else if (env.pillar === 'variable_envelope') {
      const spent = env.spentOrPaidAmount || 0;
      totalVariableSpent += spent;
      const key = env.name.trim().toLowerCase();
      const prev = envAgg.get(key) ?? {
        name: env.name,
        icon: env.icon || '🛒',
        color: env.color || '#3B82F6',
        allocated: 0,
        spent: 0,
      };
      prev.allocated += env.allocatedAmount || 0;
      prev.spent += spent;
      envAgg.set(key, prev);
    }
  }

  totalIncome = roundCurrency(totalIncome);
  totalFixedCharges = roundCurrency(totalFixedCharges);
  totalVariableSpent = roundCurrency(totalVariableSpent);
  totalSaved = roundCurrency(totalSaved);

  const savingsRate =
    totalIncome > 0 ? Math.round((totalSaved / totalIncome) * 1000) / 10 : 0;

  // Meilleur mois & score Base Zéro
  let bestMonth: WrappedBestMonth | null = null;
  let zeroBasedScore = 0;

  for (const p of periods) {
    const rtl = p.summary?.remainingToLive ?? 0;
    const rta = p.summary?.remainingToAllocate ?? 0;
    if (Math.abs(rta) < 0.01) {
      zeroBasedScore += 1;
    }
    if (!bestMonth || rtl > bestMonth.remainingToLive) {
      bestMonth = {
        periodId: String(p._id),
        label: p.label,
        month: p.month,
        remainingToLive: roundCurrency(rtl),
      };
    }
  }

  // Top 3 enveloppes les plus dépensées
  const topEnvelopes: WrappedTopEnvelope[] = Array.from(envAgg.values())
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 3)
    .map((e) => ({
      name: e.name,
      icon: e.icon,
      color: e.color,
      totalSpent: roundCurrency(e.spent),
    }));

  // Enveloppe la mieux maîtrisée (alloué > 0 et <= 100%, la plus proche ou sous contrôle)
  const controlledCandidates = Array.from(envAgg.values())
    .filter((e) => e.allocated > 0 && e.spent <= e.allocated)
    .map((e) => ({
      name: e.name,
      icon: e.icon,
      usagePercentage: Math.round((e.spent / e.allocated) * 100),
    }))
    .sort((a, b) => a.usagePercentage - b.usagePercentage);

  const bestControlledEnvelope = controlledCandidates[0] ?? null;

  // Top tags
  const tagMap = new Map<string, { totalSpent: number; count: number }>();
  for (const tx of transactions) {
    for (const tag of tx.tags ?? []) {
      const prev = tagMap.get(tag) ?? { totalSpent: 0, count: 0 };
      prev.totalSpent += tx.amount || 0;
      prev.count += 1;
      tagMap.set(tag, prev);
    }
  }
  const topTags: WrappedTagItem[] = Array.from(tagMap.entries())
    .map(([tag, info]) => ({
      tag,
      totalSpent: roundCurrency(info.totalSpent),
      count: info.count,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5);

  // Bilan par membre si budget partagé
  const memberBreakdown: WrappedMemberItem[] = [];
  if (budget.type === 'shared' && budget.members?.length) {
    const memberIds = budget.members.map((m) => String(m.userId));
    const users = await UserModel.find({ _id: { $in: memberIds } })
      .select('_id displayName avatarEmoji')
      .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const stats = new Map<string, { income: number; expenses: number }>();
    for (const id of memberIds) {
      stats.set(id, { income: 0, expenses: 0 });
    }

    for (const env of envelopes) {
      const mId = env.memberId ? String(env.memberId) : null;
      if (!mId || !stats.has(mId)) continue;
      const entry = stats.get(mId)!;
      if (env.pillar === 'income') entry.income += env.allocatedAmount || 0;
      if (env.pillar === 'fixed_charge') entry.expenses += env.allocatedAmount || 0;
    }

    for (const tx of transactions) {
      const mId = tx.paidByUserId ? String(tx.paidByUserId) : null;
      if (!mId || !stats.has(mId)) continue;
      stats.get(mId)!.expenses += tx.amount || 0;
    }

    for (const id of memberIds) {
      const u = userMap.get(id);
      const st = stats.get(id)!;
      memberBreakdown.push({
        userId: id,
        displayName: u?.displayName || 'Membre',
        avatarEmoji: u?.avatarEmoji || '👤',
        incomeContributed: roundCurrency(st.income),
        expensesPaid: roundCurrency(st.expenses),
      });
    }
  }

  return {
    budgetId: String(budget._id),
    budgetName: budget.name,
    budgetType: budget.type as 'personal' | 'shared',
    year,
    availableYears,
    periodsCount: periods.length,
    macro: {
      totalIncome,
      totalFixedCharges,
      totalVariableSpent,
      totalSaved,
      savingsRate,
    },
    highlights: {
      bestMonth,
      topEnvelopes,
      bestControlledEnvelope,
      zeroBasedScore,
    },
    topTags,
    memberBreakdown,
    patrimoine: {
      totalAssets,
      totalLiabilities,
      netWorth: roundCurrency(totalAssets - totalLiabilities),
    },
  };
}

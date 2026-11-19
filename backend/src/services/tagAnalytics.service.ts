import { Types } from 'mongoose';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { TransactionModel } from '../models/Transaction.model';

export interface TagSummaryItem {
  tag: string;
  totalAmount: number;
  count: number;
}

export interface TagEnvelopeBreakdown {
  envelopeId: string;
  envelopeName: string;
  envelopeIcon: string;
  envelopeColor: string;
  amount: number;
  percentage: number;
}

export interface TagMonthlyPoint {
  year: number;
  month: number;
  label: string;
  amount: number;
}

export interface TagTransactionItem {
  id: string;
  label: string;
  amount: number;
  date: string;
  envelopeId: string;
  envelopeName: string;
  envelopeIcon: string;
  envelopeColor: string;
  month: number;
  year: number;
}

export interface TagDetailAnalytics {
  tag: string;
  totalAmount: number;
  count: number;
  byEnvelope: TagEnvelopeBreakdown[];
  byMonth: TagMonthlyPoint[];
  transactions: TagTransactionItem[];
}

const SHORT_MONTHS = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Août',
  'Sep',
  'Oct',
  'Nov',
  'Déc'
];

export async function getBudgetTagsSummary(budgetId: string): Promise<TagSummaryItem[]> {
  const budgetObjectId = new Types.ObjectId(budgetId);
  const transactions = await TransactionModel.find({
    budgetId: budgetObjectId,
    tags: { $exists: true, $ne: [] }
  })
    .select('tags amount type')
    .lean();

  const map = new Map<string, { totalAmount: number; count: number }>();

  for (const tx of transactions) {
    const signedAmount = tx.amount;
    for (const rawTag of tx.tags ?? []) {
      const tag = rawTag.trim().toLowerCase();
      if (!tag) continue;
      const current = map.get(tag) ?? { totalAmount: 0, count: 0 };
      current.totalAmount = Math.round((current.totalAmount + signedAmount) * 100) / 100;
      current.count += 1;
      map.set(tag, current);
    }
  }

  return Array.from(map.entries())
    .map(([tag, stats]) => ({
      tag,
      totalAmount: Math.max(0, stats.totalAmount),
      count: stats.count
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

export async function getBudgetTagDetailAnalytics(
  budgetId: string,
  rawTag: string
): Promise<TagDetailAnalytics> {
  const tag = rawTag.replace(/^#+/, '').trim().toLowerCase();
  const budgetObjectId = new Types.ObjectId(budgetId);

  const transactions = await TransactionModel.find({
    budgetId: budgetObjectId,
    tags: { $in: [tag] }
  })
    .sort({ date: -1 })
    .lean();

  if (transactions.length === 0) {
    return {
      tag,
      totalAmount: 0,
      count: 0,
      byEnvelope: [],
      byMonth: [],
      transactions: []
    };
  }

  const envelopeIds = Array.from(new Set(transactions.map((t) => t.envelopeId.toString()))).map(
    (id) => new Types.ObjectId(id)
  );
  const periodIds = Array.from(new Set(transactions.map((t) => t.budgetPeriodId.toString()))).map(
    (id) => new Types.ObjectId(id)
  );

  const [envelopes, periods] = await Promise.all([
    EnvelopeModel.find({ _id: { $in: envelopeIds } }).lean(),
    BudgetPeriodModel.find({ _id: { $in: periodIds } }).lean()
  ]);

  const envelopeMap = new Map(envelopes.map((e) => [e._id.toString(), e]));
  const periodMap = new Map(periods.map((p) => [p._id.toString(), p]));

  let totalAmount = 0;
  const byEnvelopeMap = new Map<string, TagEnvelopeBreakdown>();
  const byMonthMap = new Map<string, TagMonthlyPoint>();
  const txItems: TagTransactionItem[] = [];

  for (const tx of transactions) {
    const signedAmount = tx.amount;
    totalAmount = Math.round((totalAmount + signedAmount) * 100) / 100;

    const envId = tx.envelopeId.toString();
    const env = envelopeMap.get(envId);
    const envName = env?.name ?? 'Enveloppe';
    const envIcon = env?.icon ?? '📦';
    const envColor = env?.color ?? '#3B82F6';

    const existingEnv = byEnvelopeMap.get(envId) ?? {
      envelopeId: envId,
      envelopeName: envName,
      envelopeIcon: envIcon,
      envelopeColor: envColor,
      amount: 0,
      percentage: 0
    };
    existingEnv.amount = Math.round((existingEnv.amount + signedAmount) * 100) / 100;
    byEnvelopeMap.set(envId, existingEnv);

    const period = periodMap.get(tx.budgetPeriodId.toString());
    const year = period?.year ?? tx.date.getUTCFullYear();
    const month = period?.month ?? tx.date.getUTCMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const existingMonth = byMonthMap.get(monthKey) ?? {
      year,
      month,
      label: `${SHORT_MONTHS[month - 1] ?? month} ${String(year).slice(-2)}`,
      amount: 0
    };
    existingMonth.amount = Math.round((existingMonth.amount + signedAmount) * 100) / 100;
    byMonthMap.set(monthKey, existingMonth);

    txItems.push({
      id: tx._id.toString(),
      label: tx.label,
      amount: tx.amount,
      date: tx.date.toISOString(),
      envelopeId: envId,
      envelopeName: envName,
      envelopeIcon: envIcon,
      envelopeColor: envColor,
      month,
      year
    });
  }

  const safeTotal = Math.max(0, totalAmount);
  const byEnvelope = Array.from(byEnvelopeMap.values())
    .map((item) => ({
      ...item,
      amount: Math.max(0, item.amount),
      percentage:
        safeTotal > 0 ? Math.round((Math.max(0, item.amount) / safeTotal) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  const byMonth = Array.from(byMonthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, point]) => ({
      ...point,
      amount: Math.max(0, point.amount)
    }));

  return {
    tag,
    totalAmount: safeTotal,
    count: transactions.length,
    byEnvelope,
    byMonth,
    transactions: txItems
  };
}

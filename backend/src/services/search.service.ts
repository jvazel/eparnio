import { Types } from 'mongoose';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { TransactionModel } from '../models/Transaction.model';

export type GlobalSearchFilterType =
  | 'all'
  | 'variable_expense'
  | 'fixed_charge'
  | 'income'
  | 'notes';

export interface GlobalSearchItem {
  id: string;
  kind: 'transaction' | 'fixed_charge' | 'income';
  title: string;
  notes?: string;
  amount: number;
  date: string;
  periodId: string;
  month: number;
  year: number;
  envelopeId: string;
  envelopeName: string;
  envelopeIcon: string;
  envelopeColor: string;
  memberId?: string;
}

export interface SearchBudgetInput {
  budgetId: string;
  query: string;
  type?: GlobalSearchFilterType;
  limit?: number;
}

export interface SearchBudgetResult {
  items: GlobalSearchItem[];
  totalCount: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseNumericQuery(raw: string): number | null {
  const normalized = raw.trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function searchBudgetItems({
  budgetId,
  query,
  type = 'all',
  limit = 30
}: SearchBudgetInput): Promise<SearchBudgetResult> {
  const trimmed = query.trim();
  const safeLimit = Math.min(Math.max(limit, 1), 50);

  if (!trimmed && type !== 'notes') {
    return { items: [], totalCount: 0 };
  }

  const budgetObjectId = new Types.ObjectId(budgetId);
  const numericTarget = trimmed ? parseNumericQuery(trimmed) : null;
  const regex = trimmed ? new RegExp(escapeRegExp(trimmed), 'i') : null;

  const includeTransactions = type === 'all' || type === 'variable_expense' || type === 'notes';
  const includeEnvelopes = type === 'all' || type === 'fixed_charge' || type === 'income';

  const transactionFilter: Record<string, unknown> = { budgetId: budgetObjectId };
  if (type === 'notes') {
    transactionFilter.notes = { $exists: true, $ne: '' };
  }
  if (regex) {
    const orClauses: Record<string, unknown>[] =
      type === 'notes'
        ? [{ notes: regex }]
        : [{ label: regex }, { notes: regex }];

    if (numericTarget !== null && type !== 'notes') {
      orClauses.push({
        amount: { $gte: numericTarget - 0.01, $lte: numericTarget + 0.01 }
      });
    }
    transactionFilter.$or = orClauses;
  }

  const envelopePillars =
    type === 'fixed_charge'
      ? ['fixed_charge']
      : type === 'income'
        ? ['income']
        : ['fixed_charge', 'income'];

  const envelopeFilter: Record<string, unknown> = {
    budgetId: budgetObjectId,
    pillar: { $in: envelopePillars }
  };
  if (regex) {
    const orClauses: Record<string, unknown>[] = [{ name: regex }];
    if (numericTarget !== null) {
      orClauses.push({
        allocatedAmount: { $gte: numericTarget - 0.01, $lte: numericTarget + 0.01 }
      });
    }
    envelopeFilter.$or = orClauses;
  }

  const [transactions, matchedEnvelopes] = await Promise.all([
    includeTransactions
      ? TransactionModel.find(transactionFilter).sort({ date: -1 }).limit(safeLimit).lean()
      : Promise.resolve([]),
    includeEnvelopes
      ? EnvelopeModel.find(envelopeFilter).sort({ date: -1 }).limit(safeLimit).lean()
      : Promise.resolve([])
  ]);

  const periodIds = new Set<string>();
  const txEnvelopeIds = new Set<string>();

  for (const tx of transactions) {
    periodIds.add(tx.budgetPeriodId.toString());
    txEnvelopeIds.add(tx.envelopeId.toString());
  }
  for (const env of matchedEnvelopes) {
    periodIds.add(env.budgetPeriodId.toString());
  }

  const [periods, txEnvelopes] = await Promise.all([
    periodIds.size > 0
      ? BudgetPeriodModel.find({
          _id: { $in: Array.from(periodIds).map((id) => new Types.ObjectId(id)) }
        }).lean()
      : Promise.resolve([]),
    txEnvelopeIds.size > 0
      ? EnvelopeModel.find({
          _id: { $in: Array.from(txEnvelopeIds).map((id) => new Types.ObjectId(id)) }
        }).lean()
      : Promise.resolve([])
  ]);

  const periodMap = new Map(periods.map((p) => [p._id.toString(), p]));
  const envelopeMap = new Map(txEnvelopes.map((e) => [e._id.toString(), e]));

  const results: GlobalSearchItem[] = [];

  for (const tx of transactions) {
    const period = periodMap.get(tx.budgetPeriodId.toString());
    const envelope = envelopeMap.get(tx.envelopeId.toString());
    if (!period) continue;

    results.push({
      id: tx._id.toString(),
      kind: 'transaction',
      title: tx.label,
      ...(tx.notes ? { notes: tx.notes } : {}),
      amount: tx.amount,
      date: tx.date.toISOString(),
      periodId: period._id.toString(),
      month: period.month,
      year: period.year,
      envelopeId: tx.envelopeId.toString(),
      envelopeName: envelope?.name ?? 'Enveloppe',
      envelopeIcon: envelope?.icon ?? '📦',
      envelopeColor: envelope?.color ?? '#3B82F6',
      ...(tx.paidByUserId ? { memberId: tx.paidByUserId.toString() } : {})
    });
  }

  for (const env of matchedEnvelopes) {
    const period = periodMap.get(env.budgetPeriodId.toString());
    if (!period) continue;

    results.push({
      id: env._id.toString(),
      kind: env.pillar === 'income' ? 'income' : 'fixed_charge',
      title: env.name,
      amount: env.allocatedAmount,
      date: env.date.toISOString(),
      periodId: period._id.toString(),
      month: period.month,
      year: period.year,
      envelopeId: env._id.toString(),
      envelopeName: env.name,
      envelopeIcon: env.icon,
      envelopeColor: env.color,
      ...(env.memberId ? { memberId: env.memberId.toString() } : {})
    });
  }

  results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const sliced = results.slice(0, safeLimit);
  return {
    items: sliced,
    totalCount: sliced.length
  };
}

import { Types } from 'mongoose';
import { AppError } from '../middlewares/error.middleware';
import type { IBudget } from '../models/Budget.model';
import { BudgetPeriodModel, toBudgetPeriodResponse } from '../models/BudgetPeriod.model';
import { EnvelopeModel, toEnvelopeResponse } from '../models/Envelope.model';
import { toTransactionResponse, TransactionModel } from '../models/Transaction.model';
import { recalculateEnvelopeAndPeriod } from './remainingToLive.service';
import { roundCurrency } from './zeroBasedBudget.service';

export interface ImportTransactionItemInput {
  envelopeId: string;
  amount: number;
  label: string;
  date: Date;
  paidByUserId?: string;
  notes?: string;
}

export interface ImportTransactionsBatchResult {
  importedCount: number;
  skippedDuplicatesCount: number;
  transactions: ReturnType<typeof toTransactionResponse>[];
  envelopes: ReturnType<typeof toEnvelopeResponse>[];
  period: ReturnType<typeof toBudgetPeriodResponse>;
}

export interface BalanceReconciliationResult {
  theoreticalBalance: number;
  bankBalance: number;
  difference: number;
  status: 'balanced' | 'under' | 'over';
  suggestedAdjustmentAmount: number;
}

export function normalizeLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildDeduplicationKey(date: Date, amount: number, label: string): string {
  const isoDay = date.toISOString().slice(0, 10);
  const roundedAmount = roundCurrency(amount).toFixed(2);
  return `${isoDay}|${roundedAmount}|${normalizeLabel(label)}`;
}

export function computeBalanceReconciliation(
  theoreticalBalance: number,
  bankBalance: number
): BalanceReconciliationResult {
  const safeTheoretical = roundCurrency(theoreticalBalance);
  const safeBank = roundCurrency(bankBalance);
  const difference = roundCurrency(safeBank - safeTheoretical);

  let status: BalanceReconciliationResult['status'] = 'balanced';
  if (difference < -0.005) {
    status = 'under';
  } else if (difference > 0.005) {
    status = 'over';
  }

  return {
    theoreticalBalance: safeTheoretical,
    bankBalance: safeBank,
    difference,
    status,
    suggestedAdjustmentAmount: roundCurrency(Math.abs(difference))
  };
}

function resolveMemberId(budget: IBudget, requestedUserId: string | undefined, fallbackUserId: string): Types.ObjectId {
  if (!requestedUserId) {
    return new Types.ObjectId(fallbackUserId);
  }
  const memberIds = new Set<string>([budget.ownerId.toString()]);
  for (const member of budget.members) {
    memberIds.add(member.userId.toString());
  }
  if (!memberIds.has(requestedUserId)) {
    throw new AppError('Le membre sélectionné ne fait pas partie de ce budget', 400);
  }
  return new Types.ObjectId(requestedUserId);
}

export async function importTransactionsBatch(params: {
  budget: IBudget;
  periodId: Types.ObjectId;
  userId: string;
  items: ImportTransactionItemInput[];
}): Promise<ImportTransactionsBatchResult> {
  const { budget, periodId, userId, items } = params;

  if (items.length === 0) {
    const periodDoc = await BudgetPeriodModel.findById(periodId);
    if (!periodDoc) {
      throw new AppError('Période introuvable', 404);
    }
    return {
      importedCount: 0,
      skippedDuplicatesCount: 0,
      transactions: [],
      envelopes: [],
      period: toBudgetPeriodResponse(periodDoc)
    };
  }

  const envelopeIds = Array.from(new Set(items.map((item) => item.envelopeId)));
  const envelopes = await EnvelopeModel.find({
    _id: { $in: envelopeIds.map((id) => new Types.ObjectId(id)) },
    budgetPeriodId: periodId
  });
  const validEnvelopeIds = new Set(envelopes.map((env) => env._id.toString()));

  for (const envelopeId of envelopeIds) {
    if (!validEnvelopeIds.has(envelopeId)) {
      throw new AppError('Enveloppe introuvable dans cette période', 404);
    }
  }

  const existingTransactions = await TransactionModel.find({
    budgetPeriodId: periodId,
    type: 'expense'
  }).select('date amount label');

  const seenKeys = new Set<string>(
    existingTransactions.map((tx) => buildDeduplicationKey(tx.date, tx.amount, tx.label))
  );

  const createdTransactions: ReturnType<typeof toTransactionResponse>[] = [];
  const touchedEnvelopeIds = new Set<string>();
  let skippedDuplicatesCount = 0;

  for (const item of items) {
    const dedupKey = buildDeduplicationKey(item.date, item.amount, item.label);
    if (seenKeys.has(dedupKey)) {
      skippedDuplicatesCount += 1;
      continue;
    }
    seenKeys.add(dedupKey);

    const paidByUserId = resolveMemberId(budget, item.paidByUserId, userId);
    const created = await TransactionModel.create({
      budgetId: budget._id,
      budgetPeriodId: periodId,
      envelopeId: new Types.ObjectId(item.envelopeId),
      amount: roundCurrency(item.amount),
      label: item.label.trim(),
      date: item.date,
      type: 'expense',
      authorId: new Types.ObjectId(userId),
      paidByUserId,
      notes: item.notes?.trim()
    });

    createdTransactions.push(toTransactionResponse(created));
    touchedEnvelopeIds.add(item.envelopeId);
  }

  const updatedEnvelopes: ReturnType<typeof toEnvelopeResponse>[] = [];
  let latestPeriodDoc = null;
  for (const envId of touchedEnvelopeIds) {
    const result = await recalculateEnvelopeAndPeriod(new Types.ObjectId(envId), periodId);
    updatedEnvelopes.push(toEnvelopeResponse(result.envelope));
    latestPeriodDoc = result.period;
  }

  if (!latestPeriodDoc) {
    latestPeriodDoc = await BudgetPeriodModel.findById(periodId);
    if (!latestPeriodDoc) {
      throw new AppError('Période introuvable', 404);
    }
  }

  return {
    importedCount: createdTransactions.length,
    skippedDuplicatesCount,
    transactions: createdTransactions,
    envelopes: updatedEnvelopes,
    period: toBudgetPeriodResponse(latestPeriodDoc)
  };
}

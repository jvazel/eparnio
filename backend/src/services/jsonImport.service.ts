import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../middlewares/error.middleware';
import {
  AssetAccountModel,
  type AssetCategory,
  type AssetCounterpartyType,
  type AssetOperationType
} from '../models/AssetAccount.model';
import { BudgetModel, toBudgetResponse, type BudgetResponse } from '../models/Budget.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import {
  EnvelopeModel,
  type EnvelopePillar,
  type RecurrenceFrequency,
  type RolloverMode
} from '../models/Envelope.model';
import { SavingsGoalModel } from '../models/SavingsGoal.model';
import { TransactionModel, type TransactionType } from '../models/Transaction.model';
import { assertBudgetAccess } from './budgetAccess.service';
import {
  recalculatePeriodSummary,
  recalculateSavingsGoalCurrentAmount
} from './remainingToLive.service';

const MAX_PERIODS = 600;
const MAX_ENVELOPES = 20000;
const MAX_TRANSACTIONS = 50000;
const MAX_GOALS = 500;
const MAX_ASSETS = 500;

const finiteNumberSchema = z.number().refine((v) => Number.isFinite(v), 'Nombre invalide');

const isoDateStringSchema = z
  .string()
  .min(1)
  .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Date ISO invalide');

const quickTemplateImportSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1).max(120),
  envelopeName: z.string().trim().min(1).max(120),
  defaultAmount: finiteNumberSchema.min(0).optional(),
  order: finiteNumberSchema.int().min(0).optional()
});

const periodImportSchema = z.object({
  id: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  label: z.string().trim().max(80).optional(),
  startDate: isoDateStringSchema,
  endDate: isoDateStringSchema,
  closedAt: isoDateStringSchema.nullable().optional()
});

const envelopeImportSchema = z.object({
  id: z.string().min(1),
  budgetPeriodId: z.string().min(1),
  pillar: z.enum(['income', 'fixed_charge', 'variable_envelope', 'savings']),
  name: z.string().trim().min(1).max(120),
  icon: z.string().trim().max(16).optional(),
  color: z.string().trim().max(32).optional(),
  allocatedAmount: finiteNumberSchema.min(0),
  spentOrPaidAmount: finiteNumberSchema.optional(),
  rolloverEnabled: z.boolean().optional(),
  rolloverMode: z.enum(['positive_only', 'both']).optional(),
  rolloverAmount: finiteNumberSchema.optional(),
  previousEnvelopeId: z.string().nullable().optional(),
  date: isoDateStringSchema.optional(),
  isRecurring: z.boolean().optional(),
  recurrenceFrequency: z.enum(['monthly', 'quarterly', 'semiannual', 'yearly']).optional(),
  recurrenceEndDate: isoDateStringSchema.nullable().optional(),
  recurrenceRemainingCount: z.number().int().min(0).nullable().optional(),
  isPaid: z.boolean().optional(),
  memberId: z.string().nullable().optional(),
  linkedGoalId: z.string().nullable().optional(),
  order: finiteNumberSchema.int().optional()
});

const transactionImportSchema = z.object({
  id: z.string().optional(),
  budgetPeriodId: z.string().min(1),
  envelopeId: z.string().min(1),
  type: z.enum(['expense', 'income', 'transfer']).optional(),
  amount: finiteNumberSchema.min(0),
  label: z.string().trim().min(1).max(160),
  date: isoDateStringSchema,
  authorId: z.string().nullable().optional(),
  paidByUserId: z.string().nullable().optional(),
  notes: z.string().max(300).nullable().optional(),
  splitGroupId: z.string().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(5).optional(),
  isAnomalyDismissed: z.boolean().optional()
});

const goalWithdrawalImportSchema = z.object({
  id: z.string().optional(),
  amount: finiteNumberSchema.min(0),
  label: z.string().trim().min(1).max(120),
  date: isoDateStringSchema,
  memberId: z.string().nullable().optional(),
  notes: z.string().max(300).nullable().optional()
});

const goalImportSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  icon: z.string().trim().max(16).optional(),
  color: z.string().trim().max(32).optional(),
  targetAmount: finiteNumberSchema.min(0),
  initialAmount: finiteNumberSchema.min(0).optional(),
  currentAmount: finiteNumberSchema.min(0).optional(),
  deadline: isoDateStringSchema.nullable().optional(),
  assetAccountId: z.string().nullable().optional(),
  withdrawals: z.array(goalWithdrawalImportSchema).max(2000).optional(),
  order: finiteNumberSchema.int().optional()
});

const assetHistoryImportSchema = z.object({
  date: isoDateStringSchema,
  balance: finiteNumberSchema
});

const assetOperationImportSchema = z.object({
  id: z.string().optional(),
  date: isoDateStringSchema,
  type: z.enum(['add', 'withdraw', 'set', 'transfer_in', 'transfer_out']),
  amount: finiteNumberSchema,
  label: z.string().trim().min(1).max(120),
  balanceAfter: finiteNumberSchema,
  counterpartyType: z.enum(['external', 'asset', 'savings_goal', 'budget_period']).optional(),
  counterpartyId: z.string().nullable().optional(),
  counterpartyName: z.string().max(120).nullable().optional()
});

const assetImportSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  category: z.enum(['cash', 'investment', 'real_estate', 'crypto', 'liability']),
  icon: z.string().trim().max(16).optional(),
  color: z.string().trim().max(32).optional(),
  currentBalance: finiteNumberSchema,
  history: z.array(assetHistoryImportSchema).max(5000).optional(),
  operations: z.array(assetOperationImportSchema).max(5000).optional()
});

export const budgetBackupImportSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)], {
    error: 'Version de sauvegarde non supportée (versions acceptées : 1 ou 2)'
  }),
  exportedAt: isoDateStringSchema.optional(),
  budget: z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1, 'Le nom du budget est requis').max(80),
    type: z.enum(['personal', 'shared']).optional(),
    contributionMode: z.enum(['equal_50_50', 'income_prorata', 'custom']).optional(),
    budgetStartDay: z.number().int().min(1).max(28).optional(),
    quickTemplates: z.array(quickTemplateImportSchema).max(50).optional()
  }),
  periods: z.array(periodImportSchema).max(MAX_PERIODS),
  envelopes: z.array(envelopeImportSchema).max(MAX_ENVELOPES),
  transactions: z.array(transactionImportSchema).max(MAX_TRANSACTIONS),
  goals: z.array(goalImportSchema).max(MAX_GOALS),
  assets: z.array(assetImportSchema).max(MAX_ASSETS).optional()
});

export type BudgetBackupImportPayload = z.infer<typeof budgetBackupImportSchema>;

export interface JsonImportPreviewResult {
  budgetName: string;
  schemaVersion: 1 | 2;
  exportedAt: string | null;
  periodsCount: number;
  envelopesCount: number;
  transactionsCount: number;
  goalsCount: number;
  assetsCount: number;
  dateRange: {
    from: string | null;
    to: string | null;
  };
  warnings: string[];
}

export interface JsonImportResult {
  budget: BudgetResponse;
  summary: {
    periodsCount: number;
    envelopesCount: number;
    transactionsCount: number;
    goalsCount: number;
    assetsCount: number;
  };
}

/**
 * Rejette toute clé MongoDB interdite (`$` en préfixe ou `.` dans le nom de clé)
 * récursivement dans le payload JSON importé.
 */
export function assertNoForbiddenMongoKeys(value: unknown, depth = 0): void {
  if (depth > 25) {
    throw new AppError('Structure JSON trop profondément imbriquée', 400);
  }
  if (value === null || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      assertNoForbiddenMongoKeys(item, depth + 1);
    }
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith('$') || key.includes('.')) {
      throw new AppError(`Clé JSON interdite détectée : "${key}"`, 400);
    }
    assertNoForbiddenMongoKeys(nested, depth + 1);
  }
}

/**
 * Extrait et valide le payload de sauvegarde (supporte soit l'objet backup direct,
 * soit une enveloppe `{ backup, customName? }`).
 */
export function parseAndValidateBackupPayload(rawInput: unknown): {
  backup: BudgetBackupImportPayload;
  customName?: string;
} {
  assertNoForbiddenMongoKeys(rawInput);

  let candidate: unknown = rawInput;
  let customName: string | undefined;

  if (
    rawInput &&
    typeof rawInput === 'object' &&
    !Array.isArray(rawInput) &&
    'backup' in rawInput
  ) {
    const wrapper = rawInput as { backup?: unknown; customName?: unknown };
    candidate = wrapper.backup;
    if (typeof wrapper.customName === 'string' && wrapper.customName.trim().length > 0) {
      customName = wrapper.customName.trim().slice(0, 80);
    }
  } else if (
    rawInput &&
    typeof rawInput === 'object' &&
    !Array.isArray(rawInput) &&
    'customName' in rawInput
  ) {
    const rawCustom = (rawInput as { customName?: unknown }).customName;
    if (typeof rawCustom === 'string' && rawCustom.trim().length > 0) {
      customName = rawCustom.trim().slice(0, 80);
    }
  }

  const parsed = budgetBackupImportSchema.safeParse(candidate);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const path = firstIssue?.path?.join('.') || 'backup';
    const message = firstIssue?.message || 'Fichier de sauvegarde JSON invalide';
    throw new AppError(`Sauvegarde JSON invalide (${path}) : ${message}`, 400);
  }

  return { backup: parsed.data, customName };
}

/**
 * Valide un fichier de sauvegarde JSON sans rien écrire en base et retourne un aperçu détaillé.
 */
export function previewJsonBackup(rawInput: unknown): JsonImportPreviewResult {
  const { backup } = parseAndValidateBackupPayload(rawInput);

  const warnings: string[] = [];
  if (backup.schemaVersion === 1) {
    warnings.push(
      'Sauvegarde v1 (sans comptes patrimoniaux) : compatible et restaurable intégralement.'
    );
  }

  const sortedPeriods = [...backup.periods].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  );
  const firstPeriod = sortedPeriods[0];
  const lastPeriod = sortedPeriods[sortedPeriods.length - 1];

  return {
    budgetName: backup.budget.name,
    schemaVersion: backup.schemaVersion,
    exportedAt: backup.exportedAt ?? null,
    periodsCount: backup.periods.length,
    envelopesCount: backup.envelopes.length,
    transactionsCount: backup.transactions.length,
    goalsCount: backup.goals.length,
    assetsCount: backup.assets?.length ?? 0,
    dateRange: {
      from: firstPeriod ? firstPeriod.startDate : null,
      to: lastPeriod ? lastPeriod.endDate : null
    },
    warnings
  };
}

function buildPeriodLabel(month: number, year: number): string {
  const date = new Date(Date.UTC(year, month - 1, 1));
  const formatted = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Restaure une sauvegarde JSON complète en créant un nouvel espace budgétaire (`create_new`)
 * ou en remplaçant intégralement un espace existant (`replace_existing`, réservé au `owner`).
 */
export async function importJsonBackup(params: {
  rawInput: unknown;
  userId: string;
  mode: 'create_new' | 'replace_existing';
  targetBudgetId?: string;
}): Promise<JsonImportResult> {
  const { rawInput, userId, mode, targetBudgetId } = params;
  const { backup, customName } = parseAndValidateBackupPayload(rawInput);
  const actorObjectId = new Types.ObjectId(userId);

  let budgetDoc;
  let createdNewBudgetId: Types.ObjectId | null = null;
  const allowedMemberIds = new Set<string>([userId]);

  if (mode === 'replace_existing') {
    if (!targetBudgetId) {
      throw new AppError('Identifiant du budget cible requis pour le remplacement', 400);
    }
    const { budget, member } = await assertBudgetAccess(targetBudgetId, userId);
    const isOwner =
      budget.ownerId.equals(actorObjectId) || (member && member.role === 'owner');
    if (!isOwner) {
      throw new AppError(
        'Seul le propriétaire du budget peut remplacer intégralement cet espace',
        403
      );
    }
    budgetDoc = budget;
    allowedMemberIds.add(budget.ownerId.toString());
    for (const m of budget.members) {
      allowedMemberIds.add(m.userId.toString());
    }
  } else {
    const newName = customName || `${backup.budget.name} (Restauré)`;
    budgetDoc = await BudgetModel.create({
      name: newName.slice(0, 80),
      type: 'personal',
      ownerId: actorObjectId,
      contributionMode: backup.budget.contributionMode ?? 'equal_50_50',
      members: [
        {
          userId: actorObjectId,
          role: 'owner',
          color: '#7C3AED',
          declaredMonthlyIncome: 0
        }
      ],
      budgetStartDay: backup.budget.budgetStartDay ?? 1,
      quickTemplates: (backup.budget.quickTemplates ?? []).map((tpl, idx) => ({
        label: tpl.label,
        envelopeName: tpl.envelopeName,
        ...(tpl.defaultAmount !== undefined ? { defaultAmount: tpl.defaultAmount } : {}),
        order: tpl.order ?? idx
      }))
    });
    createdNewBudgetId = budgetDoc._id;
  }

  const resolveMemberObjectId = (rawMemberId?: string | null): Types.ObjectId => {
    if (
      rawMemberId &&
      Types.ObjectId.isValid(rawMemberId) &&
      allowedMemberIds.has(rawMemberId)
    ) {
      return new Types.ObjectId(rawMemberId);
    }
    return actorObjectId;
  };

  try {
    if (mode === 'replace_existing') {
      if (customName) {
        budgetDoc.name = customName.slice(0, 80);
      }
      if (backup.budget.budgetStartDay !== undefined) {
        budgetDoc.budgetStartDay = backup.budget.budgetStartDay;
      }
      budgetDoc.quickTemplates = (backup.budget.quickTemplates ?? []).map((tpl, idx) => ({
        _id: new Types.ObjectId(),
        label: tpl.label,
        envelopeName: tpl.envelopeName,
        ...(tpl.defaultAmount !== undefined ? { defaultAmount: tpl.defaultAmount } : {}),
        order: tpl.order ?? idx
      }));
      await budgetDoc.save();

      await Promise.all([
        TransactionModel.deleteMany({ budgetId: budgetDoc._id }),
        EnvelopeModel.deleteMany({ budgetId: budgetDoc._id }),
        SavingsGoalModel.deleteMany({ budgetId: budgetDoc._id }),
        AssetAccountModel.deleteMany({ budgetId: budgetDoc._id }),
        BudgetPeriodModel.deleteMany({ budgetId: budgetDoc._id })
      ]);
    }

    // 1. Tables de remapping déterministes (zéro collision entre comptes/environnements)
    const periodIdMap = new Map<string, Types.ObjectId>();
    for (const p of backup.periods) {
      periodIdMap.set(p.id, new Types.ObjectId());
    }

    const assetIdMap = new Map<string, Types.ObjectId>();
    for (const a of backup.assets ?? []) {
      assetIdMap.set(a.id, new Types.ObjectId());
    }

    const goalIdMap = new Map<string, Types.ObjectId>();
    for (const g of backup.goals) {
      goalIdMap.set(g.id, new Types.ObjectId());
    }

    const envelopeIdMap = new Map<string, Types.ObjectId>();
    for (const e of backup.envelopes) {
      envelopeIdMap.set(e.id, new Types.ObjectId());
    }

    const splitGroupIdMap = new Map<string, string>();
    const mapSplitGroupId = (oldSplitId?: string | null): string | undefined => {
      if (!oldSplitId) return undefined;
      let mapped = splitGroupIdMap.get(oldSplitId);
      if (!mapped) {
        mapped = new Types.ObjectId().toString();
        splitGroupIdMap.set(oldSplitId, mapped);
      }
      return mapped;
    };

    // 2. Insertion des périodes
    if (backup.periods.length > 0) {
      await BudgetPeriodModel.insertMany(
        backup.periods.map((p) => ({
          _id: periodIdMap.get(p.id)!,
          budgetId: budgetDoc._id,
          month: p.month,
          year: p.year,
          label: p.label?.trim() || buildPeriodLabel(p.month, p.year),
          startDate: new Date(p.startDate),
          endDate: new Date(p.endDate),
          ...(p.closedAt ? { closedAt: new Date(p.closedAt) } : {}),
          summary: {
            plannedIncome: 0,
            plannedFixedCharges: 0,
            plannedEnvelopes: 0,
            plannedSavings: 0,
            spentVariables: 0,
            remainingToAllocate: 0,
            remainingToLive: 0
          }
        }))
      );
    }

    // 3. Insertion des comptes patrimoniaux (avec remapping des contreparties d'opérations)
    const assetsToInsert = backup.assets ?? [];
    if (assetsToInsert.length > 0) {
      await AssetAccountModel.insertMany(
        assetsToInsert.map((a) => ({
          _id: assetIdMap.get(a.id)!,
          budgetId: budgetDoc._id,
          name: a.name,
          category: a.category as AssetCategory,
          icon: a.icon ?? '🏦',
          color: a.color ?? '#3B82F6',
          currentBalance: a.currentBalance,
          history: (a.history ?? []).map((h) => ({
            date: new Date(h.date),
            balance: h.balance
          })),
          operations: (a.operations ?? []).map((op) => {
            const cpType: AssetCounterpartyType = op.counterpartyType ?? 'external';
            let mappedCounterpartyId: string | undefined;
            if (op.counterpartyId) {
              if (cpType === 'asset') {
                mappedCounterpartyId = assetIdMap.get(op.counterpartyId)?.toString();
              } else if (cpType === 'savings_goal') {
                mappedCounterpartyId = goalIdMap.get(op.counterpartyId)?.toString();
              } else if (cpType === 'budget_period') {
                mappedCounterpartyId = periodIdMap.get(op.counterpartyId)?.toString();
              }
            }
            return {
              date: new Date(op.date),
              type: op.type as AssetOperationType,
              amount: op.amount,
              label: op.label,
              balanceAfter: op.balanceAfter,
              counterpartyType: cpType,
              ...(mappedCounterpartyId ? { counterpartyId: mappedCounterpartyId } : {}),
              ...(op.counterpartyName ? { counterpartyName: op.counterpartyName } : {})
            };
          })
        }))
      );
    }

    // 4. Insertion des objectifs d'épargne (avec lien vers compte patrimonial et retraits)
    if (backup.goals.length > 0) {
      await SavingsGoalModel.insertMany(
        backup.goals.map((g, idx) => {
          const mappedAssetId = g.assetAccountId ? assetIdMap.get(g.assetAccountId) : undefined;
          return {
            _id: goalIdMap.get(g.id)!,
            budgetId: budgetDoc._id,
            name: g.name,
            icon: g.icon ?? '✈️',
            color: g.color ?? '#38BDF8',
            targetAmount: g.targetAmount,
            initialAmount: g.initialAmount ?? 0,
            currentAmount: g.currentAmount ?? g.initialAmount ?? 0,
            ...(g.deadline ? { deadline: new Date(g.deadline) } : {}),
            ...(mappedAssetId ? { assetAccountId: mappedAssetId } : {}),
            withdrawals: (g.withdrawals ?? []).map((w) => ({
              amount: w.amount,
              label: w.label,
              date: new Date(w.date),
              ...(w.memberId ? { memberId: resolveMemberObjectId(w.memberId) } : {}),
              ...(w.notes ? { notes: w.notes } : {})
            })),
            order: g.order ?? idx
          };
        })
      );
    }

    // 5. Insertion des enveloppes (avec chaîne previousEnvelopeId et linkedGoalId)
    const validEnvelopes = backup.envelopes.filter((e) => periodIdMap.has(e.budgetPeriodId));
    if (validEnvelopes.length > 0) {
      await EnvelopeModel.insertMany(
        validEnvelopes.map((e, idx) => {
          const mappedPrevId = e.previousEnvelopeId
            ? envelopeIdMap.get(e.previousEnvelopeId)
            : undefined;
          const mappedGoalId = e.linkedGoalId ? goalIdMap.get(e.linkedGoalId) : undefined;
          return {
            _id: envelopeIdMap.get(e.id)!,
            budgetId: budgetDoc._id,
            budgetPeriodId: periodIdMap.get(e.budgetPeriodId)!,
            pillar: e.pillar as EnvelopePillar,
            name: e.name,
            icon: e.icon ?? '💡',
            color: e.color ?? '#38BDF8',
            allocatedAmount: e.allocatedAmount,
            spentOrPaidAmount: e.spentOrPaidAmount ?? 0,
            rolloverEnabled: e.rolloverEnabled ?? false,
            rolloverMode: (e.rolloverMode ?? 'positive_only') as RolloverMode,
            rolloverAmount: e.rolloverAmount ?? 0,
            ...(mappedPrevId ? { previousEnvelopeId: mappedPrevId } : {}),
            date: e.date ? new Date(e.date) : new Date(),
            isRecurring: e.isRecurring ?? false,
            recurrenceFrequency: (e.recurrenceFrequency ?? 'monthly') as RecurrenceFrequency,
            ...(e.recurrenceEndDate ? { recurrenceEndDate: new Date(e.recurrenceEndDate) } : {}),
            ...(e.recurrenceRemainingCount !== undefined && e.recurrenceRemainingCount !== null
              ? { recurrenceRemainingCount: e.recurrenceRemainingCount }
              : {}),
            isPaid: e.isPaid ?? false,
            ...(e.memberId ? { memberId: resolveMemberObjectId(e.memberId) } : {}),
            ...(mappedGoalId ? { linkedGoalId: mappedGoalId } : {}),
            order: e.order ?? idx
          };
        })
      );
    }

    // 6. Insertion des transactions (avec remapping envelopeId, periodId, splitGroupId)
    const validTransactions = backup.transactions.filter(
      (tx) => periodIdMap.has(tx.budgetPeriodId) && envelopeIdMap.has(tx.envelopeId)
    );
    if (validTransactions.length > 0) {
      await TransactionModel.insertMany(
        validTransactions.map((tx) => {
          const mappedSplit = mapSplitGroupId(tx.splitGroupId);
          return {
            budgetId: budgetDoc._id,
            budgetPeriodId: periodIdMap.get(tx.budgetPeriodId)!,
            envelopeId: envelopeIdMap.get(tx.envelopeId)!,
            type: (tx.type ?? 'expense') as TransactionType,
            amount: tx.amount,
            label: tx.label,
            date: new Date(tx.date),
            authorId: resolveMemberObjectId(tx.authorId),
            paidByUserId: resolveMemberObjectId(tx.paidByUserId),
            ...(tx.notes ? { notes: tx.notes } : {}),
            ...(mappedSplit ? { splitGroupId: mappedSplit } : {}),
            tags: tx.tags ?? [],
            isAnomalyDismissed: tx.isAnomalyDismissed ?? false
          };
        })
      );
    }

    // 7. Recalcul d'intégrité post-import (périodes et objectifs d'épargne)
    for (const newPeriodId of periodIdMap.values()) {
      await recalculatePeriodSummary(newPeriodId);
    }
    for (const newGoalId of goalIdMap.values()) {
      await recalculateSavingsGoalCurrentAmount(newGoalId);
    }

    return {
      budget: toBudgetResponse(budgetDoc),
      summary: {
        periodsCount: backup.periods.length,
        envelopesCount: validEnvelopes.length,
        transactionsCount: validTransactions.length,
        goalsCount: backup.goals.length,
        assetsCount: assetsToInsert.length
      }
    };
  } catch (err) {
    // Nettoyage compensatoire si la création d'un nouvel espace échoue en cours de route
    if (createdNewBudgetId) {
      await Promise.all([
        TransactionModel.deleteMany({ budgetId: createdNewBudgetId }),
        EnvelopeModel.deleteMany({ budgetId: createdNewBudgetId }),
        SavingsGoalModel.deleteMany({ budgetId: createdNewBudgetId }),
        AssetAccountModel.deleteMany({ budgetId: createdNewBudgetId }),
        BudgetPeriodModel.deleteMany({ budgetId: createdNewBudgetId }),
        BudgetModel.deleteOne({ _id: createdNewBudgetId })
      ]);
    }
    throw err;
  }
}

import { Types } from 'mongoose';
import { AppError } from '../middlewares/error.middleware';
import {
  BudgetTemplateModel,
  toBudgetTemplateResponse,
  type BudgetTemplateResponse,
  type IBudgetTemplateItem,
  type TemplateItemPillar
} from '../models/BudgetTemplate.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel, type IEnvelope } from '../models/Envelope.model';
import { SavingsGoalModel } from '../models/SavingsGoal.model';
import { propagateEnvelopeRollover } from './periodRollover.service';
import {
  calculateRemainingToLive,
  recalculatePeriodSummary,
  recalculateSavingsGoalCurrentAmount
} from './remainingToLive.service';
import { calculateZeroBasedSummary, roundCurrency } from './zeroBasedBudget.service';

export type TemplateChangeStatus = 'updated' | 'created' | 'reset_to_zero' | 'unchanged';

export interface TemplateChangeEntry {
  pillar: TemplateItemPillar;
  name: string;
  icon: string;
  color: string;
  status: TemplateChangeStatus;
  previousAmount: number;
  newAmount: number;
  deltaAmount: number;
  spentOrPaidAmount: number;
  exceedsSpent: boolean;
  resetToZero: boolean;
  envelopeId?: string;
}

export interface TemplateSummarySnapshot {
  plannedIncome: number;
  plannedFixedCharges: number;
  plannedEnvelopes: number;
  plannedSavings: number;
  spentVariables: number;
  remainingToAllocate: number;
  remainingToLive: number;
}

export interface ApplyTemplateResult {
  dryRun: boolean;
  template: BudgetTemplateResponse;
  changes: TemplateChangeEntry[];
  summaryBefore: TemplateSummarySnapshot;
  summaryAfter: TemplateSummarySnapshot;
  warnings: string[];
}

export function normalizeTemplateItemName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Capture les enveloppes variables et allocations d'épargne d'une période
 * pour créer un scénario en 1 tap (snapshot).
 */
export async function buildTemplateItemsFromPeriod(
  budgetId: string | Types.ObjectId,
  periodId: string | Types.ObjectId
): Promise<IBudgetTemplateItem[]> {
  const period = await BudgetPeriodModel.findOne({ _id: periodId, budgetId });
  if (!period) {
    throw new AppError('Période source introuvable sur ce budget', 404);
  }

  const envelopes = await EnvelopeModel.find({
    budgetId,
    budgetPeriodId: period._id,
    pillar: { $in: ['variable_envelope', 'savings'] }
  }).sort({ pillar: 1, order: 1, createdAt: 1 });

  return envelopes.map((env, idx) => ({
    pillar: env.pillar as TemplateItemPillar,
    name: env.name,
    icon: env.icon,
    color: env.color,
    allocatedAmount: env.allocatedAmount,
    ...(env.linkedGoalId ? { linkedGoalId: env.linkedGoalId } : {}),
    rolloverEnabled: env.rolloverEnabled,
    rolloverMode: env.rolloverMode,
    order: env.order ?? idx
  }));
}

function computeSummarySnapshot(
  envelopes: Array<{
    pillar: string;
    allocatedAmount: number;
    spentOrPaidAmount: number;
  }>
): TemplateSummarySnapshot {
  const zbb = calculateZeroBasedSummary(envelopes as IEnvelope[]);
  const remainingToLive = calculateRemainingToLive(zbb);
  return {
    ...zbb,
    remainingToLive
  };
}

/**
 * Prévisualise (`dryRun: true`) ou applique (`dryRun: false`) un scénario de budget
 * sur une période donnée, en mettant à 0 € les enveloppes variables/épargne absentes
 * du scénario sans jamais les supprimer ni toucher aux transactions, revenus ou charges fixes.
 */
export async function previewOrApplyTemplate(params: {
  budgetId: string | Types.ObjectId;
  periodId: string | Types.ObjectId;
  templateId: string | Types.ObjectId;
  dryRun: boolean;
}): Promise<ApplyTemplateResult> {
  const { budgetId, periodId, templateId, dryRun } = params;

  const [period, template, periodEnvelopes, budgetGoals] = await Promise.all([
    BudgetPeriodModel.findOne({ _id: periodId, budgetId }),
    BudgetTemplateModel.findOne({ _id: templateId, budgetId }),
    EnvelopeModel.find({ budgetId, budgetPeriodId: periodId }).sort({ order: 1, createdAt: 1 }),
    SavingsGoalModel.find({ budgetId }).select('_id')
  ]);

  if (!period) {
    throw new AppError('Période budgétaire introuvable sur ce budget', 404);
  }
  if (!template) {
    throw new AppError('Scénario de budget introuvable', 404);
  }

  const validGoalIds = new Set(budgetGoals.map((g) => g._id.toString()));
  const summaryBefore = computeSummarySnapshot(periodEnvelopes);

  const targetableEnvelopes = periodEnvelopes.filter(
    (e) => e.pillar === 'variable_envelope' || e.pillar === 'savings'
  );
  const matchedEnvelopeIds = new Set<string>();
  const changes: TemplateChangeEntry[] = [];
  const warnings: string[] = [];

  // Projection en mémoire pour calculer summaryAfter
  const projectedEnvelopes = periodEnvelopes.map((e) => ({
    id: e._id.toString(),
    pillar: e.pillar,
    allocatedAmount: e.allocatedAmount,
    spentOrPaidAmount: e.spentOrPaidAmount
  }));

  const updatesToPersist: Array<{ envelope: IEnvelope; newAmount: number }> = [];
  const creationsToPersist: Array<{
    pillar: TemplateItemPillar;
    name: string;
    icon: string;
    color: string;
    allocatedAmount: number;
    linkedGoalId?: Types.ObjectId;
    rolloverEnabled: boolean;
    rolloverMode: 'positive_only' | 'both';
    order: number;
  }> = [];

  for (const item of template.items) {
    const normalizedName = normalizeTemplateItemName(item.name);

    let matched: IEnvelope | undefined;
    if (item.pillar === 'savings' && item.linkedGoalId) {
      matched = targetableEnvelopes.find(
        (e) =>
          !matchedEnvelopeIds.has(e._id.toString()) &&
          e.pillar === 'savings' &&
          e.linkedGoalId?.toString() === item.linkedGoalId?.toString()
      );
    }
    if (!matched) {
      matched = targetableEnvelopes.find(
        (e) =>
          !matchedEnvelopeIds.has(e._id.toString()) &&
          e.pillar === item.pillar &&
          normalizeTemplateItemName(e.name) === normalizedName
      );
    }

    if (matched) {
      matchedEnvelopeIds.add(matched._id.toString());
      const prevAmount = matched.allocatedAmount;
      const nextAmount = roundCurrency(item.allocatedAmount);
      const deltaAmount = roundCurrency(nextAmount - prevAmount);
      const exceedsSpent = nextAmount < matched.spentOrPaidAmount;

      if (exceedsSpent) {
        warnings.push(
          `« ${matched.name} » a déjà ${matched.spentOrPaidAmount.toFixed(2)} € dépensés (nouveau plafond : ${nextAmount.toFixed(2)} €).`
        );
      }

      const status: TemplateChangeStatus = deltaAmount === 0 ? 'unchanged' : 'updated';
      changes.push({
        pillar: item.pillar,
        name: matched.name,
        icon: matched.icon,
        color: matched.color,
        status,
        previousAmount: prevAmount,
        newAmount: nextAmount,
        deltaAmount,
        spentOrPaidAmount: matched.spentOrPaidAmount,
        exceedsSpent,
        resetToZero: false,
        envelopeId: matched._id.toString()
      });

      const proj = projectedEnvelopes.find((p) => p.id === matched!._id.toString());
      if (proj) {
        proj.allocatedAmount = nextAmount;
      }

      if (status === 'updated') {
        updatesToPersist.push({ envelope: matched, newAmount: nextAmount });
      }
    } else {
      const nextAmount = roundCurrency(item.allocatedAmount);
      let resolvedGoalId: Types.ObjectId | undefined;
      if (item.pillar === 'savings' && item.linkedGoalId) {
        if (validGoalIds.has(item.linkedGoalId.toString())) {
          resolvedGoalId = item.linkedGoalId;
        } else {
          warnings.push(
            `L’objectif d’épargne lié à « ${item.name} » n’existe plus : l’enveloppe sera créée sans lien.`
          );
        }
      }

      changes.push({
        pillar: item.pillar,
        name: item.name,
        icon: item.icon,
        color: item.color,
        status: 'created',
        previousAmount: 0,
        newAmount: nextAmount,
        deltaAmount: nextAmount,
        spentOrPaidAmount: 0,
        exceedsSpent: false,
        resetToZero: false
      });

      projectedEnvelopes.push({
        id: `new-${creationsToPersist.length}`,
        pillar: item.pillar,
        allocatedAmount: nextAmount,
        spentOrPaidAmount: 0
      });

      creationsToPersist.push({
        pillar: item.pillar,
        name: item.name,
        icon: item.icon,
        color: item.color,
        allocatedAmount: nextAmount,
        ...(resolvedGoalId ? { linkedGoalId: resolvedGoalId } : {}),
        rolloverEnabled: item.rolloverEnabled ?? false,
        rolloverMode: item.rolloverMode ?? 'positive_only',
        order: item.order ?? targetableEnvelopes.length + creationsToPersist.length
      });
    }
  }

  // Enveloppes variables / épargne présentes dans le mois mais absentes du scénario -> mises à 0 € (jamais supprimées)
  for (const env of targetableEnvelopes) {
    if (matchedEnvelopeIds.has(env._id.toString())) continue;

    const prevAmount = env.allocatedAmount;
    const exceedsSpent = env.spentOrPaidAmount > 0;
    if (exceedsSpent) {
      warnings.push(
        `« ${env.name} » est mise à 0 € mais contient déjà ${env.spentOrPaidAmount.toFixed(2)} € de dépenses (conservée).`
      );
    }

    const status: TemplateChangeStatus = prevAmount === 0 ? 'unchanged' : 'reset_to_zero';
    changes.push({
      pillar: env.pillar as TemplateItemPillar,
      name: env.name,
      icon: env.icon,
      color: env.color,
      status,
      previousAmount: prevAmount,
      newAmount: 0,
      deltaAmount: roundCurrency(-prevAmount),
      spentOrPaidAmount: env.spentOrPaidAmount,
      exceedsSpent,
      resetToZero: status === 'reset_to_zero',
      envelopeId: env._id.toString()
    });

    const proj = projectedEnvelopes.find((p) => p.id === env._id.toString());
    if (proj) {
      proj.allocatedAmount = 0;
    }

    if (status === 'reset_to_zero') {
      updatesToPersist.push({ envelope: env, newAmount: 0 });
    }
  }

  const summaryAfter = computeSummarySnapshot(projectedEnvelopes);

  if (!dryRun) {
    const impactedGoalIds = new Set<string>();
    const impactedVariableIds: Types.ObjectId[] = [];

    for (const { envelope, newAmount } of updatesToPersist) {
      envelope.allocatedAmount = newAmount;
      await envelope.save();
      if (envelope.pillar === 'variable_envelope') {
        impactedVariableIds.push(envelope._id);
      }
      if (envelope.linkedGoalId) {
        impactedGoalIds.add(envelope.linkedGoalId.toString());
      }
    }

    if (creationsToPersist.length > 0) {
      const createdDocs = await EnvelopeModel.insertMany(
        creationsToPersist.map((c) => ({
          budgetId: period.budgetId,
          budgetPeriodId: period._id,
          pillar: c.pillar,
          name: c.name,
          icon: c.icon,
          color: c.color,
          allocatedAmount: c.allocatedAmount,
          spentOrPaidAmount: 0,
          rolloverEnabled: c.rolloverEnabled,
          rolloverMode: c.rolloverMode,
          rolloverAmount: 0,
          date: period.startDate,
          isRecurring: false,
          recurrenceFrequency: 'monthly',
          isPaid: false,
          ...(c.linkedGoalId ? { linkedGoalId: c.linkedGoalId } : {}),
          order: c.order
        }))
      );
      for (const created of createdDocs) {
        if (created.linkedGoalId) {
          impactedGoalIds.add(created.linkedGoalId.toString());
        }
      }
    }

    for (const envId of impactedVariableIds) {
      await propagateEnvelopeRollover(envId);
    }

    await recalculatePeriodSummary(period._id);

    for (const goalId of impactedGoalIds) {
      await recalculateSavingsGoalCurrentAmount(goalId);
    }
  }

  return {
    dryRun,
    template: toBudgetTemplateResponse(template),
    changes,
    summaryBefore,
    summaryAfter,
    warnings
  };
}

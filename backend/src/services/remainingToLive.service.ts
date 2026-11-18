import type { Types } from 'mongoose';
import { AppError } from '../middlewares/error.middleware';
import { propagateEnvelopeRollover } from './periodRollover.service';
import { BudgetPeriodModel, type IBudgetPeriod } from '../models/BudgetPeriod.model';
import { EnvelopeModel, type IEnvelope } from '../models/Envelope.model';
import { type ISavingsGoal, SavingsGoalModel } from '../models/SavingsGoal.model';
import { TransactionModel } from '../models/Transaction.model';
import { calculateZeroBasedSummary, roundCurrency } from './zeroBasedBudget.service';

export interface RemainingToLiveInput {
  plannedIncome: number;
  plannedFixedCharges: number;
  plannedSavings: number;
  spentVariables: number;
}

/**
 * Calcule le « Reste à dépenser » global du cycle :
 * Revenus - Dépenses fixes - Épargne - Dépenses variables saisies.
 */
export function calculateRemainingToLive(input: RemainingToLiveInput): number {
  return roundCurrency(
    input.plannedIncome -
      input.plannedFixedCharges -
      input.plannedSavings -
      input.spentVariables
  );
}

/**
 * Recalcule l'intégralité des agrégats `BudgetPeriod.summary` à partir des postes en base.
 */
export async function recalculatePeriodSummary(
  periodId: string | Types.ObjectId
): Promise<IBudgetPeriod> {
  const envelopes = await EnvelopeModel.find({ budgetPeriodId: periodId });
  const zbb = calculateZeroBasedSummary(envelopes);
  const remainingToLive = calculateRemainingToLive(zbb);

  const updatedPeriod = await BudgetPeriodModel.findByIdAndUpdate(
    periodId,
    {
      $set: {
        summary: {
          ...zbb,
          remainingToLive
        }
      }
    },
    { new: true }
  );

  if (!updatedPeriod) {
    throw new AppError('Période budgétaire introuvable', 404);
  }

  return updatedPeriod;
}

/**
 * Recalcule l'épargne cumulée (`currentAmount`) d'un objectif d'épargne
 * à partir de son montant initial et de toutes les allocations `savings` liées.
 */
export async function recalculateSavingsGoalCurrentAmount(
  goalId: string | Types.ObjectId
): Promise<ISavingsGoal | null> {
  const goal = await SavingsGoalModel.findById(goalId);
  if (!goal) {
    return null;
  }

  const linkedEnvelopes = await EnvelopeModel.find({
    budgetId: goal.budgetId,
    pillar: 'savings',
    linkedGoalId: goal._id
  });

  const totalContributions = linkedEnvelopes.reduce((acc, env) => acc + env.allocatedAmount, 0);
  goal.currentAmount = Math.max(0, roundCurrency((goal.initialAmount ?? 0) + totalContributions));
  await goal.save();
  return goal;
}

/**
 * Recalcule `spentOrPaidAmount` d'une enveloppe à partir de ses transactions,
 * met à jour les agrégats de la période (`spentVariables`, `plannedSavings`, `remainingToLive`)
 * et synchronise un éventuel objectif d'épargne lié.
 */
export async function recalculateEnvelopeAndPeriod(
  envelopeId: string | Types.ObjectId,
  periodId: string | Types.ObjectId
): Promise<{ envelope: IEnvelope; period: IBudgetPeriod; goal?: ISavingsGoal }> {
  const existingEnvelope = await EnvelopeModel.findOne({
    _id: envelopeId,
    budgetPeriodId: periodId
  });

  if (!existingEnvelope) {
    throw new AppError('Poste budgétaire introuvable', 404);
  }

  const transactions = await TransactionModel.find({
    envelopeId,
    budgetPeriodId: periodId
  });

  const rawTotal = transactions.reduce((acc, tx) => {
    return tx.type === 'income' ? acc - tx.amount : acc + tx.amount;
  }, 0);

  const spentOrPaidAmount = Math.max(0, roundCurrency(rawTotal));
  const updateSet: { spentOrPaidAmount: number; allocatedAmount?: number } = {
    spentOrPaidAmount
  };
  if (existingEnvelope.pillar === 'savings') {
    updateSet.allocatedAmount = spentOrPaidAmount;
  }

  const envelope = await EnvelopeModel.findOneAndUpdate(
    { _id: envelopeId, budgetPeriodId: periodId },
    { $set: updateSet },
    { new: true }
  );

  if (!envelope) {
    throw new AppError('Poste budgétaire introuvable', 404);
  }

  if (envelope.pillar === 'variable_envelope') {
    await propagateEnvelopeRollover(envelope._id);
  }

  const period = await recalculatePeriodSummary(periodId);
  const goal = envelope.linkedGoalId
    ? await recalculateSavingsGoalCurrentAmount(envelope.linkedGoalId)
    : null;

  return { envelope, period, ...(goal ? { goal } : {}) };
}

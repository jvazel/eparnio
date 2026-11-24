import mongoose from 'mongoose';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { TransactionModel } from '../models/Transaction.model';

export interface BudgetStreakResult {
  consecutiveWeeksInGreen: number;
  consecutiveMonthsRespected: number;
  status: 'in_green' | 'fresh_start';
  headline: string;
  subtext: string;
  weeklyRecap: {
    currentWeekSpent: number;
    weeklyAverageSpent: number;
    transactionsCount: number;
    bestControlledEnvelope: {
      name: string;
      icon: string;
      usagePercent: number;
    } | null;
  };
}

function getIsoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Calcule la série bienveillante (streaks) et le bilan hebdomadaire d'un budget.
 */
export async function computeBudgetStreak(budgetId: string): Promise<BudgetStreakResult> {
  const budgetObjectId = new mongoose.Types.ObjectId(budgetId);
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twelveWeeksAgo = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);

  const [recentTransactions, periods] = await Promise.all([
    TransactionModel.find({
      budgetId: budgetObjectId,
      date: { $gte: twelveWeeksAgo }
    })
      .select('amount date type')
      .lean(),
    BudgetPeriodModel.find({ budgetId: budgetObjectId })
      .sort({ year: -1, month: -1 })
      .limit(12)
      .lean()
  ]);

  // 1. Semaines consécutives avec activité de suivi
  const activeWeeks = new Set<string>();
  let currentWeekSpent = 0;
  let thirtyDaysSpent = 0;
  let currentWeekTxCount = 0;

  for (const tx of recentTransactions) {
    const txDate = new Date(tx.date);
    activeWeeks.add(getIsoWeekKey(txDate));
    if (txDate >= thirtyDaysAgo && tx.type === 'expense') {
      thirtyDaysSpent += tx.amount;
    }
    if (txDate >= sevenDaysAgo && tx.type === 'expense') {
      currentWeekSpent += tx.amount;
      currentWeekTxCount += 1;
    }
  }

  let consecutiveWeeksInGreen = 0;
  for (let i = 0; i < 12; i += 1) {
    const probeDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    if (activeWeeks.has(getIsoWeekKey(probeDate))) {
      consecutiveWeeksInGreen += 1;
    } else if (i === 0) {
      // La semaine en cours vient peut-être de commencer : on tolère sans casser la série
      continue;
    } else {
      break;
    }
  }

  // 2. Mois consécutifs respectés (dépenses <= revenus ou restant >= 0)
  let consecutiveMonthsRespected = 0;
  for (const period of periods) {
    const summary = period.summary as
      | { totalIncome?: number; totalFixed?: number; totalVariableSpent?: number; totalSavings?: number }
      | undefined;
    const totalIncome = summary?.totalIncome ?? 0;
    const totalOut =
      (summary?.totalFixed ?? 0) +
      (summary?.totalVariableSpent ?? 0) +
      (summary?.totalSavings ?? 0);

    if (totalIncome > 0 && totalIncome - totalOut >= 0) {
      consecutiveMonthsRespected += 1;
    } else if (totalIncome === 0 && totalOut === 0) {
      continue;
    } else {
      break;
    }
  }

  // 3. Meilleure enveloppe maîtrisée sur la période la plus récente
  let bestControlledEnvelope: BudgetStreakResult['weeklyRecap']['bestControlledEnvelope'] = null;
  const latestPeriod = periods[0];
  if (latestPeriod) {
    const envelopes = await EnvelopeModel.find({
      periodId: latestPeriod._id,
      pillar: 'variable_envelope',
      allocatedAmount: { $gt: 0 }
    })
      .select('name icon allocatedAmount spentOrPaidAmount')
      .lean();

    let bestRatio = Infinity;
    for (const env of envelopes) {
      const ratio = (env.spentOrPaidAmount ?? 0) / env.allocatedAmount;
      if (ratio < bestRatio && ratio <= 1) {
        bestRatio = ratio;
        bestControlledEnvelope = {
          name: env.name,
          icon: env.icon || '✉️',
          usagePercent: Math.round(ratio * 100)
        };
      }
    }
  }

  const weeklyAverageSpent = Math.round((thirtyDaysSpent / 4.28) * 100) / 100;
  const status: 'in_green' | 'fresh_start' =
    consecutiveWeeksInGreen >= 1 || consecutiveMonthsRespected >= 1 ? 'in_green' : 'fresh_start';

  let headline = 'Nouveau départ cette semaine';
  let subtext = 'Chaque saisie te rapproche d’un budget serein.';

  if (consecutiveMonthsRespected >= 2) {
    headline = `Budget respecté ${consecutiveMonthsRespected} mois de suite`;
    subtext = 'Ta régularité porte ses fruits, continue sur cette lancée !';
  } else if (consecutiveWeeksInGreen >= 2) {
    headline = `${consecutiveWeeksInGreen}e semaine dans le vert`;
    subtext = 'Tu gardes le cap sur tes enveloppes semaine après semaine.';
  } else if (consecutiveWeeksInGreen === 1) {
    headline = '1re semaine dans le vert';
    subtext = 'Bon début ! Continue de noter tes dépenses au fil de l’eau.';
  }

  return {
    consecutiveWeeksInGreen,
    consecutiveMonthsRespected,
    status,
    headline,
    subtext,
    weeklyRecap: {
      currentWeekSpent: Math.round(currentWeekSpent * 100) / 100,
      weeklyAverageSpent,
      transactionsCount: currentWeekTxCount,
      bestControlledEnvelope
    }
  };
}

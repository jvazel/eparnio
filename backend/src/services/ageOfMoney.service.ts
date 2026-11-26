import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { TransactionModel } from '../models/Transaction.model';

const MS_PER_DAY = 86_400_000;
const DEFAULT_MIN_SAMPLES = 10;
const DEFAULT_WINDOW_SIZE = 10;
const MAX_PERIODS_LOOKBACK = 6;
const TARGET_AGE_DAYS = 30;
const GROWING_AGE_DAYS = 15;

export type AgeOfMoneyStatus = 'learning' | 'tight' | 'growing' | 'target_reached';

export interface AgeOfMoneyFlow {
  amount: number;
  date: Date;
}

export interface AgeOfMoneyResult {
  ageDays: number | null;
  status: AgeOfMoneyStatus;
  sampleSize: number;
  minSamples: number;
  inflowsCount: number;
  deltaDays: number | null;
}

function toUtcMidnightMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function isValidFlow(flow: AgeOfMoneyFlow): boolean {
  return (
    Number.isFinite(flow.amount) &&
    flow.amount > 0 &&
    flow.date instanceof Date &&
    !Number.isNaN(flow.date.getTime())
  );
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calcule l'Âge de l'Argent (en jours) selon l'algorithme FIFO (First In, First Out).
 * Chaque sortie consomme les euros disponibles dans la plus ancienne entrée non épuisée.
 * Retourne la moyenne des âges sur les N dernières sorties (10 par défaut).
 */
export function computeAgeOfMoneyFromFlows(
  inflows: AgeOfMoneyFlow[],
  outflows: AgeOfMoneyFlow[],
  options: { minSamples?: number; windowSize?: number } = {}
): AgeOfMoneyResult {
  const minSamples = options.minSamples ?? DEFAULT_MIN_SAMPLES;
  const windowSize = options.windowSize ?? DEFAULT_WINDOW_SIZE;

  const validInflows = inflows
    .filter(isValidFlow)
    .map((flow) => ({
      remaining: flow.amount,
      dateMs: toUtcMidnightMs(flow.date)
    }))
    .sort((a, b) => a.dateMs - b.dateMs);

  const validOutflows = outflows
    .filter(isValidFlow)
    .map((flow) => ({
      amount: flow.amount,
      dateMs: toUtcMidnightMs(flow.date)
    }))
    .sort((a, b) => a.dateMs - b.dateMs);

  if (validInflows.length === 0 || validOutflows.length < minSamples) {
    return {
      ageDays: null,
      status: 'learning',
      sampleSize: validOutflows.length,
      minSamples,
      inflowsCount: validInflows.length,
      deltaDays: null
    };
  }

  let inflowIdx = 0;
  const outflowAges: number[] = [];

  for (const outflow of validOutflows) {
    let remainingOut = outflow.amount;
    let weightedAgeSum = 0;

    while (remainingOut > 1e-6 && inflowIdx < validInflows.length) {
      const bucket = validInflows[inflowIdx];
      if (bucket.remaining <= 1e-6) {
        inflowIdx += 1;
        continue;
      }

      const take = Math.min(remainingOut, bucket.remaining);
      const bucketAgeDays = Math.max(0, Math.round((outflow.dateMs - bucket.dateMs) / MS_PER_DAY));
      weightedAgeSum += take * bucketAgeDays;

      bucket.remaining -= take;
      remainingOut -= take;

      if (bucket.remaining <= 1e-6) {
        inflowIdx += 1;
      }
    }

    // Si les sorties dépassent les entrées disponibles, la portion non couverte compte pour 0 jour.
    const outflowAge = weightedAgeSum / outflow.amount;
    outflowAges.push(outflowAge);
  }

  const recentWindow = outflowAges.slice(-windowSize);
  const ageDays = Math.round(average(recentWindow));

  let deltaDays: number | null = null;
  if (outflowAges.length >= windowSize * 2) {
    const previousWindow = outflowAges.slice(-windowSize * 2, -windowSize);
    deltaDays = Math.round(average(recentWindow) - average(previousWindow));
  }

  const status: AgeOfMoneyStatus =
    ageDays >= TARGET_AGE_DAYS
      ? 'target_reached'
      : ageDays >= GROWING_AGE_DAYS
        ? 'growing'
        : 'tight';

  return {
    ageDays,
    status,
    sampleSize: validOutflows.length,
    minSamples,
    inflowsCount: validInflows.length,
    deltaDays
  };
}

/**
 * Calcule l'Âge de l'Argent d'un budget à partir des 6 dernières périodes :
 * - Entrées : enveloppes `income` pointées (`isPaid: true`)
 * - Sorties : charges fixes pointées (`fixed_charge`, `isPaid: true`) + transactions `expense` (> 0)
 */
export async function computeBudgetAgeOfMoney(budgetId: string): Promise<AgeOfMoneyResult> {
  const periods = await BudgetPeriodModel.find({ budgetId })
    .sort({ year: -1, month: -1 })
    .limit(MAX_PERIODS_LOOKBACK)
    .select('_id startDate')
    .lean();

  if (periods.length === 0) {
    return {
      ageDays: null,
      status: 'learning',
      sampleSize: 0,
      minSamples: DEFAULT_MIN_SAMPLES,
      inflowsCount: 0,
      deltaDays: null
    };
  }

  const periodIds = periods.map((p) => p._id);
  const periodStartById = new Map<string, Date>(
    periods.map((p) => [p._id.toString(), new Date(p.startDate)])
  );

  const [paidEnvelopes, expenseTransactions] = await Promise.all([
    EnvelopeModel.find({
      budgetPeriodId: { $in: periodIds },
      pillar: { $in: ['income', 'fixed_charge'] },
      isPaid: true
    })
      .select('budgetPeriodId pillar allocatedAmount spentOrPaidAmount date createdAt')
      .lean(),
    TransactionModel.find({
      budgetPeriodId: { $in: periodIds },
      type: 'expense',
      amount: { $gt: 0 }
    })
      .select('amount date')
      .lean()
  ]);

  const inflows: AgeOfMoneyFlow[] = [];
  const outflows: AgeOfMoneyFlow[] = [];

  for (const env of paidEnvelopes) {
    const fallbackDate = periodStartById.get(env.budgetPeriodId.toString()) ?? new Date();
    const rawDate = env.date ?? env.createdAt ?? fallbackDate;
    const date = new Date(rawDate);

    if (env.pillar === 'income') {
      if (env.allocatedAmount > 0) {
        inflows.push({ amount: env.allocatedAmount, date });
      }
    } else if (env.pillar === 'fixed_charge') {
      const amount = env.spentOrPaidAmount > 0 ? env.spentOrPaidAmount : env.allocatedAmount;
      if (amount > 0) {
        outflows.push({ amount, date });
      }
    }
  }

  for (const tx of expenseTransactions) {
    outflows.push({
      amount: tx.amount,
      date: new Date(tx.date)
    });
  }

  return computeAgeOfMoneyFromFlows(inflows, outflows);
}

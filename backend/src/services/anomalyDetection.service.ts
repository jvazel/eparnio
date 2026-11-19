import { Types } from 'mongoose';
import { EnvelopeModel } from '../models/Envelope.model';
import { TransactionModel } from '../models/Transaction.model';

export interface DetectedAnomalyItem {
  transactionId: string;
  envelopeId: string;
  envelopeName: string;
  label: string;
  amount: number;
  date: string;
  severity: 'info' | 'warning';
  reason: string;
}

export interface EnvelopeAnomalyThreshold {
  median: number;
  historyCount: number;
  warningThreshold: number | null;
}

export interface PeriodAnomaliesResult {
  anomalies: DetectedAnomalyItem[];
  envelopeThresholds: Record<string, EnvelopeAnomalyThreshold>;
}

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 100) / 100;
  }
  return Math.round(sorted[mid]! * 100) / 100;
}

function normalizeLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export async function detectPeriodAnomalies(params: {
  budgetId: Types.ObjectId;
  periodId: Types.ObjectId;
}): Promise<PeriodAnomaliesResult> {
  const { budgetId, periodId } = params;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [periodEnvelopes, periodTxs, historicalTxs] = await Promise.all([
    EnvelopeModel.find({ budgetPeriodId: periodId, pillar: 'variable_envelope' }).select(
      'name allocatedAmount rolloverAmount spentOrPaidAmount'
    ),
    TransactionModel.find({ budgetPeriodId: periodId, type: 'expense' }).sort({ date: -1 }),
    TransactionModel.find({
      budgetId,
      budgetPeriodId: { $ne: periodId },
      type: 'expense',
      date: { $gte: sixMonthsAgo }
    }).select('envelopeId label amount')
  ]);

  const envelopeById = new Map(periodEnvelopes.map((e) => [e._id.toString(), e]));

  // Grouper l'historique par nom d'enveloppe normalisé + par enveloppeId
  const historyAmountsByEnvId = new Map<string, number[]>();
  const historicalLabels = new Set<string>();

  for (const tx of historicalTxs) {
    historicalLabels.add(normalizeLabel(tx.label));
    const envId = tx.envelopeId.toString();
    const list = historyAmountsByEnvId.get(envId) ?? [];
    list.push(tx.amount);
    historyAmountsByEnvId.set(envId, list);
  }

  // Inclure aussi les transactions de la période courante si l'historique est encore court
  for (const tx of periodTxs) {
    const envId = tx.envelopeId.toString();
    const list = historyAmountsByEnvId.get(envId) ?? [];
    list.push(tx.amount);
    historyAmountsByEnvId.set(envId, list);
  }

  const envelopeThresholds: Record<string, EnvelopeAnomalyThreshold> = {};
  for (const env of periodEnvelopes) {
    const envId = env._id.toString();
    const amounts = historyAmountsByEnvId.get(envId) ?? [];
    const median = computeMedian(amounts);
    const historyCount = amounts.length;
    envelopeThresholds[envId] = {
      median,
      historyCount,
      warningThreshold: historyCount >= 5 && median > 0 ? Math.round(median * 2 * 100) / 100 : null
    };
  }

  const anomalies: DetectedAnomalyItem[] = [];

  for (const tx of periodTxs) {
    if (tx.isAnomalyDismissed) continue;

    const envId = tx.envelopeId.toString();
    const env = envelopeById.get(envId);
    if (!env) continue;

    const threshold = envelopeThresholds[envId];
    const available = env.allocatedAmount + (env.rolloverAmount ?? 0);
    const reasons: string[] = [];
    let severity: 'info' | 'warning' = 'info';

    if (threshold?.warningThreshold && tx.amount > threshold.warningThreshold) {
      const ratio = Math.round((tx.amount / threshold.median) * 10) / 10;
      reasons.push(`${ratio}x superieur a la mediane habituelle (${threshold.median.toFixed(2)} EUR)`);
      severity = 'warning';
    }

    if (available > 0 && tx.amount > available * 0.5) {
      reasons.push(`Consomme plus de 50 % du budget de l'enveloppe`);
      severity = 'warning';
    }

    const normLabel = normalizeLabel(tx.label);
    if (historicalTxs.length >= 5 && !historicalLabels.has(normLabel) && tx.amount >= 100) {
      reasons.push('Nouveau libelle avec un montant eleve (>= 100 EUR)');
    }

    if (reasons.length > 0) {
      anomalies.push({
        transactionId: tx._id.toString(),
        envelopeId: envId,
        envelopeName: env.name,
        label: tx.label,
        amount: tx.amount,
        date: tx.date.toISOString(),
        severity,
        reason: reasons[0]!
      });
    }
  }

  return { anomalies, envelopeThresholds };
}

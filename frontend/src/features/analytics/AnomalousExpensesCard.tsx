import { AlertTriangle, Check } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import type { DetectedAnomalyItem } from '../../services/transaction.service';
import { formatCurrency } from '../../utils/format';

export interface AnomalousExpensesCardProps {
  anomalies: DetectedAnomalyItem[];
  onDismiss: (transactionId: string) => void;
}

export function AnomalousExpensesCard({ anomalies, onDismiss }: AnomalousExpensesCardProps) {
  if (anomalies.length === 0) return null;

  return (
    <Card className="space-y-3 border-amber-200/80 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Dépenses atypiques du mois
        </h3>
      </div>

      <div className="space-y-2">
        {anomalies.map((item) => (
          <div
            key={item.transactionId}
            className="flex items-start justify-between gap-2 rounded-2xl border border-amber-200/70 bg-white/90 p-3 dark:border-amber-900/40 dark:bg-slate-900/70"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {item.label} · {formatCurrency(item.amount)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {item.envelopeName} — {item.reason}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(item.transactionId)}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Check className="h-3.5 w-3.5" />
              C&apos;est normal
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

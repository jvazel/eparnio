import { AlertCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import type { EnvelopeItem } from '../../types/budget.types';
import { formatCurrency } from '../../utils/format';

export interface EnvelopesAtRiskCardProps {
  envelopes: EnvelopeItem[];
  totalDays: number;
  daysRemaining: number;
}

/**
 * Met en avant les 2 à 3 enveloppes variables dont la consommation dépasse le plus l'avancement du mois.
 */
export function EnvelopesAtRiskCard({
  envelopes,
  totalDays,
  daysRemaining
}: EnvelopesAtRiskCardProps) {
  const safeTotalDays = Math.max(1, totalDays);
  const elapsedDays = Math.min(safeTotalDays, Math.max(1, safeTotalDays - Math.max(0, daysRemaining)));
  const monthRatio = elapsedDays / safeTotalDays;

  const atRisk = envelopes
    .filter((env) => env.pillar === 'variable_envelope')
    .map((env) => {
      const available = env.allocatedAmount + (env.rolloverAmount ?? 0);
      const ratio = available > 0 ? env.spentOrPaidAmount / available : 0;
      return {
        env,
        available,
        ratio,
        percent: Math.round(ratio * 100)
      };
    })
    .filter((item) => item.available > 0 && (item.ratio > monthRatio + 0.1 || item.ratio >= 0.8))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3);

  if (atRisk.length === 0) {
    return null;
  }

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-500" aria-hidden="true" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">
          Enveloppes en tension
        </h3>
      </div>

      <div className="space-y-2.5">
        {atRisk.map(({ env, available, percent }) => (
          <div key={env.id} className="flex items-center justify-between text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true">{env.icon}</span>
              <span className="truncate font-semibold text-slate-800 dark:text-slate-100">
                {env.name}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-slate-500 tabular-nums dark:text-slate-400">
                {formatCurrency(env.spentOrPaidAmount)} / {formatCurrency(available)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                  percent >= 100
                    ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                }`}
              >
                {percent}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

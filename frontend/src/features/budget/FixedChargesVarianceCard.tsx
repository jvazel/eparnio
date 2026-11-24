import { TrendingDown, TrendingUp } from 'lucide-react';

export interface FixedChargeVarianceItem {
  envelopeId: string;
  name: string;
  icon: string;
  pillar: 'income' | 'fixed_charge';
  previousAmount: number;
  currentAmount: number;
  deltaAmount: number;
  deltaPercent: number;
}

export interface FixedChargesVarianceSummary {
  netDelta: number;
  increasesCount: number;
  decreasesCount: number;
  items: FixedChargeVarianceItem[];
}

export function VariancePill({ deltaAmount }: { deltaAmount: number }) {
  if (Math.abs(deltaAmount) < 0.01) return null;
  const isIncrease = deltaAmount > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
        isIncrease
          ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
      }`}
    >
      {isIncrease ? '↗ +' : '↘ '}
      {deltaAmount.toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}{' '}
      €
    </span>
  );
}

export function FixedChargesVarianceCard({
  summary,
}: {
  summary?: FixedChargesVarianceSummary;
}) {
  if (!summary || summary.items.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100/80 dark:border-slate-700/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {summary.netDelta >= 0 ? (
            <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          )}
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Évolution des charges fixes
          </h3>
        </div>
        <VariancePill deltaAmount={summary.netDelta} />
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {summary.items.map((item) => (
          <div
            key={item.envelopeId}
            className="py-2 flex items-center justify-between gap-2 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span>{item.icon}</span>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {item.name}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                  Mois précédent : {item.previousAmount.toFixed(2)} €
                </p>
              </div>
            </div>
            <VariancePill deltaAmount={item.deltaAmount} />
          </div>
        ))}
      </div>
    </div>
  );
}

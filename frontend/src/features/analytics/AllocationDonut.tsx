import { Card } from '../../components/ui/Card';
import type { AllocationAnalytics } from '../../types/budget.types';

export interface AllocationDonutProps {
  allocation: AllocationAnalytics;
}

/**
 * Carte 3 de l'onglet « Budget » (« Part des dépenses par rapport aux revenus ») :
 * Donut 3 couleurs (Fixe violet, Variable bleu, Épargne vert) et légende en pourcentages.
 */
export function AllocationDonutCard({ allocation }: AllocationDonutProps) {
  const size = 112;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const positiveItems = allocation.items.filter((item) => item.amount > 0);
  const segmentsTotal = positiveItems.reduce((acc, item) => acc + item.amount, 0);
  let cumulativeOffset = 0;

  return (
    <Card>
      <h2 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-50">
        Part des dépenses par rapport aux revenus
      </h2>
      <div className="flex items-center gap-4">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={
            segmentsTotal > 0
              ? `Répartition des dépenses : ${allocation.items
                  .map((item) => `${item.label} ${item.percentage.toFixed(1)}%`)
                  .join(', ')}`
              : 'Aucune dépense ou épargne saisie sur la période'
          }
          className="shrink-0 -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
          />
          {segmentsTotal > 0
            ? positiveItems.map((item) => {
                const ratio = item.amount / segmentsTotal;
                const dashLength = ratio * circumference;
                const dashOffset = -cumulativeOffset;
                cumulativeOffset += dashLength;

                return (
                  <circle
                    key={item.key}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke={item.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${dashLength} ${circumference}`}
                    strokeDashoffset={dashOffset}
                  />
                );
              })
            : null}
        </svg>

        <ul className="min-w-0 flex-1 space-y-2.5">
          {allocation.items.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-slate-700">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                <span className="truncate font-medium">{item.label}</span>
              </span>
              <span className="shrink-0 font-bold tabular-nums text-slate-900">
                {item.percentage.toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

export { AllocationDonutCard as AllocationDonut };

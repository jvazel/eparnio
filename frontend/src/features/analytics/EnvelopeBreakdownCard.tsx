import { Card } from '../../components/ui/Card';
import type { EnvelopeItem } from '../../types/budget.types';
import { formatCurrency } from '../../utils/format';

export interface EnvelopeBreakdownCardProps {
  envelopes: EnvelopeItem[];
}

/**
 * Carte « Détails des enveloppes » de l'onglet « Budget » :
 * Budget réparti, Budget consommé, Reste à dépenser et Donut de répartition des dépenses par enveloppe.
 */
export function EnvelopeBreakdownCard({ envelopes }: EnvelopeBreakdownCardProps) {
  const variableEnvelopes = envelopes.filter((env) => env.pillar === 'variable_envelope');
  const totalAllocated = variableEnvelopes.reduce((acc, env) => acc + env.allocatedAmount, 0);
  const totalSpent = variableEnvelopes.reduce((acc, env) => acc + env.spentOrPaidAmount, 0);
  const remaining = totalAllocated - totalSpent;

  const spentEnvelopes = variableEnvelopes.filter((env) => env.spentOrPaidAmount > 0);
  const positiveTotalSpent = spentEnvelopes.reduce((acc, env) => acc + env.spentOrPaidAmount, 0);
  const size = 112;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  return (
    <Card>
      <h2 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-50">
        Détails des enveloppes
      </h2>

      <div className="mb-3 grid grid-cols-2 gap-3 text-center">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Budget réparti</p>
          <p className="mt-0.5 text-base font-bold tabular-nums text-blue-600 dark:text-blue-400">
            {formatCurrency(totalAllocated)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Budget consommé</p>
          <p className="mt-0.5 text-base font-bold tabular-nums text-blue-600 dark:text-blue-400">
            {formatCurrency(totalSpent)}
          </p>
        </div>
      </div>

      <p className="mb-4 text-center text-xs font-medium text-slate-700 dark:text-slate-300">
        Il reste{' '}
        <span className="font-bold tabular-nums text-red-500 dark:text-red-400">
          {formatCurrency(remaining)}
        </span>{' '}
        à dépenser
      </p>

      {spentEnvelopes.length === 0 || positiveTotalSpent <= 0 ? (
        <p className="rounded-xl bg-slate-50 py-4 text-center text-xs font-medium text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          Aucune dépense variable ce mois-ci
        </p>
      ) : (
        <div className="flex items-center gap-4">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label={`Répartition du budget consommé : ${spentEnvelopes
              .map(
                (env) =>
                  `${env.name} ${((env.spentOrPaidAmount / positiveTotalSpent) * 100).toFixed(1)}%`
              )
              .join(', ')}`}
            className="shrink-0 -rotate-90"
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-700"
              strokeWidth={strokeWidth}
            />
            {spentEnvelopes.map((env) => {
              const ratio = env.spentOrPaidAmount / positiveTotalSpent;
              const dashLength = ratio * circumference;
              const dashOffset = -cumulativeOffset;
              cumulativeOffset += dashLength;

              return (
                <circle
                  key={env.id}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={env.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dashLength} ${circumference}`}
                  strokeDashoffset={dashOffset}
                />
              );
            })}
          </svg>

          <ul className="min-w-0 flex-1 space-y-2">
            {spentEnvelopes.map((env) => {
              const percentage = (env.spentOrPaidAmount / positiveTotalSpent) * 100;
              return (
                <li key={env.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2 text-slate-700 dark:text-slate-300">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: env.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate font-medium">{env.name} :</span>
                  </span>
                  <span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-slate-50">
                    {percentage.toFixed(1)} %
                  </span>
                </li>
              );
            })}
            <li className="border-t border-slate-100 pt-1.5 text-xs font-bold text-slate-900 dark:border-slate-800 dark:text-slate-50">
              Total : 100%
            </li>
          </ul>
        </div>
      )}
    </Card>
  );
}

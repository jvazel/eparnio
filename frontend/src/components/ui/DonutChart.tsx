import { useState } from 'react';
import { formatCurrency } from '../../utils/format';
import { Card } from './Card';

export interface DonutSegmentItem {
  id: string;
  label: string;
  amount: number;
  color: string;
}

export interface DonutSummaryCardProps {
  title?: string;
  total: number;
  items: DonutSegmentItem[];
  allowModeToggle?: boolean;
  emptyMessage?: string;
}

/**
 * Carte de synthèse avec Donut SVG multicolore, légende à puces colorées
 * et bascule optionnelle € | % (calibrée sur les captures Finzee Revenus & Epargne).
 */
export function DonutSummaryCard({
  title = 'Total',
  total,
  items,
  allowModeToggle = true,
  emptyMessage = 'Aucun élément saisi ce mois-ci. Appuyez sur + pour commencer.'
}: DonutSummaryCardProps) {
  const [displayMode, setDisplayMode] = useState<'eur' | 'pct'>('eur');

  const size = 112;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const positiveItems = items.filter((item) => item.amount > 0);
  const segmentsTotal = positiveItems.reduce((acc, item) => acc + item.amount, 0);

  let cumulativeOffset = 0;

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {formatCurrency(total)}
          </p>
        </div>

        {allowModeToggle ? (
          <div
            role="group"
            aria-label="Mode d’affichage du graphique"
            className="inline-flex rounded-full bg-slate-100 p-1 dark:bg-slate-800"
          >
            <button
              type="button"
              aria-pressed={displayMode === 'eur'}
              onClick={() => setDisplayMode('eur')}
              className={`min-h-8 min-w-10 rounded-full px-3 text-xs font-bold transition-colors ${
                displayMode === 'eur'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              €
            </button>
            <button
              type="button"
              aria-pressed={displayMode === 'pct'}
              onClick={() => setDisplayMode('pct')}
              className={`min-h-8 min-w-10 rounded-full px-3 text-xs font-bold transition-colors ${
                displayMode === 'pct'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              %
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Répartition ${title} : ${formatCurrency(total)}`}
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
                    key={item.id}
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

        {items.length > 0 ? (
          <ul className="min-w-0 flex-1 space-y-2">
            {items.map((item) => {
              const percentage = segmentsTotal > 0 ? (item.amount / segmentsTotal) * 100 : 0;
              return (
                <li key={item.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 text-slate-700">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate font-medium">{item.label}</span>
                  </span>
                  <span className="shrink-0 font-bold tabular-nums text-slate-900">
                    {displayMode === 'eur'
                      ? formatCurrency(item.amount)
                      : `${percentage.toFixed(1)} %`}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="flex-1 text-xs leading-relaxed text-slate-500">{emptyMessage}</p>
        )}
      </div>
    </Card>
  );
}

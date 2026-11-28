import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import type { EnvelopeComparisonItem } from '../../types/budget.types';
import { formatCurrency } from '../../utils/format';

export interface EnvelopeComparisonCardProps {
  comparisons: EnvelopeComparisonItem[];
  onSelectEnvelope?: (envelopeId: string) => void;
}

/**
 * Carte Pilotage (Mode Détaillé) — Comparaison de chaque enveloppe variable
 * face à sa moyenne réelle sur 3 mois ou au mois précédent (M-1).
 */
export function EnvelopeComparisonCard({
  comparisons,
  onSelectEnvelope
}: EnvelopeComparisonCardProps) {
  const [mode, setMode] = useState<'avg3m' | 'prev'>('avg3m');

  const itemsWithHistory = comparisons
    .filter((item) =>
      mode === 'avg3m' ? item.average3mSpent !== null : item.previousMonthSpent !== null
    )
    .sort((a, b) => {
      const deltaA = Math.abs((mode === 'avg3m' ? a.deltaVsAverage3m : a.deltaVsPrevious) ?? 0);
      const deltaB = Math.abs((mode === 'avg3m' ? b.deltaVsAverage3m : b.deltaVsPrevious) ?? 0);
      return deltaB - deltaA;
    });

  if (itemsWithHistory.length === 0) {
    return null;
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Comparaison par enveloppe
        </h3>
        <div
          role="group"
          aria-label="Mode de comparaison des enveloppes"
          className="inline-flex rounded-full bg-slate-100 p-0.5 text-[11px] font-semibold dark:bg-slate-800"
        >
          <button
            type="button"
            onClick={() => setMode('avg3m')}
            className={`rounded-full px-2.5 py-1 transition-colors ${
              mode === 'avg3m'
                ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-900 dark:text-violet-300'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Moy. 3 mois
          </button>
          <button
            type="button"
            onClick={() => setMode('prev')}
            className={`rounded-full px-2.5 py-1 transition-colors ${
              mode === 'prev'
                ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-900 dark:text-violet-300'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Mois préc.
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {itemsWithHistory.slice(0, 6).map((item) => {
          const delta = mode === 'avg3m' ? item.deltaVsAverage3m ?? 0 : item.deltaVsPrevious ?? 0;
          const refAmount =
            mode === 'avg3m' ? item.average3mSpent ?? 0 : item.previousMonthSpent ?? 0;
          const pct =
            mode === 'avg3m'
              ? item.percentVsAverage3m
              : refAmount > 0
                ? Math.round((delta / refAmount) * 100)
                : null;
          const isHigher = delta > 0.01;
          const isLower = delta < -0.01;

          return (
            <button
              key={item.envelopeId}
              type="button"
              onClick={() => onSelectEnvelope?.(item.envelopeId)}
              className="flex w-full items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 text-left transition-colors hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="text-base" aria-hidden="true">
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {item.name}
                  </p>
                  <p className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                    {formatCurrency(item.currentSpent)} vs {formatCurrency(refAmount)}
                  </p>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums ${
                  isHigher
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    : isLower
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {delta > 0 ? '+' : ''}
                {formatCurrency(delta)}
                {pct !== null ? ` (${pct > 0 ? '+' : ''}${pct} %)` : ''}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

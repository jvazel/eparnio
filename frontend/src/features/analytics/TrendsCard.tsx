import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import type { BudgetTrendItem } from '../../services/analytics.service';
import { formatCurrency } from '../../utils/format';

type TrendFilter = 'all' | 'variables' | 'savings';

export interface TrendsCardProps {
  items: BudgetTrendItem[];
}

/**
 * Carte « Évolution multi-mois » de l'onglet « Budget » :
 * Graphique en barres SVG léger avec filtre (Tout / Variables / Épargne).
 */
export function TrendsCard({ items }: TrendsCardProps) {
  const [filter, setFilter] = useState<TrendFilter>('all');

  if (items.length === 0) {
    return null;
  }

  const maxValue = Math.max(
    1,
    ...items.flatMap((item) => {
      if (filter === 'variables') {
        return [item.spentVariables];
      }
      if (filter === 'savings') {
        return [item.plannedSavings];
      }
      return [item.plannedFixedCharges, item.spentVariables, item.plannedSavings];
    })
  );

  const chartHeight = 110;

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">
          Évolution sur {items.length} mois
        </h2>
        <div
          className="inline-flex rounded-xl bg-slate-100 p-0.5 text-[11px] font-semibold dark:bg-slate-800"
          role="group"
          aria-label="Filtrer les tendances"
        >
          {(
            [
              { id: 'all', label: 'Tout' },
              { id: 'variables', label: 'Variables' },
              { id: 'savings', label: 'Épargne' }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              aria-pressed={filter === tab.id}
              className={`rounded-lg px-2.5 py-1 transition-colors ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2 pt-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const shortMonth = item.label.split(' ')[0]?.slice(0, 4) ?? `${item.month}`;
          const bars =
            filter === 'variables'
              ? [{ key: 'var', value: item.spentVariables, color: '#3B82F6', label: 'Variables' }]
              : filter === 'savings'
                ? [{ key: 'sav', value: item.plannedSavings, color: '#22C55E', label: 'Épargne' }]
                : [
                    { key: 'fix', value: item.plannedFixedCharges, color: '#8B5CF6', label: 'Fixes' },
                    { key: 'var', value: item.spentVariables, color: '#3B82F6', label: 'Variables' },
                    { key: 'sav', value: item.plannedSavings, color: '#22C55E', label: 'Épargne' }
                  ];

          return (
            <div key={item.periodId} className="flex flex-col items-center gap-1.5">
              <div
                className="flex w-full items-end justify-center gap-1"
                style={{ height: `${chartHeight}px` }}
              >
                {bars.map((bar) => {
                  const heightPx = Math.max(4, Math.round((bar.value / maxValue) * chartHeight));
                  return (
                    <div
                      key={bar.key}
                      title={`${bar.label} (${item.label}) : ${formatCurrency(bar.value)}`}
                      className="w-2.5 rounded-t-md transition-all"
                      style={{
                        height: `${heightPx}px`,
                        backgroundColor: bar.color
                      }}
                    />
                  );
                })}
              </div>
              <span className="truncate text-[11px] font-medium capitalize text-slate-500 dark:text-slate-400">
                {shortMonth}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-4 border-t border-slate-100 pt-2.5 text-[11px] font-medium text-slate-600 dark:border-slate-800 dark:text-slate-300">
        {filter === 'all' ? (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-500" aria-hidden="true" />
            Fixes
          </span>
        ) : null}
        {filter !== 'savings' ? (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" aria-hidden="true" />
            Variables
          </span>
        ) : null}
        {filter !== 'variables' ? (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Épargne
          </span>
        ) : null}
      </div>
    </Card>
  );
}

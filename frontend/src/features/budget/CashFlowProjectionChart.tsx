import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDateKeyDDMMYYYY, type CashFlowPoint } from '../../services/calendar.service';

interface CashFlowProjectionChartProps {
  curve: CashFlowPoint[];
  dailyVariablePace: number;
}

export function CashFlowProjectionChart({
  curve,
  dailyVariablePace,
}: CashFlowProjectionChartProps) {
  const [includeVariablePace, setIncludeVariablePace] = useState(false);

  if (curve.length === 0) return null;

  const chartData = curve.map((pt) => ({
    ...pt,
    shortDate: formatDateKeyDDMMYYYY(pt.dateKey).slice(0, 5),
    fullDate: formatDateKeyDDMMYYYY(pt.dateKey),
    projectedValue: includeVariablePace
      ? pt.projectedBalanceWithVariablePace
      : pt.projectedBalance,
  }));

  const finalBalance = chartData[chartData.length - 1]?.projectedValue ?? 0;
  const hasNegativeDip = chartData.some((pt) => pt.projectedValue < 0);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100/80 dark:border-slate-700/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Trésorerie projetée sur le cycle
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Solde fin de mois estimé :{' '}
            <span
              className={`font-bold tabular-nums ${
                finalBalance >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-500 dark:text-red-400'
              }`}
            >
              {finalBalance.toLocaleString('fr-FR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              €
            </span>
          </p>
        </div>

        {hasNegativeDip && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
            Creux &lt; 0 €
          </span>
        )}
      </div>

      {dailyVariablePace > 0 && (
        <label className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2 cursor-pointer">
          <span>
            Inclure le budget quotidien moyen ({dailyVariablePace.toFixed(2)} €/j)
          </span>
          <input
            type="checkbox"
            checked={includeVariablePace}
            onChange={(e) => setIncludeVariablePace(e.target.checked)}
            className="w-4 h-4 rounded accent-violet-600"
          />
        </label>
      )}

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.5} />
            <XAxis
              dataKey="shortDate"
              tick={{ fontSize: 10, fill: '#94A3B8' }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94A3B8' }}
              tickFormatter={(v: number) => `${Math.round(v)}€`}
            />
            <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="4 4" strokeWidth={1.5} />
            <Tooltip
              formatter={(value: unknown, name: string) => [
                `${Number(value).toLocaleString('fr-FR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} €`,
                name === 'realizedBalance' ? 'Réalisé' : 'Projeté',
              ]}
              labelFormatter={(_label: string, payload?: Array<{ payload?: { fullDate?: string } }>) =>
                payload?.[0]?.payload?.fullDate ?? ''
              }
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 4px 20px rgba(15,23,42,0.12)',
                fontSize: '12px',
              }}
            />
            <Line
              type="monotone"
              dataKey="projectedValue"
              stroke="#8B5CF6"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="realizedBalance"
              stroke="#1D7DFA"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

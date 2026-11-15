import { formatCurrency } from '../../utils/format';

export interface RingGaugeProps {
  value: number;
  max: number;
  label: string;
  size?: number;
  strokeWidth?: number;
  accentColor?: string;
}

/**
 * Jauge circulaire SVG à bords arrondis affichant le montant disponible au centre.
 */
export function RingGauge({
  value,
  max,
  label,
  size = 176,
  strokeWidth = 15,
  accentColor
}: RingGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const dashOffset = circumference * (1 - ratio);
  const resolvedColor = accentColor ?? (value < 0 ? '#EF4444' : '#3B82F6');

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="img"
          aria-label={`${label} : ${formatCurrency(value)}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
            className="dark:stroke-slate-700"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-300"
          />
        </svg>
        <span
          className={`absolute px-3 text-center text-xl font-bold tabular-nums ${
            value < 0 ? 'text-red-500' : 'text-slate-900 dark:text-slate-50'
          }`}
        >
          {formatCurrency(value)}
        </span>
      </div>
    </div>
  );
}

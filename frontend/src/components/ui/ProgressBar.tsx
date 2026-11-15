export interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  label?: string;
  className?: string;
}

/**
 * Barre de progression linéaire fine pour les objectifs d'épargne et jauges horizontales.
 */
export function ProgressBar({
  value,
  max,
  color = '#7C3AED',
  label,
  className = ''
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1;
  const percentage = Math.min(100, Math.max(0, (value / safeMax) * 100));

  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-slate-700 ${className}`.trim()}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${percentage}%`,
          backgroundColor: color
        }}
      />
    </div>
  );
}

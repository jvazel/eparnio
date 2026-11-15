import type { EnvelopeItem } from '../../types/budget.types';
import { formatCurrency } from '../../utils/format';

export interface PastelTheme {
  background: string;
  ring: string;
}

const PASTEL_THEME_MAP: Record<string, PastelTheme> = {
  '#16A34A': { background: '#CBEAD6', ring: '#16A34A' },
  '#34D399': { background: '#CBEAD6', ring: '#15803D' },
  '#6EE7B7': { background: '#CBEAD6', ring: '#16A34A' },
  '#38BDF8': { background: '#D6F0F3', ring: '#0EA5E9' },
  '#075985': { background: '#D6F0F3', ring: '#0284C7' },
  '#F472B6': { background: '#F8D4E6', ring: '#EC4899' },
  '#F87171': { background: '#F8D4E6', ring: '#EC4899' },
  '#FCE96A': { background: '#FEF0C7', ring: '#F59E0B' },
  '#FB923C': { background: '#FEF0C7', ring: '#F59E0B' },
  '#4F46E5': { background: '#EDE9FE', ring: '#7C3AED' },
  '#E879F9': { background: '#EDE9FE', ring: '#7C3AED' }
};

/**
 * Associe une couleur d'enveloppe à son thème pastel Finzee (Menthe, Glacier, Rose, Vanille, Lavande).
 */
export function resolvePastelTheme(color: string): PastelTheme {
  const normalized = color.trim().toUpperCase();
  return (
    PASTEL_THEME_MAP[normalized] ?? {
      background: '#D6F0F3',
      ring: '#0EA5E9'
    }
  );
}

export interface PastelEnvelopeCardProps {
  envelope: EnvelopeItem;
  onSelect: (envelope: EnvelopeItem) => void;
}

/**
 * Tuile pastel 2 colonnes d'une enveloppe variable (calibrée sur Finzee)
 * avec mini anneau de progression SVG autour de l'emoji et lignes Montant / Restant.
 */
export function PastelEnvelopeCard({ envelope, onSelect }: PastelEnvelopeCardProps) {
  const theme = resolvePastelTheme(envelope.color);
  const remaining = Math.round((envelope.allocatedAmount - envelope.spentOrPaidAmount) * 100) / 100;

  const usageRatio =
    envelope.allocatedAmount > 0
      ? envelope.spentOrPaidAmount / envelope.allocatedAmount
      : envelope.spentOrPaidAmount > 0
        ? 1
        : 0;

  const clampedProgress = Math.min(1, Math.max(0, usageRatio));
  const isOverBudget = remaining < 0;
  const isWarning = !isOverBudget && usageRatio >= 0.7;
  const isAlert = isOverBudget || usageRatio >= 0.95;

  const ringStrokeColor = isAlert ? '#EF4444' : isWarning ? '#F59E0B' : theme.ring;

  const ringSize = 44;
  const strokeWidth = 4;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clampedProgress);

  return (
    <button
      type="button"
      onClick={() => onSelect(envelope)}
      aria-label={`Ouvrir l’enveloppe ${envelope.name}`}
      style={{ backgroundColor: theme.background }}
      className="flex min-h-11 w-full flex-col justify-between gap-3 rounded-2xl p-3.5 text-left shadow-card transition-transform active:scale-[0.98]"
    >
      <div className="flex items-center gap-2.5">
        <div
          className="relative flex shrink-0 items-center justify-center"
          style={{ width: ringSize, height: ringSize }}
          aria-hidden="true"
        >
          <svg
            width={ringSize}
            height={ringSize}
            viewBox={`0 0 ${ringSize} ${ringSize}`}
            className="-rotate-90"
          >
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.75)"
              strokeWidth={strokeWidth}
            />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke={ringStrokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <span className="absolute flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg shadow-sm">
            {envelope.icon}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-bold leading-tight text-slate-900">
            {envelope.name}
          </p>
          {isOverBudget ? (
            <span className="mt-0.5 inline-block rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
              Dépassée
            </span>
          ) : usageRatio >= 0.95 && envelope.allocatedAmount > 0 ? (
            <span className="mt-0.5 inline-block rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
              Presque vide
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-1.5 text-slate-700">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#3B82F6]" aria-hidden="true" />
          <span className="truncate">Montant :</span>
          <span className="ml-auto font-bold tabular-nums text-slate-900">
            {formatCurrency(envelope.allocatedAmount)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-700">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#EF4444]" aria-hidden="true" />
          <span className="truncate">Restant :</span>
          <span
            className={`ml-auto font-bold tabular-nums ${
              isOverBudget ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {formatCurrency(remaining)}
          </span>
        </div>
      </div>
    </button>
  );
}

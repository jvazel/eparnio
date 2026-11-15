import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

export interface ZeroBasedBannerProps {
  remainingToAllocate: number;
  plannedIncome?: number;
  className?: string;
}

/**
 * Bandeau pédagogique d'équilibre Base Zéro affichant le montant restant à attribuer en direct.
 */
export function ZeroBasedBanner({
  remainingToAllocate,
  plannedIncome = 0,
  className = ''
}: ZeroBasedBannerProps) {
  const isEmpty = Math.abs(plannedIncome) < 0.01 && Math.abs(remainingToAllocate) < 0.01;
  const isBalanced = !isEmpty && Math.abs(remainingToAllocate) < 0.01;
  const isOverAllocated = remainingToAllocate <= -0.01;

  const containerStyle = isOverAllocated
    ? 'border-red-100 bg-red-50/90 text-red-900'
    : isBalanced
      ? 'border-emerald-100 bg-emerald-50/90 text-emerald-900'
      : 'border-violet-100 bg-gradient-to-r from-violet-50/90 to-blue-50/80 text-slate-900';

  const badgeStyle = isOverAllocated
    ? 'bg-red-100 text-red-700'
    : isBalanced
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-white text-violet-700 shadow-sm';

  const statusText = isEmpty
    ? 'Ajoutez vos revenus du mois pour démarrer votre Budget Base Zéro.'
    : isBalanced
      ? 'Parfait ! Chaque euro du mois a un rôle précis (0 € restant).'
      : isOverAllocated
        ? `Vos prévisions dépassent vos revenus de ${formatCurrency(Math.abs(remainingToAllocate))}.`
        : 'Attribuez chaque euro à une dépense, enveloppe ou épargne.';

  const Icon = isOverAllocated ? AlertTriangle : isBalanced ? CheckCircle2 : Sparkles;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-2xl border px-4 py-3 transition-colors ${containerStyle} ${className}`.trim()}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${badgeStyle}`}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide opacity-80">
              Restant à répartir
            </p>
            <p className="truncate text-xs opacity-85">{statusText}</p>
          </div>
        </div>
        <span
          className={`shrink-0 text-base font-bold tabular-nums ${
            isOverAllocated
              ? 'text-red-600'
              : isBalanced
                ? 'text-emerald-700'
                : 'text-violet-700'
          }`}
        >
          {formatCurrency(remainingToAllocate)}
        </span>
      </div>
    </div>
  );
}

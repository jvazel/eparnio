import { Flame, Sparkles, ChevronRight } from 'lucide-react';
import type { BudgetStreakData } from '../../services/analytics.service';

interface StreakBadgeCardProps {
  streak: BudgetStreakData;
  onOpenRecap: () => void;
}

/**
 * Badge/carte bienveillante affichant la série de suivi (semaines/mois dans le vert)
 * sans logique punitive.
 */
export function StreakBadgeCard({ streak, onOpenRecap }: StreakBadgeCardProps) {
  const isInGreen = streak.status === 'in_green';

  return (
    <button
      type="button"
      onClick={onOpenRecap}
      className={`w-full rounded-2xl p-3.5 text-left transition-all active:scale-[0.99] flex items-center justify-between gap-3 border ${
        isInGreen
          ? 'bg-emerald-50/90 border-emerald-200/80 text-emerald-950 dark:bg-emerald-950/35 dark:border-emerald-800/60 dark:text-emerald-100'
          : 'bg-sky-50/90 border-sky-200/80 text-sky-950 dark:bg-sky-950/35 dark:border-sky-800/60 dark:text-sky-100'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isInGreen
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
          }`}
        >
          {isInGreen ? <Flame className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{streak.headline}</p>
          <p className="truncate text-xs opacity-80">{streak.subtext}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
    </button>
  );
}

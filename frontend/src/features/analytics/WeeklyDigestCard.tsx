import { CalendarClock, ChevronRight, Sparkles } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import type { WeeklyDigestResult } from '../../services/weeklyHabit.service';
import { formatCurrency } from '../../utils/format';

export interface WeeklyDigestCardProps {
  digest: WeeklyDigestResult;
  onOpenDigest: () => void;
}

const RHYTHM_META = {
  serene: {
    label: 'Rythme serein',
    badgeClass:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
  },
  watch: {
    label: 'À surveiller',
    badgeClass:
      'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
  },
  adjust: {
    label: 'Ajustement conseillé',
    badgeClass:
      'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
  }
} as const;

export function WeeklyDigestCard({ digest, onOpenDigest }: WeeklyDigestCardProps) {
  const meta = RHYTHM_META[digest.rhythmStatus];

  return (
    <Card className="p-0 overflow-hidden">
      <button
        type="button"
        onClick={onOpenDigest}
        className="flex min-h-14 w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300"
          aria-hidden="true"
        >
          <CalendarClock className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-50">
              Point du dimanche
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}
            >
              {meta.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-bold tabular-nums text-slate-700 dark:text-slate-200">
              {formatCurrency(digest.dailyAllowance)}/jour
            </span>{' '}
            ·{' '}
            {digest.upcomingFixedCharges.length > 0
              ? `${digest.upcomingFixedCharges.length} charge${digest.upcomingFixedCharges.length > 1 ? 's' : ''} fixe${digest.upcomingFixedCharges.length > 1 ? 's' : ''} cette semaine`
              : 'Aucune charge fixe cette semaine'}
          </p>
        </div>

        <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-300">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>
    </Card>
  );
}

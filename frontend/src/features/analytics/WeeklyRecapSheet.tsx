import { X } from 'lucide-react';
import type { BudgetStreakData } from '../../services/analytics.service';
import { formatCurrency } from '../../utils/format';

interface WeeklyRecapSheetProps {
  isOpen: boolean;
  onClose: () => void;
  streak: BudgetStreakData | null;
}

/**
 * Tiroir de bilan hebdomadaire bienveillant ancré en bas de l'écran.
 */
export function WeeklyRecapSheet({ isOpen, onClose, streak }: WeeklyRecapSheetProps) {
  if (!isOpen || !streak) return null;

  const { weeklyRecap } = streak;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Bilan de la semaine"
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8 shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700"
          aria-hidden="true"
        />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
            Bilan de la semaine
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-emerald-50 p-4 text-center dark:bg-emerald-950/35">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              {streak.headline}
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{streak.subtext}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Dépensé cette semaine
              </p>
              <p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                {formatCurrency(weeklyRecap.currentWeekSpent)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {weeklyRecap.transactionsCount} saisie{weeklyRecap.transactionsCount > 1 ? 's' : ''}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Moyenne hebdo (30 j)
              </p>
              <p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                {formatCurrency(weeklyRecap.weeklyAverageSpent)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Rythme habituel
              </p>
            </div>
          </div>

          {weeklyRecap.bestControlledEnvelope ? (
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{weeklyRecap.bestControlledEnvelope.icon}</span>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Enveloppe la mieux maîtrisée
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {weeklyRecap.bestControlledEnvelope.name}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                {weeklyRecap.bestControlledEnvelope.usagePercent} % utilisé
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

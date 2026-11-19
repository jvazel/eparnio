import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';

export interface PeriodSelectorProps {
  label: string;
  isClosed?: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

/**
 * Sélecteur de cycle mensuel sous forme de pilule blanche `< Mois Année >`.
 */
export function PeriodSelector({
  label,
  isClosed = false,
  onPrevious,
  onNext
}: PeriodSelectorProps) {
  return (
    <div className="px-4 py-2">
      <div className="flex items-center justify-between rounded-2xl border border-slate-100/80 bg-white px-3 py-1.5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={onPrevious}
          aria-label="Mois précédent"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <span className="text-base font-bold text-slate-900 dark:text-slate-50">{label}</span>

        <button
          type="button"
          onClick={onNext}
          aria-label="Mois suivant"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {isClosed ? (
        <div className="mt-1.5 flex justify-center">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Lock className="h-3 w-3" aria-hidden="true" />
            Clôturé
          </span>
        </div>
      ) : null}
    </div>
  );
}

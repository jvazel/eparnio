import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PeriodSelectorProps {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
}

/**
 * Sélecteur de cycle mensuel sous forme de pilule blanche `< Mois Année >`.
 */
export function PeriodSelector({ label, onPrevious, onNext }: PeriodSelectorProps) {
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
    </div>
  );
}

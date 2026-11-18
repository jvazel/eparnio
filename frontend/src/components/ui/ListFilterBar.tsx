import { Search, X } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
}

export interface ListFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  sortOptions: FilterOption[];
  sortBy: string;
  onSortChange: (value: string) => void;
  filterPills?: FilterOption[];
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  isFilterActive: boolean;
  resultCount: number;
  resultTotalFormatted: string;
  onReset: () => void;
}

/**
 * Barre de recherche, tri et filtres rapides Mobile-First réutilisable
 * pour les listes de dépenses fixes et variables.
 */
export function ListFilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Rechercher…',
  sortOptions,
  sortBy,
  onSortChange,
  filterPills,
  filterValue,
  onFilterChange,
  isFilterActive,
  resultCount,
  resultTotalFormatted,
  onReset
}: ListFilterBarProps) {
  return (
    <div className="space-y-2">
      {/* Recherche */}
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Effacer la recherche"
            className="absolute right-2.5 rounded-full p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* Pills de filtre (statut ou membre) */}
      {filterPills && filterPills.length > 0 && onFilterChange ? (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {filterPills.map((pill) => {
            const active = filterValue === pill.value;
            return (
              <button
                key={pill.value}
                type="button"
                onClick={() => onFilterChange(pill.value)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Pills de tri */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
        {sortOptions.map((option) => {
          const active = sortBy === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSortChange(option.value)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                active
                  ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Sous-total dynamique quand un filtre est actif */}
      {isFilterActive ? (
        <div className="flex items-center justify-between rounded-xl bg-violet-50 px-3 py-1.5 text-xs text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
          <span className="font-medium">
            {resultCount} {resultCount > 1 ? 'éléments' : 'élément'} · Total :{' '}
            <strong className="tabular-nums">{resultTotalFormatted}</strong>
          </span>
          <button
            type="button"
            onClick={onReset}
            className="font-semibold underline underline-offset-2 hover:text-violet-600"
          >
            Réinitialiser
          </button>
        </div>
      ) : null}
    </div>
  );
}

import { ChevronLeft, Clock, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type GlobalSearchFilterType,
  type GlobalSearchItem,
  searchBudgetItems
} from '../../services/search.service';
import { formatCurrency } from '../../utils/format';

export interface SearchBudgetMember {
  userId: string;
  firstName?: string;
  color: string;
}

export interface GlobalSearchModalProps {
  isOpen: boolean;
  budgetId: string;
  isSharedBudget?: boolean;
  members?: SearchBudgetMember[];
  onClose: () => void;
  onSelectResult: (item: GlobalSearchItem) => void;
}

const FILTER_OPTIONS: { id: GlobalSearchFilterType; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'variable_expense', label: 'Dépenses variables' },
  { id: 'fixed_charge', label: 'Dépenses fixes' },
  { id: 'income', label: 'Revenus' },
  { id: 'notes', label: 'Notes' }
];

const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre'
];

function getRecentStorageKey(budgetId: string): string {
  return `eparnio_recent_searches_${budgetId}`;
}

function readRecentSearches(budgetId: string): string[] {
  try {
    const raw = localStorage.getItem(getRecentStorageKey(budgetId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(budgetId: string, term: string): string[] {
  const trimmed = term.trim();
  if (!trimmed) return readRecentSearches(budgetId);
  const existing = readRecentSearches(budgetId).filter(
    (item) => item.toLowerCase() !== trimmed.toLowerCase()
  );
  const next = [trimmed, ...existing].slice(0, 5);
  try {
    localStorage.setItem(getRecentStorageKey(budgetId), JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function GlobalSearchModal({
  isOpen,
  budgetId,
  isSharedBudget = false,
  members = [],
  onClose,
  onSelectResult
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<GlobalSearchFilterType>('all');
  const [results, setResults] = useState<GlobalSearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setRecentSearches(readRecentSearches(budgetId));
    setErrorMessage(null);
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [isOpen, budgetId]);

  useEffect(() => {
    setQuery('');
    setResults([]);
    setActiveFilter('all');
  }, [budgetId]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();

    if (!trimmed && activeFilter !== 'notes') {
      setResults([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    const debounceId = window.setTimeout(async () => {
      try {
        const response = await searchBudgetItems(budgetId, {
          q: trimmed,
          type: activeFilter,
          limit: 30
        });
        if (!cancelled) {
          setResults(response.items);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Impossible d’effectuer la recherche pour le moment.'
          );
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceId);
    };
  }, [isOpen, budgetId, query, activeFilter]);

  const memberMap = useMemo(() => {
    return new Map(members.map((m) => [m.userId, m]));
  }, [members]);

  const groupedResults = useMemo(() => {
    const groups = new Map<string, { label: string; items: GlobalSearchItem[] }>();
    for (const item of results) {
      const key = `${item.year}-${String(item.month).padStart(2, '0')}`;
      const monthName = MONTH_NAMES[item.month - 1] ?? `Mois ${item.month}`;
      const label = `${monthName} ${item.year}`;
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(key, { label, items: [item] });
      }
    }
    return Array.from(groups.values());
  }, [results]);

  if (!isOpen) return null;

  const handleSelectItem = (item: GlobalSearchItem) => {
    if (query.trim()) {
      setRecentSearches(saveRecentSearch(budgetId, query));
    }
    onSelectResult(item);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recherche globale dans le budget"
      className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-950"
    >
      <div className="border-b border-slate-200/80 bg-white px-4 pb-3 pt-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la recherche"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-transform active:scale-95 dark:bg-slate-800 dark:text-slate-200"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un libellé, une note, un montant..."
              aria-label="Rechercher un libellé, une note ou un montant"
              className="w-full rounded-2xl border border-slate-200 bg-slate-100/80 py-2.5 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Effacer la recherche"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="mx-auto mt-3 flex max-w-md gap-1.5 overflow-x-auto pb-1">
          {FILTER_OPTIONS.map((option) => {
            const active = activeFilter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setActiveFilter(option.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-md space-y-4">
          {errorMessage ? (
            <div className="rounded-2xl bg-red-50 p-4 text-center text-sm text-red-600 dark:bg-red-950/40 dark:text-red-300">
              {errorMessage}
            </div>
          ) : isLoading ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Recherche en cours...
            </p>
          ) : !query.trim() && activeFilter !== 'notes' ? (
            <div className="space-y-4">
              {recentSearches.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Recherches récentes
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => setQuery(term)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-center dark:border-slate-800 dark:bg-slate-900/50">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Retrouvez n’importe quelle opération sur tous vos mois
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Tapez un mot-clé (« garantie », « EDF »), une note ou un montant (« 49,90 »).
                </p>
              </div>
            </div>
          ) : groupedResults.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-center shadow-card dark:bg-slate-900">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Aucun résultat trouvé
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Essayez un autre mot-clé ou changez de filtre.
              </p>
            </div>
          ) : (
            groupedResults.map((group) => (
              <section key={group.label} className="space-y-2">
                <h3 className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {group.items.map((item) => {
                    const member = item.memberId ? memberMap.get(item.memberId) : undefined;
                    const formattedDate = new Date(item.date).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    });
                    return (
                      <button
                        key={`${item.kind}-${item.id}`}
                        type="button"
                        onClick={() => handleSelectItem(item)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 text-left shadow-card transition-transform active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900"
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-white text-lg dark:bg-slate-800"
                          style={{ borderColor: item.envelopeColor }}
                          aria-hidden="true"
                        >
                          {item.envelopeIcon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">
                              {item.title}
                            </p>
                            {isSharedBudget && member ? (
                              <span
                                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                style={{ backgroundColor: member.color }}
                                title={member.firstName}
                              >
                                { (member.firstName ?? '?').charAt(0).toUpperCase() }
                              </span>
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {item.envelopeName} · {formattedDate}
                          </p>
                          {item.notes ? (
                            <p className="mt-0.5 truncate text-xs italic text-slate-400 dark:text-slate-500">
                              « {item.notes} »
                            </p>
                          ) : null}
                          {item.tags && item.tags.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.tags.map((t) => (
                                <span
                                  key={t}
                                  className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <span
                          className={`shrink-0 text-sm font-bold tabular-nums ${
                            item.kind === 'income'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {item.kind === 'income' ? '+' : ''}
                          {formatCurrency(item.amount)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

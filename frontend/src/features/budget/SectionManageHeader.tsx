import { Settings } from 'lucide-react';
import type { EnvelopeItem } from '../../types/budget.types';

/**
 * Trie les postes budgétaires selon leur champ `order` croissant.
 */
export function sortEnvelopesByOrder(items: EnvelopeItem[]): EnvelopeItem[] {
  return [...items].sort((left, right) => left.order - right.order);
}

/**
 * Calcule la nouvelle séquence d'identifiants après déplacement d'un poste vers le haut (-1) ou le bas (+1).
 */
export function buildReorderedIds(
  sortedItems: EnvelopeItem[],
  index: number,
  direction: -1 | 1
): string[] | null {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= sortedItems.length) {
    return null;
  }

  const next = [...sortedItems];
  const [moved] = next.splice(index, 1);
  if (!moved) return null;
  next.splice(targetIndex, 0, moved);
  return next.map((item) => item.id);
}

export interface SectionManageHeaderProps {
  title: string;
  count: number;
  isManageMode: boolean;
  manageButtonLabel: string;
  onToggleManageMode: () => void;
}

/**
 * En-tête de section d'historique avec compteur discret et bouton engrenage ⚙️.
 */
export function SectionManageHeader({
  title,
  count,
  isManageMode,
  manageButtonLabel,
  onToggleManageMode
}: SectionManageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
          {count}
        </span>
      </div>

      {count > 0 && (
        <button
          type="button"
          onClick={onToggleManageMode}
          aria-label={manageButtonLabel}
          aria-pressed={isManageMode}
          className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors ${
            isManageMode
              ? 'bg-violet-600 text-white shadow-sm'
              : 'bg-white text-slate-600 shadow-card hover:bg-slate-50'
          }`}
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          {isManageMode ? <span>Terminer</span> : null}
        </button>
      )}
    </div>
  );
}

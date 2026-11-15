import { ArrowDown, ArrowUp, Check, RefreshCw, Trash2 } from 'lucide-react';
import type { EnvelopeItem } from '../../types/budget.types';
import { formatCurrency, formatFullDate } from '../../utils/format';

export interface CheckableListCardProps {
  item: EnvelopeItem;
  isManageMode?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onEdit: (item: EnvelopeItem) => void;
  onTogglePaid: (item: EnvelopeItem) => void;
  onMoveUp?: (item: EnvelopeItem) => void;
  onMoveDown?: (item: EnvelopeItem) => void;
  onDelete?: (item: EnvelopeItem) => void;
}

/**
 * Carte horizontale d'historique (Revenus & Dépenses fixes) avec anneau emoji,
 * indicateur récurrent 🔄, tap pour éditer et pastille de pointage `✓` verte/grise.
 */
export function CheckableListCard({
  item,
  isManageMode = false,
  canMoveUp = false,
  canMoveDown = false,
  onEdit,
  onTogglePaid,
  onMoveUp,
  onMoveDown,
  onDelete
}: CheckableListCardProps) {
  const paidActionLabel = item.isPaid
    ? `Marquer ${item.name} comme en attente`
    : item.pillar === 'income'
      ? `Marquer ${item.name} comme perçu`
      : `Marquer ${item.name} comme payé`;

  return (
    <div className="relative rounded-2xl border border-slate-100/80 bg-white px-3.5 py-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3 pr-9">
        <button
          type="button"
          onClick={() => onEdit(item)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label={`Modifier ${item.name}`}
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] bg-white text-xl dark:bg-slate-800"
            style={{ borderColor: item.color }}
            aria-hidden="true"
          >
            {item.icon}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">
              {item.name}
            </p>
            <p className="mt-0.5 text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
              <span className="font-bold text-slate-800 dark:text-slate-100">
                {formatCurrency(item.allocatedAmount)}
              </span>{' '}
              - {formatFullDate(item.date)}
            </p>
          </div>
        </button>

        {isManageMode ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onMoveUp?.(item)}
              disabled={!canMoveUp}
              aria-label={`Monter ${item.name}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 disabled:opacity-30"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onMoveDown?.(item)}
              disabled={!canMoveDown}
              aria-label={`Descendre ${item.name}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 disabled:opacity-30"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(item)}
              aria-label={`Supprimer ${item.name}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : item.isRecurring ? (
          <span
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400"
            title="Élément récurrent chaque mois"
            aria-label="Élément récurrent"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onTogglePaid(item)}
        aria-pressed={item.isPaid}
        aria-label={paidActionLabel}
        className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center"
      >
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors ${
            item.isPaid
              ? 'border-[#22C55E] bg-[#22C55E] text-white'
              : 'border-slate-300 bg-white text-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500'
          }`}
        >
          <Check className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
        </span>
      </button>
    </div>
  );
}

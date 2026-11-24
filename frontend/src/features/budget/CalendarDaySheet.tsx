import { Check, Plus, X } from 'lucide-react';
import {
  formatDateKeyLongFr,
  type CalendarDay,
  type CalendarEvent,
} from '../../services/calendar.service';

interface CalendarDaySheetProps {
  day: CalendarDay | null;
  onClose: () => void;
  onTogglePaid: (envelopeId: string, nextIsPaid: boolean) => void;
  onAddExpenseOnDay: (dateKey: string) => void;
  isToggling?: boolean;
}

function getPillarBadgeLabel(ev: CalendarEvent): string {
  switch (ev.pillar) {
    case 'income':
      return 'Revenu';
    case 'fixed_charge':
      return 'Charge fixe';
    case 'savings':
      return 'Épargne';
    case 'asset':
      return 'Patrimoine';
    default:
      return 'Dépense variable';
  }
}

export function CalendarDaySheet({
  day,
  onClose,
  onTogglePaid,
  onAddExpenseOnDay,
  isToggling = false,
}: CalendarDaySheetProps) {
  if (!day) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl p-5 shadow-2xl max-h-[82dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Poignée & En-tête */}
        <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {formatDateKeyLongFr(day.dateKey)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {day.events.length === 0
                ? 'Aucune opération ce jour'
                : `${day.events.length} opération${day.events.length > 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Liste des opérations */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {day.events.map((ev) => {
            const isIncome = ev.pillar === 'income';
            const canToggle = ev.kind === 'envelope';

            return (
              <div
                key={ev.id}
                className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-lg shrink-0 border-2"
                    style={{ borderColor: ev.color }}
                  >
                    {ev.emoji}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {ev.label}
                      </p>
                      {ev.isOverdue && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 shrink-0">
                          En retard
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{getPillarBadgeLabel(ev)}</span>
                      {ev.paidByUser && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                          style={{ backgroundColor: ev.paidByUser.color }}
                        >
                          {ev.paidByUser.avatarEmoji} {ev.paidByUser.displayName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      isIncome
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {isIncome ? '+' : '-'}
                    {ev.amount.toLocaleString('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    €
                  </span>

                  {canToggle && (
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => onTogglePaid(ev.envelopeId, !ev.isPaid)}
                      aria-label={ev.isPaid ? 'Marquer comme à venir' : 'Pointer comme payé'}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        ev.isPaid
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bouton rapide d'ajout */}
        <button
          type="button"
          onClick={() => onAddExpenseOnDay(day.dateKey)}
          className="mt-4 w-full py-3.5 rounded-2xl bg-[#1D7DFA] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition-transform"
        >
          <Plus className="w-4 h-4" />
          Ajouter une dépense ce jour
        </button>
      </div>
    </div>
  );
}

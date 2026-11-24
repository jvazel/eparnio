import type { CalendarDay, CalendarEvent, CalendarPillar } from '../../services/calendar.service';

interface CalendarGridProps {
  days: CalendarDay[];
  selectedDateKey: string | null;
  onSelectDay: (day: CalendarDay) => void;
  activePillarFilter: CalendarPillar | 'all';
  activeMemberFilter: string | 'all';
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function getHeatmapBgClass(totalOutflow: number, maxOutflow: number): string {
  if (totalOutflow <= 0 || maxOutflow <= 0) return '';
  const ratio = totalOutflow / maxOutflow;
  if (ratio >= 0.75) return 'bg-blue-500/30 dark:bg-blue-500/35';
  if (ratio >= 0.45) return 'bg-blue-400/20 dark:bg-blue-400/25';
  if (ratio >= 0.2) return 'bg-blue-300/15 dark:bg-blue-300/20';
  return 'bg-blue-200/15 dark:bg-blue-200/10';
}

function formatCompactNet(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded === 0) return '';
  return rounded > 0 ? `+${rounded}€` : `${rounded}€`;
}

export function CalendarGrid({
  days,
  selectedDateKey,
  onSelectDay,
  activePillarFilter,
  activeMemberFilter,
}: CalendarGridProps) {
  if (days.length === 0) return null;

  // Calculer le décalage du premier jour (0 = Lundi .. 6 = Dimanche)
  const [y, m, d] = days[0].dateKey.split('-').map(Number);
  const firstUtcDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Dimanche
  const leadingEmptyCount = (firstUtcDay + 6) % 7;

  const filterDayEvents = (events: CalendarEvent[]) =>
    events.filter((ev) => {
      if (activePillarFilter !== 'all' && ev.pillar !== activePillarFilter) return false;
      if (activeMemberFilter !== 'all' && ev.paidByUserId !== activeMemberFilter) return false;
      return true;
    });

  const maxOutflow = days.reduce((max, day) => {
    const outflow = filterDayEvents(day.events)
      .filter((ev) => ev.pillar !== 'income')
      .reduce((sum, ev) => sum + ev.amount, 0);
    return Math.max(max, outflow);
  }, 0);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100/80 dark:border-slate-700/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] p-3.5">
      {/* En-tête jours de la semaine */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 py-1"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Grille des jours */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingEmptyCount }).map((_, idx) => (
          <div key={`empty-${idx}`} className="min-h-[56px]" />
        ))}

        {days.map((day) => {
          const filteredEvents = filterDayEvents(day.events);

          const dayNumber = Number(day.dateKey.split('-')[2]);
          const isSelected = selectedDateKey === day.dateKey;
          const hasOverdue = filteredEvents.some((ev) => ev.isOverdue);
          const hasIncome = filteredEvents.some((ev) => ev.pillar === 'income');
          const hasUpcoming = filteredEvents.some((ev) => !ev.isPaid && !ev.isOverdue);
          const totalOutflow = filteredEvents
            .filter((ev) => ev.pillar !== 'income')
            .reduce((sum, ev) => sum + ev.amount, 0);

          const heatmapClass = getHeatmapBgClass(totalOutflow, maxOutflow);

          const netAmount = filteredEvents.reduce((acc, ev) => {
            return acc + (ev.pillar === 'income' ? ev.amount : -ev.amount);
          }, 0);
          const compactNet = formatCompactNet(netAmount);

          return (
            <button
              key={day.dateKey}
              type="button"
              onClick={() => onSelectDay(day)}
              aria-label={`Jour ${day.dateKey}`}
              className={`min-h-[56px] rounded-xl p-1 flex flex-col items-center justify-between transition-colors ${
                isSelected
                  ? 'bg-violet-100 dark:bg-violet-900/50 ring-2 ring-violet-600 dark:ring-violet-400'
                  : day.isToday
                    ? `${heatmapClass || 'bg-blue-50/70 dark:bg-blue-900/30'} ring-1 ring-blue-500`
                    : hasOverdue
                      ? 'bg-orange-50/70 dark:bg-orange-950/30 ring-1 ring-orange-400'
                      : heatmapClass || 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <div className="w-full flex items-center justify-between px-0.5">
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    day.isToday
                      ? 'text-blue-600 dark:text-blue-400 font-bold'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {dayNumber}
                </span>
                <div className="flex items-center gap-0.5">
                  {hasIncome && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  {hasUpcoming && (
                    <span className="w-1.5 h-1.5 rounded-full border border-dashed border-violet-500" />
                  )}
                </div>
              </div>

              {/* Solde net compact du jour */}
              <span
                className={`text-[9px] font-bold tabular-nums leading-none truncate max-w-full ${
                  netAmount > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : netAmount < 0
                      ? 'text-slate-600 dark:text-slate-300'
                      : 'text-transparent'
                }`}
              >
                {compactNet || '0'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Légende compacte */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-2.5 rounded bg-blue-400/30" /> Intensité dépenses
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Revenu
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full border border-dashed border-violet-500" /> À venir
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded border border-orange-400 bg-orange-50/70 dark:bg-orange-950/30" /> En retard
        </span>
      </div>
    </div>
  );
}

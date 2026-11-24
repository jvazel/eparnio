import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { useState } from 'react';
import { DropdownSelect } from '../../components/ui/DropdownSelect';
import {
  fetchPeriodCalendar,
  formatDateKeyDDMMYYYY,
  type CalendarDay,
  type CalendarPillar,
} from '../../services/calendar.service';
import { updateEnvelope } from '../../services/envelope.service';
import { CalendarDaySheet } from './CalendarDaySheet';
import { CalendarGrid } from './CalendarGrid';
import { CashFlowProjectionChart } from './CashFlowProjectionChart';

interface BudgetCalendarViewProps {
  periodId: string;
  onAddExpenseOnDay?: (dateKey: string) => void;
}

const PILLAR_FILTERS: Array<{ key: CalendarPillar | 'all'; label: string }> = [
  { key: 'all', label: 'Tout' },
  { key: 'income', label: 'Revenus' },
  { key: 'fixed_charge', label: 'Fixes' },
  { key: 'variable_expense', label: 'Variables' },
  { key: 'savings', label: 'Épargne' },
  { key: 'asset', label: 'Patrimoine' },
];

export function BudgetCalendarView({
  periodId,
  onAddExpenseOnDay,
}: BudgetCalendarViewProps) {
  const queryClient = useQueryClient();
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [activePillarFilter, setActivePillarFilter] = useState<CalendarPillar | 'all'>('all');
  const [activeMemberFilter, setActiveMemberFilter] = useState<string | 'all'>('all');

  const { data: calendar, isLoading, isError } = useQuery({
    queryKey: ['calendar', periodId],
    queryFn: () => fetchPeriodCalendar(periodId),
    enabled: Boolean(periodId),
  });

  const togglePaidMutation = useMutation({
    mutationFn: ({ envelopeId, isPaid }: { envelopeId: string; isPaid: boolean }) =>
      updateEnvelope(periodId, envelopeId, { isPaid }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['calendar', periodId] }),
        queryClient.invalidateQueries({ queryKey: ['period'] }),
        queryClient.invalidateQueries({ queryKey: ['envelopes'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] }),
      ]);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-72 rounded-2xl bg-white dark:bg-slate-800 animate-pulse" />
        <div className="h-52 rounded-2xl bg-white dark:bg-slate-800 animate-pulse" />
      </div>
    );
  }

  if (isError || !calendar) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Impossible de charger la vue calendrier pour cette période.
      </div>
    );
  }

  const selectedDay: CalendarDay | null =
    selectedDateKey
      ? calendar.days.find((d) => d.dateKey === selectedDateKey) ?? null
      : null;

  const allEvents = calendar.days.flatMap((d) => d.events);
  const overdueEvents = allEvents.filter((ev) => ev.isOverdue);
  const upcomingEvents = allEvents.filter((ev) => !ev.isPaid && !ev.isOverdue);
  const overdueTotal = overdueEvents.reduce((sum, ev) => sum + ev.amount, 0);
  const upcomingTotal = upcomingEvents.reduce((sum, ev) => sum + ev.amount, 0);

  return (
    <div className="space-y-4">
      {/* Filtre pilier en liste déroulante */}
      <DropdownSelect
        label="Filtrer le calendrier"
        value={activePillarFilter}
        onChange={(v) => setActivePillarFilter(v as CalendarPillar | 'all')}
        options={PILLAR_FILTERS.map((f) => ({
          value: f.key,
          label: f.label,
        }))}
      />

      {calendar.members.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {calendar.members.map((m) => (
            <button
              key={m.userId}
              type="button"
              onClick={() =>
                setActiveMemberFilter((prev) => (prev === m.userId ? 'all' : m.userId))
              }
              className={`px-2.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-colors ${
                activeMemberFilter === m.userId
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
              }`}
            >
              <span>{m.avatarEmoji}</span>
              <span>{m.displayName}</span>
            </button>
          ))}
        </div>
      )}

      {/* Résumé rapide échéances & raccourci Aujourd'hui */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {overdueEvents.length > 0 && (
            <span className="px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 text-xs font-semibold tabular-nums">
              ⚠️ {overdueEvents.length} en retard ({overdueTotal.toFixed(0)} €)
            </span>
          )}
          {upcomingEvents.length > 0 && (
            <span className="px-3 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-semibold tabular-nums">
              ⏳ {upcomingEvents.length} à venir ({upcomingTotal.toFixed(0)} €)
            </span>
          )}
        </div>
        {calendar.days.some((d) => d.isToday) && (
          <button
            type="button"
            onClick={() => setSelectedDateKey(calendar.todayKey)}
            className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold"
          >
            Aujourd’hui
          </button>
        )}
      </div>

      {/* Grille Calendrier */}
      <CalendarGrid
        days={calendar.days}
        selectedDateKey={selectedDateKey}
        onSelectDay={(day) => setSelectedDateKey(day.dateKey)}
        activePillarFilter={activePillarFilter}
        activeMemberFilter={activeMemberFilter}
      />

      {/* Courbe de trésorerie projetée */}
      <CashFlowProjectionChart
        curve={calendar.cashFlowCurve}
        dailyVariablePace={calendar.dailyVariablePace}
      />

      {/* Bandeau Prochaines échéances périodiques (hors cycle) */}
      {calendar.upcomingPeriodic.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100/80 dark:border-slate-700/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Prochaines échéances périodiques
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {calendar.upcomingPeriodic.map((item) => (
              <div
                key={`${item.envelopeId}-${item.nextDateKey}`}
                className="py-2 flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span>{item.emoji}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {item.label}
                    </p>
                    <p className="text-slate-400 dark:text-slate-500 tabular-nums">
                      Prévu le {formatDateKeyDDMMYYYY(item.nextDateKey)}
                    </p>
                  </div>
                </div>
                <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100 shrink-0">
                  {item.amount.toLocaleString('fr-FR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  €
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tiroir détail du jour */}
      <CalendarDaySheet
        day={selectedDay}
        onClose={() => setSelectedDateKey(null)}
        isToggling={togglePaidMutation.isPending}
        onTogglePaid={(envelopeId, isPaid) =>
          togglePaidMutation.mutate({ envelopeId, isPaid })
        }
        onAddExpenseOnDay={(dateKey) => {
          setSelectedDateKey(null);
          onAddExpenseOnDay?.(dateKey);
        }}
      />
    </div>
  );
}

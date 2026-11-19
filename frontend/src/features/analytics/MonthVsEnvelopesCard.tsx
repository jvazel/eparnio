import { Card } from '../../components/ui/Card';

export interface MonthVsEnvelopesCardProps {
  totalDays: number;
  daysRemaining: number;
  spentVariables: number;
  plannedEnvelopes: number;
}

/**
 * Compare l'avancement du mois (%) avec la consommation globale des enveloppes variables (%).
 */
export function MonthVsEnvelopesCard({
  totalDays,
  daysRemaining,
  spentVariables,
  plannedEnvelopes
}: MonthVsEnvelopesCardProps) {
  const safeTotalDays = Math.max(1, totalDays);
  const elapsedDays = Math.min(safeTotalDays, Math.max(1, safeTotalDays - Math.max(0, daysRemaining)));
  const monthProgress = Math.round((elapsedDays / safeTotalDays) * 100);
  const envelopesProgress =
    plannedEnvelopes > 0 ? Math.max(0, Math.round((spentVariables / plannedEnvelopes) * 100)) : 0;

  const isAheadOfPace = envelopesProgress > monthProgress + 10;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">
          Avancement du mois vs Enveloppes
        </h3>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            isAheadOfPace
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
          }`}
        >
          {isAheadOfPace ? 'Rythme élevé' : 'Maîtrisé'}
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-600 dark:text-slate-300">
            <span>Mois écoulé</span>
            <span className="font-bold tabular-nums">{monthProgress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-slate-400 transition-all duration-300 dark:bg-slate-500"
              style={{ width: `${Math.min(100, monthProgress)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-600 dark:text-slate-300">
            <span>Enveloppes consommées</span>
            <span
              className={`font-bold tabular-nums ${
                isAheadOfPace ? 'text-amber-600 dark:text-amber-400' : 'text-violet-600 dark:text-violet-400'
              }`}
            >
              {envelopesProgress}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isAheadOfPace ? 'bg-amber-500' : 'bg-violet-600'
              }`}
              style={{ width: `${Math.min(100, envelopesProgress)}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

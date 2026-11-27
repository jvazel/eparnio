import { Check, ChevronRight, Sparkles } from 'lucide-react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import type { WeeklyDigestResult } from '../../services/weeklyHabit.service';
import { formatCurrency, formatShortDate } from '../../utils/format';

export interface WeeklyDigestSheetProps {
  isOpen: boolean;
  onClose: () => void;
  digest: WeeklyDigestResult | null;
  onMarkFixedChargePaid?: (periodId: string, envelopeId: string) => Promise<void> | void;
  onSelectEnvelope?: (envelopeId: string) => void;
}

const RHYTHM_STYLE = {
  serene: {
    label: 'Rythme serein',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
  },
  watch: {
    label: 'À surveiller',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
  },
  adjust: {
    label: 'Ajustement conseillé',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
  }
} as const;

export function WeeklyDigestSheet({
  isOpen,
  onClose,
  digest,
  onMarkFixedChargePaid,
  onSelectEnvelope
}: WeeklyDigestSheetProps) {
  if (!digest) return null;

  const rhythm = RHYTHM_STYLE[digest.rhythmStatus];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Point du dimanche">
      <div className="space-y-4 pb-2">
        {/* 1. Cap de la semaine */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Ton cap de la semaine
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${rhythm.className}`}>
              {rhythm.label}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Budget / jour</p>
              <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(digest.dailyAllowance)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Reste à vivre ({digest.daysRemaining} j)
              </p>
              <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                {formatCurrency(digest.remainingToLive)}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Charges fixes des 7 prochains jours */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Charges fixes (7 prochains jours)
            </h3>
            {digest.upcomingFixedTotal > 0 && (
              <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
                {formatCurrency(digest.upcomingFixedTotal)}
              </span>
            )}
          </div>

          {digest.upcomingFixedCharges.length === 0 ? (
            <p className="rounded-2xl border border-slate-100 bg-white p-3.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              Aucune charge fixe à venir dans les 7 prochains jours.
            </p>
          ) : (
            <div className="space-y-2">
              {digest.upcomingFixedCharges.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-white text-base dark:bg-slate-800"
                      style={{ borderColor: item.color }}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-bold tabular-nums">{formatCurrency(item.amount)}</span>
                        {' · '}
                        {formatShortDate(item.dueDate)}
                      </p>
                    </div>
                  </div>
                  {onMarkFixedChargePaid && item.periodId && (
                    <button
                      type="button"
                      onClick={() => void onMarkFixedChargePaid(item.periodId, item.id)}
                      aria-label={`Pointer ${item.name} comme payée`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-emerald-100 hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Enveloppes à surveiller (top 2) */}
        <div className="space-y-2">
          <h3 className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Enveloppes à surveiller
          </h3>
          {digest.envelopesToWatch.length === 0 ? (
            <p className="rounded-2xl border border-slate-100 bg-white p-3.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              Toutes tes enveloppes suivent un rythme équilibré par rapport au mois.
            </p>
          ) : (
            <div className="space-y-2">
              {digest.envelopesToWatch.map((env) => (
                <button
                  key={env.id}
                  type="button"
                  onClick={() => {
                    onSelectEnvelope?.(env.id);
                    onClose();
                  }}
                  className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/70"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-white text-base dark:bg-slate-800"
                      style={{ borderColor: env.color }}
                      aria-hidden="true"
                    >
                      {env.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {env.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Restant :{' '}
                        <span className="font-bold tabular-nums text-slate-800 dark:text-slate-200">
                          {formatCurrency(env.remainingAmount)}
                        </span>{' '}
                        ({env.consumedPercent} % consommé)
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 4. Note positive */}
        <div className="flex items-start gap-2.5 rounded-2xl bg-violet-50/80 p-3.5 text-xs text-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden="true" />
          <p className="font-medium leading-relaxed">{digest.positiveNote}</p>
        </div>

        <Button type="button" variant="violet" fullWidth onClick={onClose}>
          C’est noté, bonne semaine !
        </Button>
      </div>
    </BottomSheet>
  );
}

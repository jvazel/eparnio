import { AlertTriangle, CheckCircle2, Info, TrendingDown } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { formatCurrency } from '../../utils/format';

export type PaceStatus = 'no_data' | 'already_negative' | 'warning' | 'healthy';

export interface PaceProjectionResult {
  status: PaceStatus;
  burnRate: number;
  projectedEndBalance: number;
  daysUntilNegative: number | null;
  negativeDate: Date | null;
}

/**
 * Calcule la projection de fin de cycle (Burn Rate) à partir des dépenses variables déjà saisies.
 */
export function computePaceProjection(params: {
  remainingToLive: number;
  spentVariables: number;
  remainingDays: number;
  startDate: string | Date;
  today?: Date;
}): PaceProjectionResult {
  const { remainingToLive, spentVariables, remainingDays } = params;
  const today = params.today ? new Date(params.today) : new Date();
  const start = new Date(params.startDate);

  const msPerDay = 24 * 60 * 60 * 1000;
  const rawElapsed = Math.floor((today.getTime() - start.getTime()) / msPerDay) + 1;
  const elapsedDays = Math.max(1, rawElapsed);

  if (remainingToLive < 0) {
    const burnRate = spentVariables > 0 ? Math.round((spentVariables / elapsedDays) * 100) / 100 : 0;
    return {
      status: 'already_negative',
      burnRate,
      projectedEndBalance: remainingToLive,
      daysUntilNegative: 0,
      negativeDate: today
    };
  }

  if (spentVariables <= 0) {
    return {
      status: 'no_data',
      burnRate: 0,
      projectedEndBalance: remainingToLive,
      daysUntilNegative: null,
      negativeDate: null
    };
  }

  const burnRate = Math.round((spentVariables / elapsedDays) * 100) / 100;
  const projectedEndBalance =
    Math.round((remainingToLive - burnRate * Math.max(0, remainingDays)) * 100) / 100;

  if (projectedEndBalance < 0 && burnRate > 0) {
    const daysUntilNegative = Math.max(0, Math.floor(remainingToLive / burnRate));
    const negativeDate = new Date(today.getTime() + daysUntilNegative * msPerDay);
    return {
      status: 'warning',
      burnRate,
      projectedEndBalance,
      daysUntilNegative,
      negativeDate
    };
  }

  return {
    status: 'healthy',
    burnRate,
    projectedEndBalance,
    daysUntilNegative: null,
    negativeDate: null
  };
}

export interface PaceProjectionCardProps {
  remainingToLive: number;
  spentVariables: number;
  remainingDays: number;
  startDate: string;
  today?: Date;
}

/**
 * Carte d'indicateur de rythme de dépense (Burn Rate) et de projection de fin de cycle.
 */
export function PaceProjectionCard({
  remainingToLive,
  spentVariables,
  remainingDays,
  startDate,
  today
}: PaceProjectionCardProps) {
  const projection = computePaceProjection({
    remainingToLive,
    spentVariables,
    remainingDays,
    startDate,
    today
  });

  const formattedNegativeDate = projection.negativeDate
    ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(
        projection.negativeDate
      )
    : '';

  const stylesByStatus: Record<
    PaceStatus,
    { badgeBg: string; icon: JSX.Element; border: string }
  > = {
    healthy: {
      badgeBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
      icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" />,
      border: 'border-emerald-100 dark:border-emerald-900/40'
    },
    warning: {
      badgeBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
      icon: <AlertTriangle className="h-5 w-5" aria-hidden="true" />,
      border: 'border-amber-200 dark:border-amber-900/50'
    },
    already_negative: {
      badgeBg: 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400',
      icon: <TrendingDown className="h-5 w-5" aria-hidden="true" />,
      border: 'border-red-200 dark:border-red-900/50'
    },
    no_data: {
      badgeBg: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
      icon: <Info className="h-5 w-5" aria-hidden="true" />,
      border: 'border-slate-100 dark:border-slate-800'
    }
  };

  const currentStyle = stylesByStatus[projection.status];

  return (
    <Card className={`border ${currentStyle.border}`}>
      <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-50">
        Projection de fin de mois
      </h3>

      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${currentStyle.badgeBg}`}
        >
          {currentStyle.icon}
        </div>

        <p className="text-sm leading-snug text-slate-700 dark:text-slate-200">
          {projection.status === 'no_data' ? (
            <>Pas encore assez de dépenses pour estimer ton rythme.</>
          ) : projection.status === 'already_negative' ? (
            <>
              Ton reste à vivre est déjà dépassé de{' '}
              <span className="font-bold text-red-600 dark:text-red-400">
                {formatCurrency(remainingToLive)}
              </span>{' '}
              sur ce cycle.
            </>
          ) : projection.status === 'warning' ? (
            <>
              À l&apos;allure actuelle (
              <span className="font-semibold tabular-nums">
                {formatCurrency(projection.burnRate)}/jour
              </span>
              ), tu passeras en négatif à partir du{' '}
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {formattedNegativeDate}
              </span>{' '}
              (dans{' '}
              <span className="font-bold">
                {projection.daysUntilNegative}{' '}
                {projection.daysUntilNegative === 1 ? 'jour' : 'jours'}
              </span>
              ).
            </>
          ) : (
            <>
              À ce rythme (
              <span className="font-semibold tabular-nums">
                {formatCurrency(projection.burnRate)}/jour
              </span>
              ), tu termineras le cycle avec{' '}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                +{formatCurrency(projection.projectedEndBalance)}
              </span>{' '}
              d&apos;avance.
            </>
          )}
        </p>
      </div>
    </Card>
  );
}

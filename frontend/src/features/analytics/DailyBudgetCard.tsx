import { Info } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import type { DailyBudgetAnalytics } from '../../types/budget.types';
import { formatCurrency } from '../../utils/format';

export interface DailyBudgetCardProps {
  dailyBudget: DailyBudgetAnalytics;
}

/**
 * Carte 2 de l'onglet « Budget » (calibrée sur Finzee : « Gestion du budget quotidien »)
 * affichant les jours restants en rouge (#EF4444) et le montant à dépenser par jour en vert (#22C55E).
 */
export function DailyBudgetCard({ dailyBudget }: DailyBudgetCardProps) {
  const { daysRemaining, dailyAmount, remainingToLive } = dailyBudget;
  const daysLabel = daysRemaining === 1 ? '1 jour' : `${daysRemaining} jours`;

  return (
    <Card>
      <h2 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-50">
        Gestion du budget quotidien
      </h2>
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
          aria-hidden="true"
        >
          <Info className="h-5 w-5" />
        </span>

        {daysRemaining > 0 ? (
          <p className="text-sm leading-snug text-slate-600 dark:text-slate-300">
            Il reste{' '}
            <span className="font-bold tabular-nums text-[#EF4444]">{daysLabel}</span> avant la fin
            du mois &amp;{' '}
            <span className="font-bold tabular-nums text-[#22C55E]">
              {formatCurrency(dailyAmount)}
            </span>{' '}
            à dépenser par jour!
          </p>
        ) : (
          <p className="text-sm leading-snug text-slate-600">
            Cette période budgétaire est terminée (solde final :{' '}
            <span
              className={`font-bold tabular-nums ${
                remainingToLive < 0 ? 'text-[#EF4444]' : 'text-[#22C55E]'
              }`}
            >
              {formatCurrency(remainingToLive)}
            </span>
            ).
          </p>
        )}
      </div>
    </Card>
  );
}

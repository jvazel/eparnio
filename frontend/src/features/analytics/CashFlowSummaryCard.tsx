import { CreditCard, Landmark, Mail, PiggyBank, Wallet } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import type { CashFlowAnalytics } from '../../types/budget.types';
import { formatCurrency } from '../../utils/format';

export interface CashFlowSummaryCardProps {
  cashFlow: CashFlowAnalytics;
  activeBalance?: number;
  upcomingFixedCharges?: number;
}

function MoneyBagIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 3h6l-1.5 3h-3L9 3Z" />
      <path d="M8.5 6h7c2.8 2.2 4.5 5.4 4.5 9a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5c0-3.6 1.7-6.8 4.5-9Z" />
      <path d="M12 10v6" />
      <path d="M10 12h4" />
    </svg>
  );
}

/**
 * Carte 1 de l'onglet « Budget » (calibrée sur Finzee : « Entrées et sorties d'argent »)
 * présentant Revenus, Dépenses fixes, Dépenses variables, Epargne et Restant en gras.
 */
export function CashFlowSummaryCard({
  cashFlow,
  activeBalance,
  upcomingFixedCharges = 0
}: CashFlowSummaryCardProps) {
  const rows = [
    {
      id: 'income',
      label: 'Revenus',
      amount: cashFlow.plannedIncome,
      badgeClass: 'bg-blue-50 text-blue-600',
      Icon: Wallet,
      isBold: false,
      amountClass: 'text-slate-800'
    },
    {
      id: 'fixed',
      label: 'Dépenses fixes',
      amount: cashFlow.plannedFixedCharges,
      badgeClass: 'bg-violet-50 text-violet-600',
      Icon: CreditCard,
      isBold: false,
      amountClass: 'text-slate-800'
    },
    {
      id: 'variable',
      label: 'Dépenses variables',
      amount: cashFlow.spentVariables,
      badgeClass: 'bg-indigo-50 text-indigo-600',
      Icon: Mail,
      isBold: false,
      amountClass: 'text-slate-800'
    },
    {
      id: 'savings',
      label: 'Epargne',
      amount: cashFlow.plannedSavings,
      badgeClass: 'bg-sky-50 text-sky-600',
      Icon: PiggyBank,
      isBold: false,
      amountClass: 'text-slate-800'
    },
    {
      id: 'remaining',
      label: 'Restant',
      amount: cashFlow.remainingToLive,
      badgeClass: 'bg-emerald-50 text-emerald-600',
      Icon: MoneyBagIcon,
      isBold: true,
      amountClass: cashFlow.remainingToLive < 0 ? 'text-red-600' : 'text-slate-900'
    }
  ];

  return (
    <Card>
      <h2 className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-50">
        Entrées et sorties d&apos;argent
      </h2>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map(({ id, label, amount, badgeClass, Icon, isBold, amountClass }) => (
          <li key={id} className="flex items-center justify-between gap-3 py-2.5 first:pt-1 last:pb-1">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${badgeClass}`}
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" />
              </span>
              <span
                className={`truncate text-sm ${
                  isBold
                    ? 'font-bold text-slate-900 dark:text-slate-50'
                    : 'font-medium text-slate-700 dark:text-slate-300'
                }`}
              >
                {label}
              </span>
            </div>
            <span
              className={`shrink-0 text-sm tabular-nums ${
                isBold ? 'font-bold' : 'font-semibold'
              } ${amountClass} dark:text-slate-100`}
            >
              {formatCurrency(amount)}
            </span>
          </li>
        ))}
      </ul>

      {typeof activeBalance === 'number' && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/70">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
              aria-hidden="true"
            >
              <Landmark className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-50">
                Solde estimé en compte
              </p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {upcomingFixedCharges > 0
                  ? `Hors ${formatCurrency(upcomingFixedCharges)} de charges à venir`
                  : 'Revenus perçus − dépenses passées'}
              </p>
            </div>
          </div>
          <span
            className={`shrink-0 text-sm font-bold tabular-nums ${
              activeBalance < 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-blue-700 dark:text-blue-300'
            }`}
          >
            {formatCurrency(activeBalance)}
          </span>
        </div>
      )}
    </Card>
  );
}

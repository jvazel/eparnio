import { PiggyBank, ShieldCheck } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import type { AssetAccountDTO } from '../../services/netWorth.service';
import type { SavingsGoalItem } from '../../types/budget.types';

/**
 * Calcule le montant total du matelas d'urgence en combinant :
 * - le solde des comptes patrimoniaux de catégorie « cash » (liquidités uniquement),
 * - les objectifs d'épargne qui ne sont PAS déjà liés à un compte liquide (pour éviter le double comptage).
 */
export function computeEmergencyFundAmount(
  goals: Array<Pick<SavingsGoalItem, 'currentAmount' | 'assetAccountId'>>,
  accounts: Array<Pick<AssetAccountDTO, 'id' | 'category' | 'currentBalance'>> = []
): { totalAmount: number; liquidAssetsTotal: number } {
  const cashAccounts = accounts.filter((account) => account.category === 'cash');
  const cashAccountIds = new Set(cashAccounts.map((account) => account.id));

  const liquidAssetsTotal = cashAccounts.reduce(
    (sum, account) => sum + Math.max(0, account.currentBalance),
    0
  );

  const unlinkedGoalsTotal = goals.reduce((sum, goal) => {
    if (goal.assetAccountId && cashAccountIds.has(goal.assetAccountId)) {
      return sum;
    }
    return sum + Math.max(0, goal.currentAmount);
  }, 0);

  return {
    totalAmount: liquidAssetsTotal + unlinkedGoalsTotal,
    liquidAssetsTotal
  };
}

export interface SavingsHealthCardProps {
  plannedIncome: number;
  plannedSavings: number;
  plannedFixedCharges: number;
  totalSavingsGoals?: number;
  emergencyFundAmount?: number;
  hasLiquidAssets?: boolean;
}

/**
 * Affiche le taux d'épargne du mois (%) et le matelas de sécurité (en mois de charges fixes).
 */
export function SavingsHealthCard({
  plannedIncome,
  plannedSavings,
  plannedFixedCharges,
  totalSavingsGoals = 0,
  emergencyFundAmount,
  hasLiquidAssets = false
}: SavingsHealthCardProps) {
  const savingsRate =
    plannedIncome > 0 ? Math.round((plannedSavings / plannedIncome) * 1000) / 10 : 0;

  const effectiveEmergencyFund = emergencyFundAmount ?? totalSavingsGoals;

  const emergencyMonths =
    plannedFixedCharges > 0 && effectiveEmergencyFund > 0
      ? Math.round((effectiveEmergencyFund / plannedFixedCharges) * 10) / 10
      : null;

  const rateBadge =
    savingsRate >= 20
      ? { label: 'Excellent (≥ 20%)', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' }
      : savingsRate >= 10
        ? { label: 'Bon (10–20%)', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' }
        : { label: 'À renforcer (< 10%)', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' };

  return (
    <Card>
      <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-50">
        Santé de l&apos;épargne
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <PiggyBank className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <span>Taux d&apos;épargne</span>
          </div>
          <p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
            {savingsRate}%
          </p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${rateBadge.cls}`}>
            {rateBadge.label}
          </span>
        </div>

        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="h-4 w-4 text-violet-500" aria-hidden="true" />
            <span>Matelas d&apos;urgence</span>
          </div>
          <p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
            {emergencyMonths !== null ? `${emergencyMonths} mois` : '—'}
          </p>
          <span className="mt-1 inline-block text-[10px] text-slate-500 dark:text-slate-400">
            {emergencyMonths !== null
              ? hasLiquidAssets
                ? 'de charges fixes (incl. liquidités)'
                : 'de charges fixes'
              : 'Ajoutez une épargne ou liquidité'}
          </span>
        </div>
      </div>
    </Card>
  );
}

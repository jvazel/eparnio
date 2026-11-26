import { Hourglass, Info, PiggyBank, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import type { AssetAccountDTO } from '../../services/netWorth.service';
import type { AgeOfMoneyAnalytics, SavingsGoalItem } from '../../types/budget.types';

const AGE_OF_MONEY_TARGET_DAYS = 30;

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
  ageOfMoney?: AgeOfMoneyAnalytics;
}

/**
 * Affiche le taux d'épargne du mois (%), le matelas de sécurité (en mois de charges fixes)
 * et l'indicateur « Âge de l'argent » (méthode FIFO, objectif 30 jours).
 */
export function SavingsHealthCard({
  plannedIncome,
  plannedSavings,
  plannedFixedCharges,
  totalSavingsGoals = 0,
  emergencyFundAmount,
  hasLiquidAssets = false,
  ageOfMoney
}: SavingsHealthCardProps) {
  const [showAgeInfo, setShowAgeInfo] = useState(false);

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

  const ageBadge =
    ageOfMoney?.status === 'target_reached'
      ? {
          label: 'Objectif atteint (≥ 30 j)',
          cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
          barCls: 'bg-emerald-500'
        }
      : ageOfMoney?.status === 'growing'
        ? {
            label: 'En progression (15–29 j)',
            cls: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
            barCls: 'bg-blue-500'
          }
        : {
            label: 'Flux tendu (< 15 j)',
            cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
            barCls: 'bg-amber-500'
          };

  const ageProgressPct =
    ageOfMoney && ageOfMoney.ageDays !== null
      ? Math.min(100, Math.max(0, Math.round((ageOfMoney.ageDays / AGE_OF_MONEY_TARGET_DAYS) * 100)))
      : 0;

  const remainingSamples = ageOfMoney
    ? Math.max(1, ageOfMoney.minSamples - ageOfMoney.sampleSize)
    : 0;

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

      {ageOfMoney && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Hourglass className="h-4 w-4 text-blue-500" aria-hidden="true" />
              <span>Âge de l&apos;argent</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAgeInfo((prev) => !prev)}
              aria-expanded={showAgeInfo}
              aria-label="En savoir plus sur l'âge de l'argent"
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {showAgeInfo && (
            <p className="mt-2 rounded-lg bg-white/90 p-2 text-[11px] leading-relaxed text-slate-600 shadow-xs dark:bg-slate-900/80 dark:text-slate-300">
              Mesure en moyenne depuis combien de jours l&apos;argent que tu dépenses aujourd&apos;hui est
              arrivé sur ton compte (méthode FIFO sur les 10 dernières sorties). Objectif : atteindre{' '}
              <strong>30 jours</strong> pour vivre sur les revenus du mois dernier.
            </p>
          )}

          {ageOfMoney.status === 'learning' || ageOfMoney.ageDays === null ? (
            <div className="mt-1.5">
              <p className="text-lg font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
                —
              </p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {ageOfMoney.inflowsCount === 0
                  ? 'Pointez au moins un revenu perçu pour démarrer le calcul.'
                  : `Encore ${remainingSamples} dépense${remainingSamples > 1 ? 's' : ''} pour calculer l'âge de ton argent.`}
              </p>
            </div>
          ) : (
            <div className="mt-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <p className="text-lg font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
                    {ageOfMoney.ageDays} {ageOfMoney.ageDays <= 1 ? 'jour' : 'jours'}
                  </p>
                  {ageOfMoney.deltaDays !== null && ageOfMoney.deltaDays !== 0 && (
                    <span
                      className={`text-[11px] font-semibold tabular-nums ${
                        ageOfMoney.deltaDays > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {ageOfMoney.deltaDays > 0
                        ? `+${ageOfMoney.deltaDays} j`
                        : `${ageOfMoney.deltaDays} j`}
                    </span>
                  )}
                </div>
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${ageBadge.cls}`}>
                  {ageBadge.label}
                </span>
              </div>

              <div className="mt-2">
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                  role="progressbar"
                  aria-label="Progression vers l'objectif des 30 jours"
                  aria-valuenow={Math.min(ageOfMoney.ageDays, AGE_OF_MONEY_TARGET_DAYS)}
                  aria-valuemin={0}
                  aria-valuemax={AGE_OF_MONEY_TARGET_DAYS}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${ageBadge.barCls}`}
                    style={{ width: `${ageProgressPct}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
                  <span>0 j</span>
                  <span>Objectif : 30 j</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

import { AssetAccountModel } from '../models/AssetAccount.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { SavingsGoalModel } from '../models/SavingsGoal.model';
import { TransactionModel } from '../models/Transaction.model';
import { computeAgeOfMoneyFifo } from './ageOfMoney.service';

export type WeeklyRhythmStatus = 'serene' | 'watch' | 'adjust';

export interface UpcomingFixedChargeItem {
  id: string;
  periodId: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
  dueDate: string;
}

export interface EnvelopeToWatchItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  consumedPercent: number;
}

export interface WeeklyDigestResult {
  periodId: string | null;
  periodLabel: string;
  remainingToLive: number;
  dailyAllowance: number;
  daysRemaining: number;
  monthProgressPercent: number;
  rhythmStatus: WeeklyRhythmStatus;
  upcomingFixedCharges: UpcomingFixedChargeItem[];
  upcomingFixedTotal: number;
  envelopesToWatch: EnvelopeToWatchItem[];
  positiveNote: string;
}

export type MilestoneCategory =
  | 'zero_based'
  | 'emergency_fund'
  | 'regularity'
  | 'savings'
  | 'serenity';

export interface HabitMilestoneItem {
  id: string;
  category: MilestoneCategory;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
  currentValue: number;
  targetValue: number;
}

export interface WeeklyHabitResponse {
  digest: WeeklyDigestResult;
  milestones: HabitMilestoneItem[];
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getIsoWeekKey(date: Date): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export interface ComputeDigestInput {
  periodId: string | null;
  periodLabel: string;
  startDate: Date;
  endDate: Date;
  remainingToLive: number;
  remainingToAllocate: number;
  plannedSavings: number;
  fixedCharges: Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
    allocatedAmount: number;
    isPaid: boolean;
    dueDate?: Date;
  }>;
  variableEnvelopes: Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
    allocatedAmount: number;
    rolloverAmount?: number;
    spentOrPaidAmount: number;
  }>;
  now?: Date;
}

export function computeWeeklyDigest(input: ComputeDigestInput): WeeklyDigestResult {
  const now = input.now ?? new Date();
  const msPerDay = 86_400_000;
  const totalDays = Math.max(1, Math.round((input.endDate.getTime() - input.startDate.getTime()) / msPerDay) + 1);
  const elapsedDays = Math.min(
    totalDays,
    Math.max(1, Math.floor((now.getTime() - input.startDate.getTime()) / msPerDay) + 1)
  );
  const daysRemaining = Math.max(
    1,
    Math.ceil((input.endDate.getTime() - now.getTime()) / msPerDay)
  );
  const monthProgressPercent = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
  const dailyAllowance = round2(input.remainingToLive / daysRemaining);

  const horizonEnd = new Date(now.getTime() + 7 * msPerDay);
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const upcomingFixedCharges: UpcomingFixedChargeItem[] = input.fixedCharges
    .filter((item) => !item.isPaid && item.dueDate)
    .filter((item) => {
      const due = item.dueDate as Date;
      return due.getTime() >= startOfToday.getTime() && due.getTime() <= horizonEnd.getTime();
    })
    .sort((a, b) => (a.dueDate!.getTime() - b.dueDate!.getTime()))
    .map((item) => ({
      id: item.id,
      periodId: input.periodId ?? '',
      name: item.name,
      icon: item.icon,
      color: item.color,
      amount: round2(item.allocatedAmount),
      dueDate: item.dueDate!.toISOString()
    }));

  const upcomingFixedTotal = round2(
    upcomingFixedCharges.reduce((sum, item) => sum + item.amount, 0)
  );

  const envelopesToWatch: EnvelopeToWatchItem[] = input.variableEnvelopes
    .map((env) => {
      const available = round2(env.allocatedAmount + (env.rolloverAmount ?? 0));
      const spent = round2(env.spentOrPaidAmount);
      const remaining = round2(available - spent);
      const consumedPercent = available > 0 ? Math.round((spent / available) * 100) : 0;
      return {
        id: env.id,
        name: env.name,
        icon: env.icon,
        color: env.color,
        allocatedAmount: available,
        spentAmount: spent,
        remainingAmount: remaining,
        consumedPercent,
        tensionDelta: consumedPercent - monthProgressPercent
      };
    })
    .filter((item) => item.allocatedAmount > 0 && item.consumedPercent > monthProgressPercent)
    .sort((a, b) => b.tensionDelta - a.tensionDelta)
    .slice(0, 2)
    .map(({ tensionDelta: _delta, ...rest }) => rest);

  let rhythmStatus: WeeklyRhythmStatus = 'serene';
  if (input.remainingToLive < 0) {
    rhythmStatus = 'adjust';
  } else if (envelopesToWatch.length > 0 || dailyAllowance < 15) {
    rhythmStatus = 'watch';
  }

  const paidFixedCount = input.fixedCharges.filter((item) => item.isPaid).length;
  const totalFixedCount = input.fixedCharges.length;
  const paidFixedRatio = totalFixedCount > 0 ? Math.round((paidFixedCount / totalFixedCount) * 100) : 0;

  let positiveNote = 'Prends 30 secondes pour garder le cap sereinement cette semaine.';
  if (input.plannedSavings > 0) {
    positiveNote = `Tu as déjà prévu ${round2(input.plannedSavings).toLocaleString('fr-FR')} € d’épargne sur ce cycle.`;
  } else if (Math.abs(input.remainingToAllocate) < 0.01) {
    positiveNote = 'Ton budget Base Zéro est parfaitement équilibré à 0 €.';
  } else if (totalFixedCount > 0 && paidFixedRatio >= 50) {
    positiveNote = `${paidFixedRatio} % de tes charges fixes sont déjà passées sur ce cycle.`;
  }

  return {
    periodId: input.periodId,
    periodLabel: input.periodLabel,
    remainingToLive: round2(input.remainingToLive),
    dailyAllowance,
    daysRemaining,
    monthProgressPercent,
    rhythmStatus,
    upcomingFixedCharges,
    upcomingFixedTotal,
    envelopesToWatch,
    positiveNote
  };
}

export interface ComputeMilestonesInput {
  balancedMonthsCount: number;
  emergencyMonthsCovered: number;
  activeWeeksCount: number;
  hasSavingsContribution: boolean;
  reachedGoalsCount: number;
  ageOfMoneyDays: number | null;
}

export function computeHabitMilestones(input: ComputeMilestonesInput): HabitMilestoneItem[] {
  const build = (
    id: string,
    category: MilestoneCategory,
    title: string,
    description: string,
    currentValue: number,
    targetValue: number
  ): HabitMilestoneItem => {
    const safeCurrent = Math.max(0, round2(currentValue));
    const unlocked = safeCurrent >= targetValue;
    const progress = targetValue > 0 ? Math.min(100, Math.round((safeCurrent / targetValue) * 100)) : 0;
    return {
      id,
      category,
      title,
      description,
      unlocked,
      progress,
      currentValue: safeCurrent,
      targetValue
    };
  };

  return [
    build(
      'zb-1',
      'zero_based',
      '1er mois équilibré à 0 €',
      'Chaque euro a trouvé sa mission sur un cycle complet.',
      input.balancedMonthsCount,
      1
    ),
    build(
      'zb-3',
      'zero_based',
      '3 mois équilibrés à 0 €',
      'Trois cycles équilibrés (cumulés, sans remise à zéro).',
      input.balancedMonthsCount,
      3
    ),
    build(
      'zb-6',
      'zero_based',
      '6 mois équilibrés à 0 €',
      'Une vraie maîtrise durable du Budget Base Zéro.',
      input.balancedMonthsCount,
      6
    ),
    build(
      'ef-1',
      'emergency_fund',
      'Matelas de 1 mois',
      'Un mois complet de charges fixes couvert par ton épargne.',
      input.emergencyMonthsCovered,
      1
    ),
    build(
      'ef-3',
      'emergency_fund',
      'Matelas de 3 mois',
      'Trois mois de charges fixes en sécurité.',
      input.emergencyMonthsCovered,
      3
    ),
    build(
      'reg-4',
      'regularity',
      '4 semaines de suivi actif',
      'Au moins une action enregistrée sur 4 semaines différentes.',
      input.activeWeeksCount,
      4
    ),
    build(
      'reg-12',
      'regularity',
      '12 semaines de suivi actif',
      'Une habitude budgétaire installée sans pression.',
      input.activeWeeksCount,
      12
    ),
    build(
      'sav-goal',
      'savings',
      'Premier objectif atteint',
      'Une cagnotte d’épargne menée jusqu’à 100 %.',
      input.reachedGoalsCount,
      1
    ),
    build(
      'aom-30',
      'serenity',
      'Âge de l’argent ≥ 30 jours',
      'Vivre sereinement sur l’argent du mois précédent.',
      input.ageOfMoneyDays ?? 0,
      30
    )
  ];
}

export async function getBudgetWeeklyHabit(
  budgetId: string,
  now = new Date()
): Promise<WeeklyHabitResponse> {
  const periods = await BudgetPeriodModel.find({ budgetId })
    .sort({ year: -1, month: -1 })
    .limit(12)
    .lean();

  const activePeriod =
    periods.find((p) => now >= new Date(p.startDate) && now <= new Date(p.endDate)) ??
    periods[0] ??
    null;

  const periodIds = periods.map((p) => p._id);

  const [activeEnvelopes, allEnvelopes, recentTransactions, goals, cashAssets] = await Promise.all([
    activePeriod ? EnvelopeModel.find({ periodId: activePeriod._id }).lean() : Promise.resolve([]),
    periodIds.length > 0
      ? EnvelopeModel.find({ periodId: { $in: periodIds } }).lean()
      : Promise.resolve([]),
    periodIds.length > 0
      ? TransactionModel.find({ periodId: { $in: periodIds } }).lean()
      : Promise.resolve([]),
    SavingsGoalModel.find({ budgetId }).lean(),
    AssetAccountModel.find({ budgetId, category: 'cash' }).lean()
  ]);

  const digest = computeWeeklyDigest({
    periodId: activePeriod ? activePeriod._id.toString() : null,
    periodLabel: activePeriod?.label ?? 'Mois en cours',
    startDate: activePeriod ? new Date(activePeriod.startDate) : now,
    endDate: activePeriod ? new Date(activePeriod.endDate) : now,
    remainingToLive: activePeriod?.summary?.remainingToLive ?? 0,
    remainingToAllocate: activePeriod?.summary?.remainingToAllocate ?? 0,
    plannedSavings: activePeriod?.summary?.plannedSavings ?? 0,
    fixedCharges: activeEnvelopes
      .filter((env) => env.pillar === 'fixed_charge')
      .map((env) => ({
        id: env._id.toString(),
        name: env.name,
        icon: env.icon,
        color: env.color,
        allocatedAmount: env.allocatedAmount,
        isPaid: Boolean(env.isPaid),
        dueDate: env.dueDate ? new Date(env.dueDate) : undefined
      })),
    variableEnvelopes: activeEnvelopes
      .filter((env) => env.pillar === 'variable_envelope')
      .map((env) => ({
        id: env._id.toString(),
        name: env.name,
        icon: env.icon,
        color: env.color,
        allocatedAmount: env.allocatedAmount,
        rolloverAmount: env.rolloverAmount ?? 0,
        spentOrPaidAmount: env.spentOrPaidAmount
      })),
    now
  });

  const balancedMonthsCount = periods.filter(
    (p) => (p.summary?.plannedIncome ?? 0) > 0 && Math.abs(p.summary?.remainingToAllocate ?? 1) < 0.01
  ).length;

  const cashAccountIds = new Set(cashAssets.map((a) => a._id.toString()));
  const liquidAssetsTotal = cashAssets.reduce((sum, a) => sum + Math.max(0, a.currentBalance), 0);
  const unlinkedGoalsTotal = goals
    .filter((g) => !g.assetAccountId || !cashAccountIds.has(g.assetAccountId.toString()))
    .reduce((sum, g) => sum + Math.max(0, g.currentAmount), 0);
  const emergencyFundTotal = liquidAssetsTotal + unlinkedGoalsTotal;
  const monthlyFixed = activePeriod?.summary?.plannedFixedCharges ?? 0;
  const emergencyMonthsCovered = monthlyFixed > 0 ? round2(emergencyFundTotal / monthlyFixed) : 0;

  const activeWeekSet = new Set<string>();
  for (const tx of recentTransactions) {
    if (tx.date) activeWeekSet.add(getIsoWeekKey(new Date(tx.date)));
  }
  for (const env of allEnvelopes) {
    if (env.isPaid && env.dueDate) {
      activeWeekSet.add(getIsoWeekKey(new Date(env.dueDate)));
    }
  }

  const reachedGoalsCount = goals.filter(
    (g) => g.targetAmount > 0 && g.currentAmount >= g.targetAmount
  ).length;
  const hasSavingsContribution =
    goals.some((g) => g.currentAmount > 0) ||
    allEnvelopes.some((e) => e.pillar === 'savings' && e.allocatedAmount > 0);

  const ageOfMoney = computeAgeOfMoneyFifo(
    allEnvelopes
      .filter((e) => e.pillar === 'income' && e.isPaid)
      .map((e) => ({
        date: e.dueDate ? new Date(e.dueDate) : new Date(e.createdAt),
        amount: e.allocatedAmount
      })),
    [
      ...allEnvelopes
        .filter((e) => e.pillar === 'fixed_charge' && e.isPaid)
        .map((e) => ({
          date: e.dueDate ? new Date(e.dueDate) : new Date(e.createdAt),
          amount: e.allocatedAmount
        })),
      ...recentTransactions
        .filter((t) => t.amount > 0)
        .map((t) => ({
          date: new Date(t.date),
          amount: t.amount
        }))
    ]
  );

  const milestones = computeHabitMilestones({
    balancedMonthsCount,
    emergencyMonthsCovered,
    activeWeeksCount: activeWeekSet.size,
    hasSavingsContribution,
    reachedGoalsCount,
    ageOfMoneyDays: ageOfMoney.ageDays
  });

  return { digest, milestones };
}

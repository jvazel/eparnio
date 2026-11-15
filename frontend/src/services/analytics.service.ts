import type { PeriodAnalyticsResponse } from '../types/api.types';
import type {
  BudgetPeriod,
  BudgetSpace,
  EnvelopeItem,
  MemberBreakdownItem,
  PeriodAnalytics
} from '../types/budget.types';
import { apiClient } from './api';

const MS_PER_DAY = 86_400_000;

function roundCurrency(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

function roundPercentage(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10;
  return rounded === 0 ? 0 : rounded;
}

function toUtcMidnightMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Récupère l'analyse complète d'une période budgétaire auprès de l'API.
 */
export async function getPeriodAnalytics(
  periodId: string,
  referenceDate?: string
): Promise<PeriodAnalyticsResponse> {
  const { data } = await apiClient.get<PeriodAnalyticsResponse>(`/periods/${periodId}/analytics`, {
    params: referenceDate ? { referenceDate } : undefined
  });
  return data;
}

/**
 * Construit un état analytique synchrone local à partir des données déjà chargées en cache,
 * utilisé pendant le rafraîchissement réseau ou en fallback hors-ligne.
 */
export function buildClientPeriodAnalytics(
  period: BudgetPeriod,
  envelopes: EnvelopeItem[],
  budget?: BudgetSpace | null,
  currentUser?: { id?: string; displayName?: string; avatarEmoji?: string } | null,
  referenceDate: Date = new Date()
): PeriodAnalytics {
  const startDate = new Date(period.startDate);
  const endDate = new Date(period.endDate);
  const startUtc = toUtcMidnightMs(startDate);
  const endUtc = toUtcMidnightMs(endDate);
  const refUtc = toUtcMidnightMs(referenceDate);

  const totalDays = Math.max(1, Math.round((endUtc - startUtc) / MS_PER_DAY) + 1);
  let daysRemaining: number;
  if (refUtc > endUtc) {
    daysRemaining = 0;
  } else if (refUtc <= startUtc) {
    daysRemaining = totalDays;
  } else {
    daysRemaining = Math.max(1, Math.round((endUtc - refUtc) / MS_PER_DAY) + 1);
  }

  const { summary } = period;
  const dailyAmount =
    daysRemaining > 0 ? Math.max(0, roundCurrency(summary.remainingToLive / daysRemaining)) : 0;

  const fixedAmount = roundCurrency(summary.plannedFixedCharges);
  const variableAmount = roundCurrency(summary.spentVariables);
  const savingsAmount = roundCurrency(summary.plannedSavings);
  const totalOutflows = roundCurrency(fixedAmount + variableAmount + savingsAmount);

  const toOutflowPct = (amount: number) =>
    totalOutflows > 0 ? roundPercentage((amount / totalOutflows) * 100) : 0;
  const toIncomePct = (amount: number) =>
    summary.plannedIncome > 0 ? roundPercentage((amount / summary.plannedIncome) * 100) : 0;

  const members = budget?.members ?? [];
  const rawMemberStats = members.map((member, index) => {
    const isSelf = Boolean(currentUser?.id && member.userId === currentUser.id);
    let incomeContributed = 0;
    let fixedChargesPaid = 0;
    let savingsContributed = 0;

    for (const env of envelopes) {
      if (env.memberId !== member.userId) continue;
      if (env.pillar === 'income') {
        incomeContributed += env.allocatedAmount;
      } else if (env.pillar === 'fixed_charge') {
        fixedChargesPaid += env.allocatedAmount;
      } else if (env.pillar === 'savings') {
        savingsContributed += env.allocatedAmount;
      }
    }

    const safeIncome = roundCurrency(incomeContributed);
    const safeFixed = roundCurrency(fixedChargesPaid);
    const safeSavings = roundCurrency(savingsContributed);
    const expensesPaid = roundCurrency(safeFixed + safeSavings);

    return {
      userId: member.userId,
      displayName: isSelf ? currentUser?.displayName || 'Moi' : `Membre ${index + 1}`,
      avatarEmoji: isSelf ? currentUser?.avatarEmoji || '🧑' : '👤',
      color: member.color,
      role: member.role,
      incomeContributed: safeIncome,
      fixedChargesPaid: safeFixed,
      variableExpensesPaid: 0,
      savingsContributed: safeSavings,
      expensesPaid,
      netBalance: roundCurrency(safeIncome - expensesPaid)
    };
  });

  const totalMembersIncome = rawMemberStats.reduce((sum, m) => sum + m.incomeContributed, 0);
  const totalMembersExpenses = rawMemberStats.reduce((sum, m) => sum + m.expensesPaid, 0);

  const memberBreakdown: MemberBreakdownItem[] = rawMemberStats.map((item) => ({
    ...item,
    incomeSharePercentage:
      totalMembersIncome > 0
        ? roundPercentage((item.incomeContributed / totalMembersIncome) * 100)
        : 0,
    expensesSharePercentage:
      totalMembersExpenses > 0
        ? roundPercentage((item.expensesPaid / totalMembersExpenses) * 100)
        : 0
  }));

  return {
    periodId: period.id,
    budgetId: period.budgetId,
    budgetType: budget?.type ?? 'personal',
    cashFlow: {
      plannedIncome: summary.plannedIncome,
      plannedFixedCharges: summary.plannedFixedCharges,
      plannedEnvelopes: summary.plannedEnvelopes,
      spentVariables: summary.spentVariables,
      plannedSavings: summary.plannedSavings,
      remainingToLive: summary.remainingToLive
    },
    dailyBudget: {
      startDate: period.startDate,
      endDate: period.endDate,
      referenceDate: referenceDate.toISOString(),
      totalDays,
      daysRemaining,
      remainingToLive: summary.remainingToLive,
      dailyAmount
    },
    allocation: {
      totalOutflows,
      plannedIncome: summary.plannedIncome,
      items: [
        {
          key: 'fixed',
          label: 'Fixe',
          color: '#8B5CF6',
          amount: fixedAmount,
          percentage: toOutflowPct(fixedAmount),
          incomeSharePercentage: toIncomePct(fixedAmount)
        },
        {
          key: 'variable',
          label: 'Variable',
          color: '#3B82F6',
          amount: variableAmount,
          percentage: toOutflowPct(variableAmount),
          incomeSharePercentage: toIncomePct(variableAmount)
        },
        {
          key: 'savings',
          label: 'Épargne',
          color: '#22C55E',
          amount: savingsAmount,
          percentage: toOutflowPct(savingsAmount),
          incomeSharePercentage: toIncomePct(savingsAmount)
        }
      ]
    },
    zeroBased: {
      plannedIncome: summary.plannedIncome,
      totalAllocated: roundCurrency(
        summary.plannedFixedCharges + summary.plannedEnvelopes + summary.plannedSavings
      ),
      remainingToAllocate: summary.remainingToAllocate,
      isBalanced:
        summary.plannedIncome > 0 && Math.abs(summary.remainingToAllocate) < 0.01
    },
    memberBreakdown
  };
}

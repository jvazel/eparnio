import type { CashFlowPoint } from '../../services/calendar.service';

export type SimulationType = 'one_time' | 'recurring_fixed' | 'installments';

export type FeasibilityLevel = 'compatible' | 'tight' | 'risk';

export interface WhatIfInput {
  type: SimulationType;
  amount: number;
  installmentsCount?: number;
  remainingToLive: number;
  remainingToAllocate: number;
  daysRemaining: number;
  totalIncome: number;
  cashFlowCurve?: CashFlowPoint[];
}

export interface WhatIfResult {
  monthlyImpact: number;
  remainingToLiveBefore: number;
  remainingToLiveAfter: number;
  dailyBudgetBefore: number;
  dailyBudgetAfter: number;
  remainingToAllocateBefore: number;
  remainingToAllocateAfter: number;
  feasibility: FeasibilityLevel;
  projectedEndBalanceAfter: number | null;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function simulateWhatIf(input: WhatIfInput): WhatIfResult {
  const safeAmount = Math.max(0, Number.isFinite(input.amount) ? input.amount : 0);
  const safeInstallments = Math.max(2, Math.round(input.installmentsCount ?? 3));
  const safeDays = Math.max(1, input.daysRemaining);

  const monthlyImpact =
    input.type === 'installments'
      ? round2(safeAmount / safeInstallments)
      : round2(safeAmount);

  const remainingToLiveBefore = round2(input.remainingToLive);
  const remainingToLiveAfter = round2(remainingToLiveBefore - monthlyImpact);

  const dailyBudgetBefore = round2(remainingToLiveBefore / safeDays);
  const dailyBudgetAfter = round2(remainingToLiveAfter / safeDays);

  const remainingToAllocateBefore = round2(input.remainingToAllocate);
  const remainingToAllocateAfter =
    input.type === 'one_time'
      ? remainingToAllocateBefore
      : round2(remainingToAllocateBefore - monthlyImpact);

  let feasibility: FeasibilityLevel = 'compatible';
  const comfortableThreshold = Math.max(100, input.totalIncome * 0.08);
  if (remainingToLiveAfter < 0) {
    feasibility = 'risk';
  } else if (remainingToLiveAfter < comfortableThreshold) {
    feasibility = 'tight';
  }

  let projectedEndBalanceAfter: number | null = null;
  if (input.cashFlowCurve && input.cashFlowCurve.length > 0) {
    const lastPoint = input.cashFlowCurve[input.cashFlowCurve.length - 1];
    projectedEndBalanceAfter = round2(lastPoint.projectedBalance - monthlyImpact);
  }

  return {
    monthlyImpact,
    remainingToLiveBefore,
    remainingToLiveAfter,
    dailyBudgetBefore,
    dailyBudgetAfter,
    remainingToAllocateBefore,
    remainingToAllocateAfter,
    feasibility,
    projectedEndBalanceAfter,
  };
}

export type SinkingFundStatus = 'completed' | 'overdue' | 'active' | 'none';

export interface SinkingFundInfo {
  status: SinkingFundStatus;
  remainingAmount: number;
  monthsRemaining: number;
  monthlySuggestedAmount: number;
}

/**
 * Calcule la mensualité recommandée pour un objectif d'épargne avec échéance (Sinking Fund).
 */
export function computeSinkingFundInfo(
  targetAmount: number,
  currentAmount: number,
  deadline?: string | null,
  referenceDate: Date = new Date()
): SinkingFundInfo {
  const remainingAmount = Math.max(0, Number((targetAmount - currentAmount).toFixed(2)));

  if (targetAmount > 0 && currentAmount >= targetAmount) {
    return {
      status: 'completed',
      remainingAmount: 0,
      monthsRemaining: 0,
      monthlySuggestedAmount: 0
    };
  }

  if (!deadline) {
    return {
      status: 'none',
      remainingAmount,
      monthsRemaining: 0,
      monthlySuggestedAmount: 0
    };
  }

  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime())) {
    return {
      status: 'none',
      remainingAmount,
      monthsRemaining: 0,
      monthlySuggestedAmount: 0
    };
  }

  const monthsDiff =
    (deadlineDate.getFullYear() - referenceDate.getFullYear()) * 12 +
    (deadlineDate.getMonth() - referenceDate.getMonth());

  if (monthsDiff < 0 || (monthsDiff === 0 && deadlineDate.getDate() < referenceDate.getDate())) {
    return {
      status: 'overdue',
      remainingAmount,
      monthsRemaining: 0,
      monthlySuggestedAmount: remainingAmount
    };
  }

  const monthsRemaining = Math.max(1, monthsDiff);
  const monthlySuggestedAmount = Math.ceil((remainingAmount / monthsRemaining) * 100) / 100;

  return {
    status: 'active',
    remainingAmount,
    monthsRemaining,
    monthlySuggestedAmount
  };
}

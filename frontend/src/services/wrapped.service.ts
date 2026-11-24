import { apiClient } from './api';

export interface WrappedTopEnvelope {
  name: string;
  icon: string;
  color: string;
  totalSpent: number;
}

export interface WrappedBestMonth {
  periodId: string;
  label: string;
  month: number;
  remainingToLive: number;
}

export interface WrappedTagItem {
  tag: string;
  totalSpent: number;
  count: number;
}

export interface WrappedMemberItem {
  userId: string;
  displayName: string;
  avatarEmoji: string;
  incomeContributed: number;
  expensesPaid: number;
}

export interface AnnualWrappedData {
  budgetId: string;
  budgetName: string;
  budgetType: 'personal' | 'shared';
  year: number;
  availableYears: number[];
  periodsCount: number;
  macro: {
    totalIncome: number;
    totalFixedCharges: number;
    totalVariableSpent: number;
    totalSaved: number;
    savingsRate: number;
  };
  highlights: {
    bestMonth: WrappedBestMonth | null;
    topEnvelopes: WrappedTopEnvelope[];
    bestControlledEnvelope: {
      name: string;
      icon: string;
      usagePercentage: number;
    } | null;
    zeroBasedScore: number;
  };
  topTags: WrappedTagItem[];
  memberBreakdown: WrappedMemberItem[];
  patrimoine?: {
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
  };
}

export async function fetchAnnualWrapped(
  budgetId: string,
  year?: number
): Promise<AnnualWrappedData> {
  const query = year ? `?year=${year}` : '';
  const { data } = await apiClient.get<{ status: string; wrapped: AnnualWrappedData }>(
    `/budgets/${budgetId}/wrapped${query}`
  );
  return data.wrapped;
}

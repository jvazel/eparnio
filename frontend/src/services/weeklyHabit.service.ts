import { apiClient } from './api';

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

export async function fetchBudgetWeeklyHabit(budgetId: string): Promise<WeeklyHabitResponse> {
  const { data } = await apiClient.get<WeeklyHabitResponse>(`/budgets/${budgetId}/weekly-digest`);
  return data;
}

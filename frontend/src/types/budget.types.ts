export type CurrencyCode = 'EUR';
export type ThemeMode = 'light' | 'dark';
export type DefaultTabId = 'revenus' | 'depenses' | 'enveloppes' | 'epargne' | 'budget';

export interface UserPreferences {
  currency: CurrencyCode;
  budgetStartDay: number;
  theme: ThemeMode;
  defaultTab?: DefaultTabId;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarEmoji: string;
  recoveryKeyHint?: string;
  hasBiometrics?: boolean;
  hasCompletedOnboarding: boolean;
  preferences: UserPreferences;
  createdAt?: string;
  updatedAt?: string;
}

export type BudgetType = 'personal' | 'shared';
export type ContributionMode = 'equal_50_50' | 'income_prorata' | 'custom';
export type BudgetMemberRole = 'owner' | 'editor' | 'viewer';

export interface QuickTemplateItem {
  id: string;
  label: string;
  envelopeName: string;
  defaultAmount?: number;
  order: number;
  variance?: {
    previousAmount: number;
    deltaAmount: number;
    deltaPercent: number;
  };
}

export interface BudgetMember {
  userId: string;
  role: BudgetMemberRole;
  color: string;
  declaredMonthlyIncome: number;
  joinedAt: string;
  displayName?: string;
  avatarEmoji?: string;
  email?: string;
}

export interface ContributionSplitMemberItem {
  userId: string;
  displayName: string;
  avatarEmoji: string;
  color: string;
  role: string;
  declaredMonthlyIncome: number;
  sharePercentage: number;
  recommendedContribution: number;
}

export interface ContributionSplitResult {
  mode: ContributionMode;
  targetAmount: number;
  totalDeclaredIncome: number;
  members: ContributionSplitMemberItem[];
}

export interface BudgetSpace {
  id: string;
  name: string;
  type: BudgetType;
  ownerId: string;
  contributionMode: ContributionMode;
  members: BudgetMember[];
  inviteCode?: string;
  inviteExpiresAt?: string;
  budgetStartDay: number;
  quickTemplates?: QuickTemplateItem[];
  createdAt?: string;
  updatedAt?: string;
}

export type PillarType = 'income' | 'fixed_charge' | 'variable_envelope' | 'savings';

export interface BudgetPeriodSummary {
  plannedIncome: number;
  plannedFixedCharges: number;
  plannedEnvelopes: number;
  plannedSavings: number;
  spentVariables: number;
  remainingToAllocate: number;
  remainingToLive: number;
}

export interface BudgetPeriod {
  id: string;
  budgetId: string;
  year: number;
  month: number;
  label: string;
  startDate: string;
  endDate: string;
  closedAt?: string;
  summary: BudgetPeriodSummary;
  createdAt?: string;
  updatedAt?: string;
}

export type RolloverMode = 'positive_only' | 'both';
export type RecurrenceFrequency = 'monthly' | 'quarterly' | 'semiannual' | 'yearly';

export interface EnvelopeItem {
  id: string;
  budgetId: string;
  budgetPeriodId: string;
  pillar: PillarType;
  name: string;
  icon: string;
  color: string;
  allocatedAmount: number;
  spentOrPaidAmount: number;
  rolloverEnabled?: boolean;
  rolloverMode?: RolloverMode;
  rolloverAmount?: number;
  previousEnvelopeId?: string;
  date: string;
  isRecurring: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceEndDate?: string;
  recurrenceRemainingCount?: number;
  isPaid: boolean;
  memberId?: string;
  linkedGoalId?: string;
  order: number;
  variance?: {
    previousAmount: number;
    deltaAmount: number;
    deltaPercent: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export type TransactionType = 'expense' | 'income' | 'transfer';

export interface TransactionItem {
  id: string;
  budgetId: string;
  budgetPeriodId: string;
  envelopeId: string;
  authorId: string;
  paidByUserId: string;
  type: TransactionType;
  amount: number;
  label: string;
  date: string;
  notes?: string;
  tags?: string[];
  splitGroupId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SavingsWithdrawalItem {
  id: string;
  amount: number;
  label: string;
  date: string;
  memberId?: string;
  notes?: string;
  tags?: string[];
  splitGroupId?: string;
  createdAt?: string;
}

export interface SavingsGoalItem {
  id: string;
  budgetId: string;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  initialAmount: number;
  currentAmount: number;
  deadline?: string;
  withdrawals?: SavingsWithdrawalItem[];
  order: number;
  variance?: {
    previousAmount: number;
    deltaAmount: number;
    deltaPercent: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface CashFlowAnalytics {
  plannedIncome: number;
  plannedFixedCharges: number;
  plannedEnvelopes: number;
  spentVariables: number;
  plannedSavings: number;
  remainingToLive: number;
}

export interface DailyBudgetAnalytics {
  startDate: string;
  endDate: string;
  referenceDate: string;
  totalDays: number;
  daysRemaining: number;
  remainingToLive: number;
  dailyAmount: number;
}

export interface AllocationSliceItem {
  key: 'fixed' | 'variable' | 'savings';
  label: string;
  color: string;
  amount: number;
  percentage: number;
  incomeSharePercentage: number;
}

export interface AllocationAnalytics {
  totalOutflows: number;
  plannedIncome: number;
  items: AllocationSliceItem[];
}

export interface ZeroBasedAnalytics {
  plannedIncome: number;
  totalAllocated: number;
  remainingToAllocate: number;
  isBalanced: boolean;
}

export interface MemberBreakdownItem {
  userId: string;
  displayName: string;
  avatarEmoji: string;
  color: string;
  role: string;
  incomeContributed: number;
  fixedChargesPaid: number;
  variableExpensesPaid: number;
  savingsContributed: number;
  expensesPaid: number;
  netBalance: number;
  incomeSharePercentage: number;
  expensesSharePercentage: number;
}

export interface PeriodAnalytics {
  periodId: string;
  budgetId: string;
  budgetType: BudgetType;
  cashFlow: CashFlowAnalytics;
  dailyBudget: DailyBudgetAnalytics;
  allocation: AllocationAnalytics;
  zeroBased: ZeroBasedAnalytics;
  memberBreakdown: MemberBreakdownItem[];
}

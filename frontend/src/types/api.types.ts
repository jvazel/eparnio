import type {
  BudgetPeriod,
  BudgetSpace,
  ContributionSplitResult,
  EnvelopeItem,
  PeriodAnalytics,
  SavingsGoalItem,
  TransactionItem,
  UserProfile
} from './budget.types';

export interface ApiErrorDetail {
  location?: string;
  path?: string;
  message: string;
}

export interface ApiErrorResponse {
  status: 'error';
  message: string;
  details?: ApiErrorDetail[];
}

export interface AuthSessionResponse {
  status: 'ok';
  token: string;
  recoveryKey?: string;
  user: UserProfile;
  defaultBudget?: BudgetSpace;
}

export interface UserResponsePayload {
  status: 'ok';
  user: UserProfile;
}

export interface MessageResponsePayload {
  status: 'ok';
  message: string;
}

export interface PasswordUpdateResponse extends MessageResponsePayload {
  token?: string;
}

export interface RegenerateRecoveryKeyResponse {
  status: 'ok';
  recoveryKey: string;
  user: UserProfile;
}

export interface BudgetsListResponse {
  status: 'ok';
  budgets: BudgetSpace[];
}

export interface BudgetResponsePayload {
  status: 'ok';
  budget: BudgetSpace;
}

export interface BudgetInviteResponse {
  status: 'ok';
  inviteCode: string;
  inviteExpiresAt?: string;
  budget: BudgetSpace;
}

export interface JoinBudgetResponse {
  status: 'ok';
  alreadyMember: boolean;
  budget: BudgetSpace;
}

export interface ContributionSplitResponse {
  status: 'ok';
  budget: BudgetSpace;
  split: ContributionSplitResult;
  period?: BudgetPeriod;
}

export interface RemoveMemberResponse {
  status: 'ok';
  removedUserId: string;
  budget: BudgetSpace;
}

export interface PeriodWithEnvelopesResponse {
  status: 'ok';
  period: BudgetPeriod;
  envelopes: EnvelopeItem[];
}

export interface EnvelopesListResponse {
  status: 'ok';
  envelopes: EnvelopeItem[];
  period: BudgetPeriod;
}

export interface EnvelopeMutationResponse {
  status: 'ok';
  envelope: EnvelopeItem;
  period: BudgetPeriod;
  goal?: SavingsGoalItem;
}

export interface EnvelopeDeleteResponse {
  status: 'ok';
  deletedId: string;
  period: BudgetPeriod;
  goal?: SavingsGoalItem;
}

export interface EnvelopesReorderResponse {
  status: 'ok';
  envelopes: EnvelopeItem[];
}

export interface TransactionsListResponse {
  status: 'ok';
  transactions: TransactionItem[];
}

export interface TransactionMutationResponse {
  status: 'ok';
  transaction: TransactionItem;
  envelope: EnvelopeItem;
  period: BudgetPeriod;
  goal?: SavingsGoalItem;
}

export interface TransactionDeleteResponse {
  status: 'ok';
  deletedId: string;
  envelope: EnvelopeItem;
  period: BudgetPeriod;
  goal?: SavingsGoalItem;
}

export interface GoalsListResponse {
  status: 'ok';
  goals: SavingsGoalItem[];
}

export interface GoalMutationResponse {
  status: 'ok';
  goal: SavingsGoalItem;
}

export interface GoalDeleteResponse {
  status: 'ok';
  deletedId: string;
}

export interface PeriodAnalyticsResponse {
  status: 'ok';
  analytics: PeriodAnalytics;
}

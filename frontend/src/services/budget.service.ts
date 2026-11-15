import type {
  BudgetInviteResponse,
  BudgetResponsePayload,
  BudgetsListResponse,
  ContributionSplitResponse,
  JoinBudgetResponse,
  MessageResponsePayload,
  RemoveMemberResponse
} from '../types/api.types';
import type { BudgetSpace, BudgetType, ContributionMode } from '../types/budget.types';
import { apiClient } from './api';

export interface CreateBudgetPayload {
  name: string;
  type: BudgetType;
  budgetStartDay?: number;
  contributionMode?: ContributionMode;
}

export interface UpdateBudgetPayload {
  name?: string;
  budgetStartDay?: number;
  contributionMode?: ContributionMode;
}

export interface UpdateContributionSplitPayload {
  contributionMode: ContributionMode;
  targetAmount?: number;
  periodId?: string;
  applyToPeriod?: boolean;
  members?: Array<{
    userId: string;
    declaredMonthlyIncome?: number;
    role?: 'editor' | 'viewer';
    customAmount?: number;
  }>;
}

/**
 * Extrait un code d'invitation propre depuis une saisie brute ou une URL `?invite=CODE`.
 */
export function extractInviteCodeFromInput(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';

  try {
    if (trimmed.includes('://') || trimmed.includes('?invite=')) {
      const parsed = trimmed.startsWith('http')
        ? new URL(trimmed)
        : new URL(trimmed, 'https://eparnio.local');
      const code = parsed.searchParams.get('invite');
      if (code) {
        return code.trim().toUpperCase();
      }
    }
  } catch {
    // Repli sur extraction par expression régulière ci-dessous
  }

  const queryMatch = trimmed.match(/invite=([A-Za-z0-9_-]+)/i);
  if (queryMatch?.[1]) {
    return queryMatch[1].trim().toUpperCase();
  }

  return trimmed.toUpperCase();
}

export async function listBudgets(): Promise<BudgetSpace[]> {
  const { data } = await apiClient.get<BudgetsListResponse>('/budgets');
  return data.budgets;
}

export async function createBudget(payload: CreateBudgetPayload): Promise<BudgetSpace> {
  const { data } = await apiClient.post<BudgetResponsePayload>('/budgets', payload);
  return data.budget;
}

export async function updateBudget(
  budgetId: string,
  payload: UpdateBudgetPayload
): Promise<BudgetSpace> {
  const { data } = await apiClient.patch<BudgetResponsePayload>(`/budgets/${budgetId}`, payload);
  return data.budget;
}

export async function deleteBudget(budgetId: string): Promise<MessageResponsePayload> {
  const { data } = await apiClient.delete<MessageResponsePayload>(`/budgets/${budgetId}`);
  return data;
}

export async function generateBudgetInvite(budgetId: string): Promise<BudgetInviteResponse> {
  const { data } = await apiClient.post<BudgetInviteResponse>(`/budgets/${budgetId}/invite`);
  return data;
}

export async function joinBudgetByCode(inviteCode: string): Promise<JoinBudgetResponse> {
  const cleanCode = extractInviteCodeFromInput(inviteCode);
  const { data } = await apiClient.post<JoinBudgetResponse>(
    `/budgets/join/${encodeURIComponent(cleanCode)}`
  );
  return data;
}

export async function updateContributionSplit(
  budgetId: string,
  payload: UpdateContributionSplitPayload
): Promise<ContributionSplitResponse> {
  const { data } = await apiClient.patch<ContributionSplitResponse>(
    `/budgets/${budgetId}/contribution-split`,
    payload
  );
  return data;
}

export async function removeBudgetMember(
  budgetId: string,
  userId: string
): Promise<RemoveMemberResponse> {
  const { data } = await apiClient.delete<RemoveMemberResponse>(
    `/budgets/${budgetId}/members/${encodeURIComponent(userId)}`
  );
  return data;
}

import type {
  GoalDeleteResponse,
  GoalMutationResponse,
  GoalsListResponse,
  GoalWithdrawalDeleteResponse
} from '../types/api.types';
import { apiClient } from './api';

export interface CreateGoalPayload {
  name: string;
  targetAmount: number;
  initialAmount?: number;
  icon?: string;
  color?: string;
  deadline?: string | null;
}

export interface UpdateGoalPayload {
  name?: string;
  targetAmount?: number;
  initialAmount?: number;
  currentAmount?: number;
  icon?: string;
  color?: string;
  deadline?: string | null;
  order?: number;
}

export interface CreateGoalWithdrawalPayload {
  amount: number;
  label: string;
  date?: string;
  memberId?: string;
  notes?: string;
}

export interface UpdateGoalWithdrawalPayload {
  amount?: number;
  label?: string;
  date?: string;
  memberId?: string | null;
  notes?: string | null;
}

/**
 * Récupère les objectifs d'épargne d'un budget.
 */
export async function listGoals(budgetId: string): Promise<GoalsListResponse> {
  const { data } = await apiClient.get<GoalsListResponse>(`/budgets/${budgetId}/goals`);
  return data;
}

/**
 * Crée un nouvel objectif d'épargne pour le budget sélectionné.
 */
export async function createGoal(
  budgetId: string,
  payload: CreateGoalPayload
): Promise<GoalMutationResponse> {
  const { data } = await apiClient.post<GoalMutationResponse>(`/budgets/${budgetId}/goals`, payload);
  return data;
}

/**
 * Met à jour un objectif d'épargne existant.
 */
export async function updateGoal(
  budgetId: string,
  goalId: string,
  payload: UpdateGoalPayload
): Promise<GoalMutationResponse> {
  const { data } = await apiClient.patch<GoalMutationResponse>(
    `/budgets/${budgetId}/goals/${goalId}`,
    payload
  );
  return data;
}

/**
 * Supprime un objectif d'épargne (ainsi que ses versements liés).
 */
export async function deleteGoal(budgetId: string, goalId: string): Promise<GoalDeleteResponse> {
  const { data } = await apiClient.delete<GoalDeleteResponse>(
    `/budgets/${budgetId}/goals/${goalId}`
  );
  return data;
}

/**
 * Enregistre un retrait / utilisation sur une cagnotte d'épargne.
 */
export async function createGoalWithdrawal(
  budgetId: string,
  goalId: string,
  payload: CreateGoalWithdrawalPayload
): Promise<GoalMutationResponse> {
  const { data } = await apiClient.post<GoalMutationResponse>(
    `/budgets/${budgetId}/goals/${goalId}/withdrawals`,
    payload
  );
  return data;
}

/**
 * Met à jour un retrait existant d'une cagnotte d'épargne.
 */
export async function updateGoalWithdrawal(
  budgetId: string,
  goalId: string,
  withdrawalId: string,
  payload: UpdateGoalWithdrawalPayload
): Promise<GoalMutationResponse> {
  const { data } = await apiClient.patch<GoalMutationResponse>(
    `/budgets/${budgetId}/goals/${goalId}/withdrawals/${withdrawalId}`,
    payload
  );
  return data;
}

/**
 * Supprime un retrait d'une cagnotte d'épargne.
 */
export async function deleteGoalWithdrawal(
  budgetId: string,
  goalId: string,
  withdrawalId: string
): Promise<GoalWithdrawalDeleteResponse> {
  const { data } = await apiClient.delete<GoalWithdrawalDeleteResponse>(
    `/budgets/${budgetId}/goals/${goalId}/withdrawals/${withdrawalId}`
  );
  return data;
}

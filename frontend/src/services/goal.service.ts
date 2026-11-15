import type {
  GoalDeleteResponse,
  GoalMutationResponse,
  GoalsListResponse
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

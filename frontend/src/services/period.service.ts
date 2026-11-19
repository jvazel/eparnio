import type { ClosePeriodResponse, PeriodWithEnvelopesResponse } from '../types/api.types';
import { apiClient } from './api';

export type CloseEnvelopeAction = 'rollover_next_month' | 'transfer_to_goal' | 'reset_zero';

export interface CloseEnvelopeDecisionPayload {
  envelopeId: string;
  action: CloseEnvelopeAction;
  goalId?: string;
}

export interface CloseNextMonthAdjustmentPayload {
  sourceEnvelopeId: string;
  allocatedAmount: number;
  include?: boolean;
}

export interface ClosePeriodPayload {
  envelopeDecisions?: CloseEnvelopeDecisionPayload[];
  nextMonthAdjustments?: CloseNextMonthAdjustmentPayload[];
}

export async function getCurrentPeriod(budgetId: string): Promise<PeriodWithEnvelopesResponse> {
  const { data } = await apiClient.get<PeriodWithEnvelopesResponse>(
    `/budgets/${budgetId}/periods/current`
  );
  return data;
}

export async function getPeriodByMonth(
  budgetId: string,
  year: number,
  month: number
): Promise<PeriodWithEnvelopesResponse> {
  const { data } = await apiClient.get<PeriodWithEnvelopesResponse>(
    `/budgets/${budgetId}/periods/by-month`,
    {
      params: { year, month }
    }
  );
  return data;
}

export async function triggerPeriodRollover(
  budgetId: string,
  periodId: string
): Promise<PeriodWithEnvelopesResponse> {
  const { data } = await apiClient.post<PeriodWithEnvelopesResponse>(
    `/budgets/${budgetId}/periods/${periodId}/rollover`
  );
  return data;
}

export async function closePeriod(
  budgetId: string,
  periodId: string,
  payload: ClosePeriodPayload
): Promise<ClosePeriodResponse> {
  const { data } = await apiClient.post<ClosePeriodResponse>(
    `/budgets/${budgetId}/periods/${periodId}/close`,
    payload
  );
  return data;
}

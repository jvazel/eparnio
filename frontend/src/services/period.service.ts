import type { PeriodWithEnvelopesResponse } from '../types/api.types';
import { apiClient } from './api';

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

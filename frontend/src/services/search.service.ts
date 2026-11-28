import { apiClient } from './api';

export type GlobalSearchFilterType =
  | 'all'
  | 'variable_expense'
  | 'fixed_charge'
  | 'income'
  | 'notes';

export interface GlobalSearchItem {
  id: string;
  kind: 'transaction' | 'fixed_charge' | 'income';
  title: string;
  notes?: string;
  tags?: string[];
  amount: number;
  date: string;
  periodId: string;
  month: number;
  year: number;
  envelopeId: string;
  envelopeName: string;
  envelopeIcon: string;
  envelopeColor: string;
  memberId?: string;
}

export interface SearchBudgetSummary {
  count: number;
  totalAmount: number;
  expensesTotal: number;
  incomesTotal: number;
}

export interface SearchBudgetResponse {
  items: GlobalSearchItem[];
  totalCount: number;
  summary?: SearchBudgetSummary;
}

export async function searchBudgetItems(
  budgetId: string,
  params: {
    q: string;
    tag?: string;
    dateFrom?: string;
    dateTo?: string;
    minAmount?: number;
    maxAmount?: number;
    type?: GlobalSearchFilterType;
    limit?: number;
  }
): Promise<SearchBudgetResponse> {
  const { data } = await apiClient.get<SearchBudgetResponse>(`/budgets/${budgetId}/search`, {
    params: {
      q: params.q,
      ...(params.tag ? { tag: params.tag } : {}),
      ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
      ...(params.dateTo ? { dateTo: params.dateTo } : {}),
      ...(params.minAmount !== undefined ? { minAmount: params.minAmount } : {}),
      ...(params.maxAmount !== undefined ? { maxAmount: params.maxAmount } : {}),
      type: params.type ?? 'all',
      limit: params.limit ?? 30
    }
  });
  return data;
}

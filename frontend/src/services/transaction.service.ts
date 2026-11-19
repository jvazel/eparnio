import type {
  TransactionDeleteResponse,
  TransactionMutationResponse,
  TransactionsListResponse
} from '../types/api.types';
import type { TransactionType } from '../types/budget.types';
import { apiClient } from './api';

export interface CreateTransactionPayload {
  envelopeId: string;
  amount: number;
  label: string;
  date?: string;
  type?: TransactionType;
  paidByUserId?: string;
  notes?: string;
  tags?: string[];
}

export interface UpdateTransactionPayload {
  envelopeId?: string;
  amount?: number;
  label?: string;
  date?: string;
  type?: TransactionType;
  paidByUserId?: string;
  notes?: string;
  tags?: string[];
}

export async function listTransactions(
  periodId: string,
  envelopeId?: string
): Promise<TransactionsListResponse> {
  const { data } = await apiClient.get<TransactionsListResponse>(
    `/periods/${periodId}/transactions`,
    {
      params: envelopeId ? { envelopeId } : undefined
    }
  );
  return data;
}

export async function createTransaction(
  periodId: string,
  payload: CreateTransactionPayload
): Promise<TransactionMutationResponse> {
  const { data } = await apiClient.post<TransactionMutationResponse>(
    `/periods/${periodId}/transactions`,
    payload
  );
  return data;
}

export async function updateTransaction(
  periodId: string,
  transactionId: string,
  payload: UpdateTransactionPayload
): Promise<TransactionMutationResponse> {
  const { data } = await apiClient.patch<TransactionMutationResponse>(
    `/periods/${periodId}/transactions/${transactionId}`,
    payload
  );
  return data;
}

export async function deleteTransaction(
  periodId: string,
  transactionId: string,
  scope: 'single' | 'group' = 'single'
): Promise<TransactionDeleteResponse> {
  const query = scope === 'group' ? '?scope=group' : '';
  const { data } = await apiClient.delete<TransactionDeleteResponse>(
    `/periods/${periodId}/transactions/${transactionId}${query}`
  );
  return data;
}

export interface ImportTransactionItemPayload {
  envelopeId: string;
  amount: number;
  label: string;
  date: string;
  paidByUserId?: string;
  notes?: string;
  tags?: string[];
}

export interface ImportTransactionsResponse {
  status: 'ok';
  importedCount: number;
  skippedDuplicatesCount: number;
  transactions: import('../types/budget.types').TransactionItem[];
  envelopes: import('../types/budget.types').EnvelopeItem[];
  period: import('../types/budget.types').BudgetPeriod;
}

export interface BalanceReconciliationResult {
  theoreticalBalance: number;
  bankBalance: number;
  difference: number;
  status: 'balanced' | 'under' | 'over';
  suggestedAdjustmentAmount: number;
}

export interface ReconcileBalanceResponse {
  status: 'ok';
  reconciliation: BalanceReconciliationResult;
}

export async function importTransactions(
  periodId: string,
  items: ImportTransactionItemPayload[]
): Promise<ImportTransactionsResponse> {
  const { data } = await apiClient.post<ImportTransactionsResponse>(
    `/periods/${periodId}/transactions/import`,
    { items }
  );
  return data;
}

export interface TransactionSuggestion {
  label: string;
  envelopeName: string;
  lastAmount: number;
  count: number;
}

export async function getTransactionSuggestions(
  budgetId: string
): Promise<TransactionSuggestion[]> {
  const { data } = await apiClient.get<{ suggestions: TransactionSuggestion[] }>(
    `/budgets/${budgetId}/transactions/suggestions`
  );
  return data.suggestions;
}


export async function reconcilePeriodBalance(
  periodId: string,
  bankBalance: number
): Promise<ReconcileBalanceResponse> {
  const { data } = await apiClient.post<ReconcileBalanceResponse>(
    `/periods/${periodId}/transactions/reconcile`,
    { bankBalance }
  );
  return data;
}


export interface SplitTransactionPayload {
  label: string;
  date?: string;
  paidByUserId?: string;
  notes?: string;
  tags?: string[];
  parts: Array<{ envelopeId: string; amount: number }>;
}

export async function splitTransaction(
  periodId: string,
  payload: SplitTransactionPayload
): Promise<{
  status: 'ok';
  splitGroupId: string;
  transactions: import('../types/budget.types').TransactionItem[];
}> {
  const { data } = await apiClient.post<{
    status: 'ok';
    splitGroupId: string;
    transactions: import('../types/budget.types').TransactionItem[];
  }>(`/periods/${periodId}/transactions/split`, payload);
  return data;
}


export interface DetectedAnomalyItem {
  transactionId: string;
  envelopeId: string;
  envelopeName: string;
  label: string;
  amount: number;
  date: string;
  severity: 'info' | 'warning';
  reason: string;
}

export interface EnvelopeAnomalyThreshold {
  median: number;
  historyCount: number;
  warningThreshold: number | null;
}

export interface PeriodAnomaliesResponse {
  status: 'ok';
  anomalies: DetectedAnomalyItem[];
  envelopeThresholds: Record<string, EnvelopeAnomalyThreshold>;
}

export async function getPeriodAnomalies(periodId: string): Promise<PeriodAnomaliesResponse> {
  const { data } = await apiClient.get<PeriodAnomaliesResponse>(
    `/periods/${periodId}/transactions/anomalies`
  );
  return data;
}

export async function dismissTransactionAnomaly(
  periodId: string,
  transactionId: string
): Promise<void> {
  await apiClient.patch(`/periods/${periodId}/transactions/${transactionId}/dismiss-anomaly`);
}

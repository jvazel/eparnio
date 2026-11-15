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
}

export interface UpdateTransactionPayload {
  envelopeId?: string;
  amount?: number;
  label?: string;
  date?: string;
  type?: TransactionType;
  paidByUserId?: string;
  notes?: string;
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
  transactionId: string
): Promise<TransactionDeleteResponse> {
  const { data } = await apiClient.delete<TransactionDeleteResponse>(
    `/periods/${periodId}/transactions/${transactionId}`
  );
  return data;
}

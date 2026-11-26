import { apiClient } from './api';
import type {
  PayeeMatchType,
  PayeeRule,
  PayeeRuleTransactionType
} from '../utils/applyPayeeRules';

export async function fetchPayeeRules(budgetId: string): Promise<PayeeRule[]> {
  const { data } = await apiClient.get<{ status: string; rules: PayeeRule[] }>(
    `/budgets/${budgetId}/payee-rules`
  );
  return data.rules;
}

export async function createPayeeRule(
  budgetId: string,
  payload: {
    pattern: string;
    matchType?: PayeeMatchType;
    transactionType?: PayeeRuleTransactionType;
    targetEnvelopeName?: string;
    renameLabel?: string;
    addTags?: string[];
    autoExcludeFromImport?: boolean;
    isActive?: boolean;
  }
): Promise<PayeeRule> {
  const { data } = await apiClient.post<{ status: string; rule: PayeeRule }>(
    `/budgets/${budgetId}/payee-rules`,
    payload
  );
  return data.rule;
}

export async function updatePayeeRule(
  budgetId: string,
  ruleId: string,
  payload: {
    pattern?: string;
    matchType?: PayeeMatchType;
    transactionType?: PayeeRuleTransactionType;
    targetEnvelopeName?: string | null;
    renameLabel?: string | null;
    addTags?: string[];
    autoExcludeFromImport?: boolean;
    isActive?: boolean;
  }
): Promise<PayeeRule> {
  const { data } = await apiClient.patch<{ status: string; rule: PayeeRule }>(
    `/budgets/${budgetId}/payee-rules/${ruleId}`,
    payload
  );
  return data.rule;
}

export async function deletePayeeRule(budgetId: string, ruleId: string): Promise<void> {
  await apiClient.delete(`/budgets/${budgetId}/payee-rules/${ruleId}`);
}

export async function reorderPayeeRules(
  budgetId: string,
  orderedIds: string[]
): Promise<PayeeRule[]> {
  const { data } = await apiClient.patch<{ status: string; rules: PayeeRule[] }>(
    `/budgets/${budgetId}/payee-rules/reorder`,
    { orderedIds }
  );
  return data.rules;
}

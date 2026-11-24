import { apiClient } from './api';

export type AssetCategory =
  | 'cash'
  | 'investment'
  | 'real_estate'
  | 'crypto'
  | 'liability';

export interface LinkedGoalSummary {
  id: string;
  name: string;
  icon: string;
  currentAmount: number;
}

export interface AssetOperationDTO {
  id: string;
  date: string;
  type: 'add' | 'withdraw' | 'set' | 'transfer_in' | 'transfer_out';
  amount: number;
  label: string;
  balanceAfter: number;
  counterpartyType: 'external' | 'asset' | 'savings_goal' | 'budget_period';
  counterpartyId?: string;
  counterpartyName?: string;
}

export interface AssetAccountDTO {
  id: string;
  budgetId: string;
  name: string;
  category: AssetCategory;
  icon: string;
  color: string;
  currentBalance: number;
  linkedGoals: LinkedGoalSummary[];
  operations?: AssetOperationDTO[];
  updatedAt: string;
}

export interface NetWorthData {
  budgetId: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  byCategory: Array<{ category: AssetCategory; label: string; amount: number }>;
  history: Array<{ dateKey: string; netWorth: number }>;
  accounts: AssetAccountDTO[];
}

export async function fetchBudgetNetWorth(budgetId: string): Promise<NetWorthData> {
  const { data } = await apiClient.get<{ status: string; netWorth: NetWorthData }>(
    `/budgets/${budgetId}/net-worth`
  );
  return data.netWorth;
}

export async function createAssetAccount(
  budgetId: string,
  payload: {
    name: string;
    category: AssetCategory;
    icon?: string;
    currentBalance: number;
  }
): Promise<void> {
  await apiClient.post(`/budgets/${budgetId}/assets`, payload);
}

export async function updateAssetAccount(
  budgetId: string,
  assetId: string,
  payload: { currentBalance?: number; name?: string; category?: AssetCategory }
): Promise<void> {
  await apiClient.patch(`/budgets/${budgetId}/assets/${assetId}`, payload);
}

export async function deleteAssetAccount(
  budgetId: string,
  assetId: string
): Promise<void> {
  await apiClient.delete(`/budgets/${budgetId}/assets/${assetId}`);
}

export async function importSavingsGoalsToAssets(
  budgetId: string
): Promise<{ importedCount: number }> {
  const { data } = await apiClient.post<{ status: string; importedCount: number }>(
    `/budgets/${budgetId}/assets/import-goals`
  );
  return { importedCount: data.importedCount };
}

export async function recordAssetOperation(
  budgetId: string,
  assetId: string,
  payload: {
    mode: 'add' | 'withdraw' | 'set';
    amount: number;
    label?: string;
    counterpartyType?: 'external' | 'asset' | 'savings_goal' | 'budget_period';
    counterpartyId?: string;
    periodId?: string;
  }
): Promise<void> {
  await apiClient.post(`/budgets/${budgetId}/assets/${assetId}/operations`, payload);
}

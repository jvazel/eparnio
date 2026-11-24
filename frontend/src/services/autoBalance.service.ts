import { apiClient } from './api';

export interface AutoBalanceTarget {
  envelopeId: string;
  name: string;
  icon: string;
  pillar: 'variable_envelope' | 'savings';
  currentAllocated: number;
  spentOrPaidAmount: number;
  availableMargin: number;
  suggestedDelta: number;
  newAllocated: number;
}

export interface AutoBalanceSuggestion {
  periodId: string;
  remainingToAllocate: number;
  isBalanced: boolean;
  mode: 'surplus' | 'deficit' | 'balanced';
  recommended: AutoBalanceTarget | null;
  alternatives: AutoBalanceTarget[];
}

export async function fetchAutoBalanceSuggestion(
  periodId: string
): Promise<AutoBalanceSuggestion> {
  const { data } = await apiClient.get<{
    status: string;
    suggestion: AutoBalanceSuggestion;
  }>(`/periods/${periodId}/auto-balance/suggestion`);
  return data.suggestion;
}

export async function applyAutoBalance(
  periodId: string,
  targetEnvelopeId: string,
  deltaAmount: number
): Promise<void> {
  await apiClient.post(`/periods/${periodId}/auto-balance/apply`, {
    targetEnvelopeId,
    deltaAmount,
  });
}

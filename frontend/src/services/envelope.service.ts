import type {
  EnvelopeDeleteResponse,
  EnvelopeMutationResponse,
  EnvelopesListResponse,
  EnvelopesReorderResponse
} from '../types/api.types';
import type { PillarType } from '../types/budget.types';
import { apiClient } from './api';

export interface CreateEnvelopePayload {
  pillar: PillarType;
  name: string;
  allocatedAmount: number;
  icon?: string;
  color?: string;
  date?: string;
  isRecurring?: boolean;
  isPaid?: boolean;
  memberId?: string;
  linkedGoalId?: string;
}

export interface UpdateEnvelopePayload {
  name?: string;
  allocatedAmount?: number;
  icon?: string;
  color?: string;
  date?: string;
  isRecurring?: boolean;
  isPaid?: boolean;
  order?: number;
  memberId?: string | null;
  linkedGoalId?: string | null;
}

export async function listEnvelopes(
  periodId: string,
  pillar?: PillarType
): Promise<EnvelopesListResponse> {
  const { data } = await apiClient.get<EnvelopesListResponse>(`/periods/${periodId}/envelopes`, {
    params: pillar ? { pillar } : undefined
  });
  return data;
}

export async function createEnvelope(
  periodId: string,
  payload: CreateEnvelopePayload
): Promise<EnvelopeMutationResponse> {
  const { data } = await apiClient.post<EnvelopeMutationResponse>(
    `/periods/${periodId}/envelopes`,
    payload
  );
  return data;
}

export async function updateEnvelope(
  periodId: string,
  envelopeId: string,
  payload: UpdateEnvelopePayload
): Promise<EnvelopeMutationResponse> {
  const { data } = await apiClient.patch<EnvelopeMutationResponse>(
    `/periods/${periodId}/envelopes/${envelopeId}`,
    payload
  );
  return data;
}

export async function reorderEnvelopes(
  periodId: string,
  orderedIds: string[]
): Promise<EnvelopesReorderResponse> {
  const { data } = await apiClient.patch<EnvelopesReorderResponse>(
    `/periods/${periodId}/envelopes/reorder`,
    { orderedIds }
  );
  return data;
}

export async function deleteEnvelope(
  periodId: string,
  envelopeId: string
): Promise<EnvelopeDeleteResponse> {
  const { data } = await apiClient.delete<EnvelopeDeleteResponse>(
    `/periods/${periodId}/envelopes/${envelopeId}`
  );
  return data;
}

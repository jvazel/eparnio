import type {
  AuthSessionResponse,
  MessageResponsePayload,
  PasswordUpdateResponse,
  RegenerateRecoveryKeyResponse,
  UserResponsePayload
} from '../types/api.types';
import type { CurrencyCode, ThemeMode, UserProfile } from '../types/budget.types';
import { apiClient } from './api';

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
  avatarEmoji?: string;
  budgetStartDay?: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UpdateProfilePayload {
  displayName?: string;
  avatarEmoji?: string;
  hasCompletedOnboarding?: boolean;
  budgetStartDay?: number;
  theme?: ThemeMode;
  currency?: CurrencyCode;
}

export interface UpdatePasswordPayload {
  email?: string;
  currentPassword?: string;
  recoveryKey?: string;
  emailCode?: string;
  newPassword: string;
}

export async function registerUser(payload: RegisterPayload): Promise<AuthSessionResponse> {
  const { data } = await apiClient.post<AuthSessionResponse>('/auth/register', payload);
  return data;
}

export async function loginUser(payload: LoginPayload): Promise<AuthSessionResponse> {
  const { data } = await apiClient.post<AuthSessionResponse>('/auth/login', payload);
  return data;
}

export async function fetchMe(): Promise<UserProfile> {
  const { data } = await apiClient.get<UserResponsePayload>('/auth/me');
  return data.user;
}

export async function updateMe(payload: UpdateProfilePayload): Promise<UserProfile> {
  const { data } = await apiClient.patch<UserResponsePayload>('/auth/me', payload);
  return data.user;
}

export async function regenerateRecoveryKey(): Promise<RegenerateRecoveryKeyResponse> {
  const { data } = await apiClient.post<RegenerateRecoveryKeyResponse>('/auth/recovery-key');
  return data;
}

export async function requestPasswordResetCode(email: string): Promise<MessageResponsePayload> {
  const { data } = await apiClient.post<MessageResponsePayload>('/auth/password/forgot', {
    email
  });
  return data;
}

export async function updatePassword(
  payload: UpdatePasswordPayload
): Promise<PasswordUpdateResponse> {
  const { data } = await apiClient.patch<PasswordUpdateResponse>('/auth/password', payload);
  return data;
}

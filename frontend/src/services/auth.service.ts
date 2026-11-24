import type {
  AuthSessionResponse,
  MessageResponsePayload,
  PasswordUpdateResponse,
  RegenerateRecoveryKeyResponse,
  UserResponsePayload
} from '../types/api.types';
import type { CurrencyCode, ThemeMode, UserProfile } from '../types/budget.types';
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/browser';
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
  defaultTab?: import('../types/budget.types').DefaultTabId;
  budgetViewMode?: import('../types/budget.types').BudgetViewMode;
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

export { browserSupportsWebAuthn };

/**
 * Enregistre un passkey biométrique (Face ID / Empreinte) pour l'utilisateur connecté.
 */
export async function registerBiometrics(): Promise<{ user: UserProfile }> {
  const { data: optionsData } = await apiClient.post<{
    options: PublicKeyCredentialCreationOptionsJSON;
  }>('/auth/webauthn/register/options');
  const registrationResponse = await startRegistration({ optionsJSON: optionsData.options });
  const { data } = await apiClient.post<{ user: UserProfile }>('/auth/webauthn/register/verify', {
    response: registrationResponse
  });
  return data;
}

/**
 * Supprime les credentials biométriques de l'utilisateur connecté.
 */
export async function removeBiometrics(): Promise<{ user: UserProfile }> {
  const { data } = await apiClient.delete<{ user: UserProfile }>('/auth/webauthn/credentials');
  return data;
}

/**
 * Connecte un utilisateur via son passkey biométrique (Face ID / Empreinte).
 */
export async function loginWithBiometrics(
  email: string
): Promise<{ token: string; user: UserProfile }> {
  const { data: optionsData } = await apiClient.post<{
    options: PublicKeyCredentialRequestOptionsJSON;
  }>('/auth/webauthn/login/options', { email });
  const authResponse = await startAuthentication({ optionsJSON: optionsData.options });
  const { data } = await apiClient.post<{ token: string; user: UserProfile }>(
    '/auth/webauthn/login/verify',
    {
      email,
      response: authResponse
    }
  );
  return data;
}

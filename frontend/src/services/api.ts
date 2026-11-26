import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import type { ApiErrorResponse } from '../types/api.types';

const API_BASE_URL =
  typeof import.meta.env !== 'undefined' && import.meta.env.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL)
    : '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

let refreshPromise: Promise<string | null> | null = null;

async function attemptSilentRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ status: string; token: string; user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']> }>(
        `${API_BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true }
      )
      .then(({ data }) => {
        if (data.token && data.user) {
          useAuthStore.getState().setSession(data.token, data.user);
          return data.token;
        }
        return null;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && error.config) {
      const requestUrl = error.config.url ?? '';
      const isAuthEndpoint =
        requestUrl.includes('/auth/login') ||
        requestUrl.includes('/auth/register') ||
        requestUrl.includes('/auth/refresh') ||
        requestUrl.includes('/auth/password');

      const originalConfig = error.config as typeof error.config & { _retried?: boolean };
      if (!isAuthEndpoint && !originalConfig._retried && useAuthStore.getState().isAuthenticated) {
        originalConfig._retried = true;
        const refreshedToken = await attemptSilentRefresh();
        if (refreshedToken) {
          originalConfig.headers.Authorization = `Bearer ${refreshedToken}`;
          return apiClient.request(originalConfig);
        }
        useAuthStore.getState().clearSession();
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Extrait un message d'erreur lisible depuis une erreur Axios ou générique.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback: string = 'Une erreur est survenue'
): string {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const data = error.response?.data;
    if (data?.details && data.details.length > 0 && data.details[0]?.message) {
      return data.details[0].message;
    }
    if (data?.message) {
      return data.message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

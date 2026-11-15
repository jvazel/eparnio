import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import type { ApiErrorResponse } from '../types/api.types';

const API_BASE_URL =
  typeof import.meta.env !== 'undefined' && import.meta.env.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL)
    : '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const requestUrl = error.config?.url ?? '';
      const isAuthEndpoint =
        requestUrl.includes('/auth/login') ||
        requestUrl.includes('/auth/register') ||
        requestUrl.includes('/auth/password');
      if (!isAuthEndpoint && useAuthStore.getState().token) {
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

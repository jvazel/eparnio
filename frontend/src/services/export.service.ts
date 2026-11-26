import { apiClient } from './api';
import type { BudgetSpace } from '../types/budget.types';

export interface JsonImportPreview {
  budgetName: string;
  schemaVersion: 1 | 2;
  exportedAt: string | null;
  periodsCount: number;
  envelopesCount: number;
  transactionsCount: number;
  goalsCount: number;
  assetsCount: number;
  dateRange: {
    from: string | null;
    to: string | null;
  };
  warnings: string[];
}

export interface JsonImportResponse {
  budget: BudgetSpace;
  summary: {
    periodsCount: number;
    envelopesCount: number;
    transactionsCount: number;
    goalsCount: number;
    assetsCount: number;
  };
}

/**
 * Valide un fichier de sauvegarde JSON côté serveur sans rien écrire en base
 * et retourne un aperçu détaillé de son contenu.
 */
export async function previewJsonBackupImport(
  backupPayload: unknown
): Promise<JsonImportPreview> {
  const { data } = await apiClient.post<{ status: string; preview: JsonImportPreview }>(
    '/budgets/import/json/preview',
    backupPayload
  );
  return data.preview;
}

/**
 * Restaure une sauvegarde JSON en créant un nouvel espace budgétaire.
 */
export async function importJsonBackupCreateNew(
  backupPayload: unknown,
  customName?: string
): Promise<JsonImportResponse> {
  const payload =
    customName && customName.trim().length > 0
      ? { backup: backupPayload, customName: customName.trim() }
      : backupPayload;
  const { data } = await apiClient.post<{ status: string } & JsonImportResponse>(
    '/budgets/import/json',
    payload
  );
  return {
    budget: data.budget,
    summary: data.summary
  };
}

/**
 * Restaure une sauvegarde JSON en remplaçant intégralement un espace existant (owner uniquement).
 */
export async function importJsonBackupReplaceExisting(
  budgetId: string,
  backupPayload: unknown,
  customName?: string
): Promise<JsonImportResponse> {
  const payload =
    customName && customName.trim().length > 0
      ? { backup: backupPayload, customName: customName.trim() }
      : backupPayload;
  const { data } = await apiClient.post<{ status: string } & JsonImportResponse>(
    `/budgets/${budgetId}/import/json`,
    payload
  );
  return {
    budget: data.budget,
    summary: data.summary
  };
}

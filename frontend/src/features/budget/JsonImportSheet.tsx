import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileJson, Upload } from 'lucide-react';
import { type ChangeEvent, useEffect, useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { getApiErrorMessage } from '../../services/api';
import {
  importJsonBackupCreateNew,
  importJsonBackupReplaceExisting,
  previewJsonBackupImport,
  type JsonImportPreview,
  type JsonImportResponse
} from '../../services/export.service';
import type { BudgetSpace } from '../../types/budget.types';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo

export interface JsonImportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeBudget?: BudgetSpace | null;
  canReplaceActiveBudget?: boolean;
  onBudgetRestored?: (budget: BudgetSpace) => void;
}

type ImportStep = 'select' | 'preview' | 'success';
type ImportMode = 'create_new' | 'replace_existing';

/**
 * Tiroir guidé Mobile-First en 3 étapes pour restaurer une sauvegarde JSON Eparnio
 * (création d'un nouvel espace ou remplacement sécurisé de l'espace actif).
 */
export function JsonImportSheet({
  isOpen,
  onClose,
  activeBudget = null,
  canReplaceActiveBudget = false,
  onBudgetRestored
}: JsonImportSheetProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ImportStep>('select');
  const [rawBackup, setRawBackup] = useState<unknown>(null);
  const [fileName, setFileName] = useState<string>('');
  const [preview, setPreview] = useState<JsonImportPreview | null>(null);
  const [mode, setMode] = useState<ImportMode>('create_new');
  const [customName, setCustomName] = useState<string>('');
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<JsonImportResponse | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep('select');
    setRawBackup(null);
    setFileName('');
    setPreview(null);
    setMode('create_new');
    setCustomName('');
    setReplaceConfirmed(false);
    setIsLoading(false);
    setErrorMessage(null);
    setImportResult(null);
  }, [isOpen]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage('Le fichier dépasse la taille maximale autorisée (10 Mo).');
      return;
    }

    setIsLoading(true);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setErrorMessage('Fichier JSON invalide ou corrompu. Vérifiez le fichier sélectionné.');
        return;
      }

      if (
        !parsed ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed) ||
        !('schemaVersion' in parsed)
      ) {
        setErrorMessage(
          'Ce fichier ne semble pas être une sauvegarde Eparnio valide (champ schemaVersion manquant).'
        );
        return;
      }

      const previewData = await previewJsonBackupImport(parsed);
      setRawBackup(parsed);
      setFileName(file.name);
      setPreview(previewData);
      setCustomName(`${previewData.budgetName} (Restauré)`);
      setStep('preview');
    } catch (err) {
      setErrorMessage(
        getApiErrorMessage(err, 'Impossible de lire ou valider cette sauvegarde JSON.')
      );
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!rawBackup || isLoading) return;
    if (mode === 'replace_existing' && (!activeBudget || !replaceConfirmed)) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result =
        mode === 'replace_existing' && activeBudget
          ? await importJsonBackupReplaceExisting(
              activeBudget.id,
              rawBackup,
              customName.trim() || undefined
            )
          : await importJsonBackupCreateNew(rawBackup, customName.trim() || undefined);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['budgets'] }),
        queryClient.invalidateQueries({ queryKey: ['period'] }),
        queryClient.invalidateQueries({ queryKey: ['envelopes'] }),
        queryClient.invalidateQueries({ queryKey: ['goals'] }),
        queryClient.invalidateQueries({ queryKey: ['net-worth'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] })
      ]);

      setImportResult(result);
      setStep('success');
      onBudgetRestored?.(result.budget);
    } catch (err) {
      setErrorMessage(
        getApiErrorMessage(err, 'La restauration de la sauvegarde a échoué.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Restaurer une sauvegarde (.json)"
    >
      <div className="space-y-4 pb-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {step === 'select'
            ? 'Étape 1/3 · Sélectionnez votre fichier de sauvegarde'
            : step === 'preview'
              ? 'Étape 2/3 · Vérifiez l’aperçu et choisissez le mode'
              : 'Étape 3/3 · Restauration terminée'}
        </p>
        {step === 'select' ? (
          <div className="space-y-3">
            <label
              htmlFor="eparnio-json-backup-input"
              className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/80 p-5 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-blue-500 dark:hover:bg-slate-800"
            >
              <Upload
                className="h-7 w-7 text-blue-600 dark:text-blue-400"
                aria-hidden="true"
              />
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isLoading ? 'Analyse du fichier en cours…' : 'Choisir un fichier .json'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Sauvegarde Eparnio v1 ou v2 (max 10 Mo)
              </span>
              <input
                id="eparnio-json-backup-input"
                type="file"
                accept="application/json,.json"
                disabled={isLoading}
                onChange={(e) => {
                  void handleFileChange(e);
                }}
                className="sr-only"
              />
            </label>
          </div>
        ) : null}

        {step === 'preview' && preview ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800/70">
              <div className="flex items-center gap-2">
                <FileJson
                  className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
                  aria-hidden="true"
                />
                <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">
                  {preview.budgetName}
                </p>
                <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  v{preview.schemaVersion}
                </span>
              </div>
              {fileName ? (
                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                  Fichier : {fileName}
                </p>
              ) : null}

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-white px-2.5 py-2 dark:bg-slate-900/70">
                  <span className="text-slate-500 dark:text-slate-400">Mois</span>
                  <p className="font-bold text-slate-900 dark:text-slate-100">
                    {preview.periodsCount}
                  </p>
                </div>
                <div className="rounded-xl bg-white px-2.5 py-2 dark:bg-slate-900/70">
                  <span className="text-slate-500 dark:text-slate-400">Postes / Enveloppes</span>
                  <p className="font-bold text-slate-900 dark:text-slate-100">
                    {preview.envelopesCount}
                  </p>
                </div>
                <div className="rounded-xl bg-white px-2.5 py-2 dark:bg-slate-900/70">
                  <span className="text-slate-500 dark:text-slate-400">Transactions</span>
                  <p className="font-bold text-slate-900 dark:text-slate-100">
                    {preview.transactionsCount}
                  </p>
                </div>
                <div className="rounded-xl bg-white px-2.5 py-2 dark:bg-slate-900/70">
                  <span className="text-slate-500 dark:text-slate-400">Épargne & Patrimoine</span>
                  <p className="font-bold text-slate-900 dark:text-slate-100">
                    {preview.goalsCount} · {preview.assetsCount}
                  </p>
                </div>
              </div>

              {preview.warnings.length > 0 ? (
                <ul className="mt-2.5 space-y-1 text-xs text-amber-700 dark:text-amber-300">
                  {preview.warnings.map((w) => (
                    <li key={w}>• {w}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="json-import-custom-name"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Nom de l’espace restauré (optionnel)
              </label>
              <input
                id="json-import-custom-name"
                type="text"
                maxLength={80}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={`${preview.budgetName} (Restauré)`}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-2" role="radiogroup" aria-label="Mode de restauration">
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'create_new'}
                onClick={() => {
                  setMode('create_new');
                  setReplaceConfirmed(false);
                }}
                className={`flex w-full flex-col rounded-2xl border p-3 text-left transition-colors ${
                  mode === 'create_new'
                    ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/40'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Créer un nouvel espace budgétaire
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    Recommandé
                  </span>
                </div>
                <span className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Sans risque : vos budgets actuels restent intacts.
                </span>
              </button>

              {canReplaceActiveBudget && activeBudget ? (
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === 'replace_existing'}
                  onClick={() => setMode('replace_existing')}
                  className={`flex w-full flex-col rounded-2xl border p-3 text-left transition-colors ${
                    mode === 'replace_existing'
                      ? 'border-red-500 bg-red-50/70 dark:border-red-400 dark:bg-red-950/40'
                      : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                  }`}
                >
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Remplacer l’espace actuel ({activeBudget.name})
                  </span>
                  <span className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Écrase toutes les données existantes de cet espace.
                  </span>
                </button>
              ) : null}
            </div>

            {mode === 'replace_existing' && activeBudget ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 dark:border-red-900/70 dark:bg-red-950/50">
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-medium text-red-800 dark:text-red-200">
                    Attention : cette action remplace définitivement tous les mois, enveloppes,
                    transactions, objectifs et comptes patrimoniaux de « {activeBudget.name} ».
                  </p>
                </div>
                <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-xs font-semibold text-red-900 dark:text-red-100">
                  <input
                    type="checkbox"
                    checked={replaceConfirmed}
                    onChange={(e) => setReplaceConfirmed(e.target.checked)}
                    className="h-4 w-4 rounded border-red-400 text-red-600 focus:ring-red-500"
                  />
                  <span>Je confirme vouloir remplacer l’espace actuel</span>
                </label>
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={isLoading}
                onClick={() => setStep('select')}
                className="flex-1"
              >
                Changer de fichier
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={
                  isLoading || (mode === 'replace_existing' && !replaceConfirmed)
                }
                onClick={() => {
                  void handleConfirmImport();
                }}
                className="flex-1"
              >
                {isLoading ? 'Restauration…' : 'Restaurer maintenant'}
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'success' && importResult ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
              <CheckCircle2
                className="h-6 w-6 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-slate-50">
                Sauvegarde restaurée !
              </h4>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                L’espace « {importResult.budget.name} » est prêt ({importResult.summary.periodsCount}{' '}
                mois, {importResult.summary.envelopesCount} postes,{' '}
                {importResult.summary.transactionsCount} transactions).
              </p>
            </div>
            <Button type="button" variant="primary" onClick={onClose} className="w-full">
              Accéder au budget
            </Button>
          </div>
        ) : null}

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300"
          >
            {errorMessage}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}

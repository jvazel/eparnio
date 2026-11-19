import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { getApiErrorMessage } from '../../services/api';

type ExportKind = 'csv' | 'pdf' | 'json';

export interface ExportActionsCardProps {
  variant?: 'card' | 'embedded';
  title?: string;
  subtitle?: string;
  onExportCsv?: () => Promise<string | void> | string | void;
  onExportPdf?: () => Promise<string | void> | string | void;
  onExportJson?: () => Promise<string | void> | string | void;
}

/**
 * Carte sobre regroupant les actions d'export CSV (Excel), Bilan PDF client
 * et Sauvegarde complète JSON, compatible modes clair et sombre.
 */
export function ExportActionsCard({
  variant = 'card',
  title = 'Exports & Sauvegarde',
  subtitle = 'Téléchargez vos données pour Excel, vos archives PDF ou une sauvegarde JSON.',
  onExportCsv,
  onExportPdf,
  onExportJson
}: ExportActionsCardProps) {
  const [busyKind, setBusyKind] = useState<ExportKind | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!onExportCsv && !onExportPdf && !onExportJson) {
    return null;
  }

  const handleRun = async (
    kind: ExportKind,
    defaultSuccessLabel: string,
    handler?: () => Promise<string | void> | string | void
  ) => {
    if (!handler || busyKind !== null) return;
    setBusyKind(kind);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const filename = await handler();
      setStatusMessage(
        typeof filename === 'string' && filename
          ? `Fichier téléchargé : ${filename}`
          : defaultSuccessLabel
      );
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'Impossible de générer cet export pour le moment.')
      );
    } finally {
      setBusyKind(null);
    }
  };

  const content = (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>

      <div className="space-y-2">
        {onExportCsv ? (
          <button
            type="button"
            disabled={busyKind !== null}
            onClick={() => {
              void handleRun('csv', 'Export CSV prêt.', onExportCsv);
            }}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-3.5 py-2 text-left text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <span className="flex items-center gap-2.5">
              <FileSpreadsheet
                className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              <span>
                {busyKind === 'csv' ? 'Préparation du CSV…' : 'Exporter en CSV (Excel)'}
              </span>
            </span>
          </button>
        ) : null}

        {onExportPdf ? (
          <button
            type="button"
            disabled={busyKind !== null}
            onClick={() => {
              void handleRun('pdf', 'Bilan PDF prêt.', onExportPdf);
            }}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-3.5 py-2 text-left text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <span className="flex items-center gap-2.5">
              <FileText
                className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400"
                aria-hidden="true"
              />
              <span>
                {busyKind === 'pdf' ? 'Génération du PDF…' : 'Télécharger le bilan PDF'}
              </span>
            </span>
          </button>
        ) : null}

        {onExportJson ? (
          <button
            type="button"
            disabled={busyKind !== null}
            onClick={() => {
              void handleRun('json', 'Sauvegarde JSON prête.', onExportJson);
            }}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-3.5 py-2 text-left text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <span className="flex items-center gap-2.5">
              <Download
                className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
                aria-hidden="true"
              />
              <span>
                {busyKind === 'json' ? 'Téléchargement JSON…' : 'Sauvegarde complète (.json)'}
              </span>
            </span>
          </button>
        ) : null}
      </div>

      {statusMessage ? (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
        >
          {statusMessage}
        </p>
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
  );

  if (variant === 'embedded') {
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
        {content}
      </div>
    );
  }

  return <Card>{content}</Card>;
}

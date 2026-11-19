import { CheckCircle2, FileSpreadsheet, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { formatCurrency } from '../../utils/format';
import {
  buildClientDedupKey,
  parseBankStatement,
  type ParsedBankOperation
} from '../../utils/csvParser';
import {
  importTransactions,
  type ImportTransactionsResponse
} from '../../services/transaction.service';
import type { EnvelopeItem as Envelope, TransactionItem as Transaction } from '../../types/budget.types';

export interface CsvImportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  periodId: string;
  envelopes: Envelope[];
  existingTransactions: Transaction[];
  onImported: (result: ImportTransactionsResponse) => void;
}

interface SortableOperation extends ParsedBankOperation {
  selectedEnvelopeId: string;
  excluded: boolean;
  isDuplicate: boolean;
}

export function CsvImportSheet({
  isOpen,
  onClose,
  periodId,
  envelopes,
  existingTransactions,
  onImported
}: CsvImportSheetProps) {
  const [operations, setOperations] = useState<SortableOperation[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const existingKeys = useMemo(() => {
    return new Set(
      existingTransactions.map((tx) => buildClientDedupKey(tx.date, tx.amount, tx.label))
    );
  }, [existingTransactions]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    setFileName(file.name);

    try {
      const text = await file.text();
      const parsed = parseBankStatement(text, envelopes, existingTransactions);
      if (parsed.length === 0) {
        setOperations([]);
        setError('Aucune opération de débit reconnue dans ce fichier CSV/OFX.');
        return;
      }

      const defaultEnvelopeId = envelopes[0]?.id ?? '';
      setOperations(
        parsed.map((op) => {
          const isDuplicate = existingKeys.has(op.dedupKey);
          return {
            ...op,
            selectedEnvelopeId: op.suggestedEnvelopeId ?? defaultEnvelopeId,
            excluded: isDuplicate,
            isDuplicate
          };
        })
      );
    } catch {
      setError('Impossible de lire ce fichier.');
    }
  };

  const activeOperations = useMemo(
    () => operations.filter((op) => !op.excluded && op.selectedEnvelopeId),
    [operations]
  );

  const handleToggleExclude = (id: string) => {
    setOperations((prev) =>
      prev.map((op) => (op.id === id ? { ...op, excluded: !op.excluded } : op))
    );
  };

  const handleEnvelopeChange = (id: string, envelopeId: string) => {
    setOperations((prev) =>
      prev.map((op) => (op.id === id ? { ...op, selectedEnvelopeId: envelopeId } : op))
    );
  };

  const handleSubmit = async () => {
    if (activeOperations.length === 0 || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await importTransactions(
        periodId,
        activeOperations.map((op) => ({
          envelopeId: op.selectedEnvelopeId,
          amount: op.amount,
          label: op.label,
          date: op.date
        }))
      );
      onImported(response);
      setOperations([]);
      setFileName(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’importation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Importer un relevé CSV / OFX">
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Lecture 100 % locale dans votre navigateur, sans connexion bancaire. Triez vos opérations
          en 1 tap avant de les enregistrer.
        </p>

        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-4 text-center transition hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-blue-500">
          <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {fileName ? fileName : 'Choisir un fichier .csv ou .ofx'}
          </span>
          <input
            type="file"
            accept=".csv,.ofx,text/csv"
            onChange={handleFileChange}
            className="sr-only"
            aria-label="Fichier CSV ou OFX"
          />
        </label>

        {error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </p>
        )}

        {operations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Boîte de tri ({activeOperations.length} à importer)
              </span>
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {operations.map((op) => (
                <div
                  key={op.id}
                  className={`rounded-2xl border p-3 transition ${
                    op.excluded
                      ? 'border-slate-200 bg-slate-50/50 opacity-60 dark:border-slate-800 dark:bg-slate-900/40'
                      : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {op.label}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {op.date} · {formatCurrency(op.amount)}
                        {op.isDuplicate && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            Doublon détecté
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleExclude(op.id)}
                      aria-label={op.excluded ? `Inclure ${op.label}` : `Exclure ${op.label}`}
                      className={`rounded-xl p-1.5 text-xs font-medium transition ${
                        op.excluded
                          ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                          : 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300'
                      }`}
                    >
                      {op.excluded ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {!op.excluded && (
                    <div className="mt-2">
                      <select
                        value={op.selectedEnvelopeId}
                        onChange={(e) => handleEnvelopeChange(op.id, e.target.value)}
                        aria-label={`Enveloppe pour ${op.label}`}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        {envelopes.map((env) => (
                          <option key={env.id} value={env.id}>
                            {env.icon} {env.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={activeOperations.length === 0 || submitting}
          className="w-full rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? 'Importation en cours...'
            : `Importer ${activeOperations.length} opération${activeOperations.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </BottomSheet>
  );
}

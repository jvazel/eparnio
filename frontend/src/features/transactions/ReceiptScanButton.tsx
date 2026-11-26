import { Camera, Loader2, ShieldCheck, X } from 'lucide-react';
import { type ChangeEvent, useRef } from 'react';
import { useReceiptScanner } from '../../hooks/useReceiptScanner';
import { formatCurrency } from '../../utils/format';
import type { ParsedReceipt } from '../../utils/parseReceiptText';

export interface ReceiptScanButtonProps {
  onResult: (result: ParsedReceipt) => void;
  onSelectCandidateAmount?: (amount: number) => void;
  disabled?: boolean;
  compact?: boolean;
}

/**
 * Bouton de scan de ticket de caisse par OCR 100 % local (caméra mobile / galerie).
 * Affiche la progression, permet d'annuler et propose des chips de montants alternatifs.
 */
export function ReceiptScanButton({
  onResult,
  onSelectCandidateAmount,
  disabled = false,
  compact = false
}: ReceiptScanButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { scanFile, cancelScan, isScanning, progress, error, lastResult } = useReceiptScanner();

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Permet de re-sélectionner le même fichier si besoin
    event.target.value = '';
    if (!file) return;

    const parsed = await scanFile(file);
    if (parsed && (parsed.amount !== null || parsed.merchant || parsed.date)) {
      onResult(parsed);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Choisir ou photographier un ticket de caisse"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || isScanning}
          onClick={() => inputRef.current?.click()}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 shadow-xs transition hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500/60 dark:hover:bg-slate-700 ${
            compact ? 'px-2.5 py-1.5 text-xs' : 'w-full px-3 py-2 text-xs'
          }`}
          aria-label="Scanner un ticket de caisse"
        >
          {isScanning ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" aria-hidden="true" />
          ) : (
            <Camera className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          )}
          <span>{isScanning ? `Lecture… ${progress}%` : 'Scanner un ticket'}</span>
        </button>

        {isScanning && (
          <button
            type="button"
            onClick={cancelScan}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Annuler
          </button>
        )}
      </div>

      {isScanning && (
        <div className="space-y-1">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
            role="progressbar"
            aria-label="Progression de la lecture du ticket"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-200 dark:bg-blue-400"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden="true" />
            Analyse 100 % locale — aucune photo n&apos;est envoyée sur nos serveurs.
          </p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
        >
          {error}
        </p>
      )}

      {!isScanning && lastResult && lastResult.candidateAmounts.length > 1 && onSelectCandidateAmount && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Autres montants détectés :
          </span>
          {lastResult.candidateAmounts.map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => onSelectCandidateAmount(candidate)}
              className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60"
            >
              {formatCurrency(candidate)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

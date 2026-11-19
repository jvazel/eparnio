import { Scale } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import {
  reconcilePeriodBalance,
  type BalanceReconciliationResult
} from '../../services/transaction.service';
import { formatCurrency } from '../../utils/format';

export interface BalanceReconcileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  periodId: string;
  theoreticalBalance: number;
}

export function BalanceReconcileSheet({
  isOpen,
  onClose,
  periodId,
  theoreticalBalance
}: BalanceReconcileSheetProps) {
  const [bankBalanceInput, setBankBalanceInput] = useState('');
  const [result, setResult] = useState<BalanceReconciliationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = Number(bankBalanceInput.replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      setError('Veuillez saisir un solde bancaire valide.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await reconcilePeriodBalance(periodId, parsed);
      setResult(response.reconciliation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la réconciliation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Réconcilier mon solde bancaire">
      <div className="space-y-4">
        <div className="rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/70">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Solde théorique Eparnio (Reste à vivre)
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatCurrency(theoreticalBalance)}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Solde réel affiché sur votre banque (€)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={bankBalanceInput}
              onChange={(e) => setBankBalanceInput(e.target.value)}
              placeholder="Ex: 1240,50"
              aria-label="Solde bancaire réel"
              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || bankBalanceInput.trim().length === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Scale className="h-4 w-4" />
            {loading ? 'Calcul en cours...' : 'Comparer les soldes'}
          </button>
        </form>

        {result && (
          <div
            className={`rounded-2xl border p-4 ${
              result.status === 'balanced'
                ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/30'
                : 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Écart détecté
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {result.difference > 0 ? '+' : ''}
              {formatCurrency(result.difference)}
            </p>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
              {result.status === 'balanced' &&
                'Votre budget Eparnio est parfaitement aligné avec votre compte bancaire.'}
              {result.status === 'under' &&
                `Votre solde bancaire est inférieur de ${formatCurrency(result.suggestedAdjustmentAmount)} au théorique (dépense oubliée probable).`}
              {result.status === 'over' &&
                `Votre solde bancaire est supérieur de ${formatCurrency(result.suggestedAdjustmentAmount)} au théorique (revenu non saisi ou charge non débitée).`}
            </p>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

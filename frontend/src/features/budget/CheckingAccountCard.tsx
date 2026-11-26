import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, Landmark, Pencil } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { getApiErrorMessage } from '../../services/api';
import { updateCheckingAccountBalance } from '../../services/netWorth.service';

export interface CheckingAccountCardProps {
  budgetId: string;
  periodId?: string;
  budgetName?: string;
  currentBalance: number | null;
  updatedAt?: string | null;
}

const euroFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR'
});

function formatEuro(val: number): string {
  return euroFormatter.format(val);
}

/**
 * Carte compacte « Compte courant » affichée dans la vue Synthèse de l'onglet Budget,
 * avec mise à jour manuelle pure et étape de confirmation obligatoire avant enregistrement.
 */
export function CheckingAccountCard({
  budgetId,
  periodId,
  budgetName,
  currentBalance,
  updatedAt
}: CheckingAccountCardProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [balanceInput, setBalanceInput] = useState('');
  const [parsedBalance, setParsedBalance] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOpen = () => {
    setStep('input');
    setBalanceInput(currentBalance !== null ? String(currentBalance).replace('.', ',') : '');
    setParsedBalance(null);
    setErrorMessage(null);
    setIsOpen(true);
  };

  const handleRequestConfirm = () => {
    setErrorMessage(null);
    const cleaned = balanceInput.replace(/\s+/g, '').replace(',', '.').trim();
    const numeric = Number(cleaned);
    if (!cleaned || !Number.isFinite(numeric)) {
      setErrorMessage('Veuillez saisir un montant valide (ex. 1240,50).');
      return;
    }
    setParsedBalance(Math.round(numeric * 100) / 100);
    setStep('confirm');
  };

  const handleConfirmSave = async () => {
    if (parsedBalance === null || isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await updateCheckingAccountBalance(budgetId, {
        balance: parsedBalance,
        ...(periodId ? { periodId } : {})
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['period'] }),
        queryClient.invalidateQueries({ queryKey: ['envelopes'] }),
        queryClient.invalidateQueries({ queryKey: ['net-worth'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['calendar'] })
      ]);
      setIsOpen(false);
    } catch (err) {
      setErrorMessage(
        getApiErrorMessage(err, 'Impossible de mettre à jour le solde du compte courant.')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const delta =
    parsedBalance !== null && currentBalance !== null
      ? Math.round((parsedBalance - currentBalance) * 100) / 100
      : null;

  const formattedUpdatedAt = updatedAt
    ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(
        new Date(updatedAt)
      )
    : null;

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {budgetName ? `Solde · ${budgetName}` : 'Compte courant'}
              </p>
              <p className="truncate text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">
                {currentBalance !== null ? formatEuro(currentBalance) : 'Non renseigné'}
              </p>
              {formattedUpdatedAt ? (
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Mis à jour le {formattedUpdatedAt}
                </p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800/70 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Mettre à jour
          </button>
        </div>
      </Card>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => !isSaving && setIsOpen(false)}
        title={
          step === 'input'
            ? 'Mettre à jour le compte courant'
            : 'Confirmer la mise à jour'
        }
      >
        <div className="space-y-4 pb-2">
          {step === 'input' ? (
            <>
              {currentBalance !== null ? (
                <div className="rounded-2xl bg-slate-50 p-3 text-xs dark:bg-slate-800/70">
                  <span className="text-slate-500 dark:text-slate-400">Solde actuel enregistré</span>
                  <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900 dark:text-slate-50">
                    {formatEuro(currentBalance)}
                  </p>
                </div>
              ) : null}

              <div>
                <label
                  htmlFor="checking-balance-input"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Nouveau solde de votre compte courant (€)
                </label>
                <input
                  id="checking-balance-input"
                  type="text"
                  inputMode="decimal"
                  value={balanceInput}
                  onChange={(e) => setBalanceInput(e.target.value)}
                  placeholder="Ex. 1240,50"
                  className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-lg font-bold tabular-nums text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                />
              </div>

              {errorMessage ? (
                <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                  {errorMessage}
                </p>
              ) : null}

              <Button type="button" variant="primary" fullWidth onClick={handleRequestConfirm}>
                Continuer
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/40">
                <div className="flex items-start gap-2">
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                    aria-hidden="true"
                  />
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-amber-900 dark:text-amber-200">
                      Confirmez-vous la mise à jour du solde ?
                    </p>
                    <p className="tabular-nums text-amber-800 dark:text-amber-300">
                      {currentBalance !== null ? formatEuro(currentBalance) : 'Non renseigné'} →{' '}
                      <strong>{parsedBalance !== null ? formatEuro(parsedBalance) : ''}</strong>
                      {delta !== null
                        ? ` (${delta >= 0 ? '+' : ''}${formatEuro(delta)})`
                        : ''}
                    </p>
                  </div>
                </div>
              </div>

              {errorMessage ? (
                <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                  {errorMessage}
                </p>
              ) : null}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  disabled={isSaving}
                  onClick={() => setStep('input')}
                >
                  Modifier
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="flex-1"
                  disabled={isSaving}
                  onClick={() => {
                    void handleConfirmSave();
                  }}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {isSaving ? 'Enregistrement…' : 'Confirmer la mise à jour'}
                </Button>
              </div>
            </>
          )}
        </div>
      </BottomSheet>
    </>
  );
}

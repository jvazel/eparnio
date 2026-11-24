import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { NumericKeypad } from '../../components/ui/NumericKeypad';
import type { CashFlowPoint } from '../../services/calendar.service';
import { createEnvelope } from '../../services/envelope.service';
import { createTransaction } from '../../services/transaction.service';
import type { EnvelopeItem } from '../../types/budget.types';
import { simulateWhatIf, type SimulationType } from './whatIfSimulator';

interface WhatIfSimulatorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  periodId: string;
  remainingToLive: number;
  remainingToAllocate: number;
  daysRemaining: number;
  totalIncome: number;
  variableEnvelopes: EnvelopeItem[];
  cashFlowCurve?: CashFlowPoint[];
}

export function WhatIfSimulatorSheet({
  isOpen,
  onClose,
  periodId,
  remainingToLive,
  remainingToAllocate,
  daysRemaining,
  totalIncome,
  variableEnvelopes,
  cashFlowCurve,
}: WhatIfSimulatorSheetProps) {
  const queryClient = useQueryClient();
  const [amountInput, setAmountInput] = useState('0');
  const [simType, setSimType] = useState<SimulationType>('one_time');
  const [installmentsCount, setInstallmentsCount] = useState(3);
  const [label, setLabel] = useState('');
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState(
    variableEnvelopes[0]?.id ?? ''
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const numericAmount = useMemo(() => {
    const parsed = Number.parseFloat(amountInput.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amountInput]);

  const result = useMemo(
    () =>
      simulateWhatIf({
        type: simType,
        amount: numericAmount,
        installmentsCount,
        remainingToLive,
        remainingToAllocate,
        daysRemaining,
        totalIncome,
        cashFlowCurve,
      }),
    [
      simType,
      numericAmount,
      installmentsCount,
      remainingToLive,
      remainingToAllocate,
      daysRemaining,
      totalIncome,
      cashFlowCurve,
    ]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cleanLabel = label.trim() || 'Achat simulé';
      if (simType === 'one_time') {
        const targetEnvId = selectedEnvelopeId || variableEnvelopes[0]?.id;
        if (!targetEnvId) {
          throw new Error('Aucune enveloppe variable disponible.');
        }
        await createTransaction(periodId, {
          envelopeId: targetEnvId,
          amount: numericAmount,
          label: cleanLabel,
          date: new Date().toISOString(),
        });
      } else {
        await createEnvelope(periodId, {
          pillar: 'fixed_charge',
          name: cleanLabel,
          icon: '📌',
          color: '#8B5CF6',
          allocatedAmount: result.monthlyImpact,
          isRecurring: true,
          recurrenceFrequency: 'monthly',
          recurrenceRemainingCount:
            simType === 'installments' ? installmentsCount : undefined,
          date: new Date().toISOString(),
        });
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['period'] }),
        queryClient.invalidateQueries({ queryKey: ['envelopes'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['calendar'] }),
      ]);
      onClose();
    },
    onError: (err: unknown) => {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.');
    },
  });

  if (!isOpen) return null;

  const feasibilityBadge =
    result.feasibility === 'compatible'
      ? {
          text: '🟢 Compatible avec votre budget',
          classes:
            'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
        }
      : result.feasibility === 'tight'
        ? {
            text: '🟠 Budget serré',
            classes: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
          }
        : {
            text: '🔴 Risque de dépassement / découvert',
            classes: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300',
          };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#F6F7FB] dark:bg-slate-900 rounded-t-3xl p-4 shadow-2xl max-h-[92dvh] overflow-y-auto space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Simulateur « Et si… ? »
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Montant Hero */}
        <div className="text-center py-1">
          <p className="text-4xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {numericAmount.toLocaleString('fr-FR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            €
          </p>
          {simType === 'installments' && (
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Soit {result.monthlyImpact.toFixed(2)} € / mois pendant {installmentsCount} mois
            </p>
          )}
        </div>

        {/* Sélecteur de type */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-2xl">
          {(
            [
              { key: 'one_time', label: 'Ponctuel' },
              { key: 'recurring_fixed', label: 'Mensuel' },
              { key: 'installments', label: 'En Nx' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSimType(opt.key)}
              className={`py-1.5 rounded-xl text-xs font-semibold transition-all ${
                simType === opt.key
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {simType === 'installments' && (
          <div className="flex items-center justify-center gap-2">
            {[3, 4, 12].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setInstallmentsCount(n)}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  installmentsCount === n
                    ? 'bg-violet-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {n}x
              </button>
            ))}
          </div>
        )}

        {/* Badge faisabilité + Avant / Après */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 shadow-sm space-y-2.5">
          <div
            className={`px-3 py-1.5 rounded-xl text-xs font-bold text-center ${feasibilityBadge.classes}`}
          >
            {feasibilityBadge.text}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-700/50">
              <p className="text-slate-500 dark:text-slate-400">Reste à vivre</p>
              <p className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {result.remainingToLiveBefore.toFixed(0)} € →{' '}
                <span
                  className={
                    result.remainingToLiveAfter < 0 ? 'text-red-500' : 'text-emerald-600'
                  }
                >
                  {result.remainingToLiveAfter.toFixed(0)} €
                </span>
              </p>
            </div>

            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-700/50">
              <p className="text-slate-500 dark:text-slate-400">Budget / jour</p>
              <p className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {result.dailyBudgetBefore.toFixed(1)} € → {result.dailyBudgetAfter.toFixed(1)} €
              </p>
            </div>
          </div>

          {result.projectedEndBalanceAfter !== null && (
            <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 tabular-nums">
              Solde fin de cycle projeté après achat :{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {result.projectedEndBalanceAfter.toFixed(2)} €
              </strong>
            </p>
          )}
        </div>

        {/* Nom & Enveloppe */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 shadow-sm space-y-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nom de l'achat ou projet..."
            className="w-full text-sm bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none"
          />
          {simType === 'one_time' && variableEnvelopes.length > 0 && (
            <select
              aria-label="Enveloppe cible"
              value={selectedEnvelopeId}
              onChange={(e) => setSelectedEnvelopeId(e.target.value)}
              className="w-full text-xs rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2.5 py-2 outline-none"
            >
              {variableEnvelopes.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.icon} {env.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <NumericKeypad value={amountInput} onChange={setAmountInput} />

        {errorMsg && <p className="text-xs text-center text-red-500">{errorMsg}</p>}

        <button
          type="button"
          disabled={numericAmount <= 0 || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className="w-full py-3.5 rounded-2xl bg-[#1D7DFA] disabled:opacity-50 text-white font-semibold text-sm shadow-sm"
        >
          {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer réellement'}
        </button>
      </div>
    </div>
  );
}

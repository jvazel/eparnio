import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Scale, X } from 'lucide-react';
import { useState } from 'react';
import {
  applyAutoBalance,
  fetchAutoBalanceSuggestion,
  type AutoBalanceTarget,
} from '../../services/autoBalance.service';

interface AutoBalanceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  periodId: string;
}

export function AutoBalanceSheet({
  isOpen,
  onClose,
  periodId,
}: AutoBalanceSheetProps) {
  const queryClient = useQueryClient();
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  const { data: suggestion, isLoading } = useQuery({
    queryKey: ['auto-balance-suggestion', periodId],
    queryFn: () => fetchAutoBalanceSuggestion(periodId),
    enabled: isOpen && Boolean(periodId),
  });

  const applyMutation = useMutation({
    mutationFn: (target: AutoBalanceTarget) =>
      applyAutoBalance(periodId, target.envelopeId, target.suggestedDelta),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['period'] }),
        queryClient.invalidateQueries({ queryKey: ['envelopes'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['auto-balance-suggestion', periodId] }),
      ]);
      onClose();
    },
  });

  if (!isOpen) return null;

  const allTargets: AutoBalanceTarget[] = suggestion
    ? [
        ...(suggestion.recommended ? [suggestion.recommended] : []),
        ...suggestion.alternatives,
      ]
    : [];

  const activeTarget =
    allTargets.find((t) => t.envelopeId === selectedTargetId) ??
    suggestion?.recommended ??
    null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl p-5 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Équilibrer en 1 tap
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-center text-slate-500 py-4">
            Calcul de la meilleure répartition...
          </p>
        ) : !suggestion || suggestion.isBalanced || !activeTarget ? (
          <p className="text-sm text-center text-emerald-600 dark:text-emerald-400 py-4 font-semibold">
            Votre budget est déjà équilibré à 0,00 € !
          </p>
        ) : (
          <>
            <div className="p-3.5 rounded-2xl bg-violet-50 dark:bg-violet-900/30 space-y-1">
              <p className="text-xs text-violet-700 dark:text-violet-300">
                Écart actuel à attribuer :{' '}
                <strong className="tabular-nums">
                  {suggestion.remainingToAllocate.toFixed(2)} €
                </strong>
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {activeTarget.suggestedDelta > 0
                  ? `Ajouter +${activeTarget.suggestedDelta.toFixed(2)} € à ${activeTarget.icon} ${activeTarget.name}`
                  : `Réduire ${activeTarget.icon} ${activeTarget.name} de ${Math.abs(
                      activeTarget.suggestedDelta
                    ).toFixed(2)} €`}
              </p>
            </div>

            {allTargets.length > 1 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Choisir une autre enveloppe cible :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {allTargets.map((t) => (
                    <button
                      key={t.envelopeId}
                      type="button"
                      onClick={() => setSelectedTargetId(t.envelopeId)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        t.envelopeId === activeTarget.envelopeId
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {t.icon} {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={applyMutation.isPending}
              onClick={() => applyMutation.mutate(activeTarget)}
              className="w-full py-3.5 rounded-2xl bg-[#1D7DFA] disabled:opacity-50 text-white font-semibold text-sm shadow-sm"
            >
              {applyMutation.isPending ? 'Application...' : 'Confirmer l’équilibrage'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

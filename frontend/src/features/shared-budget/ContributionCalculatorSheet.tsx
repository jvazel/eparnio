import { useQueryClient } from '@tanstack/react-query';
import { Calculator, CheckCircle2, Scale, Users } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { getApiErrorMessage } from '../../services/api';
import { updateContributionSplit } from '../../services/budget.service';
import type { BudgetSpace, ContributionMode } from '../../types/budget.types';
import { formatCurrency } from '../../utils/format';

export interface ContributionCalculatorSheetProps {
  isOpen: boolean;
  budget: BudgetSpace | null;
  periodId?: string;
  defaultTargetAmount: number;
  currentUserId?: string;
  onClose: () => void;
  onApplied?: () => void;
}

export interface ClientMemberPreview {
  userId: string;
  label: string;
  avatarEmoji: string;
  color: string;
  declaredMonthlyIncome: number;
  sharePercentage: number;
  recommendedContribution: number;
}

function roundCurrency(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

function roundPercent(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10;
  return rounded === 0 ? 0 : rounded;
}

/**
 * Calcule l'aperçu temps réel des quotes-parts (%) et apports (€) en 50/50 ou au prorata.
 */
export function computeClientContributionPreview(
  mode: Extract<ContributionMode, 'equal_50_50' | 'income_prorata'>,
  targetAmount: number,
  members: Array<{
    userId: string;
    label: string;
    avatarEmoji: string;
    color: string;
    declaredMonthlyIncome: number;
  }>
): ClientMemberPreview[] {
  const safeTarget = roundCurrency(Math.max(0, Number.isFinite(targetAmount) ? targetAmount : 0));
  if (members.length === 0) return [];

  let weights: number[];
  if (mode === 'equal_50_50') {
    weights = members.map(() => 1);
  } else {
    const incomes = members.map((m) =>
      Math.max(0, Number.isFinite(m.declaredMonthlyIncome) ? m.declaredMonthlyIncome : 0)
    );
    const totalIncome = incomes.reduce((acc, w) => acc + w, 0);
    weights = totalIncome > 0 ? incomes : members.map(() => 1);
  }

  const totalWeight = weights.reduce((acc, w) => acc + w, 0);
  let remainingPercent = 100;
  let remainingAmount = safeTarget;

  return members.map((member, index) => {
    const isLast = index === members.length - 1;
    const ratio = totalWeight > 0 ? weights[index] / totalWeight : 1 / members.length;

    const sharePercentage = isLast
      ? roundPercent(Math.max(0, remainingPercent))
      : roundPercent(ratio * 100);
    remainingPercent = roundPercent(remainingPercent - sharePercentage);

    const recommendedContribution = isLast
      ? roundCurrency(Math.max(0, remainingAmount))
      : roundCurrency(safeTarget * ratio);
    remainingAmount = roundCurrency(remainingAmount - recommendedContribution);

    return {
      ...member,
      sharePercentage,
      recommendedContribution
    };
  });
}

/**
 * Calculateur interactif d'apport équitable (50/50 ou Prorata des salaires) pour budget partagé.
 */
export function ContributionCalculatorSheet({
  isOpen,
  budget,
  periodId,
  defaultTargetAmount,
  currentUserId,
  onClose,
  onApplied
}: ContributionCalculatorSheetProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'equal_50_50' | 'income_prorata'>('equal_50_50');
  const [targetInput, setTargetInput] = useState('0');
  const [incomesByUser, setIncomesByUser] = useState<Record<string, string>>({});
  const [applyToPeriod, setApplyToPeriod] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !budget) return;
    setError(null);
    setMode(budget.contributionMode === 'income_prorata' ? 'income_prorata' : 'equal_50_50');
    setTargetInput(String(roundCurrency(Math.max(0, defaultTargetAmount))));
    setApplyToPeriod(Boolean(periodId));

    const initialIncomes: Record<string, string> = {};
    for (const member of budget.members) {
      initialIncomes[member.userId] = String(member.declaredMonthlyIncome ?? 0);
    }
    setIncomesByUser(initialIncomes);
  }, [isOpen, budget, defaultTargetAmount, periodId]);

  const parsedTarget = useMemo(() => {
    const numeric = Number(targetInput.replace(',', '.'));
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
  }, [targetInput]);

  const previews = useMemo(() => {
    if (!budget) return [];
    return computeClientContributionPreview(
      mode,
      parsedTarget,
      budget.members.map((member, index) => {
        const rawIncome = (incomesByUser[member.userId] ?? '0').replace(',', '.');
        const numericIncome = Number(rawIncome);
        const label =
          member.displayName?.trim() ||
          (member.userId === currentUserId ? 'Moi' : `Membre ${index + 1}`);
        return {
          userId: member.userId,
          label,
          avatarEmoji: member.avatarEmoji || '🧑',
          color: member.color,
          declaredMonthlyIncome:
            Number.isFinite(numericIncome) && numericIncome >= 0 ? numericIncome : 0
        };
      })
    );
  }, [budget, mode, parsedTarget, incomesByUser, currentUserId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!budget) return;

    setError(null);
    setIsSaving(true);
    try {
      await updateContributionSplit(budget.id, {
        contributionMode: mode,
        targetAmount: parsedTarget,
        ...(periodId ? { periodId } : {}),
        applyToPeriod: Boolean(applyToPeriod && periodId),
        members: previews.map((item) => ({
          userId: item.userId,
          declaredMonthlyIncome: item.declaredMonthlyIncome
        }))
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['budgets'] }),
        queryClient.invalidateQueries({ queryKey: ['period'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] })
      ]);
      onApplied?.();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible de calculer et enregistrer la répartition.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!budget) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Calculateur 50/50 & Prorata">
      <form onSubmit={handleSubmit} className="space-y-4 pb-2">
        <p className="text-xs leading-relaxed text-slate-500">
          Répartissez automatiquement les charges et enveloppes communes de{' '}
          <strong className="font-semibold text-slate-800">{budget.name}</strong> pour équilibrer
          votre Budget Base Zéro à <span className="font-semibold text-emerald-600">0 €</span>.
        </p>

        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-slate-600">
            Méthode de répartition
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={mode === 'equal_50_50'}
              onClick={() => setMode('equal_50_50')}
              className={`flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border px-3 text-xs font-bold transition-colors ${
                mode === 'equal_50_50'
                  ? 'border-violet-600 bg-violet-50 text-violet-700'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              Égalitaire (50/50)
            </button>
            <button
              type="button"
              aria-pressed={mode === 'income_prorata'}
              onClick={() => setMode('income_prorata')}
              className={`flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border px-3 text-xs font-bold transition-colors ${
                mode === 'income_prorata'
                  ? 'border-violet-600 bg-violet-50 text-violet-700'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              <Scale className="h-4 w-4" aria-hidden="true" />
              Prorata des salaires
            </button>
          </div>
        </fieldset>

        <div>
          <label
            htmlFor="calc-target-amount"
            className="mb-1 block text-xs font-semibold text-slate-600"
          >
            Total des besoins communs à couvrir (€)
          </label>
          <input
            id="calc-target-amount"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={targetInput}
            onChange={(event) => setTargetInput(event.target.value)}
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-base font-bold tabular-nums text-slate-900 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
        </div>

        <div className="space-y-2.5">
          {previews.map((member) => {
            const incomeInputId = `calc-income-${member.userId}`;
            return (
              <div
                key={member.userId}
                className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full border-2 bg-white text-base shadow-sm"
                      style={{ borderColor: member.color }}
                      aria-hidden="true"
                    >
                      {member.avatarEmoji}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{member.label}</p>
                      <Badge tone="violet">{member.sharePercentage} %</Badge>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[11px] font-medium text-slate-500">Apport conseillé</p>
                    <p className="text-base font-bold tabular-nums text-blue-600">
                      {formatCurrency(member.recommendedContribution)}
                    </p>
                  </div>
                </div>

                {mode === 'income_prorata' ? (
                  <div className="mt-2.5">
                    <label
                      htmlFor={incomeInputId}
                      className="mb-1 block text-[11px] font-semibold text-slate-500"
                    >
                      Revenu net mensuel de {member.label} (€)
                    </label>
                    <input
                      id={incomeInputId}
                      type="number"
                      step="1"
                      min="0"
                      inputMode="decimal"
                      value={incomesByUser[member.userId] ?? '0'}
                      onChange={(event) =>
                        setIncomesByUser((prev) => ({
                          ...prev,
                          [member.userId]: event.target.value
                        }))
                      }
                      className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold tabular-nums text-slate-900 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {periodId ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-2xl border border-slate-100 bg-white px-3.5 py-2 shadow-card">
            <input
              type="checkbox"
              checked={applyToPeriod}
              onChange={(event) => setApplyToPeriod(event.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            <span className="text-xs font-semibold text-slate-700">
              Mettre à jour automatiquement les apports du mois dans Revenus
            </span>
          </label>
        ) : null}

        {error ? (
          <p role="alert" className="text-xs font-medium text-red-600">
            {error}
          </p>
        ) : null}

        <Button type="submit" fullWidth disabled={isSaving}>
          {isSaving ? (
            <>
              <Calculator className="h-4 w-4" aria-hidden="true" />
              Enregistrement...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Appliquer cette répartition
            </>
          )}
        </Button>
      </form>
    </BottomSheet>
  );
}

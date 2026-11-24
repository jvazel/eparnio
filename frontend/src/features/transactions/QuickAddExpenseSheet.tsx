import { Star, X } from 'lucide-react';
import { DropdownSelect } from '../../components/ui/DropdownSelect';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { TagInput } from '../../components/ui/TagInput';
import { triggerHaptic } from '../../utils/haptics';
import { BottomSheet } from '../../components/ui/BottomSheet';
import {
  formatAmountToKeypadString,
  NumericKeypad,
  parseAmountString
} from '../../components/ui/NumericKeypad';
import type {
  CreateTransactionPayload,
  EnvelopeAnomalyThreshold,
  SplitTransactionPayload,
  TransactionSuggestion
} from '../../services/transaction.service';
import type { BudgetMember, EnvelopeItem, QuickTemplateItem } from '../../types/budget.types';
import { formatCurrency } from '../../utils/format';

function normalizeEnvelopeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export interface QuickAddExpenseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  envelopes: EnvelopeItem[];
  isSharedBudget?: boolean;
  members?: BudgetMember[];
  currentUserId?: string;
  isSubmitting?: boolean;
  quickTemplates?: QuickTemplateItem[];
  suggestions?: TransactionSuggestion[];
  onSaveQuickTemplate?: (payload: {
    label: string;
    envelopeName: string;
    defaultAmount?: number;
  }) => Promise<void>;
  onDeleteQuickTemplate?: (templateId: string) => Promise<void>;
  onSplitSubmit?: (payload: SplitTransactionPayload) => Promise<void>;
  anomalyThresholds?: Record<string, EnvelopeAnomalyThreshold>;
  onSubmit: (payload: CreateTransactionPayload) => Promise<void>;
}

export function QuickAddExpenseSheet({
  isOpen,
  onClose,
  envelopes,
  isSharedBudget = false,
  members = [],
  currentUserId = '',
  isSubmitting = false,
  quickTemplates = [],
  suggestions = [],
  onSaveQuickTemplate,
  onDeleteQuickTemplate,
  onSplitSubmit,
  anomalyThresholds = {},
  onSubmit
}: QuickAddExpenseSheetProps) {
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState<string>(envelopes[0]?.id ?? '');
  const [amountInput, setAmountInput] = useState('');
  const [label, setLabel] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paidByUserId, setPaidByUserId] = useState(currentUserId);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitParts, setSplitParts] = useState<Array<{ envelopeId: string; amount: string }>>([
    { envelopeId: envelopes[0]?.id ?? '', amount: '' },
    { envelopeId: envelopes[1]?.id ?? envelopes[0]?.id ?? '', amount: '' }
  ]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedEnvelopeId((prev) =>
        envelopes.some((e) => e.id === prev) ? prev : (envelopes[0]?.id ?? '')
      );
      setPaidByUserId(currentUserId);
      setError(null);
    }
  }, [isOpen, envelopes, currentUserId]);

  const selectedEnvelope = useMemo(
    () => envelopes.find((e) => e.id === selectedEnvelopeId) ?? envelopes[0] ?? null,
    [envelopes, selectedEnvelopeId]
  );

  const parsedAmount = parseAmountString(amountInput);

  const splitAllocatedSum = useMemo(
    () =>
      Math.round(
        splitParts.reduce((sum, part) => sum + parseAmountString(part.amount), 0) * 100
      ) / 100,
    [splitParts]
  );

  const splitRemainingToAllocate = Math.round((parsedAmount - splitAllocatedSum) * 100) / 100;

  const liveRemaining = useMemo(() => {
    if (!selectedEnvelope) return 0;
    const rollover = selectedEnvelope.rolloverAmount ?? 0;
    const baseAvailable =
      selectedEnvelope.allocatedAmount + rollover - selectedEnvelope.spentOrPaidAmount;
    return Math.round((baseAvailable - parsedAmount) * 100) / 100;
  }, [selectedEnvelope, parsedAmount]);

  const filteredSuggestions = useMemo(() => {
    const query = label.trim().toLowerCase();
    if (!query || suggestions.length === 0) return [];
    return suggestions
      .filter((s) => s.label.toLowerCase().includes(query) && s.label.toLowerCase() !== query)
      .slice(0, 5);
  }, [label, suggestions]);

  const selectEnvelopeByName = (envelopeName: string) => {
    const target = normalizeEnvelopeName(envelopeName);
    const match = envelopes.find((env) => normalizeEnvelopeName(env.name) === target);
    if (match) {
      setSelectedEnvelopeId(match.id);
    }
  };

  const handleApplyTemplate = (tpl: QuickTemplateItem) => {
    selectEnvelopeByName(tpl.envelopeName);
    setLabel(tpl.label);
    if (tpl.defaultAmount !== undefined && tpl.defaultAmount > 0) {
      setAmountInput(formatAmountToKeypadString(tpl.defaultAmount));
    }
  };

  const handleApplySuggestion = (suggestion: TransactionSuggestion) => {
    setLabel(suggestion.label);
    selectEnvelopeByName(suggestion.envelopeName);
    if (!amountInput && suggestion.lastAmount > 0) {
      setAmountInput(formatAmountToKeypadString(suggestion.lastAmount));
    }
  };

  const handleSaveAsFavorite = async () => {
    if (!onSaveQuickTemplate || !selectedEnvelope || !label.trim() || savingTemplate) return;
    setSavingTemplate(true);
    try {
      await onSaveQuickTemplate({
        label: label.trim(),
        envelopeName: selectedEnvelope.name,
        ...(parsedAmount > 0 ? { defaultAmount: parsedAmount } : {})
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedEnvelope) {
      setError('Veuillez sélectionner une enveloppe.');
      return;
    }
    if (parsedAmount <= 0) {
      setError('Veuillez saisir un montant supérieur à 0 €.');
      return;
    }
    if (!label.trim()) {
      setError('Veuillez saisir un libellé.');
      return;
    }

    setError(null);
    try {
      if (isSplitMode && onSplitSubmit) {
        const validParts = splitParts
          .map((p) => ({ envelopeId: p.envelopeId, amount: parseAmountString(p.amount) }))
          .filter((p) => p.envelopeId && p.amount > 0);
        const distinctEnvelopes = new Set(validParts.map((p) => p.envelopeId));
        if (distinctEnvelopes.size < 2) {
          setError('Veuillez répartir sur au moins 2 enveloppes distinctes.');
          return;
        }
        if (Math.abs(splitRemainingToAllocate) >= 0.01) {
          setError('Le reste à répartir doit être égal à 0,00 €.');
          return;
        }
        await onSplitSubmit({
          label: label.trim(),
          date,
          ...(isSharedBudget && paidByUserId ? { paidByUserId } : {}),
          parts: validParts
        });
      } else {
        await onSubmit({
          envelopeId: selectedEnvelope.id,
          amount: parsedAmount,
          label: label.trim(),
          date,
          type: 'expense',
          ...(isSharedBudget && paidByUserId ? { paidByUserId } : {}),
          ...(tags.length > 0 ? { tags } : {})
        });
      }
      setAmountInput('');
      setLabel('');
      setTags([]);
      setIsSplitMode(false);
      triggerHaptic('success');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer la dépense');
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Ajouter une dépense rapide">
      <form onSubmit={handleSubmit} className="space-y-4">
        {quickTemplates.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Favoris</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {quickTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex shrink-0 items-center gap-1 rounded-2xl border border-amber-200 bg-amber-50/80 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="inline-flex items-center gap-1"
                  >
                    <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                    <span>{tpl.label}</span>
                    {tpl.defaultAmount !== undefined && (
                      <span className="opacity-75 tabular-nums">
                        ({formatCurrency(tpl.defaultAmount)})
                      </span>
                    )}
                  </button>
                  {onDeleteQuickTemplate && (
                    <button
                      type="button"
                      onClick={() => void onDeleteQuickTemplate(tpl.id)}
                      aria-label={`Supprimer le favori ${tpl.label}`}
                      className="ml-1 rounded-full p-0.5 text-amber-700 hover:bg-amber-200/60 dark:text-amber-300 dark:hover:bg-amber-900/60"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DropdownSelect
          label="Enveloppe concernée"
          value={selectedEnvelope?.id ?? ''}
          onChange={setSelectedEnvelopeId}
          options={envelopes.map((env) => {
            const available =
              env.allocatedAmount + (env.rolloverAmount ?? 0) - env.spentOrPaidAmount;
            return {
              value: env.id,
              label: env.name,
              icon: env.icon || '✉️',
              sublabel: formatCurrency(available),
            };
          })}
        />

        <div className="rounded-2xl bg-slate-50 p-3 text-center dark:bg-slate-800/70">
          <p className="text-4xl font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
            {amountInput || '0'} €
          </p>
          {selectedEnvelope && (
            <p
              className={`mt-1 text-xs font-medium ${
                liveRemaining < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Restant dans {selectedEnvelope.name} : {formatCurrency(liveRemaining)}
            </p>
          )}
          {!isSplitMode &&
            selectedEnvelope &&
            anomalyThresholds[selectedEnvelope.id]?.warningThreshold &&
            parsedAmount > anomalyThresholds[selectedEnvelope.id]!.warningThreshold! && (
              <p
                role="status"
                className="mt-2 rounded-xl bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
              >
                Montant inhabituel : supérieur à la médiane habituelle (
                {formatCurrency(anomalyThresholds[selectedEnvelope.id]!.median)})
              </p>
            )}
        </div>

        <NumericKeypad value={amountInput} onChange={setAmountInput} />

        {envelopes.length >= 2 && onSplitSubmit && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setIsSplitMode((prev) => !prev)}
              aria-pressed={isSplitMode}
              className={`w-full rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                isSplitMode
                  ? 'border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-400 dark:bg-violet-950/50 dark:text-violet-200'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              ✂️ Répartir sur plusieurs enveloppes
            </button>

            {isSplitMode && (
              <div className="space-y-2 rounded-2xl border border-violet-200 bg-violet-50/40 p-3 dark:border-violet-900/60 dark:bg-violet-950/20">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-600 dark:text-slate-300">Reste à répartir :</span>
                  <span
                    className={
                      Math.abs(splitRemainingToAllocate) < 0.01
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }
                  >
                    {formatCurrency(splitRemainingToAllocate)}
                  </span>
                </div>

                {splitParts.map((part, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <DropdownSelect
                        value={part.envelopeId}
                        onChange={(val) =>
                          setSplitParts((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, envelopeId: val } : p))
                          )
                        }
                        options={envelopes.map((env) => ({
                          value: env.id,
                          label: env.name,
                          icon: env.icon,
                        }))}
                      />
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={part.amount}
                      onChange={(e) =>
                        setSplitParts((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, amount: e.target.value } : p))
                        )
                      }
                      placeholder="0,00"
                      aria-label={`Montant part ${idx + 1}`}
                      className="w-24 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-right text-xs font-semibold tabular-nums text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    {idx === splitParts.length - 1 && splitRemainingToAllocate > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSplitParts((prev) =>
                            prev.map((p, i) =>
                              i === idx
                                ? {
                                    ...p,
                                    amount: formatAmountToKeypadString(
                                      parseAmountString(p.amount) + splitRemainingToAllocate
                                    )
                                  }
                                : p
                            )
                          )
                        }
                        className="rounded-xl bg-violet-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-700"
                      >
                        Compléter
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Libellé (ex: Carrefour)"
            aria-label="Libellé de la dépense"
            className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Date de la dépense"
            className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        {filteredSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Suggestions de libellés">
            {filteredSuggestions.map((s) => (
              <button
                key={`${s.label}-${s.envelopeName}`}
                type="button"
                onClick={() => handleApplySuggestion(s)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {s.label} · <span className="opacity-75">{s.envelopeName}</span>
              </button>
            ))}
          </div>
        )}

        {onSaveQuickTemplate && label.trim().length > 0 && selectedEnvelope && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSaveAsFavorite()}
              disabled={savingTemplate}
              className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
            >
              <Star className="h-3.5 w-3.5" />
              Enregistrer en favori
            </button>
          </div>
        )}

        {!isSplitMode && <TagInput tags={tags} onChange={setTags} />}

        {isSharedBudget && members.length > 0 && (
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Payé par
            </span>
            <select
              value={paidByUserId}
              onChange={(e) => setPaidByUserId(e.target.value)}
              aria-label="Payé par"
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !selectedEnvelope}
          className="w-full rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Enregistrement...' : 'Enregistrer la dépense'}
        </button>
      </form>
    </BottomSheet>
  );
}

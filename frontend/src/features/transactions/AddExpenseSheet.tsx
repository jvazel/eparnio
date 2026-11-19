import { ArrowUpRight, RotateCcw, Trash2 } from 'lucide-react';
import { Star } from 'lucide-react';
import { type FormEvent, useEffect, useId, useMemo, useState } from 'react';
import { TagInput } from '../../components/ui/TagInput';
import { triggerHaptic } from '../../utils/haptics';
import type { SplitTransactionPayload, TransactionSuggestion } from '../../services/transaction.service';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import {
  formatAmountToKeypadString,
  NumericKeypad,
  parseAmountString
} from '../../components/ui/NumericKeypad';
import type { BudgetMember, EnvelopeItem, TransactionItem } from '../../types/budget.types';
import { formatCurrency, toDateInputValue } from '../../utils/format';
import {
  AmountHeroField,
  DateCardField,
  MemberPayerSelector
} from '../budget/SharedFormFields';

export interface AddExpensePayload {
  envelopeId: string;
  type: 'expense' | 'income';
  amount: number;
  label: string;
  date: string;
  paidByUserId?: string;
  notes?: string;
}

export interface AddExpenseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  envelope: EnvelopeItem | null;
  defaultDate?: string;
  initialTransaction?: TransactionItem | null;
  members?: BudgetMember[];
  currentUserId?: string;
  isSharedBudget?: boolean;
  isSubmitting?: boolean;
  suggestions?: TransactionSuggestion[];
  envelopes?: EnvelopeItem[];
  onSplitSubmit?: (payload: SplitTransactionPayload) => Promise<void>;
  onSaveQuickTemplate?: (payload: {
    label: string;
    envelopeName: string;
    defaultAmount?: number;
  }) => Promise<void>;
  onSubmit: (payload: AddExpensePayload) => Promise<void> | void;
  onDelete?: (transactionId: string) => Promise<void> | void;
}

/**
 * Tiroir de saisie ou d'édition rapide d'une dépense variable au pouce
 * avec pavé numérique intégré et calcul en direct de « Restant dans l'enveloppe ».
 */
export function AddExpenseSheet({
  isOpen,
  onClose,
  envelope,
  defaultDate,
  initialTransaction,
  members = [],
  currentUserId,
  isSharedBudget = false,
  isSubmitting = false,
  suggestions = [],
  envelopes = [],
  onSplitSubmit,
  onSaveQuickTemplate,
  onSubmit,
  onDelete
}: AddExpenseSheetProps) {
  const isEditing = Boolean(initialTransaction);
  const resolvedDefaultDate = useMemo(
    () => defaultDate ?? toDateInputValue(new Date()),
    [defaultDate]
  );

  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [dateValue, setDateValue] = useState(resolvedDefaultDate);
  const [paidByUserId, setPaidByUserId] = useState<string | undefined>(currentUserId);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitParts, setSplitParts] = useState<Array<{ envelopeId: string; amount: string }>>([]);

  const splitAllocatedSum = useMemo(
    () =>
      Math.round(
        splitParts.reduce((sum, part) => sum + parseAmountString(part.amount), 0) * 100
      ) / 100,
    [splitParts]
  );
  const splitRemainingToAllocate =
    Math.round((parseAmountString(amountInput) - splitAllocatedSum) * 100) / 100;

  const labelInputId = useId();
  const notesInputId = useId();
  const notesHintId = useId();

  useEffect(() => {
    if (!isOpen) return;

    if (initialTransaction) {
      setTransactionType(initialTransaction.type === 'income' ? 'income' : 'expense');
      setAmountInput(formatAmountToKeypadString(initialTransaction.amount));
      setLabel(initialTransaction.label);
      setNotes(initialTransaction.notes ?? '');
      setTags(initialTransaction.tags ?? []);
      setDateValue(toDateInputValue(initialTransaction.date));
      setPaidByUserId(initialTransaction.paidByUserId ?? currentUserId);
    } else {
      setTransactionType('expense');
      setAmountInput('');
      setLabel('');
      setNotes('');
      setTags([]);
      setDateValue(resolvedDefaultDate);
      setPaidByUserId(currentUserId);
    }
    setIsConfirmingDelete(false);
    setErrorMessage(null);
  }, [isOpen, initialTransaction, resolvedDefaultDate, currentUserId]);

  const numericAmount = parseAmountString(amountInput);
  const isRefund = transactionType === 'income';

  const projectedRemainingInEnvelope = useMemo(() => {
    if (!envelope) return 0;
    const available = envelope.allocatedAmount + (envelope.rolloverAmount ?? 0);
    const previousSignedSpent = initialTransaction
      ? initialTransaction.type === 'income'
        ? -initialTransaction.amount
        : initialTransaction.amount
      : 0;
    const nextSignedSpent = transactionType === 'income' ? -numericAmount : numericAmount;
    const projectedSpent = envelope.spentOrPaidAmount - previousSignedSpent + nextSignedSpent;
    const raw = available - projectedSpent;
    return Math.round((raw + Number.EPSILON) * 100) / 100;
  }, [envelope, initialTransaction, numericAmount, transactionType]);

  if (!envelope) {
    return null;
  }

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (numericAmount <= 0) {
      setErrorMessage('Veuillez saisir un montant supérieur à 0 €.');
      return;
    }

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setErrorMessage(
        isRefund
          ? 'Veuillez saisir un libellé de remboursement.'
          : 'Veuillez saisir un libellé de dépense.'
      );
      return;
    }

    const trimmedNotes = notes.trim();
    const shouldSendNotes =
      trimmedNotes.length > 0 || (isEditing && Boolean(initialTransaction?.notes));

    try {
      await onSubmit({
        envelopeId: envelope.id,
        type: transactionType,
        amount: numericAmount,
        label: trimmedLabel,
        date: new Date(`${dateValue}T12:00:00.000Z`).toISOString(),
        ...(isSharedBudget && paidByUserId ? { paidByUserId } : {}),
        ...(shouldSendNotes ? { notes: trimmedNotes } : {}),
        ...(tags.length > 0 || (isEditing && (initialTransaction?.tags?.length ?? 0) > 0)
          ? { tags }
          : {})
      });
      triggerHaptic('success');
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible d’enregistrer cette opération pour le moment.'
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!initialTransaction || !onDelete) return;
    setErrorMessage(null);
    try {
      await onDelete(initialTransaction.id);
      triggerHaptic('success');
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de supprimer cette dépense pour le moment.'
      );
    }
  };

  const sheetTitle = isEditing
    ? isRefund
      ? 'Modifier le remboursement'
      : 'Modifier la dépense'
    : isRefund
      ? `Ajouter un remboursement · ${envelope.name}`
      : `Ajouter une dépense · ${envelope.name}`;

  const subtitleText =
    projectedRemainingInEnvelope < 0
      ? `Restant dans l’enveloppe : ${formatCurrency(projectedRemainingInEnvelope)} (dépassement)`
      : `Restant dans l’enveloppe : ${formatCurrency(projectedRemainingInEnvelope)}`;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={sheetTitle}>
      <form
        method="post"
        onSubmit={handleFormSubmit}
        className="space-y-4 rounded-3xl bg-gradient-to-b from-violet-50/75 via-blue-50/45 to-slate-50/60 p-3.5 dark:from-slate-800/80 dark:via-slate-900/90 dark:to-slate-900"
      >
        <div className="flex items-center justify-center gap-3 pt-1" aria-hidden="true">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100/85 text-xl shadow-sm ring-4 ring-blue-100/40">
            🛍️
          </span>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100/90 text-2xl shadow-sm ring-4 ring-orange-100/50">
            {envelope.icon}
          </span>
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-full text-xl shadow-sm ring-4 ${
              isRefund
                ? 'bg-emerald-100/90 ring-emerald-100/45'
                : 'bg-rose-100/85 ring-rose-100/40'
            }`}
          >
            {isRefund ? '↩️' : '💳'}
          </span>
        </div>

        <fieldset className="rounded-2xl border border-slate-100 bg-white p-1.5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <legend className="sr-only">Type d’opération</legend>
          <div className="grid grid-cols-2 gap-1.5">
            <label
              className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors focus-within:ring-2 focus-within:ring-violet-500 ${
                !isRefund
                  ? 'bg-[#1D7DFA] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <input
                type="radio"
                name="transactionType"
                value="expense"
                checked={!isRefund}
                onChange={() => setTransactionType('expense')}
                className="sr-only"
              />
              <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Dépense</span>
            </label>

            <label
              className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors focus-within:ring-2 focus-within:ring-violet-500 ${
                isRefund
                  ? 'bg-emerald-600 text-white shadow-sm dark:bg-emerald-500'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <input
                type="radio"
                name="transactionType"
                value="income"
                checked={isRefund}
                onChange={() => setTransactionType('income')}
                className="sr-only"
              />
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Remboursement</span>
            </label>
          </div>
        </fieldset>

        <AmountHeroField
          value={amountInput}
          onChange={setAmountInput}
          subtitle={subtitleText}
          subtitleTone={
            projectedRemainingInEnvelope < 0
              ? 'red'
              : (isRefund && numericAmount > 0) || Math.abs(projectedRemainingInEnvelope) < 0.01
                ? 'emerald'
                : 'neutral'
          }
          subtitleTestId="live-remaining-in-envelope"
        />

        <NumericKeypad value={amountInput} onChange={setAmountInput} />

        {!isEditing && envelopes.length >= 2 && onSplitSubmit && envelope && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                setIsSplitMode((prev) => {
                  const next = !prev;
                  if (next && splitParts.length === 0) {
                    const other = envelopes.find((e) => e.id !== envelope.id) ?? envelopes[0];
                    setSplitParts([
                      { envelopeId: envelope.id, amount: '' },
                      { envelopeId: other.id, amount: '' }
                    ]);
                  }
                  return next;
                });
              }}
              aria-pressed={isSplitMode}
              className={`w-full rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                isSplitMode
                  ? 'border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-400 dark:bg-violet-950/50 dark:text-violet-200'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
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
                    <select
                      value={part.envelopeId}
                      onChange={(e) =>
                        setSplitParts((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, envelopeId: e.target.value } : p))
                        )
                      }
                      aria-label={`Enveloppe part ${idx + 1}`}
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {envelopes.map((env) => (
                        <option key={env.id} value={env.id}>
                          {env.icon} {env.name}
                        </option>
                      ))}
                    </select>
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

        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <label htmlFor={labelInputId} className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
              Nom
            </label>
            <input
              id={labelInputId}
              name="label"
              type="text"
              maxLength={100}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={
                isRefund
                  ? 'Nom du remboursement (ex. Remboursement mutuelle)'
                  : 'Nom de ma dépense (ex. Supermarché)'
              }
              className="mt-1 min-h-11 w-full bg-transparent text-base font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none dark:text-slate-50"
            />
          </div>

          {!isEditing &&
            label.trim().length > 0 &&
            suggestions
              .filter(
                (s) =>
                  s.label.toLowerCase().includes(label.trim().toLowerCase()) &&
                  s.label.toLowerCase() !== label.trim().toLowerCase()
              )
              .slice(0, 5).length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Suggestions de libellés">
                {suggestions
                  .filter(
                    (s) =>
                      s.label.toLowerCase().includes(label.trim().toLowerCase()) &&
                      s.label.toLowerCase() !== label.trim().toLowerCase()
                  )
                  .slice(0, 5)
                  .map((s) => (
                    <button
                      key={`${s.label}-${s.envelopeName}`}
                      type="button"
                      onClick={() => {
                        setLabel(s.label);
                        if (!amountInput && s.lastAmount > 0) {
                          setAmountInput(formatAmountToKeypadString(s.lastAmount));
                        }
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {s.label} · <span className="opacity-75">{s.envelopeName}</span>
                    </button>
                  ))}
              </div>
            )}

          {!isEditing && onSaveQuickTemplate && envelope && label.trim().length > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() =>
                  void onSaveQuickTemplate({
                    label: label.trim(),
                    envelopeName: envelope.name,
                    ...(numericAmount > 0 ? { defaultAmount: numericAmount } : {})
                  })
                }
                className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
              >
                <Star className="h-3.5 w-3.5" />
                Enregistrer en favori
              </button>
            </div>
          )}

          <DateCardField value={dateValue} onChange={setDateValue} />

          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <label
              htmlFor={notesInputId}
              className="block text-xs font-semibold text-slate-500 dark:text-slate-400"
            >
              Note (optionnel)
            </label>
            <textarea
              id={notesInputId}
              name="notes"
              rows={2}
              maxLength={300}
              value={notes}
              aria-describedby={notesHintId}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Précision, numéro de commande, contexte…"
              className="mt-1 w-full resize-y bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-50"
            />
            <p
              id={notesHintId}
              className="mt-1 text-right text-[11px] font-medium tabular-nums text-slate-400 dark:text-slate-500"
            >
              {notes.length} / 300
            </p>
          </div>

          <TagInput tags={tags} onChange={setTags} />

          {isSharedBudget && (
            <MemberPayerSelector
              label={isRefund ? 'Reçu par' : 'Payé par'}
              members={members}
              selectedMemberId={paidByUserId}
              currentUserId={currentUserId}
              onSelect={setPaidByUserId}
            />
          )}
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="rounded-2xl bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-600"
          >
            {errorMessage}
          </p>
        )}

        <div className="space-y-2 pt-1">
          <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
            {isSubmitting
              ? 'Enregistrement...'
              : isEditing
                ? 'Enregistrer'
                : 'Ajouter'}
          </Button>

          {isEditing && onDelete && (
            <div>
              {!isConfirmingDelete ? (
                <Button
                  type="button"
                  variant="danger"
                  fullWidth
                  disabled={isSubmitting}
                  onClick={() => setIsConfirmingDelete(true)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Supprimer
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    disabled={isSubmitting}
                    onClick={() => setIsConfirmingDelete(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    fullWidth
                    disabled={isSubmitting}
                    onClick={handleConfirmDelete}
                  >
                    Confirmer la suppression
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </BottomSheet>
  );
}

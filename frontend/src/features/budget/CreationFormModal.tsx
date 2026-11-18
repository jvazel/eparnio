import { RefreshCw, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useId, useMemo, useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import {
  formatAmountToKeypadString,
  NumericKeypad,
  parseAmountString
} from '../../components/ui/NumericKeypad';
import type { CreateEnvelopePayload } from '../../services/envelope.service';
import type { BudgetMember, EnvelopeItem, PillarType } from '../../types/budget.types';
import { formatCurrency, toDateInputValue } from '../../utils/format';
import {
  AmountHeroField,
  ColorSwatchPicker,
  CREATION_COLOR_SWATCHES,
  DateCardField,
  IconAppearanceCard,
  MemberPayerSelector
} from './SharedFormFields';

export { CREATION_COLOR_SWATCHES };

type FormPillar = Extract<PillarType, 'income' | 'fixed_charge' | 'variable_envelope'>;

interface PillarFormConfig {
  defaultIcon: string;
  defaultColor: string;
  headerIcons: readonly [string, string, string];
  emojis: readonly string[];
  createTitle: string;
  editTitle: string;
  namePlaceholder: string;
  recurringLabel: string;
  memberLabel: string;
  showScheduleCards: boolean;
}

const PILLAR_FORM_CONFIG: Record<FormPillar, PillarFormConfig> = {
  income: {
    defaultIcon: '💵',
    defaultColor: '#16A34A',
    headerIcons: ['💵', '💰', '🏦'],
    emojis: ['💵', '💰', '🏦', '💼', '🎁', '📈', '🧾', '🤝'],
    createTitle: 'Ajouter un revenu',
    editTitle: 'Modifier le revenu',
    namePlaceholder: 'Nom de mon revenu (ex. Salaire)',
    recurringLabel: 'Revenu récurrent',
    memberLabel: 'Apporté par',
    showScheduleCards: true
  },
  fixed_charge: {
    defaultIcon: '💡',
    defaultColor: '#4F46E5',
    headerIcons: ['🏠', '🚗', '📱'],
    emojis: ['🏠', '⚡', '💧', '📱', '🚗', '🍿', '🛡️', '💡', '🔥', '💳', '🎓', '🏋️'],
    createTitle: 'Ajouter une dépense fixe',
    editTitle: 'Modifier la dépense fixe',
    namePlaceholder: 'Nom de ma dépense (ex. Loyer)',
    recurringLabel: 'Dépense récurrente',
    memberLabel: 'Payé par',
    showScheduleCards: true
  },
  variable_envelope: {
    defaultIcon: '🛒',
    defaultColor: '#16A34A',
    headerIcons: ['🛒', '🍽️', '🛍️'],
    emojis: ['🛒', '🍽️', '🛍️', '⛽', '🎉', '🐶', '💅', '🏥', '🎁', '☕', '🚌', '🖤'],
    createTitle: 'Ajouter une enveloppe',
    editTitle: 'Modifier l’enveloppe',
    namePlaceholder: 'Nom de l’enveloppe (ex. Courses)',
    recurringLabel: '',
    memberLabel: 'Responsable',
    showScheduleCards: false
  }
};

export interface CreationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  pillar: FormPillar;
  currentRemainingToAllocate: number;
  defaultDate?: string;
  initialItem?: EnvelopeItem | null;
  members?: BudgetMember[];
  currentUserId?: string;
  isSharedBudget?: boolean;
  isSubmitting?: boolean;
  onSubmit: (payload: CreateEnvelopePayload) => Promise<void> | void;
  onDelete?: (envelopeId: string) => Promise<void> | void;
}

/**
 * Formulaire modal unifié (calibré sur Finzee) pour créer ou éditer
 * un revenu, une dépense fixe ou une enveloppe variable avec calcul en direct de « Restant à répartir ».
 */
export function CreationFormModal({
  isOpen,
  onClose,
  pillar,
  currentRemainingToAllocate,
  defaultDate,
  initialItem,
  members = [],
  currentUserId,
  isSharedBudget = false,
  isSubmitting = false,
  onSubmit,
  onDelete
}: CreationFormModalProps) {
  const config = PILLAR_FORM_CONFIG[pillar];
  const isEditing = Boolean(initialItem);
  const { defaultIcon, defaultColor, headerIcons, emojis: emojiChoices, showScheduleCards } = config;
  const resolvedDefaultDate = useMemo(
    () => defaultDate ?? toDateInputValue(new Date()),
    [defaultDate]
  );

  const [amountInput, setAmountInput] = useState('');
  const [name, setName] = useState('');
  const [dateValue, setDateValue] = useState(resolvedDefaultDate);
  const [isRecurring, setIsRecurring] = useState(false);
  const [rolloverEnabled, setRolloverEnabled] = useState(false);
  const [rolloverMode, setRolloverMode] = useState<'positive_only' | 'both'>('positive_only');
  const [icon, setIcon] = useState(defaultIcon);
  const [color, setColor] = useState<string>(defaultColor);
  const [memberId, setMemberId] = useState<string | undefined>(currentUserId);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nameInputId = useId();
  const recurringCheckboxId = useId();

  useEffect(() => {
    if (!isOpen) return;

    if (initialItem) {
      setAmountInput(formatAmountToKeypadString(initialItem.allocatedAmount));
      setName(initialItem.name);
      setDateValue(toDateInputValue(initialItem.date));
      setIsRecurring(initialItem.isRecurring);
      setRolloverEnabled(initialItem.rolloverEnabled ?? false);
      setRolloverMode(initialItem.rolloverMode ?? 'positive_only');
      setIcon(initialItem.icon || defaultIcon);
      setColor(initialItem.color || defaultColor);
      setMemberId(initialItem.memberId ?? currentUserId);
    } else {
      setAmountInput('');
      setName('');
      setDateValue(resolvedDefaultDate);
      setIsRecurring(false);
      setIcon(defaultIcon);
      setColor(defaultColor);
      setMemberId(currentUserId);
    }
    setIsConfirmingDelete(false);
    setErrorMessage(null);
  }, [isOpen, initialItem, resolvedDefaultDate, defaultIcon, defaultColor, currentUserId]);

  const numericAmount = parseAmountString(amountInput);

  const projectedRemainingToAllocate = useMemo(() => {
    const previousContribution = initialItem
      ? initialItem.pillar === 'income'
        ? initialItem.allocatedAmount
        : -initialItem.allocatedAmount
      : 0;
    const nextContribution = pillar === 'income' ? numericAmount : -numericAmount;
    const raw = currentRemainingToAllocate - previousContribution + nextContribution;
    return Math.round((raw + Number.EPSILON) * 100) / 100;
  }, [currentRemainingToAllocate, initialItem, numericAmount, pillar]);

  const modalTitle = isEditing ? config.editTitle : config.createTitle;

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (numericAmount <= 0) {
      setErrorMessage('Veuillez saisir un montant supérieur à 0 €.');
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Veuillez saisir un libellé.');
      return;
    }

    try {
      await onSubmit({
        pillar,
        name: trimmedName,
        icon,
        color,
        allocatedAmount: numericAmount,
        date: new Date(`${dateValue}T12:00:00.000Z`).toISOString(),
        isRecurring: pillar === 'variable_envelope' ? true : isRecurring,
        isPaid: initialItem?.isPaid ?? false,
        ...(pillar === 'variable_envelope'
          ? { rolloverEnabled, rolloverMode }
          : {}),
        ...(isSharedBudget && memberId ? { memberId } : {})
      });
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible d’enregistrer cet élément pour le moment.'
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!initialItem || !onDelete) return;
    setErrorMessage(null);
    try {
      await onDelete(initialItem.id);
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de supprimer cet élément pour le moment.'
      );
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <form
        method="post"
        onSubmit={handleFormSubmit}
        className="space-y-4 rounded-3xl bg-gradient-to-b from-violet-50/75 via-blue-50/45 to-slate-50/60 p-3.5 dark:from-slate-800/80 dark:via-slate-900/90 dark:to-slate-900"
      >
        {/* Trio de bulles d'icônes pastel en en-tête (signature Finzee) */}
        <div className="flex items-center justify-center gap-3 pt-1" aria-hidden="true">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100/85 text-xl shadow-sm ring-4 ring-blue-100/40">
            {headerIcons[0]}
          </span>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100/90 text-2xl shadow-sm ring-4 ring-orange-100/50">
            {headerIcons[1]}
          </span>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-100/85 text-xl shadow-sm ring-4 ring-rose-100/40">
            {headerIcons[2]}
          </span>
        </div>

        {/* Montant Hero centré + calcul live de Restant à répartir */}
        <AmountHeroField
          value={amountInput}
          onChange={setAmountInput}
          subtitle={`Restant à répartir : ${formatCurrency(projectedRemainingToAllocate)}`}
          subtitleTone={
            projectedRemainingToAllocate < 0
              ? 'red'
              : Math.abs(projectedRemainingToAllocate) < 0.01
                ? 'emerald'
                : 'neutral'
          }
          subtitleTestId="live-remaining-to-allocate"
        />

        {/* Pavé numérique tactile intégré */}
        <NumericKeypad value={amountInput} onChange={setAmountInput} />

        {/* Pile de cartes blanches arrondies */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <label htmlFor={nameInputId} className="block text-xs font-semibold text-slate-500">
              Nom
            </label>
            <input
              id={nameInputId}
              type="text"
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={config.namePlaceholder}
              className="mt-1 min-h-11 w-full bg-transparent text-base font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none dark:text-slate-50"
            />
          </div>

          {showScheduleCards && (
            <>
              <DateCardField value={dateValue} onChange={setDateValue} />

              <label
                htmlFor={recurringCheckboxId}
                className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-card dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Ajouter chaque mois</p>
                    <p className="text-xs text-slate-500">
                      {config.recurringLabel} · Inclus gratuitement
                    </p>
                  </div>
                </div>
                <input
                  id={recurringCheckboxId}
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(event) => setIsRecurring(event.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
              </label>
            </>
          )}

          {pillar === 'variable_envelope' && (
            <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    Reporter le solde au mois suivant
                  </p>
                  <p className="text-xs text-slate-500">
                    Utile pour les budgets annuels ou imprévus
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={rolloverEnabled}
                  onChange={(event) => setRolloverEnabled(event.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
              </label>

              {rolloverEnabled && (
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRolloverMode('positive_only')}
                    className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      rolloverMode === 'positive_only'
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    Positif uniquement
                  </button>
                  <button
                    type="button"
                    onClick={() => setRolloverMode('both')}
                    className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      rolloverMode === 'both'
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    Positif et négatif
                  </button>
                </div>
              )}
            </div>
          )}

          {isSharedBudget && (
            <MemberPayerSelector
              label={config.memberLabel}
              members={members}
              selectedMemberId={memberId}
              currentUserId={currentUserId}
              onSelect={setMemberId}
            />
          )}

          <IconAppearanceCard
            icon={icon}
            color={color}
            emojis={emojiChoices}
            onSelectIcon={setIcon}
          />

          <ColorSwatchPicker selectedColor={color} onSelectColor={setColor} />
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

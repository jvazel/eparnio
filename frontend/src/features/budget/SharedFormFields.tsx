import { Calendar, Check } from 'lucide-react';
import { useId, useState } from 'react';
import { sanitizeTypedAmount } from '../../components/ui/NumericKeypad';
import type { BudgetMember } from '../../types/budget.types';
import { formatFullDate } from '../../utils/format';

export const CREATION_COLOR_SWATCHES = [
  '#FCE96A',
  '#075985',
  '#16A34A',
  '#6EE7B7',
  '#38BDF8',
  '#4F46E5',
  '#F472B6',
  '#34D399',
  '#FB923C',
  '#F87171',
  '#E879F9',
  '#FBBF24',
  '#14B8A6',
  '#8B5CF6',
  '#EC4899',
  '#64748B',
  '#EF4444',
  '#F97316',
  '#84CC16',
  '#06B6D4',
  '#3B82F6',
  '#A855F7',
  '#F43F5E',
  '#78716C'
] as const;

export interface AmountHeroFieldProps {
  value: string;
  onChange: (nextValue: string) => void;
  subtitle: string;
  subtitleTone?: 'neutral' | 'emerald' | 'red';
  subtitleTestId?: string;
}

const SUBTITLE_TONES: Record<NonNullable<AmountHeroFieldProps['subtitleTone']>, string> = {
  neutral: 'text-slate-500',
  emerald: 'text-emerald-600',
  red: 'text-red-600'
};

/**
 * Zone montant Hero centrée au format Finzee avec sous-titre dynamique en direct.
 */
export function AmountHeroField({
  value,
  onChange,
  subtitle,
  subtitleTone = 'neutral',
  subtitleTestId
}: AmountHeroFieldProps) {
  const inputId = useId();

  return (
    <div className="text-center">
      <label htmlFor={inputId} className="sr-only">
        Montant en euros
      </label>
      <div className="flex items-baseline justify-center gap-1.5">
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          value={value}
          placeholder="0,00"
          onChange={(event) => onChange(sanitizeTypedAmount(event.target.value))}
          className="w-44 bg-transparent text-center text-4xl font-bold tabular-nums tracking-tight text-slate-900 placeholder:text-slate-300 focus:outline-none sm:text-5xl dark:text-slate-50"
        />
        <span className="text-3xl font-bold text-slate-700" aria-hidden="true">
          €
        </span>
      </div>
      <p
        data-testid={subtitleTestId}
        className={`mt-1 text-xs font-semibold tabular-nums ${SUBTITLE_TONES[subtitleTone]}`}
      >
        {subtitle}
      </p>
    </div>
  );
}

export interface DateCardFieldProps {
  value: string;
  onChange: (nextDate: string) => void;
}

/**
 * Carte blanche sélecteur de date native avec affichage littéral français.
 */
export function DateCardField({ value, onChange }: DateCardFieldProps) {
  const dateInputId = useId();

  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Calendar className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <label htmlFor={dateInputId} className="block text-xs font-semibold text-slate-500">
              Date
            </label>
            <p className="text-sm font-semibold text-slate-900">
              {formatFullDate(`${value}T12:00:00.000Z`)}
            </p>
          </div>
        </div>
        <input
          id={dateInputId}
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-base font-medium text-slate-700 focus:border-violet-500 focus:outline-none"
        />
      </div>
    </div>
  );
}

export interface MemberPayerSelectorProps {
  label: string;
  members: BudgetMember[];
  selectedMemberId?: string;
  currentUserId?: string;
  onSelect: (userId: string) => void;
}

/**
 * Pastilles de sélection du membre payeur ou contributeur pour les budgets partagés.
 */
export function MemberPayerSelector({
  label,
  members,
  selectedMemberId,
  currentUserId,
  onSelect
}: MemberPayerSelectorProps) {
  if (members.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <p className="mb-2 text-xs font-semibold text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-2">
        {members.map((member, index) => {
          const selected = member.userId === selectedMemberId;
          const displayLabel =
            member.userId === currentUserId
              ? 'Moi'
              : member.displayName?.trim() || `Membre ${index + 1}`;
          return (
            <button
              key={member.userId}
              type="button"
              onClick={() => onSelect(member.userId)}
              aria-pressed={selected}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                selected
                  ? 'border-violet-600 bg-violet-50 text-violet-700'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: member.color }}
                aria-hidden="true"
              />
              <span>{displayLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface IconAppearanceCardProps {
  icon: string;
  color: string;
  emojis: readonly string[];
  onSelectIcon: (emoji: string) => void;
}

const EXTRA_EMOJIS = [
  '🏠', '🚗', '🛒', '🍽️', '☕', '🎬', '🎮', '✈️', '🏖️', '🎁',
  '💊', '🐾', '📱', '⚡', '💧', '🛡️', '🎓', '💼', '💰', '🐷',
  '👶', '🏋️', '🎵', '📚', '🛠️', '🌿', '💍', '🚕', '🚆', '🏦',
  '🍕', '🍔', '🍷', '🥐', '🚲', '⛽', '🏨', '🎟️', '🎨', '🛋️',
  '🧹', '👕', '👟', '💇', '🦷', '🩺', '📦', '🧾', '💻', '📺',
  '🎧', '🪴', '💐', '🥂'
] as const;

/**
 * Carte blanche de prévisualisation de l'icône cerclée et sélecteur d'emoji dépliable.
 */
export function IconAppearanceCard({
  icon,
  color,
  emojis,
  onSelectIcon
}: IconAppearanceCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const allEmojis = Array.from(new Set([...emojis, ...EXTRA_EMOJIS]));

  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full border-[3px] bg-white text-xl shadow-sm dark:bg-slate-800"
            style={{ borderColor: color }}
            aria-hidden="true"
          >
            {icon}
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Apparence Icône</p>
            <button
              type="button"
              onClick={() => setIsOpen((previous) => !previous)}
              className="min-h-11 text-left text-xs font-semibold text-violet-600 hover:text-violet-700"
            >
              {isOpen ? 'Fermer la palette d’emojis' : 'Cliquez pour ajouter un emoji'}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="mt-3 grid grid-cols-6 gap-2 border-t border-slate-100 pt-3">
          {allEmojis.map((choice) => {
            const isSelected = icon === choice;
            return (
              <button
                key={choice}
                type="button"
                onClick={() => {
                  onSelectIcon(choice);
                  setIsOpen(false);
                }}
                aria-label={`Choisir l’emoji ${choice}`}
                aria-pressed={isSelected}
                className={`flex min-h-11 items-center justify-center rounded-xl border text-xl transition-transform active:scale-95 ${
                  isSelected
                    ? 'border-slate-900 bg-violet-50'
                    : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                {choice}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface ColorSwatchPickerProps {
  selectedColor: string;
  swatches?: readonly string[];
  onSelectColor: (color: string) => void;
}

/**
 * Rangée des 11 pastilles de couleur Finzee pour les enveloppes, revenus, charges et objectifs.
 */
export function ColorSwatchPicker({
  selectedColor,
  swatches = CREATION_COLOR_SWATCHES,
  onSelectColor
}: ColorSwatchPickerProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <p className="mb-2.5 text-sm font-semibold text-slate-900 dark:text-slate-50">Couleur de l’icône</p>
      <div className="grid grid-cols-6 gap-1 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        {swatches.map((swatch) => {
          const isSelected = selectedColor.toLowerCase() === swatch.toLowerCase();
          return (
            <button
              key={swatch}
              type="button"
              onClick={() => onSelectColor(swatch)}
              aria-label={`Choisir la couleur ${swatch}`}
              aria-pressed={isSelected}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-95 ${
                  isSelected ? 'ring-2 ring-slate-900 ring-offset-2' : 'ring-1 ring-slate-200'
                }`}
                style={{ backgroundColor: swatch }}
              >
                {isSelected && <Check className="h-4 w-4 text-slate-900" aria-hidden="true" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

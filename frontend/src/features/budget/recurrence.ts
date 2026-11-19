import type { EnvelopeItem, RecurrenceFrequency } from '../../types/budget.types';
import { formatShortDate } from '../../utils/format';

export const RECURRENCE_FREQUENCY_OPTIONS: readonly {
  value: RecurrenceFrequency;
  label: string;
  cardTitle: string;
}[] = [
  { value: 'monthly', label: 'Mensuel', cardTitle: 'Ajouter chaque mois' },
  { value: 'quarterly', label: 'Trimestriel', cardTitle: 'Ajouter tous les 3 mois' },
  { value: 'semiannual', label: 'Semestriel', cardTitle: 'Ajouter tous les 6 mois' },
  { value: 'yearly', label: 'Annuel', cardTitle: 'Ajouter chaque année' }
] as const;

export function getRecurrenceFrequencyLabel(frequency?: RecurrenceFrequency): string {
  const match = RECURRENCE_FREQUENCY_OPTIONS.find((item) => item.value === frequency);
  return match?.label ?? 'Mensuel';
}

/**
 * Retourne les badges discrets décrivant la fréquence et l'éventuelle fin de récurrence d'un poste.
 */
export function getRecurrenceBadges(
  item: Pick<
    EnvelopeItem,
    'isRecurring' | 'recurrenceFrequency' | 'recurrenceEndDate' | 'recurrenceRemainingCount'
  >
): string[] {
  if (!item.isRecurring) {
    return [];
  }

  const badges: string[] = [];
  if (item.recurrenceFrequency && item.recurrenceFrequency !== 'monthly') {
    badges.push(getRecurrenceFrequencyLabel(item.recurrenceFrequency));
  }

  if (typeof item.recurrenceRemainingCount === 'number' && item.recurrenceRemainingCount >= 1) {
    badges.push(
      item.recurrenceRemainingCount === 1
        ? '1 mensualité restante'
        : `${item.recurrenceRemainingCount} mensualités restantes`
    );
  } else if (item.recurrenceEndDate) {
    badges.push(`Jusqu’au ${formatShortDate(item.recurrenceEndDate)}`);
  }

  return badges;
}

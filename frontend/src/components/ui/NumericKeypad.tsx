import { Delete } from 'lucide-react';

export interface NumericKeypadProps {
  value: string;
  onChange: (nextValue: string) => void;
}

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'backspace'] as const;

/**
 * Applique une touche du pavé numérique tactile (`0-9`, `,`, `backspace`)
 * avec contrainte à 2 décimales et 7 chiffres entiers maximum.
 */
export function applyKeypadInput(current: string, key: string): string {
  if (key === 'backspace') {
    return current.slice(0, -1);
  }

  const normalizedKey = key === '.' ? ',' : key;

  if (normalizedKey === ',') {
    if (current.includes(',')) return current;
    return current === '' ? '0,' : `${current},`;
  }

  if (!/^\d$/.test(normalizedKey)) {
    return current;
  }

  if (current === '0') {
    return normalizedKey;
  }

  const [, decimals] = current.split(',');
  if (decimals !== undefined && decimals.length >= 2) {
    return current;
  }

  const [integerPart = ''] = current.split(',');
  if (decimals === undefined && integerPart.length >= 7) {
    return current;
  }

  return `${current}${normalizedKey}`;
}

/**
 * Convertit une saisie textuelle (`"1 234,50"` ou `"1234.5"`) en nombre positif.
 */
export function parseAmountString(value: string): number {
  const normalized = value.replace(/\s+/g, '').replace(',', '.');
  if (!normalized || normalized === '.') return 0;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

/**
 * Convertit un nombre en chaîne adaptée au pavé numérique (ex. `19.99` -> `"19,99"`).
 */
export function formatAmountToKeypadString(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace('.', ',');
}

/**
 * Nettoie une saisie clavier libre en montant décimal à virgule (2 décimales max, 7 entiers).
 */
export function sanitizeTypedAmount(raw: string): string {
  const cleaned = raw.replace(/\./g, ',').replace(/[^\d,]/g, '');
  const firstComma = cleaned.indexOf(',');
  if (firstComma === -1) {
    return cleaned.slice(0, 7);
  }
  const intPart = cleaned.slice(0, firstComma).slice(0, 7) || '0';
  const decPart = cleaned.slice(firstComma + 1).replace(/,/g, '').slice(0, 2);
  return `${intPart},${decPart}`;
}

/**
 * Pavé numérique ergonomique Mobile-First conçu pour une saisie rapide au pouce.
 */
export function NumericKeypad({ value, onChange }: NumericKeypadProps) {
  return (
    <div
      role="group"
      aria-label="Pavé numérique"
      className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100/90 p-2"
    >
      {KEYPAD_KEYS.map((key) => {
        const isBackspace = key === 'backspace';
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(applyKeypadInput(value, key))}
            aria-label={isBackspace ? 'Effacer un chiffre' : `Chiffre ${key}`}
            className="flex min-h-11 items-center justify-center rounded-xl bg-white text-base font-bold tabular-nums text-slate-900 shadow-sm transition-transform active:scale-95 active:bg-slate-50 dark:bg-slate-800 dark:text-slate-50 dark:active:bg-slate-700"
          >
            {isBackspace ? <Delete className="h-5 w-5 text-slate-600" aria-hidden="true" /> : key}
          </button>
        );
      })}
    </div>
  );
}

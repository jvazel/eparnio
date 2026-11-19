import { Delete } from 'lucide-react';
import { useState } from 'react';
import { triggerHaptic } from '../../utils/haptics';

export interface NumericKeypadProps {
  value: string;
  onChange: (nextValue: string) => void;
}

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'backspace'] as const;
const OPERATOR_KEYS = ['+', '−', '×', '÷', '='] as const;

/**
 * Évalue une expression arithmétique simple (+, -, *, /) sans `eval`,
 * avec priorité opératoire, arrondi à 2 décimales et gestion de la division par zéro.
 */
export function evaluateArithmeticExpression(raw: string): number | null {
  const normalized = raw
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/');

  if (!normalized) return null;

  const tokens = normalized.match(/\d+(?:\.\d+)?|[+\-*/]/g);
  if (!tokens || tokens.join('') !== normalized) {
    return null;
  }

  const values: number[] = [];
  const ops: string[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (i % 2 === 0) {
      const num = Number.parseFloat(token);
      if (!Number.isFinite(num)) return null;
      values.push(num);
    } else {
      if (!['+', '-', '*', '/'].includes(token)) return null;
      ops.push(token);
    }
  }

  if (values.length !== ops.length + 1) {
    return null;
  }

  // Passe 1 : multiplications et divisions
  const pass1Values: number[] = [values[0]];
  const pass1Ops: string[] = [];

  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i];
    const nextVal = values[i + 1];
    if (op === '*' || op === '/') {
      const prev = pass1Values.pop()!;
      if (op === '/' && nextVal === 0) {
        return null;
      }
      pass1Values.push(op === '*' ? prev * nextVal : prev / nextVal);
    } else {
      pass1Ops.push(op);
      pass1Values.push(nextVal);
    }
  }

  // Passe 2 : additions et soustractions
  let result = pass1Values[0];
  for (let i = 0; i < pass1Ops.length; i += 1) {
    result = pass1Ops[i] === '+' ? result + pass1Values[i + 1] : result - pass1Values[i + 1];
  }

  if (!Number.isFinite(result)) return null;
  const clamped = Math.max(0, result);
  return Math.round((clamped + Number.EPSILON) * 100) / 100;
}

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
  const [expression, setExpression] = useState('');

  const handleOperator = (op: (typeof OPERATOR_KEYS)[number]) => {
    triggerHaptic('light');
    if (op === '=') {
      if (!expression) return;
      const fullExpr = `${expression}${value || '0'}`;
      const evaluated = evaluateArithmeticExpression(fullExpr);
      setExpression('');
      if (evaluated !== null) {
        onChange(formatAmountToKeypadString(evaluated) || '0');
      }
      return;
    }

    const currentPart = value || '0';
    setExpression((prev) => `${prev}${currentPart} ${op} `);
    onChange('');
  };

  return (
    <div
      role="group"
      aria-label="Pavé numérique"
      className="space-y-2 rounded-2xl bg-slate-100/90 p-2 dark:bg-slate-800/70"
    >
      {expression && (
        <p
          aria-live="polite"
          className="px-2 text-right text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400"
        >
          {expression}
          {value}
        </p>
      )}

      <div className="grid grid-cols-5 gap-1.5">
        {OPERATOR_KEYS.map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => handleOperator(op)}
            aria-label={`Opérateur ${op}`}
            className={`flex min-h-9 items-center justify-center rounded-xl text-sm font-bold transition-transform active:scale-95 ${
              op === '='
                ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                : 'bg-white/80 text-slate-700 shadow-sm hover:bg-white dark:bg-slate-700/80 dark:text-slate-100'
            }`}
          >
            {op}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {KEYPAD_KEYS.map((key) => {
          const isBackspace = key === 'backspace';
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onChange(applyKeypadInput(value, key));
              }}
              aria-label={isBackspace ? 'Effacer un chiffre' : `Chiffre ${key}`}
              className="flex min-h-11 items-center justify-center rounded-xl bg-white text-base font-bold tabular-nums text-slate-900 shadow-sm transition-transform active:scale-95 active:bg-slate-50 dark:bg-slate-800 dark:text-slate-50 dark:active:bg-slate-700"
            >
              {isBackspace ? (
                <Delete className="h-5 w-5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
              ) : (
                key
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

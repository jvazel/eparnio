export type ReceiptConfidence = 'high' | 'medium' | 'low';

export interface ParsedReceipt {
  amount: number | null;
  candidateAmounts: number[];
  merchant: string | null;
  date: string | null;
  rawText: string;
  confidence: ReceiptConfidence;
}

const TOTAL_KEYWORDS = [
  'NET A PAYER',
  'TOTAL A PAYER',
  'MONTANT TTC',
  'TOTAL TTC',
  'A PAYER',
  'TOTAL',
  'CARTE BANCAIRE',
  'CB',
  'REGLEMENT',
  'SOMME'
];

const EXCLUDED_AMOUNT_KEYWORDS = [
  'TVA',
  'SOUS-TOTAL',
  'SOUS TOTAL',
  'RENDU',
  'ESPECES',
  'REMISE',
  'ECONOMIE',
  'POINTS',
  'FIDELITE',
  'SIRET',
  'SIREN',
  'TEL',
  'CODE',
  'TICKET',
  'CAISSE'
];

const IGNORED_MERCHANT_KEYWORDS = [
  'BIENVENUE',
  'MERCI',
  'TICKET',
  'CAISSE',
  'DUPLICATA',
  'FACTURE',
  'SIRET',
  'SIREN',
  'RCS',
  'TVA',
  'TEL',
  'TELEPHONE',
  'WWW.',
  'HTTP',
  'RUE ',
  'AVENUE ',
  'BOULEVARD ',
  'BD ',
  'IMPASSE ',
  'PLACE ',
  'CEDEX',
  'FRANCE'
];

const FRENCH_MONTHS: Record<string, number> = {
  janv: 1,
  janvier: 1,
  fev: 2,
  fevr: 2,
  fevrier: 2,
  mars: 3,
  avr: 4,
  avril: 4,
  mai: 5,
  juin: 6,
  juil: 7,
  juillet: 7,
  aout: 8,
  sept: 9,
  septembre: 9,
  oct: 10,
  octobre: 10,
  nov: 11,
  novembre: 11,
  dec: 12,
  decembre: 12
};

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeForMatch(value: string): string {
  return stripAccents(value).toUpperCase().replace(/\s+/g, ' ').trim();
}

function fixOcrNumericGlitches(token: string): string {
  return token
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/\s+/g, '')
    .replace(',', '.');
}

function extractAmountsFromLine(line: string): number[] {
  // Capture les montants type 42,80 / 42.80 / 1 240,50 / 42,8O
  const matches = line.match(/(?:\d{1,3}(?:[\s\u00A0]\d{3})*|\d+)[.,]\s*[0-9OoIl]{2}(?!\d)/g);
  if (!matches) {
    return [];
  }

  const results: number[] = [];
  for (const raw of matches) {
    const cleaned = fixOcrNumericGlitches(raw);
    const parsed = Number.parseFloat(cleaned);
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 50_000) {
      results.push(Math.round(parsed * 100) / 100);
    }
  }
  return results;
}

function toTitleCase(input: string): string {
  return input
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function extractMerchant(lines: string[]): string | null {
  const candidates = lines.slice(0, 6);

  for (const rawLine of candidates) {
    const cleaned = rawLine
      .replace(/\b(SAS|SARL|EURL|SA|SNC|SASU)\b/gi, '')
      .replace(/[^a-zA-ZÀ-ÿ0-9'&\-\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length < 2) continue;

    // Ignorer les lignes majoritairement numériques (téléphone, code postal, date, SIRET)
    const lettersCount = (cleaned.match(/[a-zA-ZÀ-ÿ]/g) ?? []).length;
    if (lettersCount < 2 || lettersCount / cleaned.length < 0.45) continue;

    // Ignorer les codes postaux français (5 chiffres)
    if (/\b\d{5}\b/.test(cleaned)) continue;

    const normalized = normalizeForMatch(cleaned);
    if (IGNORED_MERCHANT_KEYWORDS.some((kw) => normalized.includes(kw))) {
      continue;
    }

    return toTitleCase(cleaned).slice(0, 60);
  }

  return null;
}

function isReasonableDate(year: number, month: number, day: number, referenceDate: Date): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return false;
  }

  const minYear = referenceDate.getUTCFullYear() - 2;
  const maxMs = referenceDate.getTime() + 7 * 86_400_000;
  return year >= minYear && candidate.getTime() <= maxMs;
}

function formatIsoDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function extractDate(text: string, referenceDate: Date): string | null {
  // 1. Formats numériques JJ/MM/AAAA, JJ-MM-AAAA, JJ.MM.AAAA, JJ/MM/AA
  const numericRegex = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g;
  let match: RegExpExecArray | null;
  while ((match = numericRegex.exec(text)) !== null) {
    const day = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    let year = Number.parseInt(match[3], 10);
    if (year < 100) {
      year += 2000;
    }
    if (isReasonableDate(year, month, day, referenceDate)) {
      return formatIsoDate(year, month, day);
    }
  }

  // 2. Format textuel français : "26 nov. 2026" ou "26 novembre 2026"
  const normalizedText = stripAccents(text).toLowerCase();
  const textualRegex = /\b(\d{1,2})\s+([a-z]{3,9})\.?\s+(\d{4})\b/g;
  while ((match = textualRegex.exec(normalizedText)) !== null) {
    const day = Number.parseInt(match[1], 10);
    const monthKey = match[2];
    const year = Number.parseInt(match[3], 10);
    const month = FRENCH_MONTHS[monthKey];
    if (month && isReasonableDate(year, month, day, referenceDate)) {
      return formatIsoDate(year, month, day);
    }
  }

  return null;
}

/**
 * Parse le texte brut issu d'un OCR de ticket de caisse français.
 * 100 % pur et testable unitairement.
 */
export function parseReceiptText(
  rawText: string,
  referenceDate: Date = new Date()
): ParsedReceipt {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      amount: null,
      candidateAmounts: [],
      merchant: null,
      date: null,
      rawText,
      confidence: 'low'
    };
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const scoredAmounts: Array<{ amount: number; score: number }> = [];
  let hasKeywordMatch = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const amounts = extractAmountsFromLine(line);
    if (amounts.length === 0) continue;

    const normalized = normalizeForMatch(line);
    const isExcluded = EXCLUDED_AMOUNT_KEYWORDS.some((kw) => normalized.includes(kw));
    const keywordIndex = TOTAL_KEYWORDS.findIndex((kw) => normalized.includes(kw));

    for (const amount of amounts) {
      let score = 1;
      if (keywordIndex !== -1 && !isExcluded) {
        // Plus le mot-clé est précis (tôt dans TOTAL_KEYWORDS), plus le score est élevé
        score = 100 - keywordIndex * 5 + (i / Math.max(1, lines.length)) * 10;
        hasKeywordMatch = true;
      } else if (isExcluded) {
        score = -10;
      } else {
        // Bonus léger pour les lignes vers la fin du ticket et les montants plus grands
        score = 10 + (i / Math.max(1, lines.length)) * 5 + Math.min(amount / 100, 10);
      }

      scoredAmounts.push({ amount, score });
    }
  }

  const positiveScored = scoredAmounts
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.amount - a.amount);

  const candidateAmounts: number[] = [];
  for (const entry of positiveScored) {
    if (!candidateAmounts.includes(entry.amount)) {
      candidateAmounts.push(entry.amount);
    }
    if (candidateAmounts.length >= 3) break;
  }

  const amount = candidateAmounts[0] ?? null;
  const merchant = extractMerchant(lines);
  const date = extractDate(trimmed, referenceDate);

  const confidence: ReceiptConfidence =
    amount !== null && hasKeywordMatch
      ? 'high'
      : amount !== null
        ? 'medium'
        : 'low';

  return {
    amount,
    candidateAmounts,
    merchant,
    date,
    rawText,
    confidence
  };
}

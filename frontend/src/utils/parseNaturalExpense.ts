import type { TransactionSuggestion } from '../services/transaction.service';
import type { BudgetMember, EnvelopeItem } from '../types/budget.types';

export interface ParseNaturalExpenseContext {
  envelopes: Array<Pick<EnvelopeItem, 'id' | 'name' | 'icon'>>;
  suggestions?: Array<Pick<TransactionSuggestion, 'label' | 'envelopeName'>>;
  members?: Array<Pick<BudgetMember, 'userId' | 'displayName'>>;
  isSharedBudget?: boolean;
  /** Date de référence (par défaut aujourd'hui) pour les expressions relatives (« hier », « lundi »). */
  referenceDate?: Date;
}

export interface ParsedNaturalExpense {
  rawInput: string;
  amount?: number;
  label?: string;
  envelopeId?: string;
  envelopeName?: string;
  envelopeMatchedBy?: 'direct' | 'suggestion';
  date?: string;
  dateLabel?: string;
  paidByUserId?: string;
  paidByName?: string;
  tags: string[];
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDays(base: Date, deltaDays: number): Date {
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  next.setDate(next.getDate() + deltaDays);
  return next;
}

const WEEKDAY_MAP: Record<string, number> = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6
};

const STOP_WORDS = new Set([
  'a',
  'au',
  'aux',
  'chez',
  'pour',
  'dans',
  'de',
  'du',
  'des',
  'en',
  'le',
  'la',
  'les',
  'un',
  'une',
  'sur',
  'par',
  'et'
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Parse une phrase en langage naturel (dictée vocale ou saisie texte libre)
 * pour pré-remplir une dépense dans le Quick-Add, 100 % en local.
 *
 * Exemples :
 * - « 42,50 euros Carrefour courses hier »
 * - « 42€50 boulangerie #matin »
 * - « 15 balles resto payé par Julie »
 */
export function parseNaturalExpense(
  rawInput: string,
  context: ParseNaturalExpenseContext
): ParsedNaturalExpense {
  const trimmed = rawInput.trim();
  const result: ParsedNaturalExpense = {
    rawInput: trimmed,
    tags: []
  };

  if (!trimmed) {
    return result;
  }

  let working = trimmed;

  // 1. Extraction des #tags
  const tagMatches = working.matchAll(/#([a-zA-ZÀ-ÿ0-9_-]+)/g);
  const seenTags = new Set<string>();
  for (const match of tagMatches) {
    const tag = match[1].trim().toLowerCase();
    if (tag && !seenTags.has(tag)) {
      seenTags.add(tag);
      result.tags.push(tag);
    }
  }
  working = working.replace(/#[a-zA-ZÀ-ÿ0-9_-]+/g, ' ');

  // 2. Extraction du montant (formats parlés & écrits FR)
  // 2a. Forme « 42 euros 50 » ou « 42€50 »
  const spokenEuroCentsRegex =
    /(?:^|\s)(\d{1,6})\s*(?:€|euros?|balles?)\s*(\d{1,2})(?=\s|$|[.,;!?])/i;
  // 2b. Forme classique « 42,50 € », « 42.50 euros », « 15 balles », « 42,50 »
  const standardAmountRegex =
    /(?:^|\s)(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur|balles?)?(?=\s|$|[.,;!?])/i;

  const spokenMatch = working.match(spokenEuroCentsRegex);
  if (spokenMatch) {
    const euros = Number.parseInt(spokenMatch[1], 10);
    const centsRaw = spokenMatch[2].padEnd(2, '0').slice(0, 2);
    const cents = Number.parseInt(centsRaw, 10);
    const parsed = Math.round((euros + cents / 100) * 100) / 100;
    if (Number.isFinite(parsed) && parsed > 0) {
      result.amount = parsed;
      working = working.replace(spokenMatch[0], ' ');
    }
  } else {
    const standardMatch = working.match(standardAmountRegex);
    if (standardMatch) {
      const parsed = Number.parseFloat(standardMatch[1].replace(',', '.'));
      if (Number.isFinite(parsed) && parsed > 0) {
        result.amount = Math.round(parsed * 100) / 100;
        working = working.replace(standardMatch[0], ' ');
      }
    }
  }

  // 3. Extraction de la date relative
  const refDate = context.referenceDate ?? new Date();
  if (/\bavant[- ]hier\b/i.test(working)) {
    result.date = formatIsoDate(shiftDays(refDate, -2));
    result.dateLabel = 'Avant-hier';
    working = working.replace(/\bavant[- ]hier\b/gi, ' ');
  } else if (/\bhier\b/i.test(working)) {
    result.date = formatIsoDate(shiftDays(refDate, -1));
    result.dateLabel = 'Hier';
    working = working.replace(/\bhier\b/gi, ' ');
  } else if (/\baujourd['’]?hui\b/i.test(working)) {
    result.date = formatIsoDate(refDate);
    result.dateLabel = "Aujourd'hui";
    working = working.replace(/\baujourd['’]?hui\b/gi, ' ');
  } else {
    const weekdayMatch = working.match(
      /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i
    );
    if (weekdayMatch) {
      const dayKey = weekdayMatch[1].toLowerCase();
      const targetDay = WEEKDAY_MAP[dayKey];
      const currentDay = refDate.getDay();
      let diff = currentDay - targetDay;
      if (diff <= 0) {
        diff += 7;
      }
      result.date = formatIsoDate(shiftDays(refDate, -diff));
      result.dateLabel = capitalizeFirst(dayKey);
      working = working.replace(weekdayMatch[0], ' ');
    }
  }

  // 4. Extraction du payeur en budget commun (« payé par Julie » / « par Julie »)
  if (context.isSharedBudget && context.members && context.members.length > 0) {
    const paidByMatch = working.match(/\b(?:pay[eé]e?\s+)?par\s+([a-zA-ZÀ-ÿ-]+)\b/i);
    if (paidByMatch) {
      const spokenName = normalizeText(paidByMatch[1]);
      const matchedMember = context.members.find((member) => {
        const memberNorm = normalizeText(member.displayName ?? '');
        if (!memberNorm) return false;
        const firstName = memberNorm.split(/\s+/)[0] ?? memberNorm;
        return memberNorm === spokenName || firstName === spokenName || memberNorm.startsWith(spokenName);
      });
      if (matchedMember) {
        result.paidByUserId = matchedMember.userId;
        result.paidByName = matchedMember.displayName;
        working = working.replace(paidByMatch[0], ' ');
      }
    }
  }

  // 5. Détection de l'enveloppe — Niveau 1 : correspondance directe sur le nom d'enveloppe
  const normalizedWorking = normalizeText(working);
  const workingTokens = normalizedWorking.split(/[^a-z0-9]+/).filter(Boolean);

  // Trier par longueur décroissante pour privilégier les noms composés
  const sortedEnvelopes = [...context.envelopes].sort(
    (a, b) => normalizeText(b.name).length - normalizeText(a.name).length
  );

  for (const envelope of sortedEnvelopes) {
    const envNorm = normalizeText(envelope.name);
    if (!envNorm) continue;

    // 5a. Correspondance exacte de l'expression complète
    const fullRegex = new RegExp(`(^|\\s)${escapeRegExp(envNorm)}s?(?=\\s|$)`, 'i');
    if (fullRegex.test(normalizedWorking)) {
      result.envelopeId = envelope.id;
      result.envelopeName = envelope.name;
      result.envelopeMatchedBy = 'direct';
      // Retirer le mot correspondant dans working (en gérant les accents via tokenisation)
      const envWords = envNorm.split(/\s+/).filter(Boolean);
      for (const word of envWords) {
        working = removeNormalizedWord(working, word);
      }
      break;
    }

    // 5b. Correspondance sur un token significatif (ex. « course » -> « Courses », « resto » -> « Restaurants »)
    const matchedToken = workingTokens.find((token) => {
      if (token.length < 4) return false;
      const expandedToken = token === 'resto' || token === 'restos' ? 'restaurant' : token;
      return (
        envNorm === expandedToken ||
        envNorm === `${expandedToken}s` ||
        `${envNorm}s` === expandedToken ||
        envNorm.startsWith(expandedToken) ||
        expandedToken.startsWith(envNorm)
      );
    });
    if (matchedToken) {
      result.envelopeId = envelope.id;
      result.envelopeName = envelope.name;
      result.envelopeMatchedBy = 'direct';
      working = removeNormalizedWord(working, matchedToken);
      break;
    }
  }

  // 6. Nettoyage du libellé restant
  const cleanedLabel = cleanRemainingLabel(working);
  if (cleanedLabel) {
    result.label = capitalizeFirst(cleanedLabel);
  }

  // 7. Détection de l'enveloppe — Niveau 2 : fallback via l'historique des suggestions
  if (!result.envelopeId && result.label && context.suggestions && context.suggestions.length > 0) {
    const labelNorm = normalizeText(result.label);
    const matchedSuggestion = context.suggestions.find((suggestion) => {
      const sugNorm = normalizeText(suggestion.label);
      return sugNorm === labelNorm || sugNorm.includes(labelNorm) || labelNorm.includes(sugNorm);
    });
    if (matchedSuggestion) {
      const targetEnvNorm = normalizeText(matchedSuggestion.envelopeName);
      const matchedEnv = context.envelopes.find(
        (env) => normalizeText(env.name) === targetEnvNorm
      );
      if (matchedEnv) {
        result.envelopeId = matchedEnv.id;
        result.envelopeName = matchedEnv.name;
        result.envelopeMatchedBy = 'suggestion';
      }
    }
  }

  return result;
}

function removeNormalizedWord(source: string, normalizedTarget: string): string {
  const words = source.split(/\s+/);
  let removed = false;
  const kept = words.filter((word) => {
    if (removed) return true;
    const clean = normalizeText(word.replace(/[.,;!?]+$/g, ''));
    if (
      clean === normalizedTarget ||
      clean === `${normalizedTarget}s` ||
      `${clean}s` === normalizedTarget
    ) {
      removed = true;
      return false;
    }
    return true;
  });
  return kept.join(' ');
}

function cleanRemainingLabel(raw: string): string {
  const tokens = raw
    .replace(/[.,;!?]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  // Retirer les mots de liaison en début et fin de libellé uniquement
  while (tokens.length > 0 && STOP_WORDS.has(normalizeText(tokens[0]))) {
    tokens.shift();
  }
  while (tokens.length > 0 && STOP_WORDS.has(normalizeText(tokens[tokens.length - 1]))) {
    tokens.pop();
  }

  return tokens.join(' ').trim();
}

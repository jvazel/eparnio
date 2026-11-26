export type PayeeMatchType = 'contains' | 'starts_with' | 'exact';
export type PayeeRuleTransactionType = 'all' | 'expense' | 'income';

export interface PayeeRule {
  id: string;
  budgetId: string;
  pattern: string;
  matchType: PayeeMatchType;
  transactionType: PayeeRuleTransactionType;
  targetEnvelopeName?: string;
  renameLabel?: string;
  addTags: string[];
  autoExcludeFromImport: boolean;
  isActive: boolean;
  order: number;
}

export interface EnvelopeMatchCandidate {
  id: string;
  name: string;
  icon?: string;
}

export interface AppliedPayeeRuleResult {
  matchedRule: PayeeRule;
  resolvedEnvelopeId?: string;
  resolvedEnvelopeName?: string;
  renameLabel?: string;
  addTags: string[];
  autoExcludeFromImport: boolean;
}

export function normalizeRuleText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Nettoie un libellé bancaire brut (`CB MONOPRIX 14/11 75011`, `PRLV SEPA NETFLIX.COM`)
 * pour suggérer un motif propre lors de la création d'une règle à la volée.
 */
export function extractSuggestedPattern(rawLabel: string): string {
  const cleaned = rawLabel
    .replace(/^(cb|carte|paiement\s+psc|paiement\s+cb|prlv\s+sepa|prlv|vir\s+sepa|virement)\s+/i, '')
    .replace(/\b\d{2}\/\d{2}(\/\d{2,4})?\b/g, ' ')
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (cleaned || rawLabel.trim()).slice(0, 80);
}

/**
 * Évalue de manière déterministe les règles actives (triées par `order`) sur un libellé brut
 * et retourne la première règle correspondante avec l'enveloppe résolue sur la période active.
 */
export function applyPayeeRules(
  rawLabel: string,
  transactionType: 'expense' | 'income',
  rules: PayeeRule[],
  activeEnvelopes: EnvelopeMatchCandidate[]
): AppliedPayeeRuleResult | null {
  const normalizedInput = normalizeRuleText(rawLabel);
  if (!normalizedInput || rules.length === 0) {
    return null;
  }

  const orderedActiveRules = [...rules]
    .filter((r) => r.isActive && r.pattern.trim().length > 0)
    .sort((a, b) => a.order - b.order);

  for (const rule of orderedActiveRules) {
    if (rule.transactionType !== 'all' && rule.transactionType !== transactionType) {
      continue;
    }

    const normalizedPattern = normalizeRuleText(rule.pattern);
    if (!normalizedPattern) continue;

    let isMatch = false;
    if (rule.matchType === 'exact') {
      isMatch = normalizedInput === normalizedPattern;
    } else if (rule.matchType === 'starts_with') {
      isMatch = normalizedInput.startsWith(normalizedPattern);
    } else {
      isMatch = normalizedInput.includes(normalizedPattern);
    }

    if (!isMatch) continue;

    let resolvedEnvelopeId: string | undefined;
    let resolvedEnvelopeName: string | undefined;
    if (rule.targetEnvelopeName) {
      const targetNorm = normalizeRuleText(rule.targetEnvelopeName);
      const matchedEnv = activeEnvelopes.find(
        (env) => normalizeRuleText(env.name) === targetNorm
      );
      if (matchedEnv) {
        resolvedEnvelopeId = matchedEnv.id;
        resolvedEnvelopeName = matchedEnv.name;
      }
    }

    return {
      matchedRule: rule,
      ...(resolvedEnvelopeId ? { resolvedEnvelopeId, resolvedEnvelopeName } : {}),
      ...(rule.renameLabel ? { renameLabel: rule.renameLabel } : {}),
      addTags: rule.addTags ?? [],
      autoExcludeFromImport: Boolean(rule.autoExcludeFromImport)
    };
  }

  return null;
}

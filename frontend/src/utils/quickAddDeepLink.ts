import { parseNaturalExpense } from './parseNaturalExpense';

export const EPARNIO_PENDING_QUICK_ADD_KEY = 'eparnio_pending_quick_add_v1';

export type QuickAddLaunchMode = 'voice' | 'ocr';

export interface QuickAddPrefill {
  source: 'deep_link' | 'share_target' | 'shortcut';
  mode?: QuickAddLaunchMode;
  amount?: number;
  label?: string;
  envelopeName?: string;
  envelopeId?: string;
  budgetId?: string;
  date?: string;
  tags?: string[];
  notes?: string;
  rawText?: string;
}

function parseAmountParam(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw
    .replace(/[€$£]/g, '')
    .replace(/\b(eur|euros?)\b/gi, '')
    .replace(/\s+/g, '')
    .replace(',', '.')
    .trim();
  if (!cleaned) return undefined;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0 || num > 1_000_000) {
    return undefined;
  }
  return Math.round(num * 100) / 100;
}

function parseDateParam(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return trimmed;
}

function parseTagsParam(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  const tags = raw
    .split(/[,;]+/)
    .map((t) => t.trim().replace(/^#+/, '').replace(/\s+/g, '-').toLowerCase().slice(0, 40))
    .filter(Boolean)
    .slice(0, 5);
  return tags.length > 0 ? Array.from(new Set(tags)) : undefined;
}

/**
 * Analyse une URL `/quick-add` (mode structuré Apple Pay / Raccourcis ou mode texte libre Share Target)
 * et retourne un objet `QuickAddPrefill` sécurisé (jamais de soumission automatique).
 */
export function parseQuickAddUrlParams(
  pathname: string,
  search: string
): QuickAddPrefill | null {
  const normalizedPath = pathname.replace(/\/+$/, '');
  if (normalizedPath !== '/quick-add') {
    return null;
  }

  const params = new URLSearchParams(search);
  const rawMode = params.get('mode')?.trim().toLowerCase();
  const mode: QuickAddLaunchMode | undefined =
    rawMode === 'voice' || rawMode === 'ocr' ? rawMode : undefined;
  const rawAmount = params.get('amount');
  const rawLabel = params.get('label')?.trim().slice(0, 160) || undefined;
  const rawEnvelope = params.get('envelope')?.trim().slice(0, 120) || undefined;
  const rawEnvelopeId = params.get('envelopeId')?.trim().slice(0, 80) || undefined;
  const rawBudgetId = params.get('budgetId')?.trim().slice(0, 80) || undefined;
  const rawDate = parseDateParam(params.get('date'));
  const rawTags = parseTagsParam(params.get('tags'));
  const rawNotes = params.get('notes')?.trim().slice(0, 300) || undefined;

  const sharedText = [params.get('title'), params.get('text')]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  const amount = parseAmountParam(rawAmount);

  // Mode texte libre / Web Share Target
  if (sharedText && amount === undefined && !rawLabel) {
    const parsedNatural = parseNaturalExpense(sharedText, {
      envelopes: [],
      suggestions: [],
      members: [],
      isSharedBudget: false
    });
    return {
      source: 'share_target',
      ...(parsedNatural.amount !== undefined ? { amount: parsedNatural.amount } : {}),
      ...(parsedNatural.label ? { label: parsedNatural.label.slice(0, 160) } : {}),
      ...(parsedNatural.date ? { date: parsedNatural.date } : {}),
      ...(parsedNatural.tags && parsedNatural.tags.length > 0
        ? { tags: parsedNatural.tags }
        : {}),
      rawText: sharedText.slice(0, 300)
    };
  }

  // Mode structuré (Apple Pay / Raccourcis / Widgets Android) ou raccourci d'icône vide
  const hasAnyStructuredField = Boolean(
    mode ||
      amount !== undefined ||
      rawLabel ||
      rawEnvelope ||
      rawEnvelopeId ||
      rawBudgetId ||
      rawDate ||
      rawTags ||
      rawNotes
  );

  return {
    source: hasAnyStructuredField ? 'deep_link' : 'shortcut',
    ...(mode ? { mode } : {}),
    ...(amount !== undefined ? { amount } : {}),
    ...(rawLabel ? { label: rawLabel } : {}),
    ...(rawEnvelope ? { envelopeName: rawEnvelope } : {}),
    ...(rawEnvelopeId ? { envelopeId: rawEnvelopeId } : {}),
    ...(rawBudgetId ? { budgetId: rawBudgetId } : {}),
    ...(rawDate ? { date: rawDate } : {}),
    ...(rawTags ? { tags: rawTags } : {}),
    ...(rawNotes ? { notes: rawNotes } : {})
  };
}

/**
 * Analyse une URL de deep-link natif Android (`eparnio://quick-add?mode=voice|ocr&...`).
 */
export function parseNativeQuickAddUrl(rawUrl: string): QuickAddPrefill | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'eparnio:' && parsed.hostname === 'quick-add') {
      return parseQuickAddUrlParams('/quick-add', parsed.search);
    }
    return parseQuickAddUrlParams(parsed.pathname, parsed.search);
  } catch {
    return null;
  }
}

/**
 * Conserve temporairement un deep-link en `sessionStorage` si l'utilisateur doit d'abord se reconnecter.
 */
export function savePendingQuickAddPrefill(prefill: QuickAddPrefill): void {
  try {
    sessionStorage.setItem(EPARNIO_PENDING_QUICK_ADD_KEY, JSON.stringify(prefill));
  } catch {
    // Ignorer si sessionStorage est indisponible
  }
}

/**
 * Lit et supprime immédiatement le deep-link en attente depuis `sessionStorage`.
 */
export function consumePendingQuickAddPrefill(): QuickAddPrefill | null {
  try {
    const raw = sessionStorage.getItem(EPARNIO_PENDING_QUICK_ADD_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(EPARNIO_PENDING_QUICK_ADD_KEY);
    const parsed = JSON.parse(raw) as QuickAddPrefill;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Nettoie `/quick-add?...` de la barre d'adresse pour éviter toute réouverture au rechargement.
 */
export function clearQuickAddUrl(): void {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/quick-add')) {
    window.history.replaceState({}, '', '/');
  }
}

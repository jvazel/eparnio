const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/**
 * Formate un montant numérique en euros selon les conventions françaises (tabular-nums recommandé côté UI).
 */
export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

/**
 * Formate un mois (ex. "Décembre 2025") à partir d'une date de référence.
 */
export function formatMonthLabel(date: Date): string {
  const formatted = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric'
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Formate une date courte lisible en liste (ex. "10 déc.").
 */
export function formatShortDate(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  }).format(date);
}

/**
 * Formate une date complète en français (ex. "10 décembre 2025").
 */
export function formatFullDate(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

/**
 * Convertit une date ISO ou Date vers `YYYY-MM-DD` pour un champ `<input type="date">`.
 */
export function toDateInputValue(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Valide la robustesse d'un nouveau mot de passe (8 car. min., majuscule, minuscule, chiffre).
 */
export function validateStrongPassword(password: string): string | undefined {
  if (!password) {
    return 'Le mot de passe est requis.';
  }
  if (password.length < 8) {
    return 'Le mot de passe doit contenir au moins 8 caractères.';
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Le mot de passe doit contenir au moins 1 majuscule, 1 minuscule et 1 chiffre.';
  }
  return undefined;
}

/**
 * Télécharge localement la clé de récupération personnelle au format `.txt` (0 service externe).
 */
export function downloadRecoveryKeyFile(recoveryKey: string, email?: string): void {
  const createdAt = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(new Date());

  const content = [
    'EPARNIO — CLÉ DE RÉCUPÉRATION PERSONNELLE',
    '=========================================',
    '',
    ...(email ? [`Compte : ${email}`] : []),
    `Clé de récupération : ${recoveryKey}`,
    `Enregistrée le : ${createdAt}`,
    '',
    'Conservez ce fichier en lieu sûr.',
    'Cette clé permet de réinitialiser votre mot de passe gratuitement sans dépendre d’un service tiers.'
  ].join('\n');

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const canUseObjectUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
  const href = canUseObjectUrl
    ? URL.createObjectURL(blob)
    : `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`;

  const link = document.createElement('a');
  link.href = href;
  link.download = 'eparnio-cle-recuperation.txt';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (canUseObjectUrl) {
    URL.revokeObjectURL(href);
  }
}

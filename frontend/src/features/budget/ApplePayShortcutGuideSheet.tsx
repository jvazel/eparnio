import { Check, Copy, ExternalLink, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';

export interface ApplePayShortcutGuideSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onTestShortcut?: () => void;
}

/**
 * Guide intégré Mobile-First pour automatiser la saisie rapide avec Apple Pay (Raccourcis iOS),
 * le partage système Android (Web Share Target) et le raccourci d'icône PWA.
 */
export function ApplePayShortcutGuideSheet({
  isOpen,
  onClose,
  onTestShortcut
}: ApplePayShortcutGuideSheetProps) {
  const [copied, setCopied] = useState(false);

  const origin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://eparnio.app';
  const templateUrl = `${origin}/quick-add?amount=&label=`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(templateUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback silencieux si clipboard indisponible
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Automatiser avec Apple Pay"
    >
      <div className="space-y-4 pb-2">
        <div className="rounded-2xl border border-violet-200/80 bg-violet-50/70 p-3.5 dark:border-violet-900/60 dark:bg-violet-950/40">
          <div className="flex items-center gap-2">
            <Smartphone
              className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300"
              aria-hidden="true"
            />
            <p className="text-xs font-bold text-violet-900 dark:text-violet-100">
              90 % du confort bancaire, 0 identifiant partagé
            </p>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-violet-800/90 dark:text-violet-200/90">
            À chaque paiement Apple Pay, votre iPhone ouvre Eparnio pré-rempli avec le montant
            et le marchand. Il ne reste qu’à valider en 1 tap !
          </p>
        </div>

        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Votre lien Quick-Add
          </p>
          <p className="break-all rounded-xl bg-white px-3 py-2 font-mono text-[11px] text-slate-800 dark:bg-slate-900 dark:text-slate-100">
            {templateUrl}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              className="flex-1"
              onClick={() => {
                void handleCopy();
              }}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Copié !
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copier le lien
                </>
              )}
            </Button>
            {onTestShortcut ? (
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  onClose();
                  onTestShortcut();
                }}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Tester
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold text-slate-900 dark:text-slate-50">
            Configuration iPhone (Raccourcis iOS — 1 min)
          </p>
          <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <li>
              Ouvrez l’app <strong>Raccourcis</strong> → onglet <strong>Automatisation</strong> →{' '}
              <strong>+</strong>.
            </li>
            <li>
              Choisissez <strong>Transaction</strong> (Apple Pay / Wallet) puis{' '}
              <strong>Exécuter immédiatement</strong>.
            </li>
            <li>
              Ajoutez l’action <strong>Ouvrir des URL</strong> et collez le lien ci-dessus.
            </li>
            <li>
              Insérez les variables <strong>Montant</strong> après <code>amount=</code> et{' '}
              <strong>Commerçant</strong> après <code>label=</code>.
            </li>
          </ol>
        </div>

        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          <strong>Sur Android :</strong> vous pouvez aussi partager directement un SMS bancaire
          vers <strong>Eparnio</strong> depuis le menu <em>Partager</em>, ou faire un appui long
          sur l’icône Eparnio → <em>Dépense rapide</em>.
        </p>
      </div>
    </BottomSheet>
  );
}

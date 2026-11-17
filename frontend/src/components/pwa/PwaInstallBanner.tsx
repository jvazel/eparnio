import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';

/**
 * Bandeau discret d'installation PWA sur mobile (Android / Chrome via prompt natif,
 * iOS Safari via guide « Partager → Sur l'écran d'accueil »).
 */
export function PwaInstallBanner() {
  const { canInstall, isIosSafari, isStandalone, isDismissed, promptInstall, dismiss } =
    usePwaInstall();

  if (isStandalone || isDismissed || (!canInstall && !isIosSafari)) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Installer l’application Eparnio"
      className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50/90 px-3.5 py-2.5 shadow-sm dark:border-violet-800/60 dark:bg-violet-950/50"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white"
          aria-hidden="true"
        >
          <Smartphone className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-50">
            Installer Eparnio
          </p>
          {canInstall ? (
            <p className="truncate text-[11px] text-slate-600 dark:text-slate-300">
              Ajoutez l’app sur votre écran d’accueil
            </p>
          ) : (
            <p className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
              <span>Appuyez sur</span>
              <Share className="inline h-3 w-3 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>puis « Sur l’écran d’accueil »</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {canInstall && (
          <button
            type="button"
            onClick={() => {
              void promptInstall();
            }}
            className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700 active:scale-95"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Installer</span>
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer la suggestion d’installation"
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-violet-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-violet-900/60 dark:hover:text-slate-100"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

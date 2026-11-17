import { RefreshCw, WifiOff } from 'lucide-react';
import { useOfflineSync } from '../../hooks/useOfflineSync';

/**
 * Bandeau discret affiché hors-ligne ou lorsque des actions locales attendent une synchronisation.
 */
export function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, syncQueue } = useOfflineSync();

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-4 mb-3 flex items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 px-3.5 py-2 text-xs font-medium text-amber-900 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-100"
    >
      <div className="flex min-w-0 items-center gap-2">
        <WifiOff className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <span className="truncate">
          {!isOnline
            ? pendingCount > 0
              ? `Mode hors-ligne — ${pendingCount} action(s) en attente`
              : 'Mode hors-ligne'
            : `${pendingCount} action(s) en attente de synchronisation`}
        </span>
      </div>

      {isOnline && pendingCount > 0 ? (
        <button
          type="button"
          disabled={isSyncing}
          onClick={() => {
            void syncQueue();
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
        >
          <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{isSyncing ? 'Synchro...' : 'Synchroniser'}</span>
        </button>
      ) : null}
    </div>
  );
}

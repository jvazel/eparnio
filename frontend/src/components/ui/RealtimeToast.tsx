import { Radio, X } from 'lucide-react';
import { useEffect } from 'react';

export interface RealtimeToastProps {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
}

/**
 * Toast discret affiché lorsqu'un autre membre effectue une action en direct
 * sur le budget actif (modes clair et sombre).
 */
export function RealtimeToast({
  message,
  onDismiss,
  durationMs = 3500
}: RealtimeToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [message, onDismiss, durationMs]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-4 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-violet-200 bg-white/95 px-3.5 py-2.5 shadow-lg backdrop-blur-md dark:border-violet-800/70 dark:bg-slate-900/95"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300">
        <Radio className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <p className="min-w-0 flex-1 text-xs font-semibold text-slate-800 dark:text-slate-100">
        {message}
      </p>
      <button
        type="button"
        aria-label="Fermer la notification en direct"
        onClick={onDismiss}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

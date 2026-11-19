import { ChevronLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  getTagDetailAnalytics,
  type TagDetailAnalytics
} from '../../services/analytics.service';
import { formatCurrency } from '../../utils/format';

export interface TagDetailModalProps {
  isOpen: boolean;
  budgetId: string;
  tag: string | null;
  onClose: () => void;
}

export function TagDetailModal({
  isOpen,
  budgetId,
  tag,
  onClose
}: TagDetailModalProps) {
  const [analytics, setAnalytics] = useState<TagDetailAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !tag) return;
    let cancelled = false;
    setIsLoading(true);
    getTagDetailAnalytics(budgetId, tag)
      .then((data) => {
        if (!cancelled) setAnalytics(data);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, budgetId, tag]);

  if (!isOpen || !tag) return null;

  const maxMonthly = analytics
    ? Math.max(...analytics.byMonth.map((m) => m.amount), 1)
    : 1;

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Détails du tag #${tag}`}
      className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-950"
    >
      <header className="border-b border-slate-200/80 bg-white px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le détail du tag"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
              #{tag}
            </h2>
            {analytics ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {analytics.count} {analytics.count > 1 ? 'opérations' : 'opération'} ·{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatCurrency(analytics.totalAmount)}
                </span>
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-md space-y-4">
          {isLoading || !analytics ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Chargement des statistiques...
            </p>
          ) : (
            <>
              {analytics.byEnvelope.length > 0 && (
                <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-100">
                    Répartition par enveloppe
                  </h3>
                  <div className="flex items-center gap-4">
                    <svg
                      viewBox="0 0 100 100"
                      className="h-24 w-24 shrink-0 -rotate-90"
                      aria-hidden="true"
                    >
                      <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth="12"
                        className="text-slate-100 dark:text-slate-800"
                      />
                      {analytics.byEnvelope.map((slice) => {
                        const dashLength = (slice.percentage / 100) * circumference;
                        const dashOffset = -cumulativeOffset;
                        cumulativeOffset += dashLength;
                        return (
                          <circle
                            key={slice.envelopeId}
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="transparent"
                            stroke={slice.envelopeColor}
                            strokeWidth="12"
                            strokeDasharray={`${dashLength} ${circumference}`}
                            strokeDashoffset={dashOffset}
                          />
                        );
                      })}
                    </svg>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {analytics.byEnvelope.map((item) => (
                        <div
                          key={item.envelopeId}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-700 dark:text-slate-200">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: item.envelopeColor }}
                            />
                            <span className="truncate">
                              {item.envelopeIcon} {item.envelopeName}
                            </span>
                          </span>
                          <span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-slate-100">
                            {item.percentage}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {analytics.byMonth.length > 0 && (
                <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-100">
                    Évolution mois par mois
                  </h3>
                  <div className="flex items-end gap-2 pt-2">
                    {analytics.byMonth.map((point) => {
                      const heightPx = Math.max(
                        12,
                        Math.round((point.amount / maxMonthly) * 80)
                      );
                      return (
                        <div
                          key={`${point.year}-${point.month}`}
                          className="flex flex-1 flex-col items-center gap-1"
                        >
                          <span className="text-[10px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                            {Math.round(point.amount)}€
                          </span>
                          <div
                            className="w-full max-w-8 rounded-t-lg bg-violet-500 dark:bg-violet-400"
                            style={{ height: `${heightPx}px` }}
                          />
                          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                            {point.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="space-y-2">
                <h3 className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Opérations associées
                </h3>
                {analytics.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-card dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-white text-base dark:bg-slate-800"
                        style={{ borderColor: tx.envelopeColor }}
                      >
                        {tx.envelopeIcon}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                          {tx.label}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {tx.envelopeName} ·{' '}
                          {new Date(tx.date).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { Hash } from 'lucide-react';
import type { TagSummaryItem } from '../../services/analytics.service';
import { formatCurrency } from '../../utils/format';

export interface TagAnalyticsCardProps {
  tags: TagSummaryItem[];
  onSelectTag: (tag: string) => void;
}

export function TagAnalyticsCard({ tags, onSelectTag }: TagAnalyticsCardProps) {
  if (tags.length === 0) {
    return null;
  }

  const maxAmount = Math.max(...tags.map((t) => t.totalAmount), 1);

  return (
    <section
      aria-label="Suivi par tags"
      className="rounded-3xl border border-slate-100 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300">
            <Hash className="h-4 w-4" aria-hidden="true" />
          </span>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Suivi par tags
          </h3>
        </div>
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
          {tags.length} {tags.length > 1 ? 'tags' : 'tag'}
        </span>
      </div>

      <div className="space-y-2.5">
        {tags.slice(0, 6).map((item) => {
          const widthPercent = Math.max(6, Math.round((item.totalAmount / maxAmount) * 100));
          return (
            <button
              key={item.tag}
              type="button"
              onClick={() => onSelectTag(item.tag)}
              className="block w-full rounded-2xl p-1.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  #{item.tag}{' '}
                  <span className="font-normal text-slate-400 dark:text-slate-500">
                    ({item.count})
                  </span>
                </span>
                <span className="font-bold tabular-nums text-slate-900 dark:text-slate-50">
                  {formatCurrency(item.totalAmount)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all dark:bg-violet-400"
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

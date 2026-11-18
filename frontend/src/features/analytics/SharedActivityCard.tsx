import { Activity } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import type { EnvelopeItem } from '../../types/budget.types';
import { formatCurrency } from '../../utils/format';

export interface SharedActivityCardProps {
  envelopes: EnvelopeItem[];
}

/**
 * Affiche les dernières modifications / ajouts d'enveloppes et charges sur un budget partagé.
 */
export function SharedActivityCard({ envelopes }: SharedActivityCardProps) {
  const recent = [...envelopes]
    .sort((a, b) => {
      const timeA = new Date(a.updatedAt ?? a.date).getTime();
      const timeB = new Date(b.updatedAt ?? b.date).getTime();
      return timeB - timeA;
    })
    .slice(0, 4);

  if (recent.length === 0) {
    return null;
  }

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-violet-600" aria-hidden="true" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">
          Activité récente du foyer
        </h3>
      </div>

      <ul className="space-y-2">
        {recent.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-200"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true">{item.icon}</span>
              <span className="truncate font-medium">{item.name}</span>
            </div>
            <span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {formatCurrency(
                item.pillar === 'variable_envelope' ? item.spentOrPaidAmount : item.allocatedAmount
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

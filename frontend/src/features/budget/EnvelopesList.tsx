import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PastelEnvelopeCard } from '../../components/ui/PastelEnvelopeCard';
import { RingGauge } from '../../components/ui/RingGauge';
import type { BudgetPeriodSummary, EnvelopeItem } from '../../types/budget.types';
import { formatCurrency } from '../../utils/format';
import { sortEnvelopesByOrder } from './SectionManageHeader';
import { ZeroBasedBanner } from './ZeroBasedBanner';

export interface EnvelopesListProps {
  items: EnvelopeItem[];
  summary: BudgetPeriodSummary;
  onAddEnvelope: () => void;
  onSelectEnvelope: (envelope: EnvelopeItem) => void;
}

/**
 * Vue complète de l'onglet « Enveloppes » (Dépenses variables) :
 * Jauge circulaire « Reste dans les enveloppes » + grille 2 colonnes de tuiles pastel Finzee.
 */
export function EnvelopesList({
  items,
  summary,
  onAddEnvelope,
  onSelectEnvelope
}: EnvelopesListProps) {
  const sortedItems = useMemo(() => sortEnvelopesByOrder(items), [items]);
  const remainingInEnvelopes =
    Math.round((summary.plannedEnvelopes - summary.spentVariables) * 100) / 100;

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500">Budget alloué : </span>
            <span className="font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {formatCurrency(summary.plannedEnvelopes)}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Dépensé : </span>
            <span className="font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {formatCurrency(summary.spentVariables)}
            </span>
          </div>
        </div>

        <RingGauge
          value={remainingInEnvelopes}
          max={Math.max(summary.plannedEnvelopes, Math.abs(remainingInEnvelopes), 1)}
          label="Reste dans les enveloppes"
        />
      </Card>

      <ZeroBasedBanner
        remainingToAllocate={summary.remainingToAllocate}
        plannedIncome={summary.plannedIncome}
      />

      <section aria-label="Les enveloppes" className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">Les enveloppes</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
              {sortedItems.length}
            </span>
          </div>
        </div>

        {sortedItems.length === 0 ? (
          <Card className="text-center">
            <p className="text-sm font-medium text-slate-600">
              Aucune enveloppe budgétaire sur cette période.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Créez vos enveloppes (Courses, Sorties, Transports…) et suivez chaque dépense au
              pouce.
            </p>
            <div className="mt-4">
              <Button type="button" variant="primary" onClick={onAddEnvelope}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Créer ma première enveloppe
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {sortedItems.map((envelope) => (
              <PastelEnvelopeCard
                key={envelope.id}
                envelope={envelope}
                onSelect={onSelectEnvelope}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

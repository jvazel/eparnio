import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CheckableListCard } from '../../components/ui/CheckableListCard';
import { DonutSummaryCard } from '../../components/ui/DonutChart';
import type { BudgetPeriodSummary, EnvelopeItem } from '../../types/budget.types';
import {
  buildReorderedIds,
  SectionManageHeader,
  sortEnvelopesByOrder
} from './SectionManageHeader';
import { ZeroBasedBanner, type ZeroBasedQuickActions } from './ZeroBasedBanner';

export interface IncomeListProps {
  items: EnvelopeItem[];
  summary: BudgetPeriodSummary;
  onAddIncome: () => void;
  onEditIncome: (item: EnvelopeItem) => void;
  onTogglePaid: (item: EnvelopeItem) => void;
  onReorder: (orderedIds: string[]) => void;
  onDeleteIncome: (item: EnvelopeItem) => void;
  zeroBasedActions?: ZeroBasedQuickActions;
}

/**
 * Vue complète de l'onglet « Revenus » : Donut € | %, solde Base Zéro
 * et historique pointable / réorganisable en mode ⚙️.
 */
export function IncomeList({
  items,
  summary,
  onAddIncome,
  onEditIncome,
  onTogglePaid,
  onReorder,
  onDeleteIncome,
  zeroBasedActions
}: IncomeListProps) {
  const [isManageMode, setIsManageMode] = useState(false);

  const sortedItems = useMemo(() => sortEnvelopesByOrder(items), [items]);

  const donutItems = useMemo(
    () =>
      sortedItems.map((item) => ({
        id: item.id,
        label: item.name,
        amount: item.allocatedAmount,
        color: item.color
      })),
    [sortedItems]
  );

  const handleMove = (index: number, direction: -1 | 1) => {
    const orderedIds = buildReorderedIds(sortedItems, index, direction);
    if (orderedIds) {
      onReorder(orderedIds);
    }
  };

  return (
    <div className="space-y-4">
      <DonutSummaryCard
        title="Total"
        total={summary.plannedIncome}
        items={donutItems}
        allowModeToggle
        emptyMessage="Aucun revenu prévu ce mois-ci. Touchez + pour ajouter votre premier revenu."
      />

      <ZeroBasedBanner
        remainingToAllocate={summary.remainingToAllocate}
        plannedIncome={summary.plannedIncome}
        {...zeroBasedActions}
      />

      <section aria-label="Historique des revenus" className="space-y-2.5">
        <SectionManageHeader
          title="Historique des revenus"
          count={sortedItems.length}
          isManageMode={isManageMode}
          manageButtonLabel="Gérer l’ordre et supprimer des revenus"
          onToggleManageMode={() => setIsManageMode((previous) => !previous)}
        />

        {sortedItems.length === 0 ? (
          <Card className="text-center">
            <p className="text-sm font-medium text-slate-600">
              Aucun revenu enregistré sur cette période.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Ajoutez votre salaire ou vos apports pour initialiser le calcul Base Zéro.
            </p>
            <div className="mt-4">
              <Button type="button" variant="primary" onClick={onAddIncome}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Saisir mon premier revenu
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {sortedItems.map((item, index) => (
              <CheckableListCard
                key={item.id}
                item={item}
                isManageMode={isManageMode}
                canMoveUp={index > 0}
                canMoveDown={index < sortedItems.length - 1}
                onEdit={onEditIncome}
                onTogglePaid={onTogglePaid}
                onMoveUp={() => handleMove(index, -1)}
                onMoveDown={() => handleMove(index, 1)}
                onDelete={onDeleteIncome}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

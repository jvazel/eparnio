import { Scale } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import type { BudgetTrendItem } from '../../services/analytics.service';
import type { EnvelopeItem, PeriodAnalytics } from '../../types/budget.types';
import { ZeroBasedBanner } from '../budget/ZeroBasedBanner';
import { AllocationDonutCard } from './AllocationDonut';
import { CashFlowSummaryCard } from './CashFlowSummaryCard';
import { DailyBudgetCard } from './DailyBudgetCard';
import { EnvelopeBreakdownCard } from './EnvelopeBreakdownCard';
import { MemberBreakdownCard } from './MemberBreakdownCard';
import { TrendsCard } from './TrendsCard';

export interface MonthlyInsightsProps {
  analytics: PeriodAnalytics;
  envelopes?: EnvelopeItem[];
  trends?: BudgetTrendItem[];
  currentUserId?: string;
  onOpenCalculator?: () => void;
}

/**
 * Vue complète de l'onglet « Budget » sans FAB (+) :
 * Entrées et sorties d'argent, Gestion du budget quotidien, Part des dépenses,
 * bandeau Base Zéro et Bilan par membre (si budget partagé).
 */
export function MonthlyInsights({
  analytics,
  envelopes = [],
  trends = [],
  currentUserId,
  onOpenCalculator
}: MonthlyInsightsProps) {
  const isSharedBudget = analytics.budgetType === 'shared';

  return (
    <div className="space-y-4">
      <CashFlowSummaryCard cashFlow={analytics.cashFlow} />

      <DailyBudgetCard dailyBudget={analytics.dailyBudget} />

      <AllocationDonutCard allocation={analytics.allocation} />

      <EnvelopeBreakdownCard envelopes={envelopes} />

      <ZeroBasedBanner
        remainingToAllocate={analytics.zeroBased.remainingToAllocate}
        plannedIncome={analytics.zeroBased.plannedIncome}
      />

      <TrendsCard items={trends} />

      {isSharedBudget && (
        <div className="space-y-3">
          <MemberBreakdownCard
            members={analytics.memberBreakdown}
            currentUserId={currentUserId}
          />
          {onOpenCalculator ? (
            <Button type="button" variant="secondary" fullWidth onClick={onOpenCalculator}>
              <Scale className="h-4 w-4 text-violet-600" aria-hidden="true" />
              Calculateur 50/50 &amp; Prorata
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

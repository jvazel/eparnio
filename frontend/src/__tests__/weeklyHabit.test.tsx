import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HabitMilestonesCard } from '../features/analytics/HabitMilestonesCard';
import { WeeklyDigestCard } from '../features/analytics/WeeklyDigestCard';
import { WeeklyDigestSheet } from '../features/analytics/WeeklyDigestSheet';
import type {
  HabitMilestoneItem,
  WeeklyDigestResult
} from '../services/weeklyHabit.service';

const mockDigest: WeeklyDigestResult = {
  periodId: 'p1',
  periodLabel: 'Novembre 2026',
  remainingToLive: 640,
  dailyAllowance: 40,
  daysRemaining: 16,
  monthProgressPercent: 50,
  rhythmStatus: 'watch',
  upcomingFixedCharges: [
    {
      id: 'f1',
      periodId: 'p1',
      name: 'Internet',
      icon: '📱',
      color: '#3B82F6',
      amount: 35,
      dueDate: '2026-11-18T00:00:00.000Z'
    }
  ],
  upcomingFixedTotal: 35,
  envelopesToWatch: [
    {
      id: 'e1',
      name: 'Sorties',
      icon: '🎉',
      color: '#EC4899',
      allocatedAmount: 100,
      spentAmount: 85,
      remainingAmount: 15,
      consumedPercent: 85
    }
  ],
  positiveNote: 'Tu as déjà prévu 200 € d’épargne sur ce cycle.'
};

const mockMilestones: HabitMilestoneItem[] = [
  {
    id: 'zb-1',
    category: 'zero_based',
    title: '1er mois équilibré à 0 €',
    description: 'Chaque euro a trouvé sa mission.',
    unlocked: true,
    progress: 100,
    currentValue: 1,
    targetValue: 1
  },
  {
    id: 'zb-3',
    category: 'zero_based',
    title: '3 mois équilibrés à 0 €',
    description: 'Trois cycles équilibrés.',
    unlocked: false,
    progress: 33,
    currentValue: 1,
    targetValue: 3
  }
];

describe('Point du dimanche & Jalons de régularité (Étape 64)', () => {
  it('affiche WeeklyDigestCard et déclenche l’ouverture au clic', () => {
    const onOpen = vi.fn();
    render(<WeeklyDigestCard digest={mockDigest} onOpenDigest={onOpen} />);

    expect(screen.getByText('Point du dimanche')).toBeInTheDocument();
    expect(screen.getByText('À surveiller')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('affiche WeeklyDigestSheet et permet de pointer une charge fixe ou ouvrir une enveloppe', () => {
    const onMarkPaid = vi.fn();
    const onSelectEnvelope = vi.fn();
    const onClose = vi.fn();

    render(
      <WeeklyDigestSheet
        isOpen
        onClose={onClose}
        digest={mockDigest}
        onMarkFixedChargePaid={onMarkPaid}
        onSelectEnvelope={onSelectEnvelope}
      />
    );

    expect(screen.getByText('Internet')).toBeInTheDocument();
    expect(screen.getByText('Sorties')).toBeInTheDocument();
    expect(screen.getByText(/200 € d’épargne/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /pointer internet comme payée/i }));
    expect(onMarkPaid).toHaveBeenCalledWith('p1', 'f1');

    fireEvent.click(screen.getByRole('button', { name: /sorties/i }));
    expect(onSelectEnvelope).toHaveBeenCalledWith('e1');
    expect(onClose).toHaveBeenCalled();
  });

  it('affiche HabitMilestonesCard avec les jalons débloqués et le prochain palier', () => {
    render(<HabitMilestonesCard milestones={mockMilestones} />);

    expect(screen.getByText('Mes jalons de régularité')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText('1er mois équilibré à 0 €')).toBeInTheDocument();
    expect(screen.getByText(/prochain palier : 3 mois équilibrés/i)).toBeInTheDocument();
  });
});

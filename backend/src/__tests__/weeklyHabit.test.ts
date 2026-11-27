import { describe, expect, it } from 'vitest';
import {
  computeHabitMilestones,
  computeWeeklyDigest
} from '../services/weeklyHabit.service';

describe('weeklyHabit.service (Étape 64)', () => {
  it('calcule le Point du dimanche avec les charges fixes à 7 jours, le top 2 enveloppes et la note positive', () => {
    const now = new Date('2026-11-15T12:00:00.000Z');
    const digest = computeWeeklyDigest({
      periodId: 'p1',
      periodLabel: 'Novembre 2026',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      endDate: new Date('2026-11-30T23:59:59.999Z'),
      remainingToLive: 640,
      remainingToAllocate: 0,
      plannedSavings: 200,
      fixedCharges: [
        {
          id: 'f1',
          name: 'Internet',
          icon: '📱',
          color: '#3B82F6',
          allocatedAmount: 35,
          isPaid: false,
          dueDate: new Date('2026-11-18T00:00:00.000Z')
        },
        {
          id: 'f2',
          name: 'Assurance',
          icon: '🛡️',
          color: '#16A34A',
          allocatedAmount: 55,
          isPaid: false,
          dueDate: new Date('2026-11-28T00:00:00.000Z') // > 7 jours
        },
        {
          id: 'f3',
          name: 'Loyer',
          icon: '🏠',
          color: '#7C3AED',
          allocatedAmount: 800,
          isPaid: true,
          dueDate: new Date('2026-11-16T00:00:00.000Z') // déjà payée
        }
      ],
      variableEnvelopes: [
        {
          id: 'e1',
          name: 'Sorties',
          icon: '🎉',
          color: '#EC4899',
          allocatedAmount: 100,
          spentOrPaidAmount: 90
        },
        {
          id: 'e2',
          name: 'Courses',
          icon: '🛒',
          color: '#16A34A',
          allocatedAmount: 400,
          spentOrPaidAmount: 300
        },
        {
          id: 'e3',
          name: 'Transport',
          icon: '🚌',
          color: '#06B6D4',
          allocatedAmount: 100,
          spentOrPaidAmount: 20
        }
      ],
      now
    });

    expect(digest.upcomingFixedCharges).toHaveLength(1);
    expect(digest.upcomingFixedCharges[0]?.name).toBe('Internet');
    expect(digest.upcomingFixedTotal).toBe(35);
    expect(digest.envelopesToWatch).toHaveLength(2);
    expect(digest.envelopesToWatch[0]?.name).toBe('Sorties');
    expect(digest.rhythmStatus).toBe('watch');
    expect(digest.positiveNote).toContain('200');
  });

  it('calcule les jalons de régularité cumulés sans remise à zéro punitive', () => {
    const milestones = computeHabitMilestones({
      balancedMonthsCount: 3,
      emergencyMonthsCovered: 1.5,
      activeWeeksCount: 5,
      hasSavingsContribution: true,
      reachedGoalsCount: 1,
      ageOfMoneyDays: 32
    });

    const byId = Object.fromEntries(milestones.map((m) => [m.id, m]));
    expect(byId['zb-1']?.unlocked).toBe(true);
    expect(byId['zb-3']?.unlocked).toBe(true);
    expect(byId['zb-6']?.unlocked).toBe(false);
    expect(byId['zb-6']?.progress).toBe(50);
    expect(byId['ef-1']?.unlocked).toBe(true);
    expect(byId['reg-4']?.unlocked).toBe(true);
    expect(byId['sav-goal']?.unlocked).toBe(true);
    expect(byId['aom-30']?.unlocked).toBe(true);
  });
});

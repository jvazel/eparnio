import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetCalendarView } from '../features/budget/BudgetCalendarView';
import * as calendarService from '../services/calendar.service';
import * as envelopeService from '../services/envelope.service';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 320, height: 180 }}>{children}</div>
    ),
  };
});

describe('BudgetCalendarView & CalendarDaySheet', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('formate les clés YYYY-MM-DD en DD/MM/YYYY', () => {
    expect(calendarService.formatDateKeyDDMMYYYY('2026-11-24')).toBe('24/11/2026');
  });

  it('affiche la grille, la courbe, les échéances périodiques et permet de pointer un jour', async () => {
    vi.spyOn(calendarService, 'fetchPeriodCalendar').mockResolvedValue({
      periodId: 'p1',
      budgetId: 'b1',
      startDateKey: '2026-11-01',
      endDateKey: '2026-11-03',
      todayKey: '2026-11-02',
      dailyVariablePace: 20,
      members: [],
      upcomingPeriodic: [
        {
          envelopeId: 'env-q',
          label: 'Assurance Auto',
          pillar: 'fixed_charge',
          amount: 180,
          emoji: '🚗',
          color: '#8B5CF6',
          recurrenceFrequency: 'quarterly',
          nextDateKey: '2027-01-15',
        },
      ],
      cashFlowCurve: [
        {
          dateKey: '2026-11-01',
          isToday: false,
          isFuture: false,
          realizedBalance: 2000,
          projectedBalance: 2000,
          projectedBalanceWithVariablePace: 2000,
        },
        {
          dateKey: '2026-11-02',
          isToday: true,
          isFuture: false,
          realizedBalance: 2000,
          projectedBalance: 1950,
          projectedBalanceWithVariablePace: 1950,
        },
        {
          dateKey: '2026-11-03',
          isToday: false,
          isFuture: true,
          realizedBalance: null,
          projectedBalance: 1950,
          projectedBalanceWithVariablePace: 1930,
        },
      ],
      days: [
        {
          dateKey: '2026-11-01',
          isToday: false,
          isPast: true,
          isFuture: false,
          netRealized: 2000,
          netPlanned: 0,
          netTotal: 2000,
          events: [
            {
              id: 'env_1',
              kind: 'envelope',
              pillar: 'income',
              dateKey: '2026-11-01',
              originalDate: '2026-11-01T12:00:00.000Z',
              label: 'Salaire',
              amount: 2000,
              emoji: '💵',
              color: '#22C55E',
              isPaid: true,
              isOverdue: false,
              envelopeId: 'env1',
              paidByUserId: null,
              paidByUser: null,
            },
          ],
        },
        {
          dateKey: '2026-11-02',
          isToday: true,
          isPast: false,
          isFuture: false,
          netRealized: 0,
          netPlanned: -50,
          netTotal: -50,
          events: [
            {
              id: 'env_2',
              kind: 'envelope',
              pillar: 'fixed_charge',
              dateKey: '2026-11-02',
              originalDate: '2026-11-02T12:00:00.000Z',
              label: 'Internet',
              amount: 50,
              emoji: '🌐',
              color: '#8B5CF6',
              isPaid: false,
              isOverdue: false,
              envelopeId: 'env2',
              paidByUserId: null,
              paidByUser: null,
            },
          ],
        },
        {
          dateKey: '2026-11-03',
          isToday: false,
          isPast: false,
          isFuture: true,
          netRealized: 0,
          netPlanned: 0,
          netTotal: 0,
          events: [],
        },
      ],
    });

    const updateSpy = vi
      .spyOn(envelopeService, 'updateEnvelope')
      .mockResolvedValue({} as never);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BudgetCalendarView periodId="p1" />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Trésorerie projetée sur le cycle')).toBeInTheDocument();
    expect(screen.getByText('Assurance Auto')).toBeInTheDocument();
    expect(screen.getByText('Prévu le 15/01/2027')).toBeInTheDocument();

    // Cliquer sur le 02/11/2026
    fireEvent.click(screen.getByLabelText('Jour 2026-11-02'));
    expect(await screen.findByText('Lundi 2 novembre 2026')).toBeInTheDocument();
    expect(screen.getByText('Internet')).toBeInTheDocument();

    // Pointer l'échéance en 1 tap
    fireEvent.click(screen.getByLabelText('Pointer comme payé'));
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('p1', 'env2', { isPaid: true });
    });
  });
});

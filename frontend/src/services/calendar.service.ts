import { apiClient } from './api';

export type CalendarPillar =
  | 'income'
  | 'fixed_charge'
  | 'variable_expense'
  | 'savings'
  | 'asset';

export interface CalendarMemberInfo {
  userId: string;
  displayName: string;
  avatarEmoji: string;
  color: string;
}

export interface CalendarEvent {
  id: string;
  kind: 'transaction' | 'envelope';
  pillar: CalendarPillar;
  dateKey: string;
  originalDate: string;
  label: string;
  amount: number;
  emoji: string;
  color: string;
  isPaid: boolean;
  isOverdue: boolean;
  envelopeId: string;
  paidByUserId: string | null;
  paidByUser: CalendarMemberInfo | null;
  recurrenceFrequency?: 'monthly' | 'quarterly' | 'semiannual' | 'yearly';
}

export interface CalendarDay {
  dateKey: string;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  events: CalendarEvent[];
  netRealized: number;
  netPlanned: number;
  netTotal: number;
}

export interface CashFlowPoint {
  dateKey: string;
  isToday: boolean;
  isFuture: boolean;
  realizedBalance: number | null;
  projectedBalance: number;
  projectedBalanceWithVariablePace: number;
}

export interface UpcomingPeriodicItem {
  envelopeId: string;
  label: string;
  pillar: CalendarPillar;
  amount: number;
  emoji: string;
  color: string;
  recurrenceFrequency: 'quarterly' | 'semiannual' | 'yearly';
  nextDateKey: string;
}

export interface PeriodCalendarData {
  periodId: string;
  budgetId: string;
  startDateKey: string;
  endDateKey: string;
  todayKey: string;
  days: CalendarDay[];
  cashFlowCurve: CashFlowPoint[];
  upcomingPeriodic: UpcomingPeriodicItem[];
  members: CalendarMemberInfo[];
  dailyVariablePace: number;
}

export function formatDateKeyDDMMYYYY(dateKey: string): string {
  const parts = dateKey.split('-');
  if (parts.length !== 3) return dateKey;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatDateKeyLongFr(dateKey: string): string {
  const parts = dateKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateKey;
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const formatted = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export async function fetchPeriodCalendar(periodId: string): Promise<PeriodCalendarData> {
  const { data } = await apiClient.get<{ status: string; calendar: PeriodCalendarData }>(
    `/periods/${periodId}/calendar`
  );
  return data.calendar;
}

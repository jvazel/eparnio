import { AssetAccountModel } from '../models/AssetAccount.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel, type IEnvelope } from '../models/Envelope.model';
import { TransactionModel, type ITransaction } from '../models/Transaction.model';
import { UserModel } from '../models/User.model';
import { assertPeriodAccess } from './budgetAccess.service';
import { roundCurrency } from './zeroBasedBudget.service';

const MS_PER_DAY = 86_400_000;

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

export interface PeriodCalendarResponse {
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

export function toUtcDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

export function clampDateWithShortMonth(year: number, monthIndex0: number, day: number): Date {
  const lastDayOfMonth = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
  const safeDay = Math.min(Math.max(1, day), lastDayOfMonth);
  return new Date(Date.UTC(year, monthIndex0, safeDay));
}

function addMonthsClamped(baseDate: Date, monthsToAdd: number, anchorDay: number): Date {
  const totalMonths = baseDate.getUTCFullYear() * 12 + baseDate.getUTCMonth() + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = totalMonths % 12;
  return clampDateWithShortMonth(targetYear, targetMonth, anchorDay);
}

function getSignedAmount(pillar: CalendarPillar, amount: number): number {
  if (pillar === 'asset') return 0;
  return pillar === 'income' ? amount : -amount;
}

export async function getPeriodCalendar(
  periodId: string,
  userId: string,
  referenceDate: Date = new Date()
): Promise<PeriodCalendarResponse> {
  const { budget } = await assertPeriodAccess(periodId, userId);

  const period = await BudgetPeriodModel.findById(periodId).lean();
  if (!period) {
    throw new Error('Période introuvable');
  }

  const startDate = new Date(period.startDate);
  const endDate = new Date(period.endDate);
  const startDateKey = toUtcDateKey(startDate);
  const endDateKey = toUtcDateKey(endDate);
  const todayKey = toUtcDateKey(referenceDate);

  const [envelopes, transactions, assetAccounts] = await Promise.all([
    EnvelopeModel.find({ budgetPeriodId: periodId }).lean<IEnvelope[]>(),
    TransactionModel.find({ budgetPeriodId: periodId }).lean<ITransaction[]>(),
    AssetAccountModel.find({ budgetId: period.budgetId }).lean(),
  ]);

  const memberIds = Array.from(
    new Set([
      ...(budget.members?.map((m) => String(m.userId)) ?? []),
      ...transactions.map((t) => (t.paidByUserId ? String(t.paidByUserId) : '')).filter(Boolean),
      ...envelopes.map((e) => (e.memberId ? String(e.memberId) : '')).filter(Boolean),
    ])
  );

  const users = memberIds.length
    ? await UserModel.find({ _id: { $in: memberIds } })
        .select('_id displayName avatarEmoji color')
        .lean()
    : [];

  const memberMap = new Map<string, CalendarMemberInfo>();
  for (const u of users) {
    const id = String(u._id);
    memberMap.set(id, {
      userId: id,
      displayName: u.displayName || 'Membre',
      avatarEmoji: u.avatarEmoji || '👤',
      color: '#7C3AED',
    });
  }

  const envelopeById = new Map<string, IEnvelope>();
  for (const env of envelopes) {
    envelopeById.set(String(env._id), env);
  }

  const events: CalendarEvent[] = [];

  // 1. Transactions réalisées (variables ou versements)
  for (const tx of transactions) {
    const env = envelopeById.get(String(tx.envelopeId));
    const rawDate = tx.date ? new Date(tx.date) : startDate;
    let dateKey = toUtcDateKey(rawDate);
    if (dateKey < startDateKey) dateKey = startDateKey;
    if (dateKey > endDateKey) dateKey = endDateKey;

    const paidById = tx.paidByUserId ? String(tx.paidByUserId) : null;
    const pillar: CalendarPillar =
      env?.pillar === 'savings' ? 'savings' : 'variable_expense';

    events.push({
      id: `tx_${String(tx._id)}`,
      kind: 'transaction',
      pillar,
      dateKey,
      originalDate: rawDate.toISOString(),
      label: tx.label || env?.name || 'Dépense',
      amount: roundCurrency(tx.amount),
      emoji: env?.icon || '💸',
      color: env?.color || '#3B82F6',
      isPaid: true,
      isOverdue: false,
      envelopeId: String(tx.envelopeId),
      paidByUserId: paidById,
      paidByUser: paidById ? memberMap.get(paidById) ?? null : null,
    });
  }

  // 2. Enveloppes de type income, fixed_charge, savings (si montant > 0 et non gérées uniquement par transactions)
  for (const env of envelopes) {
    if (env.pillar === 'variable_envelope') continue;
    const amount = roundCurrency(env.allocatedAmount || 0);
    if (amount <= 0) continue;

    const rawDate = env.date ? new Date(env.date) : startDate;
    let dateKey = toUtcDateKey(rawDate);
    if (dateKey < startDateKey) dateKey = startDateKey;
    if (dateKey > endDateKey) dateKey = endDateKey;

    const isPaid = Boolean(env.isPaid);
    const isOverdue = !isPaid && dateKey < todayKey;
    const paidById = env.memberId ? String(env.memberId) : null;

    events.push({
      id: `env_${String(env._id)}`,
      kind: 'envelope',
      pillar: env.pillar as CalendarPillar,
      dateKey,
      originalDate: rawDate.toISOString(),
      label: env.name,
      amount,
      emoji: env.icon || (env.pillar === 'income' ? '💵' : '📌'),
      color: env.color || (env.pillar === 'income' ? '#22C55E' : '#8B5CF6'),
      isPaid,
      isOverdue,
      envelopeId: String(env._id),
      paidByUserId: paidById,
      paidByUser: paidById ? memberMap.get(paidById) ?? null : null,
      recurrenceFrequency: env.recurrenceFrequency as CalendarEvent['recurrenceFrequency'],
    });
  }

  // 3. Opérations patrimoniales dans la fenêtre du cycle (hors budget_period et savings_goal pour éviter les doublons)
  for (const acc of assetAccounts) {
    for (const op of acc.operations ?? []) {
      if (op.counterpartyType === 'budget_period' || op.counterpartyType === 'savings_goal') continue;
      if (op.type === 'set') continue;
      const opDate = new Date(op.date);
      const dateKey = toUtcDateKey(opDate);
      if (dateKey < startDateKey || dateKey > endDateKey) continue;

      events.push({
        id: `asset_${String(acc._id)}_${String(op._id ?? dateKey)}`,
        kind: 'transaction',
        pillar: 'asset',
        dateKey,
        originalDate: opDate.toISOString(),
        label: `${acc.name} — ${op.label}`,
        amount: roundCurrency(op.amount),
        emoji: acc.icon || '🏦',
        color: acc.color || '#06B6D4',
        isPaid: true,
        isOverdue: false,
        envelopeId: String(acc._id),
        paidByUserId: null,
        paidByUser: null,
      });
    }
  }

  // Regrouper les événements par dateKey
  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const list = eventsByDay.get(ev.dateKey) ?? [];
    list.push(ev);
    eventsByDay.set(ev.dateKey, list);
  }

  // Construire tous les jours du cycle
  const days: CalendarDay[] = [];
  const totalDays = Math.max(
    1,
    Math.round(
      (Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()) -
        Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate())) /
        MS_PER_DAY
    ) + 1
  );

  for (let i = 0; i < totalDays; i++) {
    const current = addUtcDays(startDate, i);
    const dateKey = toUtcDateKey(current);
    const dayEvents = eventsByDay.get(dateKey) ?? [];

    let netRealized = 0;
    let netPlanned = 0;
    for (const ev of dayEvents) {
      const signed = getSignedAmount(ev.pillar, ev.amount);
      if (ev.isPaid) {
        netRealized += signed;
      } else {
        netPlanned += signed;
      }
    }

    days.push({
      dateKey,
      isToday: dateKey === todayKey,
      isPast: dateKey < todayKey,
      isFuture: dateKey > todayKey,
      events: dayEvents,
      netRealized: roundCurrency(netRealized),
      netPlanned: roundCurrency(netPlanned),
      netTotal: roundCurrency(netRealized + netPlanned),
    });
  }

  // Calcul du rythme quotidien des enveloppes variables restantes
  let totalVariableAllocated = 0;
  let totalVariableSpent = 0;
  for (const env of envelopes) {
    if (env.pillar === 'variable_envelope') {
      totalVariableAllocated += env.allocatedAmount || 0;
      totalVariableSpent += env.spentOrPaidAmount || 0;
    }
  }
  const remainingVariableBudget = Math.max(0, totalVariableAllocated - totalVariableSpent);
  const futureDaysCount = days.filter((d) => d.isFuture).length;
  const dailyVariablePace =
    futureDaysCount > 0 ? roundCurrency(remainingVariableBudget / futureDaysCount) : 0;

  // Somme des échéances en retard (imputées dès aujourd'hui sur la courbe projetée)
  let overdueNet = 0;
  for (const ev of events) {
    if (ev.isOverdue) {
      overdueNet += getSignedAmount(ev.pillar, ev.amount);
    }
  }

  // Courbe journalière de trésorerie
  const cashFlowCurve: CashFlowPoint[] = [];
  let runningRealized = 0;
  let runningProjected = 0;
  let runningProjectedWithPace = 0;
  let overdueApplied = false;

  for (const day of days) {
    runningRealized = roundCurrency(runningRealized + day.netRealized);

    if (day.dateKey <= todayKey) {
      runningProjected = runningRealized;
      runningProjectedWithPace = runningRealized;

      if (day.dateKey === todayKey && !overdueApplied) {
        runningProjected = roundCurrency(runningProjected + overdueNet);
        runningProjectedWithPace = roundCurrency(runningProjectedWithPace + overdueNet);
        overdueApplied = true;
      }

      cashFlowCurve.push({
        dateKey: day.dateKey,
        isToday: day.isToday,
        isFuture: false,
        realizedBalance: runningRealized,
        projectedBalance: runningProjected,
        projectedBalanceWithVariablePace: runningProjectedWithPace,
      });
    } else {
      if (!overdueApplied) {
        runningProjected = roundCurrency(runningProjected + overdueNet);
        runningProjectedWithPace = roundCurrency(runningProjectedWithPace + overdueNet);
        overdueApplied = true;
      }

      runningProjected = roundCurrency(runningProjected + day.netRealized + day.netPlanned);
      runningProjectedWithPace = roundCurrency(
        runningProjectedWithPace + day.netRealized + day.netPlanned - dailyVariablePace
      );

      cashFlowCurve.push({
        dateKey: day.dateKey,
        isToday: false,
        isFuture: true,
        realizedBalance: null,
        projectedBalance: runningProjected,
        projectedBalanceWithVariablePace: runningProjectedWithPace,
      });
    }
  }

  // 4. Échéances périodiques futures hors cycle (quarterly, semiannual, yearly) sur les 3 prochains mois
  const horizonDate = addMonthsClamped(endDate, 3, endDate.getUTCDate());
  const horizonKey = toUtcDateKey(horizonDate);
  const upcomingPeriodic: UpcomingPeriodicItem[] = [];

  for (const env of envelopes) {
    const freq = env.recurrenceFrequency;
    if (!env.isRecurring || !freq || freq === 'monthly') continue;

    const monthsStep = freq === 'quarterly' ? 3 : freq === 'semiannual' ? 6 : 12;
    const baseDate = env.date ? new Date(env.date) : startDate;
    const anchorDay = baseDate.getUTCDate();

    let nextDate = addMonthsClamped(baseDate, monthsStep, anchorDay);
    while (toUtcDateKey(nextDate) <= endDateKey) {
      nextDate = addMonthsClamped(nextDate, monthsStep, anchorDay);
    }

    const nextKey = toUtcDateKey(nextDate);
    if (nextKey > endDateKey && nextKey <= horizonKey) {
      upcomingPeriodic.push({
        envelopeId: String(env._id),
        label: env.name,
        pillar: env.pillar as CalendarPillar,
        amount: roundCurrency(env.allocatedAmount || 0),
        emoji: env.icon || '📅',
        color: env.color || '#8B5CF6',
        recurrenceFrequency: freq,
        nextDateKey: nextKey,
      });
    }
  }

  upcomingPeriodic.sort((a, b) => a.nextDateKey.localeCompare(b.nextDateKey));

  return {
    periodId: String(period._id),
    budgetId: String(period.budgetId),
    startDateKey,
    endDateKey,
    todayKey,
    days,
    cashFlowCurve,
    upcomingPeriodic,
    members: Array.from(memberMap.values()),
    dailyVariablePace,
  };
}

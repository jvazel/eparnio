import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { BudgetModel } from '../models/Budget.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { TransactionModel } from '../models/Transaction.model';
import { UserModel } from '../models/User.model';
import { clampDateWithShortMonth, getPeriodCalendar, toUtcDateKey } from '../services/calendar.service';

describe('Vue Calendrier & Trésorerie Prévisionnelle (/api/periods/:periodId/calendar)', () => {
  const app = createApp();
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    await TransactionModel.deleteMany({});
    await EnvelopeModel.deleteMany({});
    await BudgetPeriodModel.deleteMany({});
    await BudgetModel.deleteMany({});
    await UserModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('gère les fins de mois courtes (29/30/31) et le formatage UTC YYYY-MM-DD', () => {
    const febNonLeap = clampDateWithShortMonth(2025, 1, 31);
    expect(toUtcDateKey(febNonLeap)).toBe('2025-02-28');

    const febLeap = clampDateWithShortMonth(2024, 1, 31);
    expect(toUtcDateKey(febLeap)).toBe('2024-02-29');
  });

  it('rejette une requête non authentifiée (401)', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/periods/${fakeId}/calendar`);
    expect(res.status).toBe(401);
  });

  it('agrège réalisé, à venir, en retard, courbe de trésorerie et échéances périodiques', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({
      email: 'calendar@eparnio.fr',
      password: 'Password123!',
      displayName: 'Camille',
    });
    expect(registerRes.status).toBe(201);
    const token = registerRes.body.token as string;
    const userId = registerRes.body.user.id as string;

    const budget = await BudgetModel.create({
      name: 'Budget Perso',
      type: 'personal',
      ownerId: userId,
      budgetStartDay: 1,
      members: [{ userId, role: 'owner' }],
    });

    const period = await BudgetPeriodModel.create({
      budgetId: budget._id,
      year: 2026,
      month: 11,
      label: 'Novembre 2026',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      endDate: new Date('2026-11-30T23:59:59.999Z'),
    });

    // Revenu déjà perçu le 01/11
    await EnvelopeModel.create({
      budgetPeriodId: period._id,
      budgetId: budget._id,
      pillar: 'income',
      name: 'Salaire',
      icon: '💵',
      color: '#22C55E',
      allocatedAmount: 3000,
      spentOrPaidAmount: 0,
      isPaid: true,
      date: new Date('2026-11-01T12:00:00.000Z'),
      memberId: userId,
    });

    // Charge fixe en retard (prévue le 05/11, isPaid: false, alors qu'on est le 10/11)
    await EnvelopeModel.create({
      budgetPeriodId: period._id,
      budgetId: budget._id,
      pillar: 'fixed_charge',
      name: 'Internet',
      icon: '🌐',
      color: '#8B5CF6',
      allocatedAmount: 40,
      spentOrPaidAmount: 0,
      isPaid: false,
      date: new Date('2026-11-05T12:00:00.000Z'),
    });

    // Charge fixe à venir le 20/11
    await EnvelopeModel.create({
      budgetPeriodId: period._id,
      budgetId: budget._id,
      pillar: 'fixed_charge',
      name: 'Loyer',
      icon: '🏠',
      color: '#8B5CF6',
      allocatedAmount: 900,
      spentOrPaidAmount: 0,
      isPaid: false,
      date: new Date('2026-11-20T12:00:00.000Z'),
    });

    // Charge trimestrielle récurrente (prochaine échéance dans les 3 mois)
    await EnvelopeModel.create({
      budgetPeriodId: period._id,
      budgetId: budget._id,
      pillar: 'fixed_charge',
      name: 'Eau Trimestrielle',
      icon: '💧',
      color: '#38BDF8',
      allocatedAmount: 120,
      spentOrPaidAmount: 0,
      isPaid: true,
      isRecurring: true,
      recurrenceFrequency: 'quarterly',
      date: new Date('2026-11-15T12:00:00.000Z'),
    });

    // Enveloppe variable + transaction le 08/11
    const coursesEnv = await EnvelopeModel.create({
      budgetPeriodId: period._id,
      budgetId: budget._id,
      pillar: 'variable_envelope',
      name: 'Courses',
      icon: '🛒',
      color: '#3B82F6',
      allocatedAmount: 400,
      spentOrPaidAmount: 100,
    });

    await TransactionModel.create({
      budgetPeriodId: period._id,
      budgetId: budget._id,
      envelopeId: coursesEnv._id,
      amount: 100,
      label: 'Supermarché',
      date: new Date('2026-11-08T12:00:00.000Z'),
      authorId: userId,
      paidByUserId: userId,
    });

    const refIso = '2026-11-10T10:00:00.000Z';
    const res = await request(app)
      .get(`/api/periods/${String(period._id)}/calendar?referenceDate=${encodeURIComponent(refIso)}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');

    const cal = res.body.calendar;
    expect(cal.startDateKey).toBe('2026-11-01');
    expect(cal.endDateKey).toBe('2026-11-30');
    expect(cal.todayKey).toBe('2026-11-10');
    expect(cal.days).toHaveLength(30);

    // Vérifier l'échéance en retard du 05/11
    const day05 = cal.days.find((d: { dateKey: string }) => d.dateKey === '2026-11-05');
    expect(day05.events).toHaveLength(1);
    expect(day05.events[0].isOverdue).toBe(true);
    expect(day05.events[0].isPaid).toBe(false);

    // Vérifier la courbe au 10/11 (3000 - 100 = 2900 réalisé, - 40 retard = 2860 projeté)
    const point10 = cal.cashFlowCurve.find((p: { dateKey: string }) => p.dateKey === '2026-11-10');
    expect(point10.realizedBalance).toBe(2900);
    expect(point10.projectedBalance).toBe(2860);

    // Vérifier la courbe au 30/11 (2740 - 900 loyer = 1840 projeté)
    const point30 = cal.cashFlowCurve.find((p: { dateKey: string }) => p.dateKey === '2026-11-30');
    expect(point30.realizedBalance).toBeNull();
    expect(point30.projectedBalance).toBe(1840);

    // Vérifier les échéances périodiques futures (Eau Trimestrielle -> 2027-02-15)
    expect(cal.upcomingPeriodic).toHaveLength(1);
    expect(cal.upcomingPeriodic[0].label).toBe('Eau Trimestrielle');
    expect(cal.upcomingPeriodic[0].nextDateKey).toBe('2027-02-15');
  });

  it('refuse l accès si l utilisateur n est pas membre du budget', async () => {
    const user1 = await UserModel.create({
      email: 'u1@eparnio.fr',
      passwordHash: 'hash',
      displayName: 'U1',
    });
    const user2 = await UserModel.create({
      email: 'u2@eparnio.fr',
      passwordHash: 'hash',
      displayName: 'U2',
    });
    const budget = await BudgetModel.create({
      name: 'Perso U1',
      type: 'personal',
      ownerId: user1._id,
      budgetStartDay: 1,
      members: [{ userId: user1._id, role: 'owner' }],
    });
    const period = await BudgetPeriodModel.create({
      budgetId: budget._id,
      year: 2026,
      month: 11,
      label: 'Novembre 2026',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      endDate: new Date('2026-11-30T23:59:59.999Z'),
    });

    await expect(getPeriodCalendar(String(period._id), String(user2._id))).rejects.toThrow();
  });
});

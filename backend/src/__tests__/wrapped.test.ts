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

describe('Bilan Annuel Eparnio Wrapped (/api/budgets/:budgetId/wrapped)', () => {
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

  it('rejette une requête non authentifiée (401)', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/budgets/${fakeId}/wrapped`);
    expect(res.status).toBe(401);
  });

  it('agrège les statistiques annuelles, availableYears et gère une année vide', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: 'wrapped@eparnio.fr',
      password: 'Password123!',
      displayName: 'Sam',
    });
    expect(reg.status).toBe(201);
    const token = reg.body.token as string;
    const userId = reg.body.user.id as string;

    const budget = await BudgetModel.create({
      name: 'Budget Sam',
      type: 'personal',
      ownerId: userId,
      budgetStartDay: 1,
      members: [{ userId, role: 'owner' }],
    });

    const p2025 = await BudgetPeriodModel.create({
      budgetId: budget._id,
      year: 2025,
      month: 12,
      label: 'Décembre 2025',
      startDate: new Date('2025-12-01T00:00:00.000Z'),
      endDate: new Date('2025-12-31T23:59:59.999Z'),
      summary: {
        plannedIncome: 2000,
        plannedFixedCharges: 800,
        plannedVariableEnvelopes: 500,
        plannedSavings: 200,
        actualVariableSpent: 400,
        remainingToAllocate: 0,
        remainingToLive: 600,
      },
    });

    await EnvelopeModel.create({
      budgetId: budget._id,
      budgetPeriodId: p2025._id,
      pillar: 'income',
      name: 'Salaire',
      icon: '💵',
      color: '#22C55E',
      allocatedAmount: 2000,
      spentOrPaidAmount: 0,
    });

    await EnvelopeModel.create({
      budgetId: budget._id,
      budgetPeriodId: p2025._id,
      pillar: 'savings',
      name: 'Livret A',
      icon: '🐷',
      color: '#06B6D4',
      allocatedAmount: 200,
      spentOrPaidAmount: 0,
    });

    await EnvelopeModel.create({
      budgetId: budget._id,
      budgetPeriodId: p2025._id,
      pillar: 'variable_envelope',
      name: 'Courses',
      icon: '🛒',
      color: '#3B82F6',
      allocatedAmount: 500,
      spentOrPaidAmount: 400,
    });

    const res2025 = await request(app)
      .get(`/api/budgets/${String(budget._id)}/wrapped?year=2025`)
      .set('Authorization', `Bearer ${token}`);

    expect(res2025.status).toBe(200);
    const w = res2025.body.wrapped;
    expect(w.year).toBe(2025);
    expect(w.availableYears).toEqual([2025]);
    expect(w.macro.totalIncome).toBe(2000);
    expect(w.macro.totalSaved).toBe(200);
    expect(w.macro.savingsRate).toBe(10);
    expect(w.highlights.zeroBasedScore).toBe(1);
    expect(w.highlights.bestMonth.label).toBe('Décembre 2025');
    expect(w.highlights.topEnvelopes[0].name).toBe('Courses');

    // Année vide
    const res2024 = await request(app)
      .get(`/api/budgets/${String(budget._id)}/wrapped?year=2024`)
      .set('Authorization', `Bearer ${token}`);
    expect(res2024.status).toBe(200);
    expect(res2024.body.wrapped.periodsCount).toBe(0);
  });
});

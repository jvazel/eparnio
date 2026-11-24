import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { BudgetModel } from '../models/Budget.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { UserModel } from '../models/User.model';
import { calculateVariance } from '../services/fixedChargeVariance.service';

describe('Détecteur d écarts & Hausses d abonnements', () => {
  const app = createApp();
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    await EnvelopeModel.deleteMany({});
    await BudgetPeriodModel.deleteMany({});
    await BudgetModel.deleteMany({});
    await UserModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('calcule les hausses, baisses et ignore les écarts < 0.01 €', () => {
    expect(calculateVariance(50, 50.004)).toBeNull();
    expect(calculateVariance(55, 50)).toEqual({
      previousAmount: 50,
      deltaAmount: 5,
      deltaPercent: 10,
    });
    expect(calculateVariance(40, 50)).toEqual({
      previousAmount: 50,
      deltaAmount: -10,
      deltaPercent: -20,
    });
  });

  it('expose variance sur GET /envelopes et fixedChargesVarianceSummary sur GET /analytics', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: 'variance@eparnio.fr',
      password: 'Password123!',
      displayName: 'Léo',
    });
    const token = reg.body.token as string;
    const userId = reg.body.user.id as string;

    const budget = await BudgetModel.create({
      name: 'Perso',
      type: 'personal',
      ownerId: userId,
      budgetStartDay: 1,
      members: [{ userId, role: 'owner' }],
    });

    const pPrev = await BudgetPeriodModel.create({
      budgetId: budget._id,
      year: 2026,
      month: 10,
      label: 'Octobre 2026',
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      endDate: new Date('2026-10-31T23:59:59.999Z'),
    });

    const pCurr = await BudgetPeriodModel.create({
      budgetId: budget._id,
      year: 2026,
      month: 11,
      label: 'Novembre 2026',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      endDate: new Date('2026-11-30T23:59:59.999Z'),
    });

    const prevNetflix = await EnvelopeModel.create({
      budgetId: budget._id,
      budgetPeriodId: pPrev._id,
      pillar: 'fixed_charge',
      name: 'Netflix',
      icon: '🍿',
      color: '#EF4444',
      allocatedAmount: 13.99,
      spentOrPaidAmount: 0,
    });

    await EnvelopeModel.create({
      budgetId: budget._id,
      budgetPeriodId: pCurr._id,
      pillar: 'fixed_charge',
      name: 'Netflix',
      icon: '🍿',
      color: '#EF4444',
      allocatedAmount: 15.99,
      spentOrPaidAmount: 0,
      previousEnvelopeId: prevNetflix._id,
    });

    const envRes = await request(app)
      .get(`/api/periods/${String(pCurr._id)}/envelopes`)
      .set('Authorization', `Bearer ${token}`);
    expect(envRes.status).toBe(200);
    expect(envRes.body.envelopes[0].variance).toEqual({
      previousAmount: 13.99,
      deltaAmount: 2,
      deltaPercent: 14.3,
    });

    const analyticsRes = await request(app)
      .get(`/api/periods/${String(pCurr._id)}/analytics`)
      .set('Authorization', `Bearer ${token}`);
    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.analytics.fixedChargesVarianceSummary.netDelta).toBe(2);
    expect(analyticsRes.body.analytics.fixedChargesVarianceSummary.increasesCount).toBe(1);
  });
});

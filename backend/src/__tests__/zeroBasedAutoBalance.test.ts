import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { BudgetModel } from '../models/Budget.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { UserModel } from '../models/User.model';

describe('Assistant d équilibrage Base Zéro en 1 Tap', () => {
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

  it('suggère et applique un équilibrage en cas de surplus ou de déficit', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: 'autobalance@eparnio.fr',
      password: 'Password123!',
      displayName: 'Nina',
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

    const period = await BudgetPeriodModel.create({
      budgetId: budget._id,
      year: 2026,
      month: 11,
      label: 'Novembre 2026',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      endDate: new Date('2026-11-30T23:59:59.999Z'),
    });

    // Revenu 2000 €
    await EnvelopeModel.create({
      budgetId: budget._id,
      budgetPeriodId: period._id,
      pillar: 'income',
      name: 'Salaire',
      icon: '💵',
      color: '#22C55E',
      allocatedAmount: 2000,
      spentOrPaidAmount: 0,
    });

    // Charge fixe 1000 € (ne doit jamais être modifiée)
    await EnvelopeModel.create({
      budgetId: budget._id,
      budgetPeriodId: period._id,
      pillar: 'fixed_charge',
      name: 'Loyer',
      icon: '🏠',
      color: '#8B5CF6',
      allocatedAmount: 1000,
      spentOrPaidAmount: 0,
    });

    // Variable 500 € -> surplus de 500 €
    await EnvelopeModel.create({
      budgetId: budget._id,
      budgetPeriodId: period._id,
      pillar: 'variable_envelope',
      name: 'Courses',
      icon: '🛒',
      color: '#3B82F6',
      allocatedAmount: 500,
      spentOrPaidAmount: 0,
    });

    // Épargne 0 €
    const savingsEnv = await EnvelopeModel.create({
      budgetId: budget._id,
      budgetPeriodId: period._id,
      pillar: 'savings',
      name: 'Précaution',
      icon: '🐷',
      color: '#06B6D4',
      allocatedAmount: 0,
      spentOrPaidAmount: 0,
    });

    const sugRes = await request(app)
      .get(`/api/periods/${String(period._id)}/auto-balance/suggestion`)
      .set('Authorization', `Bearer ${token}`);

    expect(sugRes.status).toBe(200);
    expect(['surplus', 'deficit']).toContain(sugRes.body.suggestion.mode);
    expect(sugRes.body.suggestion.recommended).not.toBeNull();

    const rec = sugRes.body.suggestion.recommended;
    const applyRes = await request(app)
      .post(`/api/periods/${String(period._id)}/auto-balance/apply`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        targetEnvelopeId: rec.envelopeId,
        deltaAmount: rec.suggestedDelta,
      });

    expect(applyRes.status).toBe(200);
    expect(applyRes.body.result.summary.remainingToAllocate).toBe(0);
  });
});

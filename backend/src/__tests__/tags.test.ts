import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';

const app = createApp();
let mongoServer: MongoMemoryServer;

async function registerUser(email: string, firstName: string) {
  const res = await request(app).post('/api/auth/register').send({
    email,
    password: 'Password123',
    displayName: firstName,
    budgetStartDay: 1
  });
  const token = res.body.token as string;
  const budgetsRes = await request(app)
    .get('/api/budgets')
    .set('Authorization', `Bearer ${token}`);
  return {
    token,
    userId: res.body.user.id as string,
    budgetId: budgetsRes.body.budgets[0].id as string
  };
}

describe('Étape 36 — Tags Transversaux & Suivi Visuel (Backend)', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  });

  it('normalise les tags, filtre /search par tag et calcule /tags/summary + /tags/:tag/analytics', async () => {
    const user = await registerUser('tags@eparnio.fr', 'Léa');
    const budgetObjectId = new mongoose.Types.ObjectId(user.budgetId);

    const period = await BudgetPeriodModel.create({
      budgetId: budgetObjectId,
      month: 8,
      year: 2026,
      label: 'Août 2026',
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2026-08-31T23:59:59.000Z')
    });

    const envCourses = await EnvelopeModel.create({
      budgetId: budgetObjectId,
      budgetPeriodId: period._id,
      pillar: 'variable_envelope',
      name: 'Courses',
      icon: '🛒',
      color: '#22C55E',
      allocatedAmount: 400,
      date: new Date('2026-08-01T12:00:00.000Z')
    });

    const envTransport = await EnvelopeModel.create({
      budgetId: budgetObjectId,
      budgetPeriodId: period._id,
      pillar: 'variable_envelope',
      name: 'Transports',
      icon: '🚆',
      color: '#3B82F6',
      allocatedAmount: 200,
      date: new Date('2026-08-01T12:00:00.000Z')
    });

    const tx1 = await request(app)
      .post(`/api/periods/${period._id.toString()}/transactions`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        envelopeId: envCourses._id.toString(),
        amount: 60,
        label: 'Pique-nique plage',
        tags: ['#Vacances Été', 'remboursable']
      });
    expect(tx1.status).toBe(201);
    expect(tx1.body.transaction.tags).toEqual(['vacances-été', 'remboursable']);

    const tx2 = await request(app)
      .post(`/api/periods/${period._id.toString()}/transactions`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        envelopeId: envTransport._id.toString(),
        amount: 40,
        label: 'Billet train',
        tags: ['vacances-été']
      });
    expect(tx2.status).toBe(201);

    const searchRes = await request(app)
      .get(`/api/budgets/${user.budgetId}/search?tag=vacances-été`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.items).toHaveLength(2);

    const summaryRes = await request(app)
      .get(`/api/budgets/${user.budgetId}/tags/summary`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.tags[0]).toEqual({
      tag: 'vacances-été',
      totalAmount: 100,
      count: 2
    });

    const detailRes = await request(app)
      .get(`/api/budgets/${user.budgetId}/tags/${encodeURIComponent('vacances-été')}/analytics`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.analytics.totalAmount).toBe(100);
    expect(detailRes.body.analytics.byEnvelope).toHaveLength(2);
    expect(detailRes.body.analytics.byMonth).toHaveLength(1);
  });
});

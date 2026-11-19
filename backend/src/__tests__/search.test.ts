import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { TransactionModel } from '../models/Transaction.model';

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

describe('GET /api/budgets/:id/search', () => {
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

  it('retourne 401 sans authentification', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/budgets/${fakeId}/search?q=test`);
    expect(res.status).toBe(401);
  });

  it('retourne 404 si le budget n’appartient pas à l’utilisateur', async () => {
    const user1 = await registerUser('user1@eparnio.fr', 'Alice');
    const user2 = await registerUser('user2@eparnio.fr', 'Bob');

    const res = await request(app)
      .get(`/api/budgets/${user1.budgetId}/search?q=loyer`)
      .set('Authorization', `Bearer ${user2.token}`);

    expect(res.status).toBe(404);
  });

  it('recherche les transactions, notes, montants et enveloppes sur plusieurs mois', async () => {
    const user = await registerUser('search@eparnio.fr', 'Clara');
    const budgetObjectId = new mongoose.Types.ObjectId(user.budgetId);
    const userObjectId = new mongoose.Types.ObjectId(user.userId);

    const periodJuly = await BudgetPeriodModel.create({
      budgetId: budgetObjectId,
      month: 7,
      year: 2026,
      label: 'Juillet 2026',
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      endDate: new Date('2026-07-31T23:59:59.000Z')
    });

    const periodAug = await BudgetPeriodModel.create({
      budgetId: budgetObjectId,
      month: 8,
      year: 2026,
      label: 'Août 2026',
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2026-08-31T23:59:59.000Z')
    });

    const coursesEnv = await EnvelopeModel.create({
      budgetId: budgetObjectId,
      budgetPeriodId: periodJuly._id,
      pillar: 'variable_envelope',
      name: 'Courses',
      icon: '🛒',
      color: '#22C55E',
      allocatedAmount: 400,
      date: new Date('2026-07-01T12:00:00.000Z')
    });

    await EnvelopeModel.create({
      budgetId: budgetObjectId,
      budgetPeriodId: periodAug._id,
      pillar: 'fixed_charge',
      name: 'Loyer Appartement',
      icon: '🏠',
      color: '#3B82F6',
      allocatedAmount: 950,
      date: new Date('2026-08-02T12:00:00.000Z')
    });

    await EnvelopeModel.create({
      budgetId: budgetObjectId,
      budgetPeriodId: periodAug._id,
      pillar: 'income',
      name: 'Salaire Principal',
      icon: '💵',
      color: '#10B981',
      allocatedAmount: 2500,
      date: new Date('2026-08-01T12:00:00.000Z')
    });

    await TransactionModel.create({
      budgetId: budgetObjectId,
      budgetPeriodId: periodJuly._id,
      envelopeId: coursesEnv._id,
      type: 'expense',
      amount: 49.9,
      label: 'Boulangerie & Café',
      notes: 'Ticket avec garantie machine',
      date: new Date('2026-07-15T12:00:00.000Z'),
      authorId: userObjectId,
      paidByUserId: userObjectId
    });

    // Recherche par note
    const noteRes = await request(app)
      .get(`/api/budgets/${user.budgetId}/search?q=garantie&type=notes`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(noteRes.status).toBe(200);
    expect(noteRes.body.items).toHaveLength(1);
    expect(noteRes.body.items[0].title).toBe('Boulangerie & Café');
    expect(noteRes.body.items[0].month).toBe(7);

    // Recherche par montant
    const amountRes = await request(app)
      .get(`/api/budgets/${user.budgetId}/search?q=49,90`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(amountRes.status).toBe(200);
    expect(amountRes.body.items).toHaveLength(1);
    expect(amountRes.body.items[0].amount).toBe(49.9);

    // Filtre fixed_charge
    const fixedRes = await request(app)
      .get(`/api/budgets/${user.budgetId}/search?q=Loyer&type=fixed_charge`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(fixedRes.status).toBe(200);
    expect(fixedRes.body.items).toHaveLength(1);
    expect(fixedRes.body.items[0].kind).toBe('fixed_charge');
    expect(fixedRes.body.items[0].month).toBe(8);
  });
});

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
import { computeAgeOfMoneyFromFlows } from '../services/ageOfMoney.service';

describe('Service Âge de l’Argent (FIFO)', () => {
  it('retourne le statut learning si moins de 10 sorties ou aucun revenu perçu', () => {
    const noIncome = computeAgeOfMoneyFromFlows(
      [],
      Array.from({ length: 12 }, (_, idx) => ({
        amount: 20,
        date: new Date(Date.UTC(2026, 0, idx + 1))
      }))
    );
    expect(noIncome.ageDays).toBeNull();
    expect(noIncome.status).toBe('learning');
    expect(noIncome.inflowsCount).toBe(0);

    const tooFewOutflows = computeAgeOfMoneyFromFlows(
      [{ amount: 2000, date: new Date(Date.UTC(2026, 0, 1)) }],
      Array.from({ length: 5 }, (_, idx) => ({
        amount: 50,
        date: new Date(Date.UTC(2026, 0, idx + 2))
      }))
    );
    expect(tooFewOutflows.ageDays).toBeNull();
    expect(tooFewOutflows.status).toBe('learning');
    expect(tooFewOutflows.sampleSize).toBe(5);
    expect(tooFewOutflows.minSamples).toBe(10);
  });

  it('calcule correctement la moyenne FIFO sur 1 revenu et 10 dépenses (flux tendu < 15 j)', () => {
    const inflows = [{ amount: 2000, date: new Date(Date.UTC(2026, 0, 1)) }];
    // 10 dépenses de 100 € du 2 au 11 janvier -> âges de 1 à 10 jours -> moyenne = 5.5 -> arrondi 6
    const outflows = Array.from({ length: 10 }, (_, idx) => ({
      amount: 100,
      date: new Date(Date.UTC(2026, 0, idx + 2))
    }));

    const result = computeAgeOfMoneyFromFlows(inflows, outflows);
    expect(result.ageDays).toBe(6);
    expect(result.status).toBe('tight');
    expect(result.sampleSize).toBe(10);
    expect(result.deltaDays).toBeNull();
  });

  it('gère le chevauchement de 2 revenus consécutifs (moyenne pondérée) et le statut target_reached (≥ 30 j)', () => {
    // Revenu 1 : 1 000 € le 1er janvier ; Revenu 2 : 1 000 € le 1er février
    const inflows = [
      { amount: 1000, date: new Date(Date.UTC(2026, 0, 1)) },
      { amount: 1000, date: new Date(Date.UTC(2026, 1, 1)) }
    ];
    // 9 dépenses de 100 € le 15 février (consomment 900 € du 1er janv -> 45 j chacune)
    // 10e dépense de 200 € le 15 février : 100 € du 1er janv (45 j) + 100 € du 1er fév (14 j) -> 29.5 j
    // Moyenne sur les 10 = (9 * 45 + 29.5) / 10 = 43.45 -> 43 j
    const outflows = [
      ...Array.from({ length: 9 }, () => ({
        amount: 100,
        date: new Date(Date.UTC(2026, 1, 15))
      })),
      { amount: 200, date: new Date(Date.UTC(2026, 1, 15)) }
    ];

    const result = computeAgeOfMoneyFromFlows(inflows, outflows);
    expect(result.ageDays).toBe(43);
    expect(result.status).toBe('target_reached');
  });

  it('calcule le deltaDays lorsque au moins 20 sorties existent (fenêtre actuelle vs précédente)', () => {
    const inflows = [{ amount: 5000, date: new Date(Date.UTC(2026, 0, 1)) }];
    // 10 premières sorties à J+10, 10 suivantes à J+25 -> ageDays = 25, deltaDays = +15, status = growing
    const outflows = [
      ...Array.from({ length: 10 }, () => ({
        amount: 50,
        date: new Date(Date.UTC(2026, 0, 11))
      })),
      ...Array.from({ length: 10 }, () => ({
        amount: 50,
        date: new Date(Date.UTC(2026, 0, 26))
      }))
    ];

    const result = computeAgeOfMoneyFromFlows(inflows, outflows);
    expect(result.ageDays).toBe(25);
    expect(result.status).toBe('growing');
    expect(result.deltaDays).toBe(15);
  });
});

describe('API /api/periods/:periodId/analytics — exposition de ageOfMoney', () => {
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

  it('retourne ageOfMoney dans /analytics en ignorant les revenus/charges non pointés', async () => {
    const ownerRes = await request(app).post('/api/auth/register').send({
      email: 'age@eparnio.fr',
      password: 'Password123!',
      displayName: 'Alice',
      budgetStartDay: 1
    });
    const token = ownerRes.body.token as string;
    const budgetId = ownerRes.body.defaultBudget.id as string;

    const periodRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2026&month=2`)
      .set('Authorization', `Bearer ${token}`);
    const periodId = periodRes.body.period.id as string;

    // 1 revenu perçu le 1er février
    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'income',
        name: 'Salaire',
        allocatedAmount: 3000,
        date: '2026-02-01T12:00:00.000Z',
        isPaid: true
      });

    // 1 revenu NON perçu (doit être ignoré)
    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'income',
        name: 'Prime future',
        allocatedAmount: 500,
        date: '2026-01-01T12:00:00.000Z',
        isPaid: false
      });

    // 1 enveloppe variable + 10 dépenses le 21 février (20 jours après le 1er février)
    const envRes = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'variable_envelope',
        name: 'Courses',
        allocatedAmount: 600
      });
    const envelopeId = envRes.body.envelope.id as string;

    for (let i = 0; i < 10; i += 1) {
      await request(app)
        .post(`/api/periods/${periodId}/transactions`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          envelopeId,
          type: 'expense',
          amount: 25,
          label: `Achat ${i + 1}`,
          date: '2026-02-21T12:00:00.000Z'
        });
    }

    const analyticsRes = await request(app)
      .get(`/api/periods/${periodId}/analytics`)
      .set('Authorization', `Bearer ${token}`);

    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.analytics.ageOfMoney).toEqual({
      ageDays: 20,
      status: 'growing',
      sampleSize: 10,
      minSamples: 10,
      inflowsCount: 1,
      deltaDays: null
    });
  });
});

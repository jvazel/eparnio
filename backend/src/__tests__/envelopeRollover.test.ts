import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { computeEnvelopeRolloverAmount } from '../services/periodRollover.service';

const app = createApp();

describe('Rollover des Enveloppes Variables (Positif & Négatif)', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  it('calcule correctement le montant de report selon rolloverEnabled et rolloverMode', () => {
    expect(
      computeEnvelopeRolloverAmount({
        pillar: 'variable_envelope',
        allocatedAmount: 200,
        rolloverAmount: 0,
        spentOrPaidAmount: 150,
        rolloverEnabled: false,
        rolloverMode: 'positive_only'
      })
    ).toBe(0);

    expect(
      computeEnvelopeRolloverAmount({
        pillar: 'variable_envelope',
        allocatedAmount: 200,
        rolloverAmount: 50,
        spentOrPaidAmount: 180,
        rolloverEnabled: true,
        rolloverMode: 'positive_only'
      })
    ).toBe(70);

    expect(
      computeEnvelopeRolloverAmount({
        pillar: 'variable_envelope',
        allocatedAmount: 200,
        rolloverAmount: 0,
        spentOrPaidAmount: 235,
        rolloverEnabled: true,
        rolloverMode: 'positive_only'
      })
    ).toBe(0);

    expect(
      computeEnvelopeRolloverAmount({
        pillar: 'variable_envelope',
        allocatedAmount: 200,
        rolloverAmount: 0,
        spentOrPaidAmount: 235,
        rolloverEnabled: true,
        rolloverMode: 'both'
      })
    ).toBe(-35);
  });

  it('reporte le solde au mois suivant, préserve Base Zéro et propage les modifications rétroactives', async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      displayName: 'Claire',
      email: 'claire.rollover@eparnio.fr',
      password: 'Password123'
    });
    expect(regRes.status).toBe(201);
    const token = regRes.body.token as string;
    const budgetId = regRes.body.defaultBudget.id as string;

    // Période Janvier 2026
    const janRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2026&month=1`)
      .set('Authorization', `Bearer ${token}`);
    expect(janRes.status).toBe(200);
    const janPeriodId = janRes.body.period.id as string;

    // Revenu récurrent 1000 €
    await request(app)
      .post(`/api/periods/${janPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'income',
        name: 'Salaire',
        allocatedAmount: 1000,
        isRecurring: true
      });

    // Enveloppe Vacances (rollover positive_only) : 200 €
    const vacRes = await request(app)
      .post(`/api/periods/${janPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'variable_envelope',
        name: 'Vacances',
        allocatedAmount: 200,
        rolloverEnabled: true,
        rolloverMode: 'positive_only'
      });
    const vacJanId = vacRes.body.envelope.id as string;

    // Enveloppe Courses (rollover both) : 300 €
    const grocRes = await request(app)
      .post(`/api/periods/${janPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'variable_envelope',
        name: 'Courses',
        allocatedAmount: 300,
        rolloverEnabled: true,
        rolloverMode: 'both'
      });
    const grocJanId = grocRes.body.envelope.id as string;

    // Dépenses en Janvier : 120 € sur Vacances (reste +80 €), 340 € sur Courses (reste -40 €)
    await request(app)
      .post(`/api/periods/${janPeriodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ envelopeId: vacJanId, label: 'Billet train', amount: 120 });

    await request(app)
      .post(`/api/periods/${janPeriodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ envelopeId: grocJanId, label: 'Supermarché', amount: 340 });

    // Passage à Février 2026
    const febRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2026&month=2`)
      .set('Authorization', `Bearer ${token}`);
    expect(febRes.status).toBe(200);
    const febPeriod = febRes.body.period;

    const febEnvelopes = febRes.body.envelopes as Array<{
      id: string;
      name: string;
      rolloverAmount: number;
      previousEnvelopeId?: string;
    }>;
    const vacFeb = febEnvelopes.find((e) => e.name === 'Vacances');
    const grocFeb = febEnvelopes.find((e) => e.name === 'Courses');

    expect(vacFeb?.rolloverAmount).toBe(80);
    expect(vacFeb?.previousEnvelopeId).toBe(vacJanId);
    expect(grocFeb?.rolloverAmount).toBe(-40);
    expect(grocFeb?.previousEnvelopeId).toBe(grocJanId);

    // Modification rétroactive en Janvier (+30 € sur Vacances -> reste +50 €)
    await request(app)
      .post(`/api/periods/${janPeriodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ envelopeId: vacJanId, label: 'Assurance voyage', amount: 30 });

    const febAfterRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2026&month=2`)
      .set('Authorization', `Bearer ${token}`);
    const vacFebAfter = (febAfterRes.body.envelopes as Array<{ name: string; rolloverAmount: number }>).find(
      (e) => e.name === 'Vacances'
    );
    expect(vacFebAfter?.rolloverAmount).toBe(50);
  });
});

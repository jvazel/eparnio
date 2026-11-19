import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { computeMedian } from '../services/anomalyDetection.service';

const app = createApp();
let mongoServer: MongoMemoryServer;

describe('Étape 34 — Détection des Dépenses Atypiques (Backend)', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('calcule correctement la médiane', () => {
    expect(computeMedian([])).toBe(0);
    expect(computeMedian([10, 30, 20])).toBe(20);
    expect(computeMedian([10, 20, 30, 40])).toBe(25);
  });

  it('détecte les anomalies sur une période et permet de les acquitter', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: 'anomalies@eparnio.fr',
      password: 'Password123!',
      displayName: 'Nina',
      budgetStartDay: 1
    });
    const token = (reg.body.accessToken ?? reg.body.token) as string;

    const budgetRes = await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Budget Perso', type: 'personal' });
    const budgetId = (budgetRes.body.budget?.id ?? budgetRes.body.id) as string;

    const periodRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/current`)
      .set('Authorization', `Bearer ${token}`);
    const periodId = (periodRes.body.period?.id ?? periodRes.body.id) as string;

    const envRes = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Courses', pillar: 'variable_envelope', allocatedAmount: 300 });
    const envId = (envRes.body.envelope?.id ?? envRes.body.id) as string;

    // 5 petites dépenses normales (~20 €) + 1 grosse dépense atypique (180 € > 50% du budget)
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post(`/api/periods/${periodId}/transactions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ envelopeId: envId, amount: 20, label: 'Boulangerie' });
    }

    const bigTxRes = await request(app)
      .post(`/api/periods/${periodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ envelopeId: envId, amount: 180, label: 'Épicerie Fine' });
    const bigTxId = bigTxRes.body.transaction.id as string;

    const anomaliesRes = await request(app)
      .get(`/api/periods/${periodId}/transactions/anomalies`)
      .set('Authorization', `Bearer ${token}`);

    expect(anomaliesRes.status).toBe(200);
    expect(anomaliesRes.body.anomalies.length).toBeGreaterThanOrEqual(1);
    expect(anomaliesRes.body.anomalies[0]).toMatchObject({
      transactionId: bigTxId,
      label: 'Épicerie Fine',
      severity: 'warning'
    });
    expect(anomaliesRes.body.envelopeThresholds[envId].warningThreshold).toBe(40);

    // Acquitter l'alerte
    const dismissRes = await request(app)
      .patch(`/api/periods/${periodId}/transactions/${bigTxId}/dismiss-anomaly`)
      .set('Authorization', `Bearer ${token}`);
    expect(dismissRes.status).toBe(200);

    const anomaliesAfter = await request(app)
      .get(`/api/periods/${periodId}/transactions/anomalies`)
      .set('Authorization', `Bearer ${token}`);
    expect(
      anomaliesAfter.body.anomalies.some((a: { transactionId: string }) => a.transactionId === bigTxId)
    ).toBe(false);
  });
});

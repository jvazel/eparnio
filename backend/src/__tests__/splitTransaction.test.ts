import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';

const app = createApp();
let mongoServer: MongoMemoryServer;

describe('Étape 33 — Fractionnement de Ticket (Split Transaction)', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('crée un ticket fractionné, nettoie le splitGroupId orphelin en scope=single et supprime tout en scope=group', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: 'split@eparnio.fr',
      password: 'Password123!',
      displayName: 'Léo',
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

    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Salaire', pillar: 'income', allocatedAmount: 2000 });

    const env1Res = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Courses', pillar: 'variable_envelope', allocatedAmount: 300 });
    const env1Id = (env1Res.body.envelope?.id ?? env1Res.body.id) as string;

    const env2Res = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Maison', pillar: 'variable_envelope', allocatedAmount: 200 });
    const env2Id = (env2Res.body.envelope?.id ?? env2Res.body.id) as string;

    // 1. Créer un ticket fractionné de 100 € (70 € Courses + 30 € Maison)
    const splitRes = await request(app)
      .post(`/api/periods/${periodId}/transactions/split`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'Leclerc',
        date: '2026-11-12',
        parts: [
          { envelopeId: env1Id, amount: 70 },
          { envelopeId: env2Id, amount: 30 }
        ]
      });

    expect(splitRes.status).toBe(201);
    expect(splitRes.body.splitGroupId).toBeTruthy();
    expect(splitRes.body.transactions).toHaveLength(2);
    expect(splitRes.body.period.summary.remainingToLive).toBe(1900);

    const tx1Id = splitRes.body.transactions[0].id as string;
    const tx2Id = splitRes.body.transactions[1].id as string;

    // 2. Suppression partielle (?scope=single) -> la 2e transaction perd son splitGroupId
    const delSingleRes = await request(app)
      .delete(`/api/periods/${periodId}/transactions/${tx1Id}?scope=single`)
      .set('Authorization', `Bearer ${token}`);
    expect(delSingleRes.status).toBe(200);
    expect(delSingleRes.body.period.summary.remainingToLive).toBe(1970);

    const listRes = await request(app)
      .get(`/api/periods/${periodId}/transactions`)
      .set('Authorization', `Bearer ${token}`);
    const remainingTx = listRes.body.transactions.find((t: { id: string }) => t.id === tx2Id);
    expect(remainingTx.splitGroupId).toBeUndefined();

    // 3. Créer un autre ticket fractionné et le supprimer entièrement (?scope=group)
    const splitRes2 = await request(app)
      .post(`/api/periods/${periodId}/transactions/split`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'Ikea',
        parts: [
          { envelopeId: env1Id, amount: 20 },
          { envelopeId: env2Id, amount: 80 }
        ]
      });
    expect(splitRes2.status).toBe(201);
    const groupTxId = splitRes2.body.transactions[0].id as string;

    const delGroupRes = await request(app)
      .delete(`/api/periods/${periodId}/transactions/${groupTxId}?scope=group`)
      .set('Authorization', `Bearer ${token}`);
    expect(delGroupRes.status).toBe(200);
    expect(delGroupRes.body.period.summary.remainingToLive).toBe(1970);
  });
});

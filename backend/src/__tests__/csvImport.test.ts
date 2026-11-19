import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import {
  buildDeduplicationKey,
  computeBalanceReconciliation,
  normalizeLabel
} from '../services/csvImport.service';

const app = createApp();
let mongoServer: MongoMemoryServer;

async function registerUser(email: string) {
  const response = await request(app).post('/api/auth/register').send({
    email,
    password: 'Password123!',
    displayName: 'Test',
    budgetStartDay: 1
  });
  return {
    token: (response.body.accessToken ?? response.body.token) as string
  };
}

describe('Étape 30 — Import CSV & Réconciliation de solde (Backend)', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  it('normalise les libellés et génère une clé de déduplication stable', () => {
    expect(normalizeLabel('  Café   Étoile  ')).toBe('cafe etoile');
    const key1 = buildDeduplicationKey(new Date('2026-11-10T10:00:00Z'), 42.5, 'Carrefour Market');
    const key2 = buildDeduplicationKey(new Date('2026-11-10T22:00:00Z'), 42.5, '  carrefour   market ');
    expect(key1).toBe(key2);
  });

  it('calcule correctement la réconciliation de solde', () => {
    expect(computeBalanceReconciliation(500, 500)).toEqual({
      theoreticalBalance: 500,
      bankBalance: 500,
      difference: 0,
      status: 'balanced',
      suggestedAdjustmentAmount: 0
    });

    expect(computeBalanceReconciliation(500, 450.25)).toEqual({
      theoreticalBalance: 500,
      bankBalance: 450.25,
      difference: -49.75,
      status: 'under',
      suggestedAdjustmentAmount: 49.75
    });

    expect(computeBalanceReconciliation(500, 530)).toEqual({
      theoreticalBalance: 500,
      bankBalance: 530,
      difference: 30,
      status: 'over',
      suggestedAdjustmentAmount: 30
    });
  });

  it('importe un lot de transactions, ignore les doublons et recalcule le reste à vivre', async () => {
    const { token } = await registerUser('csv-import@eparnio.fr');

    const budgetRes = await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Budget Perso', type: 'personal' });
    const budgetId = (budgetRes.body.budget?.id ?? budgetRes.body.id) as string;

    const periodRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/current`)
      .set('Authorization', `Bearer ${token}`);
    const periodId = (periodRes.body.period?.id ?? periodRes.body.id) as string;

    // Ajouter un revenu de 2000 €
    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Salaire', pillar: 'income', allocatedAmount: 2000 });

    // Créer une enveloppe Courses de 400 €
    const envRes = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Courses',
        pillar: 'variable_envelope',
        allocatedAmount: 400,
        icon: '🛒',
        color: '#22C55E'
      });
    expect(envRes.status).toBe(201);
    const envelopeId = (envRes.body.envelope?.id ?? envRes.body.id) as string;

    // Premier import : 2 transactions
    const import1 = await request(app)
      .post(`/api/periods/${periodId}/transactions/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { envelopeId, amount: 55.4, label: 'Carrefour City', date: '2026-11-05' },
          { envelopeId, amount: 24.6, label: 'Boulangerie', date: '2026-11-06' }
        ]
      });

    expect(import1.status).toBe(201);
    expect(import1.body.importedCount).toBe(2);
    expect(import1.body.skippedDuplicatesCount).toBe(0);
    expect(import1.body.envelopes[0].spentOrPaidAmount).toBe(80);
    expect(import1.body.period.summary.remainingToLive).toBe(1920);

    // Deuxième import avec 1 doublon et 1 nouvelle opération
    const import2 = await request(app)
      .post(`/api/periods/${periodId}/transactions/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { envelopeId, amount: 55.4, label: '  carrefour city ', date: '2026-11-05' },
          { envelopeId, amount: 20, label: 'Pharmacie', date: '2026-11-07' }
        ]
      });

    expect(import2.status).toBe(201);
    expect(import2.body.importedCount).toBe(1);
    expect(import2.body.skippedDuplicatesCount).toBe(1);
    expect(import2.body.envelopes[0].spentOrPaidAmount).toBe(100);
    expect(import2.body.period.summary.remainingToLive).toBe(1900);

    // Réconciliation de solde
    const reconcileRes = await request(app)
      .post(`/api/periods/${periodId}/transactions/reconcile`)
      .set('Authorization', `Bearer ${token}`)
      .send({ bankBalance: 1875 });

    expect(reconcileRes.status).toBe(200);
    expect(reconcileRes.body.reconciliation).toEqual({
      theoreticalBalance: 1900,
      bankBalance: 1875,
      difference: -25,
      status: 'under',
      suggestedAdjustmentAmount: 25
    });
  });
});

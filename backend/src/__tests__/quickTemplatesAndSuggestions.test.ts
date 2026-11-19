import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';

const app = createApp();
let mongoServer: MongoMemoryServer;

describe('Étape 32 — Auto-complétion & Favoris (quickTemplates & suggestions)', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('gère le CRUD quickTemplates et retourne les suggestions de transactions du budget', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: 'templates@eparnio.fr',
      password: 'Password123!',
      displayName: 'Sam',
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
      .send({ name: 'Épicerie Bio', pillar: 'variable_envelope', allocatedAmount: 300 });
    const envelopeId = (envRes.body.envelope?.id ?? envRes.body.id) as string;

    // Créer 2 transactions pour alimenter les suggestions
    await request(app)
      .post(`/api/periods/${periodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ envelopeId, amount: 34.5, label: 'Biocoop', date: '2026-11-05' });

    const suggestionsRes = await request(app)
      .get(`/api/budgets/${budgetId}/transactions/suggestions`)
      .set('Authorization', `Bearer ${token}`);

    expect(suggestionsRes.status).toBe(200);
    expect(suggestionsRes.body.suggestions).toHaveLength(1);
    expect(suggestionsRes.body.suggestions[0]).toMatchObject({
      label: 'Biocoop',
      envelopeName: 'Épicerie Bio',
      lastAmount: 34.5,
      count: 1
    });

    // Créer un favori
    const createTplRes = await request(app)
      .post(`/api/budgets/${budgetId}/quick-templates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Café matin', envelopeName: 'Épicerie Bio', defaultAmount: 2.5 });

    expect(createTplRes.status).toBe(201);
    expect(createTplRes.body.quickTemplates).toHaveLength(1);
    expect(createTplRes.body.quickTemplates[0]).toMatchObject({
      label: 'Café matin',
      envelopeName: 'epicerie bio',
      defaultAmount: 2.5
    });

    const templateId = createTplRes.body.quickTemplates[0].id as string;

    // Supprimer le favori
    const deleteTplRes = await request(app)
      .delete(`/api/budgets/${budgetId}/quick-templates/${templateId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteTplRes.status).toBe(200);
    expect(deleteTplRes.body.quickTemplates).toHaveLength(0);
  });
});

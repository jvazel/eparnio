import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { AssetAccountModel } from '../models/AssetAccount.model';
import { BudgetModel } from '../models/Budget.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { SavingsGoalModel } from '../models/SavingsGoal.model';
import { UserModel } from '../models/User.model';

describe('Synchronisation Épargne liée <-> Compte Patrimonial (zéro double comptage)', () => {
  const app = createApp();
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    await AssetAccountModel.deleteMany({});
    await SavingsGoalModel.deleteMany({});
    await EnvelopeModel.deleteMany({});
    await BudgetPeriodModel.deleteMany({});
    await BudgetModel.deleteMany({});
    await UserModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('met à jour automatiquement le compte patrimonial lié lors des versements, ajustements, retraits et suppressions sans double comptage', async () => {
    const ownerRes = await request(app).post('/api/auth/register').send({
      email: 'sync-asset@eparnio.fr',
      password: 'Password123!',
      displayName: 'Johann',
      budgetStartDay: 1
    });
    const token = ownerRes.body.token as string;
    const budgetId = ownerRes.body.defaultBudget.id as string;

    // 1. Créer un compte patrimonial Livret A à 1 000 €
    const assetRes = await request(app)
      .post(`/api/budgets/${budgetId}/assets`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Livret A',
        category: 'cash',
        currentBalance: 1000
      });
    expect(assetRes.status).toBe(201);
    const livretId = (assetRes.body.asset.id ?? assetRes.body.asset._id) as string;

    // 2. Créer un objectif d'épargne lié au Livret A
    const goalRes = await request(app)
      .post(`/api/budgets/${budgetId}/goals`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Vacances Japon',
        targetAmount: 3000,
        assetAccountId: livretId
      });
    expect(goalRes.status).toBe(201);
    const goalId = goalRes.body.goal.id as string;

    const periodRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2026&month=11`)
      .set('Authorization', `Bearer ${token}`);
    const periodId = periodRes.body.period.id as string;

    // 3. Versement de 200 € dans l'épargne -> Livret A passe à 1 200 € et Patrimoine Net = 1 200 € (pas 1 400 €)
    const contribRes = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'savings',
        name: 'Versement Japon',
        allocatedAmount: 200,
        linkedGoalId: goalId
      });
    expect(contribRes.status).toBe(201);
    expect(contribRes.body.goal.currentAmount).toBe(200);
    const envelopeId = contribRes.body.envelope.id as string;

    let nwRes = await request(app)
      .get(`/api/budgets/${budgetId}/net-worth`)
      .set('Authorization', `Bearer ${token}`);
    expect(nwRes.status).toBe(200);
    expect(nwRes.body.netWorth.totalAssets).toBe(1200);
    expect(nwRes.body.netWorth.netWorth).toBe(1200);
    expect(nwRes.body.netWorth.accounts[0].currentBalance).toBe(1200);

    // 4. Ajustement du versement de 200 € à 350 € (+150 €) -> Livret A passe à 1 350 €
    const updateRes = await request(app)
      .patch(`/api/periods/${periodId}/envelopes/${envelopeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ allocatedAmount: 350 });
    expect(updateRes.status).toBe(200);

    nwRes = await request(app)
      .get(`/api/budgets/${budgetId}/net-worth`)
      .set('Authorization', `Bearer ${token}`);
    expect(nwRes.body.netWorth.netWorth).toBe(1350);

    // 5. Retrait de 100 € sur la cagnotte -> Livret A passe à 1 250 €
    const withdrawRes = await request(app)
      .post(`/api/budgets/${budgetId}/goals/${goalId}/withdrawals`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100, label: 'Billet avion' });
    expect(withdrawRes.status).toBe(201);
    expect(withdrawRes.body.goal.currentAmount).toBe(250);

    nwRes = await request(app)
      .get(`/api/budgets/${budgetId}/net-worth`)
      .set('Authorization', `Bearer ${token}`);
    expect(nwRes.body.netWorth.netWorth).toBe(1250);

    // 6. Suppression du versement de 350 € -> Livret A passe à 900 €
    const deleteRes = await request(app)
      .delete(`/api/periods/${periodId}/envelopes/${envelopeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);

    nwRes = await request(app)
      .get(`/api/budgets/${budgetId}/net-worth`)
      .set('Authorization', `Bearer ${token}`);
    expect(nwRes.body.netWorth.netWorth).toBe(900);
  });
});

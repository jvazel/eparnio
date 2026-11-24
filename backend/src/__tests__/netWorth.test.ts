import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { AssetAccountModel } from '../models/AssetAccount.model';
import { BudgetModel } from '../models/Budget.model';
import { SavingsGoalModel } from '../models/SavingsGoal.model';
import { UserModel } from '../models/User.model';

describe('Patrimoine Net & Comptes Actifs/Passifs', () => {
  const app = createApp();
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    await SavingsGoalModel.deleteMany({});
    await AssetAccountModel.deleteMany({});
    await BudgetModel.deleteMany({});
    await UserModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('calcule Actifs - Passifs, gère les projets liés (N->1) et l historique', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: 'networth@eparnio.fr',
      password: 'Password123!',
      displayName: 'Clara',
    });
    const token = reg.body.token as string;
    const userId = reg.body.user.id as string;

    const budget = await BudgetModel.create({
      name: 'Patrimoine Clara',
      type: 'personal',
      ownerId: userId,
      budgetStartDay: 1,
      members: [{ userId, role: 'owner' }],
    });

    const livretRes = await request(app)
      .post(`/api/budgets/${String(budget._id)}/assets`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Livret A',
        category: 'cash',
        icon: '🏦',
        currentBalance: 5000,
      });
    expect(livretRes.status).toBe(201);
    const livretId = livretRes.body.asset._id as string;

    await request(app)
      .post(`/api/budgets/${String(budget._id)}/assets`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Crédit Auto',
        category: 'liability',
        icon: '🚗',
        currentBalance: 2000,
      });

    // Lier 2 projets virtuels sur le même Livret A
    await SavingsGoalModel.create({
      budgetId: budget._id,
      name: 'Vacances Italie',
      icon: '🇮🇹',
      targetAmount: 1500,
      currentAmount: 800,
      assetAccountId: livretId,
    });
    await SavingsGoalModel.create({
      budgetId: budget._id,
      name: 'Matelas sécurité',
      icon: '🛡️',
      targetAmount: 5000,
      currentAmount: 4200,
      assetAccountId: livretId,
    });

    const nwRes = await request(app)
      .get(`/api/budgets/${String(budget._id)}/net-worth`)
      .set('Authorization', `Bearer ${token}`);

    expect(nwRes.status).toBe(200);
    expect(nwRes.body.netWorth.totalAssets).toBe(5000);
    expect(nwRes.body.netWorth.totalLiabilities).toBe(2000);
    expect(nwRes.body.netWorth.netWorth).toBe(3000);

    const livret = nwRes.body.netWorth.accounts.find(
      (a: { name: string }) => a.name === 'Livret A'
    );
    expect(livret.linkedGoals).toHaveLength(2);
  });
});

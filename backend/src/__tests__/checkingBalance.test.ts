import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { resetAllRateLimiters } from '../middlewares/rateLimit.middleware';
import { AssetAccountModel } from '../models/AssetAccount.model';
import { BudgetModel } from '../models/Budget.model';
import { UserModel } from '../models/User.model';

const app = createApp();
let mongoServer: MongoMemoryServer;

async function registerUser(email: string, displayName: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .set('x-test-rate-limit-key', `chk-${email}`)
    .send({ email, password: 'Password123', displayName });
  return {
    token: res.body.token as string,
    userId: res.body.user.id as string,
    budgetId: res.body.defaultBudget.id as string
  };
}

describe('Compte Courant Principal — PUT /api/budgets/:budgetId/checking-balance (Étape 59)', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    resetAllRateLimiters();
    await Promise.all([
      UserModel.deleteMany({}),
      BudgetModel.deleteMany({}),
      AssetAccountModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('crée automatiquement le compte courant au 1er appel, le met à jour au 2e et refuse viewer (403)', async () => {
    const owner = await registerUser('chk-owner@eparnio.test', 'Alice');
    const viewer = await registerUser('chk-viewer@eparnio.test', 'Bob');

    await BudgetModel.findByIdAndUpdate(owner.budgetId, {
      $set: { type: 'shared' },
      $push: {
        members: {
          userId: new mongoose.Types.ObjectId(viewer.userId),
          role: 'viewer',
          color: '#3B82F6',
          declaredMonthlyIncome: 0
        }
      }
    });

    // Sans JWT -> 401
    const unauth = await request(app)
      .put(`/api/budgets/${owner.budgetId}/checking-balance`)
      .send({ balance: 1200 });
    expect(unauth.status).toBe(401);

    // Viewer -> 403
    const forbidden = await request(app)
      .put(`/api/budgets/${owner.budgetId}/checking-balance`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ balance: 1200 });
    expect(forbidden.status).toBe(403);

    // 1er appel : création automatique
    const first = await request(app)
      .put(`/api/budgets/${owner.budgetId}/checking-balance`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ balance: 1250.5 });
    expect(first.status).toBe(200);
    expect(first.body.checkingAccount.currentBalance).toBe(1250.5);

    // 2e appel : mise à jour sur le même compte (unicité + historique)
    const second = await request(app)
      .put(`/api/budgets/${owner.budgetId}/checking-balance`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ balance: 1410.25, label: 'Pointage banque' });
    expect(second.status).toBe(200);
    expect(second.body.checkingAccount.id).toBe(first.body.checkingAccount.id);
    expect(second.body.checkingAccount.currentBalance).toBe(1410.25);

    const accounts = await AssetAccountModel.find({ budgetId: owner.budgetId });
    expect(accounts).toHaveLength(1);
    expect(accounts[0].isCheckingAccount).toBe(true);
    expect(accounts[0].history).toHaveLength(2);
    expect(accounts[0].operations).toHaveLength(2);
  });
});

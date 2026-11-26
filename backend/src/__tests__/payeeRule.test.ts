import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { resetAllRateLimiters } from '../middlewares/rateLimit.middleware';
import { BudgetModel } from '../models/Budget.model';
import { PayeeRuleModel } from '../models/PayeeRule.model';
import { UserModel } from '../models/User.model';

const app = createApp();
let mongoServer: MongoMemoryServer;

async function registerUser(email: string, displayName: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .set('x-test-rate-limit-key', `rule-${email}`)
    .send({ email, password: 'Password123', displayName });
  return {
    token: res.body.token as string,
    userId: res.body.user.id as string,
    budgetId: res.body.defaultBudget.id as string
  };
}

describe('Règles d’Auto-Catégorisation / Payee Rules (Étape 54)', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    resetAllRateLimiters();
    await Promise.all([
      UserModel.deleteMany({}),
      BudgetModel.deleteMany({}),
      PayeeRuleModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('gère le CRUD complet, le réordonnancement, la validation Zod et le contrôle d’accès viewer (403)', async () => {
    const owner = await registerUser('pr-owner@eparnio.test', 'Alice');
    const viewer = await registerUser('pr-viewer@eparnio.test', 'Bob');

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

    // Rejet si aucune action définie -> 400
    const badRule = await request(app)
      .post(`/api/budgets/${owner.budgetId}/payee-rules`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ pattern: 'carrefour' });
    expect(badRule.status).toBe(400);

    // Création règle 1 (Carrefour -> Courses + tag)
    const r1 = await request(app)
      .post(`/api/budgets/${owner.budgetId}/payee-rules`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        pattern: 'CARREFOUR',
        targetEnvelopeName: 'Courses',
        renameLabel: 'Carrefour',
        addTags: ['#Alimentation']
      });
    expect(r1.status).toBe(201);
    expect(r1.body.rule.addTags).toEqual(['alimentation']);

    // Création règle 2 (autoExcludeFromImport)
    const r2 = await request(app)
      .post(`/api/budgets/${owner.budgetId}/payee-rules`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        pattern: 'VIREMENT INTERNE',
        autoExcludeFromImport: true
      });
    expect(r2.status).toBe(201);
    expect(r2.body.rule.autoExcludeFromImport).toBe(true);

    // Viewer peut lister (200) mais pas créer ni réordonner (403)
    const listViewer = await request(app)
      .get(`/api/budgets/${owner.budgetId}/payee-rules`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(listViewer.status).toBe(200);
    expect(listViewer.body.rules).toHaveLength(2);

    const forbiddenViewer = await request(app)
      .post(`/api/budgets/${owner.budgetId}/payee-rules`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ pattern: 'TEST', autoExcludeFromImport: true });
    expect(forbiddenViewer.status).toBe(403);

    // Réordonnancement par owner
    const reorderRes = await request(app)
      .patch(`/api/budgets/${owner.budgetId}/payee-rules/reorder`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ orderedIds: [r2.body.rule.id, r1.body.rule.id] });
    expect(reorderRes.status).toBe(200);
    expect(reorderRes.body.rules[0].id).toBe(r2.body.rule.id);

    // Désactivation + suppression
    const patchRes = await request(app)
      .patch(`/api/budgets/${owner.budgetId}/payee-rules/${r1.body.rule.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ isActive: false });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.rule.isActive).toBe(false);

    const delRes = await request(app)
      .delete(`/api/budgets/${owner.budgetId}/payee-rules/${r1.body.rule.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(delRes.status).toBe(200);
  });
});

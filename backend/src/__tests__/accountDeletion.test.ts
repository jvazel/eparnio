import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { resetAllRateLimiters } from '../middlewares/rateLimit.middleware';
import { BudgetModel } from '../models/Budget.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { PushSubscriptionModel } from '../models/PushSubscription.model';
import { UserModel } from '../models/User.model';

const app = createApp();
let mongoServer: MongoMemoryServer;

async function registerUser(email: string, displayName: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .set('x-test-rate-limit-key', `del-${email}`)
    .send({ email, password: 'Password123', displayName });
  return {
    token: res.body.token as string,
    userId: res.body.user.id as string,
    budgetId: res.body.defaultBudget.id as string
  };
}

describe('Suppression de compte RGPD — DELETE /api/auth/me (Étape 56)', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    resetAllRateLimiters();
    await Promise.all([
      UserModel.deleteMany({}),
      BudgetModel.deleteMany({}),
      BudgetPeriodModel.deleteMany({}),
      EnvelopeModel.deleteMany({}),
      PushSubscriptionModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('refuse sans JWT (401), mauvais mot de passe (401) ou mauvaise confirmation (400)', async () => {
    const user = await registerUser('del-guard@eparnio.test', 'Alice');

    const unauth = await request(app)
      .delete('/api/auth/me')
      .send({ currentPassword: 'Password123', confirmation: 'SUPPRIMER' });
    expect(unauth.status).toBe(401);

    const badConfirm = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ currentPassword: 'Password123', confirmation: 'OUI' });
    expect(badConfirm.status).toBe(400);

    const badPass = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ currentPassword: 'WrongPassword1', confirmation: 'SUPPRIMER' });
    expect(badPass.status).toBe(401);
  });

  it('supprime en cascade le budget personnel et transfère automatiquement la propriété d’un budget partagé', async () => {
    const owner = await registerUser('del-owner@eparnio.test', 'Alice');
    const partner = await registerUser('del-partner@eparnio.test', 'Bob');

    // Créer un budget partagé où Alice est owner et Bob est editor
    const sharedBudget = await BudgetModel.create({
      name: 'Foyer Commun',
      type: 'shared',
      ownerId: new mongoose.Types.ObjectId(owner.userId),
      members: [
        {
          userId: new mongoose.Types.ObjectId(owner.userId),
          role: 'owner',
          color: '#7C3AED',
          declaredMonthlyIncome: 0
        },
        {
          userId: new mongoose.Types.ObjectId(partner.userId),
          role: 'editor',
          color: '#22C55E',
          declaredMonthlyIncome: 0
        }
      ]
    });

    // Ajouter un abonnement Push pour Alice
    await PushSubscriptionModel.create({
      userId: new mongoose.Types.ObjectId(owner.userId),
      endpoint: 'https://push.example.com/alice',
      keys: { p256dh: 'key1', auth: 'auth1' }
    });

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ currentPassword: 'Password123', confirmation: 'SUPPRIMER' });

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      deletedBudgetsCount: 1,
      transferredBudgetsCount: 1,
      leftSharedBudgetsCount: 0
    });

    // Compte Alice, budget perso et push supprimés
    expect(await UserModel.findById(owner.userId)).toBeNull();
    expect(await BudgetModel.findById(owner.budgetId)).toBeNull();
    expect(await PushSubscriptionModel.countDocuments({ userId: owner.userId })).toBe(0);

    // Budget partagé préservé et transféré à Bob (qui devient owner)
    const updatedShared = await BudgetModel.findById(sharedBudget._id);
    expect(updatedShared).not.toBeNull();
    expect(updatedShared?.ownerId.toString()).toBe(partner.userId);
    expect(updatedShared?.members).toHaveLength(1);
    expect(updatedShared?.members[0].userId.toString()).toBe(partner.userId);
    expect(updatedShared?.members[0].role).toBe('owner');
  });
});

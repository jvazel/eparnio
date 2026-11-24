import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import webpush from 'web-push';

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));
import { createApp } from '../app';
import { env } from '../config/env';
import { BudgetModel } from '../models/Budget.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { PushSubscriptionModel } from '../models/PushSubscription.model';
import { UserModel } from '../models/User.model';
import {
  checkAndSendDueAlerts,
  checkAndSendEnvelopeThresholdAlerts,
  sendPushToUser,
} from '../services/pushNotification.service';

describe('Notifications Push PWA (/api/notifications/*)', () => {
  const app = createApp();
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await PushSubscriptionModel.deleteMany({});
    await EnvelopeModel.deleteMany({});
    await BudgetPeriodModel.deleteMany({});
    await BudgetModel.deleteMany({});
    await UserModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('rejette une requête non authentifiée (401)', async () => {
    const res = await request(app).get('/api/notifications/vapid-public-key');
    expect(res.status).toBe(401);
  });

  it('gère subscribe, preferences et unsubscribe avec JWT', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: 'push@eparnio.fr',
      password: 'Password123!',
      displayName: 'Alex',
    });
    expect(reg.status).toBe(201);
    const token = reg.body.token as string;

    const subRes = await request(app)
      .post('/api/notifications/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
        keys: { p256dh: 'key1', auth: 'auth1' },
      });
    expect(subRes.status).toBe(201);
    expect(await PushSubscriptionModel.countDocuments()).toBe(1);

    const prefRes = await request(app)
      .patch('/api/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        dailyReminderEnabled: true,
        dailyReminderHour: '19:00',
        upcomingDueAlertEnabled: false,
      });
    expect(prefRes.status).toBe(200);
    expect(prefRes.body.notificationPreferences.dailyReminderEnabled).toBe(true);
    expect(prefRes.body.notificationPreferences.dailyReminderHour).toBe('19:00');
    expect(prefRes.body.notificationPreferences.upcomingDueAlertEnabled).toBe(false);

    const unsubRes = await request(app)
      .delete('/api/notifications/unsubscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc' });
    expect(unsubRes.status).toBe(200);
    expect(await PushSubscriptionModel.countDocuments()).toBe(0);
  });

  it('nettoie les abonnements expirés (410 Gone) lors de sendPushToUser', async () => {
    const user = await UserModel.create({
      email: 'gone@eparnio.fr',
      passwordHash: 'hash',
      displayName: 'Gone',
    });
    await PushSubscriptionModel.create({
      userId: user._id,
      endpoint: 'https://push.example.com/expired',
      keys: { p256dh: 'k', auth: 'a' },
    });

    // Simuler VAPID configuré via env
    env.VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8';
    env.VAPID_PRIVATE_KEY = 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls';
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce({ statusCode: 410 });

    const result = await sendPushToUser(String(user._id), {
      title: 'Test',
      body: 'Body',
    });

    expect(result.removed).toBe(1);
    expect(await PushSubscriptionModel.countDocuments({ userId: user._id })).toBe(0);
  });

  it('détecte les échéances à J-2 et les enveloppes >= 80%', async () => {
    const user = await UserModel.create({
      email: 'alerts@eparnio.fr',
      passwordHash: 'hash',
      displayName: 'Alerts',
    });
    await PushSubscriptionModel.create({
      userId: user._id,
      endpoint: 'https://push.example.com/ok',
      keys: { p256dh: 'k', auth: 'a' },
    });

    const budget = await BudgetModel.create({
      name: 'Perso',
      type: 'personal',
      ownerId: user._id,
      budgetStartDay: 1,
      members: [{ userId: user._id, role: 'owner' }],
    });

    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    const period = await BudgetPeriodModel.create({
      budgetId: budget._id,
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      label: 'Mois courant',
      startDate: start,
      endDate: end,
    });

    const inTwoDays = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2, 12, 0, 0)
    );

    await EnvelopeModel.create({
      budgetId: budget._id,
      budgetPeriodId: period._id,
      pillar: 'fixed_charge',
      name: 'Loyer',
      icon: '🏠',
      color: '#8B5CF6',
      allocatedAmount: 800,
      spentOrPaidAmount: 0,
      isPaid: false,
      date: inTwoDays,
    });

    await EnvelopeModel.create({
      budgetId: budget._id,
      budgetPeriodId: period._id,
      pillar: 'variable_envelope',
      name: 'Courses',
      icon: '🛒',
      color: '#3B82F6',
      allocatedAmount: 200,
      spentOrPaidAmount: 170, // 85%
    });

    const sendSpy = vi.mocked(webpush.sendNotification).mockResolvedValue({} as never);
    sendSpy.mockClear();

    const dueCount = await checkAndSendDueAlerts(now);
    const thresholdCount = await checkAndSendEnvelopeThresholdAlerts();

    expect(dueCount).toBe(1);
    expect(thresholdCount).toBe(1);
    expect(sendSpy).toHaveBeenCalledTimes(2);
  });
});

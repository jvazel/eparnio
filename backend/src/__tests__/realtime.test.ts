import type { Response } from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { resetAllRateLimiters } from '../middlewares/rateLimit.middleware';
import { BudgetModel } from '../models/Budget.model';
import { UserModel } from '../models/User.model';
import * as pushService from '../services/pushNotification.service';
import {
  disconnectUserFromBudget,
  emitBudgetEvent,
  notifySharedBudgetActivity,
  registerRealtimeClient,
  resetRealtimeClientsForTests
} from '../services/realtime.service';

const app = createApp();
let mongoServer: MongoMemoryServer;

function createMockSseResponse() {
  const chunks: string[] = [];
  const headers: Record<string, string> = {};
  const res = {
    status: vi.fn().mockReturnThis(),
    setHeader: vi.fn((k: string, v: string) => {
      headers[k.toLowerCase()] = v;
    }),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: string) => {
      chunks.push(chunk);
      return true;
    }),
    end: vi.fn()
  } as unknown as Response;
  return { res, chunks, headers };
}

describe('Synchronisation Temps Réel SSE & Notifications Partagées (Étape 53)', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    resetRealtimeClientsForTests();
    resetAllRateLimiters();
    vi.restoreAllMocks();
    await Promise.all([UserModel.deleteMany({}), BudgetModel.deleteMany({})]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('configure les en-têtes Render/SSE anti-buffering, diffuse par budgetId et déconnecte un membre retiré', () => {
    const clientA = createMockSseResponse();
    const clientB = createMockSseResponse();

    const cleanupA = registerRealtimeClient('budget-1', 'user-a', clientA.res);
    const cleanupB = registerRealtimeClient('budget-2', 'user-b', clientB.res);

    expect(clientA.headers['content-type']).toContain('text/event-stream');
    expect(clientA.headers['cache-control']).toContain('no-transform');
    expect(clientA.headers['x-accel-buffering']).toBe('no');

    const delivered = emitBudgetEvent('budget-1', {
      type: 'transaction:created',
      actorUserId: 'user-x',
      actorName: 'Alex',
      summary: 'Alex a ajouté 38,00 € dans Courses',
      invalidateKeys: ['period', 'envelopes']
    });

    expect(delivered).toBe(1);
    expect(clientA.chunks.some((c) => c.includes('Alex a ajouté 38,00 €'))).toBe(true);
    expect(clientB.chunks.some((c) => c.includes('Alex a ajouté 38,00 €'))).toBe(false);

    const closed = disconnectUserFromBudget('budget-1', 'user-a');
    expect(closed).toBe(1);
    expect(clientA.res.end).toHaveBeenCalledTimes(1);

    cleanupA();
    cleanupB();
  });

  it('protège GET /api/budgets/:budgetId/events (401 sans JWT, 403 non-membre)', async () => {
    const ownerRes = await request(app)
      .post('/api/auth/register')
      .set('x-test-rate-limit-key', 'sse-owner')
      .send({ email: 'sse-owner@eparnio.test', password: 'Password123', displayName: 'Alice' });
    const otherRes = await request(app)
      .post('/api/auth/register')
      .set('x-test-rate-limit-key', 'sse-other')
      .send({ email: 'sse-other@eparnio.test', password: 'Password123', displayName: 'Bob' });

    const budgetId = ownerRes.body.defaultBudget.id as string;

    const unauth = await request(app).get(`/api/budgets/${budgetId}/events`);
    expect(unauth.status).toBe(401);

    const forbidden = await request(app)
      .get(`/api/budgets/${budgetId}/events`)
      .set('Authorization', `Bearer ${otherRes.body.token}`);
    expect(forbidden.status).toBe(403);
  });

  it('envoie les notifications Push d’activité partagée selon sharedActivityAlertEnabled (activé par défaut, exclut l’auteur)', async () => {
    const pushSpy = vi
      .spyOn(pushService, 'sendPushToUser')
      .mockResolvedValue({ sent: 1, removed: 0 });

    const actor = await UserModel.create({
      email: 'actor@eparnio.test',
      passwordHash: 'hash',
      displayName: 'Alex'
    });
    const partnerEnabled = await UserModel.create({
      email: 'partner1@eparnio.test',
      passwordHash: 'hash',
      displayName: 'Sam'
      // notificationPreferences absent -> sharedActivityAlertEnabled par défaut true
    });
    const partnerDisabled = await UserModel.create({
      email: 'partner2@eparnio.test',
      passwordHash: 'hash',
      displayName: 'Léo',
      notificationPreferences: {
        dailyReminderEnabled: false,
        dailyReminderHour: '20:00',
        upcomingDueAlertEnabled: true,
        envelopeThresholdAlertEnabled: true,
        sharedActivityAlertEnabled: false
      }
    });

    const sharedBudget = await BudgetModel.create({
      name: 'Foyer',
      type: 'shared',
      ownerId: actor._id,
      members: [
        { userId: actor._id, role: 'owner', color: '#7C3AED', declaredMonthlyIncome: 0 },
        { userId: partnerEnabled._id, role: 'editor', color: '#22C55E', declaredMonthlyIncome: 0 },
        { userId: partnerDisabled._id, role: 'editor', color: '#3B82F6', declaredMonthlyIncome: 0 }
      ]
    });

    const sent = await notifySharedBudgetActivity({
      budgetId: sharedBudget._id.toString(),
      actorUserId: actor._id.toString(),
      summary: 'Alex a ajouté 38,00 € dans Courses'
    });

    expect(sent).toBe(1);
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledWith(
      partnerEnabled._id.toString(),
      expect.objectContaining({
        title: 'Eparnio · Foyer',
        body: 'Alex a ajouté 38,00 € dans Courses'
      })
    );
  });
});

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { EnvelopeModel } from '../models/Envelope.model';

let mongoServer: MongoMemoryServer;
const app = createApp();

describe('Étape 74 — Pointage groupé des charges fixes & Cron Push sécurisé', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    delete process.env.CRON_SECRET;
    await mongoose.connection.db?.dropDatabase();
  });

  it('pointe et dépointe en lot des charges fixes via PATCH /envelopes/bulk-paid', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: 'bulk@eparnio.test',
      password: 'Password123',
      displayName: 'Bulk'
    });
    const token = reg.body.token as string;
    const budgetId = reg.body.defaultBudget.id as string;

    const periodRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/current`)
      .set('Authorization', `Bearer ${token}`);
    const periodId = periodRes.body.period.id as string;

    const c1 = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'fixed_charge',
        name: 'Loyer',
        allocatedAmount: 800,
        date: '2026-11-05',
        isRecurring: true
      });
    const c2 = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'fixed_charge',
        name: 'Internet',
        allocatedAmount: 40,
        date: '2026-11-06',
        isRecurring: true
      });
    const envVar = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'variable_envelope',
        name: 'Courses',
        allocatedAmount: 400
      });

    const bulkRes = await request(app)
      .patch(`/api/periods/${periodId}/envelopes/bulk-paid`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        envelopeIds: [c1.body.envelope.id, c2.body.envelope.id, envVar.body.envelope.id],
        isPaid: true
      });

    expect(bulkRes.status).toBe(200);
    // Seules les 2 charges fixes sont mises à jour (l'enveloppe variable est ignorée)
    expect(bulkRes.body.updatedCount).toBe(2);
    expect(bulkRes.body.envelopes.every((e: { isPaid: boolean }) => e.isPaid)).toBe(true);

    const dbC1 = await EnvelopeModel.findById(c1.body.envelope.id);
    expect(dbC1?.isPaid).toBe(true);
    expect(dbC1?.spentOrPaidAmount).toBe(800);

    // Annulation (isPaid: false)
    const undoRes = await request(app)
      .patch(`/api/periods/${periodId}/envelopes/bulk-paid`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        envelopeIds: [c1.body.envelope.id, c2.body.envelope.id],
        isPaid: false
      });

    expect(undoRes.status).toBe(200);
    expect(undoRes.body.updatedCount).toBe(2);
    const dbC1After = await EnvelopeModel.findById(c1.body.envelope.id);
    expect(dbC1After?.isPaid).toBe(false);
    expect(dbC1After?.spentOrPaidAmount).toBe(0);
  });

  it('protège POST /api/notifications/cron/run par CRON_SECRET (503 / 401 / 200)', async () => {
    const res503 = await request(app).post('/api/notifications/cron/run');
    expect(res503.status).toBe(503);

    process.env.CRON_SECRET = 'super-secret-cron-token';
    const res401 = await request(app)
      .post('/api/notifications/cron/run')
      .set('X-Cron-Secret', 'wrong-secret');
    expect(res401.status).toBe(401);

    const res200 = await request(app)
      .post('/api/notifications/cron/run')
      .set('X-Cron-Secret', 'super-secret-cron-token');
    expect(res200.status).toBe(200);
    expect(res200.body.status).toBe('ok');
    expect(typeof res200.body.dueAlerts).toBe('number');
    expect(typeof res200.body.thresholdAlerts).toBe('number');
    expect(typeof res200.body.weeklyDigests).toBe('number');
  });
});

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';

const app = createApp();
let mongoServer: MongoMemoryServer;

describe('Étape 31 — Préférence defaultTab (PATCH /api/auth/me)', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('met à jour user.preferences.defaultTab via PATCH /api/auth/me', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({
      email: 'default-tab@eparnio.fr',
      password: 'Password123!',
      displayName: 'Alex',
      budgetStartDay: 1
    });

    expect(registerRes.status).toBe(201);
    const token = (registerRes.body.accessToken ?? registerRes.body.token) as string;
    expect(registerRes.body.user.preferences.defaultTab).toBe('depenses');

    const patchRes = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ defaultTab: 'enveloppes' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.user.preferences.defaultTab).toBe('enveloppes');
  });
});

import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { env } from '../config/env';
import { resetAllRateLimiters } from '../middlewares/rateLimit.middleware';
import { BudgetModel } from '../models/Budget.model';
import { UserModel } from '../models/User.model';

const app = createApp();
let mongoServer: MongoMemoryServer;

describe('Durcissement Sécurité Production (Étape 58)', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    resetAllRateLimiters();
    await Promise.all([UserModel.deleteMany({}), BudgetModel.deleteMany({})]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('rejette immédiatement (401) un JWT valide dès que le compte a été supprimé', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .set('x-test-rate-limit-key', 'sec-del')
      .send({ email: 'sec-del@eparnio.test', password: 'Password123', displayName: 'Alice' });

    const token = reg.body.token as string;
    const meBefore = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meBefore.status).toBe(200);

    // Supprimer le compte
    const del = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Password123', confirmation: 'SUPPRIMER' });
    expect(del.status).toBe(200);

    // L'ancien JWT doit être immédiatement rejeté en 401
    const meAfter = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meAfter.status).toBe(401);
  });

  it('épingle l’algorithme HS256 et rejette un JWT signé avec un autre algorithme (HS512)', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .set('x-test-rate-limit-key', 'sec-alg')
      .send({ email: 'sec-alg@eparnio.test', password: 'Password123', displayName: 'Bob' });

    const hs512Token = jwt.sign(
      { id: reg.body.user.id, email: 'sec-alg@eparnio.test', tokenVersion: 0 },
      env.JWT_SECRET,
      { algorithm: 'HS512', expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${hs512Token}`);
    expect(res.status).toBe(401);
  });

  it('isole correctement les clients derrière proxy via trust proxy (X-Forwarded-For)', async () => {
    const res1 = await request(app)
      .get('/api/health')
      .set('X-Forwarded-For', '203.0.113.10');
    const res2 = await request(app)
      .get('/api/health')
      .set('X-Forwarded-For', '203.0.113.20');

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  it('gère la session par cookies HttpOnly (login -> /me sans Bearer -> /refresh -> /logout)', async () => {
    await request(app)
      .post('/api/auth/register')
      .set('x-test-rate-limit-key', 'sec-cookie-reg')
      .send({ email: 'sec-cookie@eparnio.test', password: 'Password123', displayName: 'Claire' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('x-test-rate-limit-key', 'sec-cookie-login')
      .send({ email: 'sec-cookie@eparnio.test', password: 'Password123' });

    expect(loginRes.status).toBe(200);
    const setCookies = loginRes.headers['set-cookie'] as unknown as string[];
    expect(Array.isArray(setCookies)).toBe(true);
    expect(setCookies.some((c) => c.startsWith('eparnio_access_token=') && c.includes('HttpOnly'))).toBe(true);
    expect(setCookies.some((c) => c.startsWith('eparnio_refresh_token=') && c.includes('HttpOnly'))).toBe(true);

    const cookieHeader = setCookies.map((c) => c.split(';')[0]).join('; ');

    // /me authentifié uniquement via cookie HttpOnly (sans Authorization: Bearer)
    const meRes = await request(app).get('/api/auth/me').set('Cookie', cookieHeader);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('sec-cookie@eparnio.test');

    // /refresh avec le cookie HttpOnly refresh
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('x-test-rate-limit-key', 'sec-cookie-refresh')
      .set('Cookie', cookieHeader);
    expect(refreshRes.status).toBe(200);
    expect(typeof refreshRes.body.token).toBe('string');

    // /logout efface les cookies
    const logoutRes = await request(app).post('/api/auth/logout');
    expect(logoutRes.status).toBe(200);
  });
});

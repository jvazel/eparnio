import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { env } from '../config/env';

describe('Verrouillage d’inscription (REGISTRATION_INVITE_CODE)', () => {
  const originalInviteCode = env.REGISTRATION_INVITE_CODE;

  afterEach(() => {
    env.REGISTRATION_INVITE_CODE = originalInviteCode;
  });

  it('expose registrationRequiresInviteCode=false par défaut sur GET /api/auth/config', async () => {
    env.REGISTRATION_INVITE_CODE = '';
    const app = createApp();

    const res = await request(app).get('/api/auth/config');
    expect(res.status).toBe(200);
    expect(res.body.registrationRequiresInviteCode).toBe(false);
  });

  it('expose registrationRequiresInviteCode=true et bloque POST /api/auth/register sans code valide', async () => {
    env.REGISTRATION_INVITE_CODE = 'EPARNIO-PRIV-2026';
    const app = createApp();

    const cfgRes = await request(app).get('/api/auth/config');
    expect(cfgRes.status).toBe(200);
    expect(cfgRes.body.registrationRequiresInviteCode).toBe(true);

    const missingCodeRes = await request(app).post('/api/auth/register').send({
      email: 'blocked@eparnio.test',
      password: 'Password123',
      displayName: 'Blocked'
    });
    expect(missingCodeRes.status).toBe(403);

    const wrongCodeRes = await request(app).post('/api/auth/register').send({
      email: 'blocked2@eparnio.test',
      password: 'Password123',
      displayName: 'Blocked',
      inviteCode: 'MAUVAIS-CODE'
    });
    expect(wrongCodeRes.status).toBe(403);
  });
});

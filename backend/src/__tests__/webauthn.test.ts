import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';

describe('WebAuthn / Connexion Biométrique', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    const collections = await mongoose.connection.db?.collections();
    if (collections) {
      await Promise.all(collections.map((collection) => collection.deleteMany({})));
    }
  });

  it('génère les options d’enregistrement WebAuthn et refuse login/options sans credential', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({
      email: 'bio@eparnio.fr',
      password: 'Password123',
      displayName: 'Bio User',
      avatarEmoji: '🧑'
    });
    expect(registerRes.status).toBe(201);
    const { token } = registerRes.body as { token: string };

    const optionsRes = await request(app)
      .post('/api/auth/webauthn/register/options')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(optionsRes.status).toBe(200);
    expect(optionsRes.body.options.challenge).toBeTruthy();

    const loginOptsRes = await request(app)
      .post('/api/auth/webauthn/login/options')
      .send({ email: 'bio@eparnio.fr' });
    expect(loginOptsRes.status).toBe(400);

    const deleteRes = await request(app)
      .delete('/api/auth/webauthn/credentials')
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.user.hasBiometrics).toBe(false);
  });
});

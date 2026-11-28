import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import net from 'node:net';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { parseEnvConfig } from '../config/env';
import { signAccessToken } from '../middlewares/auth.middleware';
import { resetAllRateLimiters } from '../middlewares/rateLimit.middleware';
import { BudgetModel } from '../models/Budget.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { SavingsGoalModel } from '../models/SavingsGoal.model';
import { TransactionModel } from '../models/Transaction.model';
import { UserModel } from '../models/User.model';
import { sendSmtpMail, setEmailSenderForTests } from '../services/email.service';

describe('API Authentification JWT & Multi-Budgets (/api/auth & /api/budgets)', () => {
  const app = createApp();
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    setEmailSenderForTests(null);
    resetAllRateLimiters();
    await TransactionModel.deleteMany({});
    await EnvelopeModel.deleteMany({});
    await SavingsGoalModel.deleteMany({});
    await BudgetPeriodModel.deleteMany({});
    await BudgetModel.deleteMany({});
    await UserModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  async function registerSampleUser(overrides?: {
    email?: string;
    password?: string;
    displayName?: string;
    budgetStartDay?: number;
  }) {
    return request(app)
      .post('/api/auth/register')
      .send({
        email: overrides?.email ?? 'camille@eparnio.fr',
        password: overrides?.password ?? 'MonMotDePasse123!',
        displayName: overrides?.displayName ?? 'Camille',
        avatarEmoji: '👩',
        budgetStartDay: overrides?.budgetStartDay ?? 28
      });
  }

  describe('POST /api/auth/register & POST /api/auth/login', () => {
    it('inscrit un utilisateur, génère une clé de récupération hachée, crée son Budget Perso et exclut les secrets', async () => {
      const res = await registerSampleUser();

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ok');
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.recoveryKey).toMatch(/^EPAR-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(res.body.user).toMatchObject({
        email: 'camille@eparnio.fr',
        displayName: 'Camille',
        avatarEmoji: '👩',
        recoveryKeyHint: `EPAR-••••-${String(res.body.recoveryKey).slice(-4)}`,
        hasCompletedOnboarding: false,
        preferences: {
          currency: 'EUR',
          budgetStartDay: 28,
          theme: 'light'
        }
      });
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.recoveryKeyHash).toBeUndefined();
      expect(res.body.defaultBudget).toMatchObject({
        name: 'Budget Perso',
        type: 'personal',
        budgetStartDay: 28
      });
      expect(res.body.defaultBudget.members[0].role).toBe('owner');
    });

    it('rejette une inscription avec e-mail existant (409) ou mot de passe faible sans majuscule/minuscule/chiffre (400)', async () => {
      await registerSampleUser();

      const duplicateRes = await registerSampleUser();
      expect(duplicateRes.status).toBe(409);

      const shortPassRes = await request(app).post('/api/auth/register').send({
        email: 'autre1@eparnio.fr',
        password: '123',
        displayName: 'Autre'
      });
      expect(shortPassRes.status).toBe(400);

      const noUpperPassRes = await request(app).post('/api/auth/register').send({
        email: 'autre2@eparnio.fr',
        password: 'password123',
        displayName: 'Autre'
      });
      expect(noUpperPassRes.status).toBe(400);

      const noDigitPassRes = await request(app).post('/api/auth/register').send({
        email: 'autre3@eparnio.fr',
        password: 'PasswordSansChiffre',
        displayName: 'Autre'
      });
      expect(noDigitPassRes.status).toBe(400);
    });

    it('connecte un utilisateur existant et rejette un mauvais mot de passe (401)', async () => {
      await registerSampleUser();

      const okRes = await request(app).post('/api/auth/login').send({
        email: 'camille@eparnio.fr',
        password: 'MonMotDePasse123!'
      });
      expect(okRes.status).toBe(200);
      expect(okRes.body.token).toEqual(expect.any(String));
      expect(okRes.body.user.displayName).toBe('Camille');

      const badPassRes = await request(app).post('/api/auth/login').send({
        email: 'camille@eparnio.fr',
        password: 'MauvaisMotDePasse'
      });
      expect(badPassRes.status).toBe(401);
    });
  });

  describe('GET / PATCH /api/auth/me & PATCH /api/auth/password', () => {
    it('protège /me par JWT puis récupère et met à jour profil, onboarding et jour de paie', async () => {
      const noTokenRes = await request(app).get('/api/auth/me');
      expect(noTokenRes.status).toBe(401);

      const invalidTokenRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token');
      expect(invalidTokenRes.status).toBe(401);

      const regRes = await registerSampleUser({ budgetStartDay: 1 });
      const token = regRes.body.token as string;
      const budgetId = regRes.body.defaultBudget.id as string;

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe('camille@eparnio.fr');

      const patchRes = await request(app)
        .patch('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          displayName: 'Camille M.',
          avatarEmoji: '🦊',
          hasCompletedOnboarding: true,
          budgetStartDay: 25,
          theme: 'dark'
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.user).toMatchObject({
        displayName: 'Camille M.',
        avatarEmoji: '🦊',
        hasCompletedOnboarding: true,
        preferences: {
          budgetStartDay: 25,
          theme: 'dark',
          currency: 'EUR'
        }
      });

      const updatedBudget = await BudgetModel.findById(budgetId);
      expect(updatedBudget?.budgetStartDay).toBe(25);
    });

    it('met à jour le mot de passe en session authentifiée en vérifiant currentPassword', async () => {
      const regRes = await registerSampleUser();
      const token = regRes.body.token as string;

      const missingCurrentRes = await request(app)
        .patch('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ newPassword: 'NouveauPassword456!' });
      expect(missingCurrentRes.status).toBe(400);

      const wrongCurrentRes = await request(app)
        .patch('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'MauvaisPassword',
          newPassword: 'NouveauPassword456!'
        });
      expect(wrongCurrentRes.status).toBe(401);

      const updateOkRes = await request(app)
        .patch('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'MonMotDePasse123!',
          newPassword: 'NouveauPassword456!'
        });
      expect(updateOkRes.status).toBe(200);
      expect(typeof updateOkRes.body.token).toBe('string');

      // L'ancien JWT est révoqué dès le changement de mot de passe (tokenVersion incrémenté)
      const oldTokenMeRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(oldTokenMeRes.status).toBe(401);

      // Le nouveau JWT renvoyé reste valide
      const newTokenMeRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${updateOkRes.body.token}`);
      expect(newTokenMeRes.status).toBe(200);

      const loginNewRes = await request(app).post('/api/auth/login').send({
        email: 'camille@eparnio.fr',
        password: 'NouveauPassword456!'
      });
      expect(loginNewRes.status).toBe(200);
    });

    it('exige une clé de récupération valide pour réinitialiser le mot de passe et permet sa régénération', async () => {
      const regRes = await registerSampleUser();
      const firstRecoveryKey = regRes.body.recoveryKey as string;
      const initialToken = regRes.body.token as string;
      expect(firstRecoveryKey).toMatch(/^EPAR-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

      // Sans clé de récupération ni mot de passe actuel -> 401
      const missingProofRes = await request(app).patch('/api/auth/password').send({
        email: 'camille@eparnio.fr',
        newPassword: 'NouveauPassword789!'
      });
      expect(missingProofRes.status).toBe(401);

      // Avec une mauvaise clé de récupération -> 401
      const wrongKeyRes = await request(app).patch('/api/auth/password').send({
        email: 'camille@eparnio.fr',
        recoveryKey: 'EPAR-0000-0000',
        newPassword: 'NouveauPassword789!'
      });
      expect(wrongKeyRes.status).toBe(401);

      // Mot de passe trop faible -> 400
      const weakPwdRes = await request(app).patch('/api/auth/password').send({
        email: 'camille@eparnio.fr',
        recoveryKey: firstRecoveryKey,
        newPassword: 'faible'
      });
      expect(weakPwdRes.status).toBe(400);

      // Avec la clé valide saisie en minuscules et avec espaces -> 200
      const formattedKey = ` ${firstRecoveryKey.toLowerCase()} `;
      const resetRes = await request(app).patch('/api/auth/password').send({
        email: 'camille@eparnio.fr',
        recoveryKey: formattedKey,
        newPassword: 'NouveauPassword789!'
      });
      expect(resetRes.status).toBe(200);

      // L'ancien JWT émis avant le reset est révoqué
      const oldJwtAfterReset = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${initialToken}`);
      expect(oldJwtAfterReset.status).toBe(401);

      // Connexion avec le nouveau mot de passe
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'camille@eparnio.fr',
        password: 'NouveauPassword789!'
      });
      expect(loginRes.status).toBe(200);
      const freshToken = loginRes.body.token as string;

      // Régénération de la clé de récupération via POST /api/auth/recovery-key
      const regenRes = await request(app)
        .post('/api/auth/recovery-key')
        .set('Authorization', `Bearer ${freshToken}`)
        .send();
      expect(regenRes.status).toBe(200);
      const secondRecoveryKey = regenRes.body.recoveryKey as string;
      expect(secondRecoveryKey).toMatch(/^EPAR-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(secondRecoveryKey).not.toBe(firstRecoveryKey);

      // L'ancienne clé de récupération ne fonctionne plus
      const oldKeyReuseRes = await request(app).patch('/api/auth/password').send({
        email: 'camille@eparnio.fr',
        recoveryKey: firstRecoveryKey,
        newPassword: 'EncoreAutrePassword1!'
      });
      expect(oldKeyReuseRes.status).toBe(401);

      // La nouvelle clé de récupération fonctionne
      const newKeyResetRes = await request(app).patch('/api/auth/password').send({
        email: 'camille@eparnio.fr',
        recoveryKey: secondRecoveryKey,
        newPassword: 'EncoreAutrePassword1!'
      });
      expect(newKeyResetRes.status).toBe(200);
    });
  });

  describe('CRUD /api/budgets & Contrôle d’accès', () => {
    it('gère la liste, création, renommage et suppression avec vérification propriétaire', async () => {
      const regA = await registerSampleUser({ email: 'alice@eparnio.fr', displayName: 'Alice' });
      const regB = await registerSampleUser({ email: 'bob@eparnio.fr', displayName: 'Bob' });

      const tokenA = regA.body.token as string;
      const tokenB = regB.body.token as string;
      const defaultBudgetAId = regA.body.defaultBudget.id as string;

      // Impossible de supprimer le dernier budget
      const deleteLastRes = await request(app)
        .delete(`/api/budgets/${defaultBudgetAId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(deleteLastRes.status).toBe(400);

      // Création d'un second espace partagé
      const createRes = await request(app)
        .post('/api/budgets')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Budget Couple',
          type: 'shared',
          budgetStartDay: 27,
          contributionMode: 'income_prorata'
        });
      expect(createRes.status).toBe(201);
      const sharedBudgetId = createRes.body.budget.id as string;
      expect(createRes.body.budget.type).toBe('shared');

      // Liste des budgets de A (2 espaces)
      const listRes = await request(app)
        .get('/api/budgets')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.budgets).toHaveLength(2);

      // Un utilisateur tiers B ne peut pas modifier ni supprimer le budget de A
      const forbiddenPatch = await request(app)
        .patch(`/api/budgets/${sharedBudgetId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Piratage' });
      expect(forbiddenPatch.status).toBe(403);

      const forbiddenDelete = await request(app)
        .delete(`/api/budgets/${sharedBudgetId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(forbiddenDelete.status).toBe(403);

      // Renommage autorisé pour A
      const patchOk = await request(app)
        .patch(`/api/budgets/${sharedBudgetId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Budget Foyer', budgetStartDay: 15 });
      expect(patchOk.status).toBe(200);
      expect(patchOk.body.budget.name).toBe('Budget Foyer');
      expect(patchOk.body.budget.budgetStartDay).toBe(15);

      // Suppression autorisée de l'espace secondaire
      const deleteOk = await request(app)
        .delete(`/api/budgets/${sharedBudgetId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(deleteOk.status).toBe(200);

      // JWT portant un userId inexistant retourne 401 sur /me (Étape 58 : révocation stricte)
      const ghostToken = signAccessToken({
        id: new mongoose.Types.ObjectId().toString(),
        email: 'ghost@eparnio.fr'
      });
      const ghostMe = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${ghostToken}`);
      expect(ghostMe.status).toBe(401);
    });
  });

  describe('Étape 8 — Sécurisation : parseEnvConfig, Rate Limiter & Suppression en cascade', () => {
    it('valide JWT_SECRET en production via parseEnvConfig', () => {
      expect(() =>
        parseEnvConfig({
          NODE_ENV: 'production'
        })
      ).toThrow();

      expect(() =>
        parseEnvConfig({
          NODE_ENV: 'production',
          JWT_SECRET: 'eparnio-dev-secret-key-change-in-production'
        })
      ).toThrow();

      expect(() =>
        parseEnvConfig({
          NODE_ENV: 'production',
          JWT_SECRET: 'secret-trop-court'
        })
      ).toThrow();

      const validProd = parseEnvConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'un-secret-production-aleatoire-de-plus-de-32-caracteres!'
      });
      expect(validProd.NODE_ENV).toBe('production');
      expect(validProd.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
      expect(validProd.JWT_EXPIRES_IN).toBe('24h');
      expect(validProd.BCRYPT_SALT_ROUNDS).toBe(10);
      expect(validProd.INVITE_CODE_TTL_HOURS).toBe(24);
      expect(validProd.RATE_LIMIT_WINDOW_MINUTES).toBe(15);
      expect(validProd.AUTH_RATE_LIMIT_MAX).toBe(20);
      expect(validProd.INVITE_RATE_LIMIT_MAX).toBe(15);
      expect(validProd.SMTP_TIMEOUT_MS).toBe(15000);
      expect(validProd.PASSWORD_RESET_MAX_ATTEMPTS).toBe(5);
      expect(validProd.JSON_BODY_LIMIT).toBe('1mb');

      const customEnv = parseEnvConfig({
        NODE_ENV: 'development',
        JWT_EXPIRES_IN: '7d',
        BCRYPT_SALT_ROUNDS: '12',
        INVITE_CODE_TTL_HOURS: '48',
        RATE_LIMIT_WINDOW_MINUTES: '30',
        AUTH_RATE_LIMIT_MAX: '50',
        INVITE_RATE_LIMIT_MAX: '25',
        SMTP_TIMEOUT_MS: '20000',
        PASSWORD_RESET_MAX_ATTEMPTS: '3',
        JSON_BODY_LIMIT: '2mb'
      });
      expect(customEnv).toMatchObject({
        JWT_EXPIRES_IN: '7d',
        BCRYPT_SALT_ROUNDS: 12,
        INVITE_CODE_TTL_HOURS: 48,
        RATE_LIMIT_WINDOW_MINUTES: 30,
        AUTH_RATE_LIMIT_MAX: 50,
        INVITE_RATE_LIMIT_MAX: 25,
        SMTP_TIMEOUT_MS: 20000,
        PASSWORD_RESET_MAX_ATTEMPTS: 3,
        JSON_BODY_LIMIT: '2mb'
      });

      expect(() =>
        parseEnvConfig({
          NODE_ENV: 'development',
          JWT_EXPIRES_IN: 'invalid-ttl'
        })
      ).toThrow();
    });

    it('applique le rate limiter (429 + Retry-After) après 20 tentatives sur /api/auth/login', async () => {
      await registerSampleUser();

      for (let i = 0; i < 20; i += 1) {
        const res = await request(app)
          .post('/api/auth/login')
          .set('x-test-rate-limit-key', 'brute-login-test')
          .send({
            email: 'camille@eparnio.fr',
            password: 'MauvaisPassword1!'
          });
        expect(res.status).toBe(401);
      }

      const blockedRes = await request(app)
        .post('/api/auth/login')
        .set('x-test-rate-limit-key', 'brute-login-test')
        .send({
          email: 'camille@eparnio.fr',
          password: 'MauvaisPassword1!'
        });
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers['retry-after']).toBeDefined();
    });

    it('supprime en cascade périodes, enveloppes, transactions et épargnes lors de DELETE /api/budgets/:id', async () => {
      const regRes = await registerSampleUser();
      const token = regRes.body.token as string;
      const userId = regRes.body.user.id as string;

      const createBudgetRes = await request(app)
        .post('/api/budgets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Budget À Supprimer', type: 'shared' });
      expect(createBudgetRes.status).toBe(201);
      const targetBudgetId = createBudgetRes.body.budget.id as string;

      const period = await BudgetPeriodModel.create({
        budgetId: targetBudgetId,
        year: 2025,
        month: 12,
        label: 'Décembre 2025',
        startDate: new Date('2025-12-01T00:00:00.000Z'),
        endDate: new Date('2025-12-31T23:59:59.999Z')
      });

      const envelope = await EnvelopeModel.create({
        budgetId: targetBudgetId,
        budgetPeriodId: period._id,
        pillar: 'variable_envelope',
        name: 'Courses',
        icon: '🛒',
        color: '#3B82F6',
        allocatedAmount: 300,
        spentOrPaidAmount: 50,
        date: new Date('2025-12-10T00:00:00.000Z')
      });

      await TransactionModel.create({
        budgetId: targetBudgetId,
        budgetPeriodId: period._id,
        envelopeId: envelope._id,
        authorId: userId,
        paidByUserId: userId,
        type: 'expense',
        amount: 50,
        label: 'Supermarché'
      });

      await SavingsGoalModel.create({
        budgetId: targetBudgetId,
        name: 'Vacances',
        targetAmount: 2000
      });

      const deleteRes = await request(app)
        .delete(`/api/budgets/${targetBudgetId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteRes.status).toBe(200);

      expect(await BudgetModel.countDocuments({ _id: targetBudgetId })).toBe(0);
      expect(await BudgetPeriodModel.countDocuments({ budgetId: targetBudgetId })).toBe(0);
      expect(await EnvelopeModel.countDocuments({ budgetId: targetBudgetId })).toBe(0);
      expect(await TransactionModel.countDocuments({ budgetId: targetBudgetId })).toBe(0);
      expect(await SavingsGoalModel.countDocuments({ budgetId: targetBudgetId })).toBe(0);
    });

    it('gère le flux complet de code par e-mail (POST /password/forgot, 401/429, 410 expiré, 200 et révocation JWT)', async () => {
      const regRes = await registerSampleUser();
      const initialToken = regRes.body.token as string;

      let sentCode: string | undefined;
      let sentTtl: number | undefined;
      setEmailSenderForTests(async ({ code, ttlMinutes }) => {
        sentCode = code;
        sentTtl = ttlMinutes;
      });

      // Compte inconnu -> 200 neutre sans envoi d'e-mail
      const unknownRes = await request(app)
        .post('/api/auth/password/forgot')
        .send({ email: 'inconnu@eparnio.fr' });
      expect(unknownRes.status).toBe(200);
      expect(sentCode).toBeUndefined();

      // Compte connu -> génère un code à 6 chiffres et l'envoie
      const forgotRes = await request(app)
        .post('/api/auth/password/forgot')
        .send({ email: 'camille@eparnio.fr' });
      expect(forgotRes.status).toBe(200);
      expect(sentCode).toMatch(/^\d{6}$/);
      expect(sentTtl).toBe(15);

      const wrongCode = sentCode === '000000' ? '999999' : '000000';
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        const failRes = await request(app).patch('/api/auth/password').send({
          email: 'camille@eparnio.fr',
          emailCode: wrongCode,
          newPassword: 'EmailResetPassword1!'
        });
        expect(failRes.status).toBe(401);
      }

      // 5e essai erroné -> 429 et invalidation du code
      const lockRes = await request(app).patch('/api/auth/password').send({
        email: 'camille@eparnio.fr',
        emailCode: wrongCode,
        newPassword: 'EmailResetPassword1!'
      });
      expect(lockRes.status).toBe(429);

      // Demande un nouveau code puis simule son expiration -> 410
      await request(app).post('/api/auth/password/forgot').send({ email: 'camille@eparnio.fr' });
      const expiredCode = sentCode!;
      await UserModel.updateOne(
        { email: 'camille@eparnio.fr' },
        { resetEmailCodeExpiresAt: new Date(Date.now() - 60_000) }
      );
      const expiredRes = await request(app).patch('/api/auth/password').send({
        email: 'camille@eparnio.fr',
        emailCode: expiredCode,
        newPassword: 'EmailResetPassword1!'
      });
      expect(expiredRes.status).toBe(410);

      // Demande un dernier code valide -> réinitialise et révoque l'ancien JWT
      await request(app).post('/api/auth/password/forgot').send({ email: 'camille@eparnio.fr' });
      const validCode = sentCode!;
      const resetOkRes = await request(app).patch('/api/auth/password').send({
        email: 'camille@eparnio.fr',
        emailCode: validCode,
        newPassword: 'EmailResetPassword1!'
      });
      expect(resetOkRes.status).toBe(200);

      const revokedJwtRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${initialToken}`);
      expect(revokedJwtRes.status).toBe(401);

      const loginAfterEmailReset = await request(app).post('/api/auth/login').send({
        email: 'camille@eparnio.fr',
        password: 'EmailResetPassword1!'
      });
      expect(loginAfterEmailReset.status).toBe(200);
    });

    it('envoie un e-mail complet via sendSmtpMail contre un serveur TCP SMTP local', async () => {
      const receivedCommands: string[] = [];
      let receivedBody = '';

      const mockServer = net.createServer((socket) => {
        let buffer = '';
        let inDataMode = false;
        socket.write('220 localhost ESMTP Mock\r\n');

        socket.on('data', (chunk) => {
          buffer += chunk.toString('utf8');

          while (true) {
            if (inDataMode) {
              const endMarker = buffer.indexOf('\r\n.\r\n');
              if (endMarker === -1) break;
              receivedBody = buffer.slice(0, endMarker);
              buffer = buffer.slice(endMarker + 5);
              inDataMode = false;
              socket.write('250 2.0.0 OK queued\r\n');
              continue;
            }

            const crlfIndex = buffer.indexOf('\r\n');
            if (crlfIndex === -1) break;
            const line = buffer.slice(0, crlfIndex);
            buffer = buffer.slice(crlfIndex + 2);
            receivedCommands.push(line);

            const upper = line.toUpperCase();
            if (upper.startsWith('EHLO')) {
              socket.write('250-localhost Hello\r\n250 AUTH PLAIN\r\n');
            } else if (upper.startsWith('AUTH PLAIN')) {
              socket.write('235 2.7.0 Authentication successful\r\n');
            } else if (upper.startsWith('MAIL FROM:')) {
              socket.write('250 2.1.0 OK\r\n');
            } else if (upper.startsWith('RCPT TO:')) {
              socket.write('250 2.1.5 OK\r\n');
            } else if (upper === 'DATA') {
              inDataMode = true;
              socket.write('354 Start mail input\r\n');
            } else if (upper === 'QUIT') {
              socket.write('221 2.0.0 Bye\r\n');
              socket.end();
            } else {
              socket.write('500 Unknown command\r\n');
            }
          }
        });
      });

      await new Promise<void>((resolve) => {
        mockServer.listen(0, '127.0.0.1', () => resolve());
      });

      try {
        const address = mockServer.address();
        if (!address || typeof address === 'string') {
          throw new Error('Port SMTP mock introuvable');
        }

        await sendSmtpMail({
          host: '127.0.0.1',
          port: address.port,
          secure: false,
          user: 'eparnio.contact@gmail.com',
          pass: 'abcd efgh ijkl mnop',
          from: 'Eparnio <no-reply@eparnio.app>',
          to: 'camille@eparnio.fr',
          subject: 'Code de récupération',
          text: 'Code : 123456\n.ligne commençant par un point'
        });

        const expectedAuth = Buffer.from(
          '\u0000eparnio.contact@gmail.com\u0000abcdefghijklmnop',
          'utf8'
        ).toString('base64');
        expect(receivedCommands).toContain(`AUTH PLAIN ${expectedAuth}`);
        expect(receivedCommands).toContain('MAIL FROM:<eparnio.contact@gmail.com>');
        expect(receivedCommands).toContain('RCPT TO:<camille@eparnio.fr>');
        expect(receivedCommands).toContain('DATA');
        expect(receivedCommands).toContain('QUIT');
        expect(receivedBody).toContain('Code : 123456');
        expect(receivedBody).toContain('..ligne commençant par un point');
      } finally {
        await new Promise<void>((resolve) => {
          mockServer.close(() => resolve());
        });
      }
    });
  });
});

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { resetAllRateLimiters } from '../middlewares/rateLimit.middleware';
import { BudgetModel } from '../models/Budget.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { SavingsGoalModel } from '../models/SavingsGoal.model';
import { TransactionModel } from '../models/Transaction.model';
import { UserModel } from '../models/User.model';
import { calculateContributionSplit } from '../services/invite.service';
import {
  computeCycleBounds,
  daysInUtcMonth,
  resolveCycleYearMonthForDate
} from '../services/periodRollover.service';

describe('Étape 7 — API Partage Complet, Calculateur 50/50 & Prorata, Membres & Reconduction Mensuelle', () => {
  const app = createApp();
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
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

  async function registerUser(email: string, displayName: string, budgetStartDay = 1) {
    const res = await request(app).post('/api/auth/register').send({
      email,
      password: 'Password123!',
      displayName,
      avatarEmoji: '🧑',
      budgetStartDay
    });
    return {
      token: res.body.token as string,
      userId: res.body.user.id as string,
      budgetId: res.body.defaultBudget.id as string
    };
  }

  it('génère/régénère un code d’invitation, permet de rejoindre, protège les anciens codes et enrichit les membres', async () => {
    const owner = await registerUser('owner@eparnio.fr', 'Johann');
    const partner = await registerUser('partner@eparnio.fr', 'Claire');
    const outsider = await registerUser('outsider@eparnio.fr', 'Marc');

    const createBudgetRes = await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Budget Couple', type: 'personal', budgetStartDay: 1 });
    expect(createBudgetRes.status).toBe(201);
    const sharedBudgetId = createBudgetRes.body.budget.id as string;

    // Génération initiale du code
    const inviteRes = await request(app)
      .post(`/api/budgets/${sharedBudgetId}/invite`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(inviteRes.status).toBe(200);
    const firstCode = inviteRes.body.inviteCode as string;
    expect(firstCode).toMatch(/^[A-Z0-9]{8,}$/);
    expect(inviteRes.body.budget.type).toBe('shared');
    expect(typeof inviteRes.body.inviteExpiresAt).toBe('string');
    const ttlRemainingMs =
      new Date(inviteRes.body.inviteExpiresAt as string).getTime() - Date.now();
    expect(ttlRemainingMs).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(ttlRemainingMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 60_000);

    // Claire rejoint via le code en minuscules avec espaces (normalisation)
    const joinRes = await request(app)
      .post(`/api/budgets/join/${firstCode.toLowerCase()}`)
      .set('Authorization', `Bearer ${partner.token}`);
    expect(joinRes.status).toBe(200);
    expect(joinRes.body.alreadyMember).toBe(false);
    expect(joinRes.body.budget.members).toHaveLength(2);
    const claireMember = joinRes.body.budget.members.find(
      (m: { userId: string }) => m.userId === partner.userId
    );
    expect(claireMember.role).toBe('editor');
    expect(claireMember.displayName).toBe('Claire');
    expect(claireMember.color).not.toBe('#7C3AED');

    // Ré-adhésion idempotente
    const joinAgainRes = await request(app)
      .post(`/api/budgets/join/${firstCode}`)
      .set('Authorization', `Bearer ${partner.token}`);
    expect(joinAgainRes.status).toBe(200);
    expect(joinAgainRes.body.alreadyMember).toBe(true);
    expect(joinAgainRes.body.budget.members).toHaveLength(2);

    // Régénération du code (révoque l'ancien)
    const regenRes = await request(app)
      .post(`/api/budgets/${sharedBudgetId}/invite`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(regenRes.status).toBe(200);
    expect(regenRes.body.inviteCode).not.toBe(firstCode);

    const oldCodeRes = await request(app)
      .post(`/api/budgets/join/${firstCode}`)
      .set('Authorization', `Bearer ${outsider.token}`);
    expect(oldCodeRes.status).toBe(404);

    // GET /api/budgets expose le budget commun avec les noms des deux membres pour Claire
    const listPartnerRes = await request(app)
      .get('/api/budgets')
      .set('Authorization', `Bearer ${partner.token}`);
    expect(listPartnerRes.status).toBe(200);
    const foundShared = listPartnerRes.body.budgets.find(
      (b: { id: string }) => b.id === sharedBudgetId
    );
    expect(foundShared.members.map((m: { displayName: string }) => m.displayName)).toEqual(
      expect.arrayContaining(['Johann', 'Claire'])
    );
  });

  it('calcule les répartitions 50/50 et Prorata (60/40) et met à jour les apports de la période', async () => {
    const zeroFallback = calculateContributionSplit({
      mode: 'income_prorata',
      targetAmount: 1000,
      members: [
        {
          userId: 'u1',
          displayName: 'A',
          avatarEmoji: '🧑',
          color: '#7C3AED',
          role: 'owner',
          declaredMonthlyIncome: 0
        },
        {
          userId: 'u2',
          displayName: 'B',
          avatarEmoji: '👩',
          color: '#EC4899',
          role: 'editor',
          declaredMonthlyIncome: 0
        }
      ]
    });
    expect(zeroFallback.members.map((m) => m.recommendedContribution)).toEqual([500, 500]);

    const owner = await registerUser('johann@eparnio.fr', 'Johann');
    const partner = await registerUser('claire@eparnio.fr', 'Claire');

    const createRes = await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Budget Foyer', type: 'shared', budgetStartDay: 1 });
    const sharedId = createRes.body.budget.id as string;

    const inv = await request(app)
      .post(`/api/budgets/${sharedId}/invite`)
      .set('Authorization', `Bearer ${owner.token}`);
    await request(app)
      .post(`/api/budgets/join/${inv.body.inviteCode}`)
      .set('Authorization', `Bearer ${partner.token}`);

    // Crée une période et 1 500 € de dépenses fixes + enveloppes
    const periodRes = await request(app)
      .get(`/api/budgets/${sharedId}/periods/by-month?year=2026&month=3`)
      .set('Authorization', `Bearer ${owner.token}`);
    const periodId = periodRes.body.period.id as string;

    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ pillar: 'fixed_charge', name: 'Loyer commun', allocatedAmount: 1000 });
    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ pillar: 'variable_envelope', name: 'Courses communes', allocatedAmount: 500 });

    // 1. Calcul 50/50 avec application sur la période (1 500 € -> 750 € chacun)
    const split50Res = await request(app)
      .patch(`/api/budgets/${sharedId}/contribution-split`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        contributionMode: 'equal_50_50',
        periodId,
        applyToPeriod: true
      });
    expect(split50Res.status).toBe(200);
    expect(split50Res.body.split.targetAmount).toBe(1500);
    expect(split50Res.body.split.members.map((m: { recommendedContribution: number }) => m.recommendedContribution)).toEqual([
      750,
      750
    ]);
    expect(split50Res.body.period.summary.plannedIncome).toBe(1500);
    expect(split50Res.body.period.summary.remainingToAllocate).toBe(0);

    // 2. Calcul Prorata 2400 € / 1600 € -> 60% / 40% soit 900 € / 600 € (met à jour sans dupliquer)
    const prorataRes = await request(app)
      .patch(`/api/budgets/${sharedId}/contribution-split`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        contributionMode: 'income_prorata',
        periodId,
        applyToPeriod: true,
        members: [
          { userId: owner.userId, declaredMonthlyIncome: 2400 },
          { userId: partner.userId, declaredMonthlyIncome: 1600, role: 'viewer' }
        ]
      });
    expect(prorataRes.status).toBe(200);
    expect(prorataRes.body.budget.contributionMode).toBe('income_prorata');
    expect(prorataRes.body.split.totalDeclaredIncome).toBe(4000);
    const johannSplit = prorataRes.body.split.members.find(
      (m: { userId: string }) => m.userId === owner.userId
    );
    const claireSplit = prorataRes.body.split.members.find(
      (m: { userId: string }) => m.userId === partner.userId
    );
    expect(johannSplit.sharePercentage).toBe(60);
    expect(johannSplit.recommendedContribution).toBe(900);
    expect(claireSplit.sharePercentage).toBe(40);
    expect(claireSplit.recommendedContribution).toBe(600);
    expect(prorataRes.body.period.summary.plannedIncome).toBe(1500);

    // Vérifie qu'il n'y a bien que 2 lignes d'apports (pas de doublon) et que Claire est passée en viewer
    const envAfter = await EnvelopeModel.find({ budgetPeriodId: periodId, pillar: 'income' });
    expect(envAfter).toHaveLength(2);

    const viewerBlocked = await request(app)
      .post(`/api/budgets/${sharedId}/invite`)
      .set('Authorization', `Bearer ${partner.token}`);
    expect(viewerBlocked.status).toBe(403);
  });

  it('gère le retrait des membres et le départ volontaire avec contrôle strict des droits', async () => {
    const owner = await registerUser('alice@eparnio.fr', 'Alice');
    const memberB = await registerUser('bob@eparnio.fr', 'Bob');
    const memberC = await registerUser('chloe@eparnio.fr', 'Chloé');

    const createRes = await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Coloc', type: 'shared' });
    const budgetId = createRes.body.budget.id as string;

    const inv = await request(app)
      .post(`/api/budgets/${budgetId}/invite`)
      .set('Authorization', `Bearer ${owner.token}`);
    await request(app)
      .post(`/api/budgets/join/${inv.body.inviteCode}`)
      .set('Authorization', `Bearer ${memberB.token}`);
    await request(app)
      .post(`/api/budgets/join/${inv.body.inviteCode}`)
      .set('Authorization', `Bearer ${memberC.token}`);

    // Un non-propriétaire ne peut pas retirer un autre membre
    const forbiddenRemove = await request(app)
      .delete(`/api/budgets/${budgetId}/members/${memberC.userId}`)
      .set('Authorization', `Bearer ${memberB.token}`);
    expect(forbiddenRemove.status).toBe(403);

    // Le propriétaire ne peut pas être retiré
    const ownerRemoveRes = await request(app)
      .delete(`/api/budgets/${budgetId}/members/${owner.userId}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(ownerRemoveRes.status).toBe(400);

    // Bob quitte volontairement
    const leaveRes = await request(app)
      .delete(`/api/budgets/${budgetId}/members/${memberB.userId}`)
      .set('Authorization', `Bearer ${memberB.token}`);
    expect(leaveRes.status).toBe(200);
    expect(leaveRes.body.budget.members).toHaveLength(2);

    // Le propriétaire retire Chloé
    const kickRes = await request(app)
      .delete(`/api/budgets/${budgetId}/members/${memberC.userId}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(kickRes.status).toBe(200);
    expect(kickRes.body.budget.members).toHaveLength(1);

    // Chloé n'a plus accès aux périodes du budget
    const deniedRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/current`)
      .set('Authorization', `Bearer ${memberC.token}`);
    expect(deniedRes.status).toBe(403);
  });

  it('reconduit automatiquement les récurrents et enveloppes au mois suivant (by-month & /rollover) sans doublon', async () => {
    expect(daysInUtcMonth(2024, 2)).toBe(29);
    const febBounds = computeCycleBounds(2025, 2, 31);
    expect(febBounds.startDate.toISOString()).toBe('2025-01-31T00:00:00.000Z');
    expect(febBounds.endDate.toISOString()).toBe('2025-02-27T23:59:59.999Z');
    expect(resolveCycleYearMonthForDate(new Date('2025-01-31T10:00:00.000Z'), 31)).toEqual({
      year: 2025,
      month: 2
    });

    const user = await registerUser('rollover@eparnio.fr', 'Thomas', 1);

    const octRes = await request(app)
      .get(`/api/budgets/${user.budgetId}/periods/by-month?year=2025&month=10`)
      .set('Authorization', `Bearer ${user.token}`);
    const octId = octRes.body.period.id as string;

    const goalRes = await request(app)
      .post(`/api/budgets/${user.budgetId}/goals`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Vacances', targetAmount: 2000, initialAmount: 0 });
    const goalId = goalRes.body.goal.id as string;

    // Revenu récurrent + prime ponctuelle
    const salRes = await request(app)
      .post(`/api/periods/${octId}/envelopes`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        pillar: 'income',
        name: 'Salaire',
        allocatedAmount: 2500,
        isRecurring: true,
        isPaid: true
      });
    expect(salRes.status).toBe(201);

    await request(app)
      .post(`/api/periods/${octId}/envelopes`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        pillar: 'income',
        name: 'Prime exceptionnelle',
        allocatedAmount: 300,
        isRecurring: false,
        isPaid: true
      });

    // Charge fixe récurrente + achat ponctuel
    await request(app)
      .post(`/api/periods/${octId}/envelopes`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        pillar: 'fixed_charge',
        name: 'Loyer',
        allocatedAmount: 900,
        isRecurring: true,
        isPaid: true
      });
    await request(app)
      .post(`/api/periods/${octId}/envelopes`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        pillar: 'fixed_charge',
        name: 'Taxe ponctuelle',
        allocatedAmount: 120,
        isRecurring: false,
        isPaid: true
      });

    // Enveloppe variable avec dépense
    const coursesRes = await request(app)
      .post(`/api/periods/${octId}/envelopes`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        pillar: 'variable_envelope',
        name: 'Courses',
        allocatedAmount: 400
      });
    const coursesId = coursesRes.body.envelope.id as string;

    await request(app)
      .post(`/api/periods/${octId}/transactions`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        envelopeId: coursesId,
        amount: 145,
        label: 'Supermarché'
      });

    // Épargne récurrente liée au goal
    await request(app)
      .post(`/api/periods/${octId}/envelopes`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        pillar: 'savings',
        name: 'Virement Vacances',
        allocatedAmount: 200,
        isRecurring: true,
        linkedGoalId: goalId
      });

    // Navigation vers Novembre 2025 -> reconduction automatique
    const novRes = await request(app)
      .get(`/api/budgets/${user.budgetId}/periods/by-month?year=2025&month=11`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(novRes.status).toBe(200);
    const novId = novRes.body.period.id as string;
    const novEnvelopes = novRes.body.envelopes as Array<{
      name: string;
      pillar: string;
      isPaid: boolean;
      spentOrPaidAmount: number;
      allocatedAmount: number;
    }>;

    // 4 éléments reconduits : Salaire, Loyer, Courses, Virement Vacances (les 2 non récurrents exclus)
    expect(novEnvelopes).toHaveLength(4);
    expect(novEnvelopes.find((e) => e.name === 'Prime exceptionnelle')).toBeUndefined();
    expect(novEnvelopes.find((e) => e.name === 'Taxe ponctuelle')).toBeUndefined();

    const novSalaire = novEnvelopes.find((e) => e.name === 'Salaire');
    const novLoyer = novEnvelopes.find((e) => e.name === 'Loyer');
    const novCourses = novEnvelopes.find((e) => e.name === 'Courses');
    expect(novSalaire?.isPaid).toBe(false);
    expect(novLoyer?.isPaid).toBe(false);
    expect(novCourses?.allocatedAmount).toBe(400);
    expect(novCourses?.spentOrPaidAmount).toBe(0);

    // Base Zéro en Novembre : 2500 - 900 - 400 - 200 = 1000 €
    expect(novRes.body.period.summary.remainingToAllocate).toBe(1000);

    // Vérifie que l'objectif Vacances cumule Octobre (200) + Novembre (200) = 400 €
    const updatedGoal = await SavingsGoalModel.findById(goalId);
    expect(updatedGoal?.currentAmount).toBe(400);

    // Reconduction explicite via POST /rollover vers Décembre 2025 (2 appels idempotents)
    const decRes1 = await request(app)
      .post(`/api/budgets/${user.budgetId}/periods/${novId}/rollover`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(decRes1.status).toBe(200);
    expect(decRes1.body.period.label).toBe('Décembre 2025');
    expect(decRes1.body.envelopes).toHaveLength(4);

    const decRes2 = await request(app)
      .post(`/api/budgets/${user.budgetId}/periods/${novId}/rollover`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(decRes2.status).toBe(200);
    expect(decRes2.body.envelopes).toHaveLength(4);
  });

  it('rejette avec 410 un code d’invitation expiré et restaure l’accès après régénération (24h)', async () => {
    const ownerRes = await request(app).post('/api/auth/register').send({
      email: 'owner-exp@eparnio.fr',
      password: 'Password123!',
      displayName: 'Owner'
    });
    const guestRes = await request(app).post('/api/auth/register').send({
      email: 'guest-exp@eparnio.fr',
      password: 'Password123!',
      displayName: 'Guest'
    });

    const ownerToken = ownerRes.body.token as string;
    const guestToken = guestRes.body.token as string;

    const createBudgetRes = await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Budget Expire Test', type: 'shared' });
    expect(createBudgetRes.status).toBe(201);
    const budgetId = createBudgetRes.body.budget.id as string;

    const firstInviteRes = await request(app)
      .post(`/api/budgets/${budgetId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(firstInviteRes.status).toBe(200);
    const expiredCode = firstInviteRes.body.inviteCode as string;

    // Simule un code expiré en base (il y a 1 heure)
    await BudgetModel.findByIdAndUpdate(budgetId, {
      inviteExpiresAt: new Date(Date.now() - 60 * 60 * 1000)
    });

    const expiredJoinRes = await request(app)
      .post(`/api/budgets/join/${expiredCode}`)
      .set('Authorization', `Bearer ${guestToken}`);
    expect(expiredJoinRes.status).toBe(410);

    // La régénération réinitialise une fenêtre de 24h et permet de rejoindre
    const regenInviteRes = await request(app)
      .post(`/api/budgets/${budgetId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(regenInviteRes.status).toBe(200);
    const freshCode = regenInviteRes.body.inviteCode as string;
    expect(freshCode).not.toBe(expiredCode);
    expect(new Date(regenInviteRes.body.inviteExpiresAt as string).getTime()).toBeGreaterThan(
      Date.now() + 23 * 60 * 60 * 1000
    );

    const validJoinRes = await request(app)
      .post(`/api/budgets/join/${freshCode}`)
      .set('Authorization', `Bearer ${guestToken}`);
    expect(validJoinRes.status).toBe(200);
  });

  it('applique le rate limiter (429) après 15 tentatives sur POST /api/budgets/join/:inviteCode', async () => {
    const guestRes = await request(app).post('/api/auth/register').send({
      email: 'brute-guest@eparnio.fr',
      password: 'Password123!',
      displayName: 'Brute'
    });
    const guestToken = guestRes.body.token as string;

    for (let i = 0; i < 15; i += 1) {
      const attemptRes = await request(app)
        .post('/api/budgets/join/INVALIDE99')
        .set('Authorization', `Bearer ${guestToken}`)
        .set('x-test-rate-limit-key', 'brute-invite-test');
      expect(attemptRes.status).toBe(404);
    }

    const blockedRes = await request(app)
      .post('/api/budgets/join/INVALIDE99')
      .set('Authorization', `Bearer ${guestToken}`)
      .set('x-test-rate-limit-key', 'brute-invite-test');
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers['retry-after']).toBeDefined();
  });
});

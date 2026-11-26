import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { resetAllRateLimiters } from '../middlewares/rateLimit.middleware';
import { AssetAccountModel } from '../models/AssetAccount.model';
import { BudgetModel } from '../models/Budget.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { SavingsGoalModel } from '../models/SavingsGoal.model';
import { TransactionModel } from '../models/Transaction.model';
import { UserModel } from '../models/User.model';

const app = createApp();

let mongoServer: MongoMemoryServer;

async function registerAndLogin(email: string, displayName: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .set('x-test-rate-limit-key', `reg-${email}`)
    .send({
      email,
      password: 'Password123',
      displayName
    });
  return {
    token: res.body.token as string,
    userId: res.body.user.id as string,
    budgetId: res.body.defaultBudget.id as string
  };
}

describe('JSON Backup Import & Restore (Étape 51)', () => {
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
      TransactionModel.deleteMany({}),
      SavingsGoalModel.deleteMany({}),
      AssetAccountModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('effectue un aller-retour complet (export v2 -> preview -> create_new) avec intégrité de toutes les collections', async () => {
    const owner = await registerAndLogin('owner@eparnio.test', 'Alice');

    // Créer un compte patrimonial
    const asset = await AssetAccountModel.create({
      budgetId: owner.budgetId,
      name: 'Livret A',
      category: 'cash',
      icon: '🏦',
      color: '#3B82F6',
      currentBalance: 1500,
      history: [{ date: new Date('2026-01-01T00:00:00.000Z'), balance: 1500 }],
      operations: [
        {
          date: new Date('2026-01-05T00:00:00.000Z'),
          type: 'add',
          amount: 500,
          label: 'Versement initial',
          balanceAfter: 1500,
          counterpartyType: 'external'
        }
      ]
    });

    // Créer un objectif d'épargne lié au compte patrimonial avec un retrait
    const goal = await SavingsGoalModel.create({
      budgetId: owner.budgetId,
      name: 'Vacances Japon',
      icon: '✈️',
      color: '#10B981',
      targetAmount: 3000,
      initialAmount: 200,
      currentAmount: 350,
      assetAccountId: asset._id,
      withdrawals: [
        {
          amount: 50,
          label: 'Acompte billet',
          date: new Date('2026-01-12T00:00:00.000Z'),
          memberId: new mongoose.Types.ObjectId(owner.userId),
          notes: 'Remboursable'
        }
      ]
    });

    // Créer 2 périodes (Janvier et Février 2026) pour tester le chaînage rollover previousEnvelopeId
    const p1 = await BudgetPeriodModel.create({
      budgetId: owner.budgetId,
      month: 1,
      year: 2026,
      label: 'Janvier 2026',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-31T23:59:59.999Z')
    });
    const p2 = await BudgetPeriodModel.create({
      budgetId: owner.budgetId,
      month: 2,
      year: 2026,
      label: 'Février 2026',
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      endDate: new Date('2026-02-28T23:59:59.999Z')
    });

    const incomeEnv = await EnvelopeModel.create({
      budgetId: owner.budgetId,
      budgetPeriodId: p1._id,
      pillar: 'income',
      name: 'Salaire',
      allocatedAmount: 2500,
      isRecurring: true,
      isPaid: true
    });
    const fixedEnv = await EnvelopeModel.create({
      budgetId: owner.budgetId,
      budgetPeriodId: p1._id,
      pillar: 'fixed_charge',
      name: 'Loyer',
      allocatedAmount: 900,
      isRecurring: true,
      isPaid: true
    });
    const savingsEnv = await EnvelopeModel.create({
      budgetId: owner.budgetId,
      budgetPeriodId: p1._id,
      pillar: 'savings',
      name: 'Vacances Japon',
      allocatedAmount: 200,
      linkedGoalId: goal._id
    });
    const coursesP1 = await EnvelopeModel.create({
      budgetId: owner.budgetId,
      budgetPeriodId: p1._id,
      pillar: 'variable_envelope',
      name: 'Courses',
      allocatedAmount: 400,
      spentOrPaidAmount: 120,
      rolloverEnabled: true,
      rolloverMode: 'positive_only'
    });
    const coursesP2 = await EnvelopeModel.create({
      budgetId: owner.budgetId,
      budgetPeriodId: p2._id,
      pillar: 'variable_envelope',
      name: 'Courses',
      allocatedAmount: 400,
      spentOrPaidAmount: 0,
      rolloverEnabled: true,
      rolloverMode: 'positive_only',
      rolloverAmount: 280,
      previousEnvelopeId: coursesP1._id
    });
    expect(incomeEnv._id).toBeDefined();
    expect(fixedEnv._id).toBeDefined();
    expect(savingsEnv._id).toBeDefined();
    expect(coursesP2._id).toBeDefined();

    // Créer une transaction fractionnée (splitGroupId) + tags
    const splitId = new mongoose.Types.ObjectId().toString();
    await TransactionModel.create([
      {
        budgetId: owner.budgetId,
        budgetPeriodId: p1._id,
        envelopeId: coursesP1._id,
        type: 'expense',
        amount: 100,
        label: 'Carrefour',
        date: new Date('2026-01-10T12:00:00.000Z'),
        authorId: owner.userId,
        paidByUserId: owner.userId,
        splitGroupId: splitId,
        tags: ['alimentation']
      },
      {
        budgetId: owner.budgetId,
        budgetPeriodId: p1._id,
        envelopeId: coursesP1._id,
        type: 'expense',
        amount: 20,
        label: 'Boulangerie',
        date: new Date('2026-01-10T12:00:00.000Z'),
        authorId: owner.userId,
        paidByUserId: owner.userId,
        splitGroupId: splitId,
        tags: ['alimentation']
      }
    ]);

    // 1. Export JSON v2
    const exportRes = await request(app)
      .get(`/api/budgets/${owner.budgetId}/export/json`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(exportRes.status).toBe(200);
    expect(exportRes.body.schemaVersion).toBe(2);
    expect(exportRes.body.assets).toHaveLength(1);

    const backupPayload = exportRes.body;

    // 2. Preview (zéro écriture en base)
    const budgetsCountBefore = await BudgetModel.countDocuments();
    const previewRes = await request(app)
      .post('/api/budgets/import/json/preview')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(backupPayload);
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.preview.schemaVersion).toBe(2);
    expect(previewRes.body.preview.periodsCount).toBe(2);
    expect(previewRes.body.preview.envelopesCount).toBe(5);
    expect(previewRes.body.preview.transactionsCount).toBe(2);
    expect(previewRes.body.preview.goalsCount).toBe(1);
    expect(previewRes.body.preview.assetsCount).toBe(1);
    expect(await BudgetModel.countDocuments()).toBe(budgetsCountBefore);

    // 3. Import en mode create_new
    const importRes = await request(app)
      .post('/api/budgets/import/json')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ backup: backupPayload, customName: 'Mon Budget Restauré' });
    expect(importRes.status).toBe(201);
    expect(importRes.body.budget.name).toBe('Mon Budget Restauré');
    expect(importRes.body.budget.id).not.toBe(owner.budgetId);
    expect(importRes.body.summary).toEqual({
      periodsCount: 2,
      envelopesCount: 5,
      transactionsCount: 2,
      goalsCount: 1,
      assetsCount: 1
    });

    const restoredBudgetId = importRes.body.budget.id;

    // Vérifier le remapping des ObjectId et l'intégrité des calculs
    const restoredPeriods = await BudgetPeriodModel.find({ budgetId: restoredBudgetId }).sort({
      month: 1
    });
    expect(restoredPeriods).toHaveLength(2);
    expect(restoredPeriods[0].summary.plannedIncome).toBe(2500);
    expect(restoredPeriods[0].summary.plannedFixedCharges).toBe(900);
    expect(restoredPeriods[0].summary.plannedSavings).toBe(200);
    expect(restoredPeriods[0].summary.spentVariables).toBe(120);
    expect(restoredPeriods[0].summary.remainingToLive).toBe(1280);

    const restoredGoals = await SavingsGoalModel.find({ budgetId: restoredBudgetId });
    expect(restoredGoals).toHaveLength(1);
    expect(restoredGoals[0].currentAmount).toBe(350); // 200 initial + 200 contrib - 50 withdrawal
    expect(restoredGoals[0].assetAccountId).toBeDefined();
    expect(restoredGoals[0].assetAccountId?.toString()).not.toBe(asset._id.toString());

    const restoredEnvelopes = await EnvelopeModel.find({ budgetId: restoredBudgetId });
    const restoredCoursesP2 = restoredEnvelopes.find(
      (e) => e.name === 'Courses' && e.rolloverAmount === 280
    );
    const restoredCoursesP1 = restoredEnvelopes.find(
      (e) => e.name === 'Courses' && e.rolloverAmount === 0
    );
    expect(restoredCoursesP2?.previousEnvelopeId?.toString()).toBe(
      restoredCoursesP1?._id.toString()
    );

    const restoredTxs = await TransactionModel.find({ budgetId: restoredBudgetId });
    expect(restoredTxs).toHaveLength(2);
    expect(restoredTxs[0].splitGroupId).toBeDefined();
    expect(restoredTxs[0].splitGroupId).toBe(restoredTxs[1].splitGroupId);
    expect(restoredTxs[0].splitGroupId).not.toBe(splitId);
  });

  it('supporte la rétrocompatibilité schemaVersion: 1 (sans assets) et rejette les payloads invalides ou injections $', async () => {
    const owner = await registerAndLogin('v1@eparnio.test', 'Bob');

    // Sans JWT -> 401
    const unauthRes = await request(app).post('/api/budgets/import/json/preview').send({});
    expect(unauthRes.status).toBe(401);

    // Version non supportée -> 400
    const badVersion = await request(app)
      .post('/api/budgets/import/json/preview')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        schemaVersion: 99,
        budget: { name: 'Test' },
        periods: [],
        envelopes: [],
        transactions: [],
        goals: []
      });
    expect(badVersion.status).toBe(400);

    // Injection clé MongoDB ($) -> 400
    const injectionRes = await request(app)
      .post('/api/budgets/import/json/preview')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        schemaVersion: 1,
        budget: { name: 'Test', $ne: true },
        periods: [],
        envelopes: [],
        transactions: [],
        goals: []
      });
    expect(injectionRes.status).toBe(400);

    // Rétrocompatibilité v1 sans champ assets -> 201
    const v1Res = await request(app)
      .post('/api/budgets/import/json')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        schemaVersion: 1,
        budget: { name: 'Backup V1', budgetStartDay: 1 },
        periods: [],
        envelopes: [],
        transactions: [],
        goals: []
      });
    expect(v1Res.status).toBe(201);
    expect(v1Res.body.summary.assetsCount).toBe(0);
  });

  it('gère le mode replace_existing (owner autorisé, editor refusé 403)', async () => {
    const owner = await registerAndLogin('rep-owner@eparnio.test', 'Claire');
    const editor = await registerAndLogin('rep-editor@eparnio.test', 'David');

    // Ajouter editor au budget de owner
    await BudgetModel.findByIdAndUpdate(owner.budgetId, {
      $set: { type: 'shared' },
      $push: {
        members: {
          userId: new mongoose.Types.ObjectId(editor.userId),
          role: 'editor',
          color: '#10B981',
          declaredMonthlyIncome: 0
        }
      }
    });

    const validBackup = {
      schemaVersion: 2,
      budget: { name: 'Remplacé', budgetStartDay: 5 },
      periods: [
        {
          id: 'p1',
          month: 3,
          year: 2026,
          startDate: '2026-03-05T00:00:00.000Z',
          endDate: '2026-04-04T23:59:59.999Z'
        }
      ],
      envelopes: [],
      transactions: [],
      goals: [],
      assets: []
    };

    // Editor -> 403
    const forbiddenRes = await request(app)
      .post(`/api/budgets/${owner.budgetId}/import/json`)
      .set('Authorization', `Bearer ${editor.token}`)
      .send(validBackup);
    expect(forbiddenRes.status).toBe(403);

    // Owner -> 200
    const okRes = await request(app)
      .post(`/api/budgets/${owner.budgetId}/import/json`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send(validBackup);
    expect(okRes.status).toBe(200);
    expect(okRes.body.budget.id).toBe(owner.budgetId);
    expect(okRes.body.budget.budgetStartDay).toBe(5);
    expect(okRes.body.summary.periodsCount).toBe(1);
  });
});

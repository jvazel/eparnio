import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { BudgetModel } from '../models/Budget.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { SavingsGoalModel } from '../models/SavingsGoal.model';
import { TransactionModel } from '../models/Transaction.model';
import { UserModel } from '../models/User.model';

describe('API Analyses & Budget Quotidien (/api/periods/:periodId/analytics)', () => {
  const app = createApp();
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
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

  it('calcule exactement la synthèse Finzee, le budget quotidien (28 j / 39,88 €) et les % Fixe/Variable/Épargne', async () => {
    const ownerRes = await request(app).post('/api/auth/register').send({
      email: 'johann@eparnio.fr',
      password: 'Password123!',
      displayName: 'Johann',
      budgetStartDay: 1
    });
    const token = ownerRes.body.token as string;
    const budgetId = ownerRes.body.defaultBudget.id as string;

    const periodRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2025&month=9`)
      .set('Authorization', `Bearer ${token}`);
    const periodId = periodRes.body.period.id as string;

    // 1. Revenus : 2150,50 €
    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'income',
        name: 'Salaire Johann',
        allocatedAmount: 2150.5,
        icon: '💵',
        color: '#16A34A'
      });

    // 2. Dépenses fixes : 864,99 €
    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'fixed_charge',
        name: 'Loyer & charges',
        allocatedAmount: 864.99,
        icon: '🏠',
        color: '#4F46E5'
      });

    // 3. Enveloppe variable (plafond 1163,51 € pour équilibrer Base Zéro à 0 €) + 47,00 € dépensés
    const envRes = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'variable_envelope',
        name: 'Courses',
        allocatedAmount: 1163.51,
        icon: '🛒',
        color: '#0EA5E9'
      });
    const coursesEnvelopeId = envRes.body.envelope.id as string;

    await request(app)
      .post(`/api/periods/${periodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        envelopeId: coursesEnvelopeId,
        amount: 47,
        label: 'Primeur',
        date: '2025-09-02T12:00:00.000Z'
      });

    // 4. Épargne : 122,00 €
    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'savings',
        name: 'Livret A',
        allocatedAmount: 122,
        icon: '🐷',
        color: '#22C55E'
      });

    // Appel analytics au 3 septembre 2025 (28 jours restants inclus dans septembre 2025)
    const analyticsRes = await request(app)
      .get(
        `/api/periods/${periodId}/analytics?referenceDate=${encodeURIComponent(
          '2025-09-03T12:00:00.000Z'
        )}`
      )
      .set('Authorization', `Bearer ${token}`);

    expect(analyticsRes.status).toBe(200);
    const { analytics } = analyticsRes.body;

    expect(analytics.budgetType).toBe('personal');
    expect(analytics.cashFlow).toEqual({
      plannedIncome: 2150.5,
      plannedFixedCharges: 864.99,
      plannedEnvelopes: 1163.51,
      spentVariables: 47,
      plannedSavings: 122,
      remainingToLive: 1116.51
    });

    expect(analytics.dailyBudget.totalDays).toBe(30);
    expect(analytics.dailyBudget.daysRemaining).toBe(28);
    expect(analytics.dailyBudget.dailyAmount).toBe(39.88);

    expect(analytics.allocation.totalOutflows).toBe(1033.99);
    expect(analytics.allocation.items).toEqual([
      expect.objectContaining({
        key: 'fixed',
        label: 'Fixe',
        color: '#8B5CF6',
        amount: 864.99,
        percentage: 83.7
      }),
      expect.objectContaining({
        key: 'variable',
        label: 'Variable',
        color: '#3B82F6',
        amount: 47,
        percentage: 4.5
      }),
      expect.objectContaining({
        key: 'savings',
        label: 'Épargne',
        color: '#22C55E',
        amount: 122,
        percentage: 11.8
      })
    ]);

    expect(analytics.zeroBased).toEqual({
      plannedIncome: 2150.5,
      totalAllocated: 2150.5,
      remainingToAllocate: 0,
      isBalanced: true
    });

    // Cas limites de dates : avant le début du cycle -> totalDays = 30 ; après la fin -> 0 jours et 0 €
    const beforeCycleRes = await request(app)
      .get(
        `/api/periods/${periodId}/analytics?referenceDate=${encodeURIComponent(
          '2025-08-25T10:00:00.000Z'
        )}`
      )
      .set('Authorization', `Bearer ${token}`);
    expect(beforeCycleRes.status).toBe(200);
    expect(beforeCycleRes.body.analytics.dailyBudget.daysRemaining).toBe(30);

    const afterCycleRes = await request(app)
      .get(
        `/api/periods/${periodId}/analytics?referenceDate=${encodeURIComponent(
          '2025-10-05T10:00:00.000Z'
        )}`
      )
      .set('Authorization', `Bearer ${token}`);
    expect(afterCycleRes.status).toBe(200);
    expect(afterCycleRes.body.analytics.dailyBudget.daysRemaining).toBe(0);
    expect(afterCycleRes.body.analytics.dailyBudget.dailyAmount).toBe(0);
  });

  it('calcule le bilan comparatif par membre en budget partagé et applique le contrôle d’accès', async () => {
    const ownerRes = await request(app).post('/api/auth/register').send({
      email: 'alex@eparnio.fr',
      password: 'Password123!',
      displayName: 'Alex',
      avatarEmoji: '🦊',
      budgetStartDay: 1
    });
    const ownerToken = ownerRes.body.token as string;
    const ownerId = ownerRes.body.user.id as string;

    const partnerRes = await request(app).post('/api/auth/register').send({
      email: 'camille@eparnio.fr',
      password: 'Password123!',
      displayName: 'Camille',
      avatarEmoji: '🐼',
      budgetStartDay: 1
    });
    const partnerId = partnerRes.body.user.id as string;

    const outsiderRes = await request(app).post('/api/auth/register').send({
      email: 'outsider@eparnio.fr',
      password: 'Password123!',
      displayName: 'Outsider'
    });
    const outsiderToken = outsiderRes.body.token as string;

    const sharedRes = await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Foyer Alex & Camille', type: 'shared', budgetStartDay: 1 });
    const sharedBudgetId = sharedRes.body.budget.id as string;

    await BudgetModel.findByIdAndUpdate(sharedBudgetId, {
      $push: {
        members: {
          userId: new mongoose.Types.ObjectId(partnerId),
          role: 'editor',
          color: '#EC4899',
          declaredMonthlyIncome: 2000,
          joinedAt: new Date()
        }
      }
    });

    const periodRes = await request(app)
      .get(`/api/budgets/${sharedBudgetId}/periods/by-month?year=2026&month=11`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const periodId = periodRes.body.period.id as string;

    // Apports : Alex 2400 €, Camille 1600 €
    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        pillar: 'income',
        name: 'Apport Alex',
        allocatedAmount: 2400,
        memberId: ownerId
      });

    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        pillar: 'income',
        name: 'Apport Camille',
        allocatedAmount: 1600,
        memberId: partnerId
      });

    // Charge fixe payée par Alex : 1000 €
    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        pillar: 'fixed_charge',
        name: 'Loyer',
        allocatedAmount: 1000,
        memberId: ownerId
      });

    // Dépenses variables : Camille paie 250 € de courses (avec remboursement 50 € -> 200 € net), Alex paie 100 €
    const envRes = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        pillar: 'variable_envelope',
        name: 'Courses',
        allocatedAmount: 600
      });
    const coursesId = envRes.body.envelope.id as string;

    await request(app)
      .post(`/api/periods/${periodId}/transactions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        envelopeId: coursesId,
        amount: 250,
        label: 'Supermarché',
        paidByUserId: partnerId
      });

    await request(app)
      .post(`/api/periods/${periodId}/transactions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        envelopeId: coursesId,
        type: 'income',
        amount: 50,
        label: 'Avoir carte',
        paidByUserId: partnerId
      });

    await request(app)
      .post(`/api/periods/${periodId}/transactions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        envelopeId: coursesId,
        amount: 100,
        label: 'Boulangerie',
        paidByUserId: ownerId
      });

    // Épargne commune versée par Camille : 200 € (sans transaction enfant -> via memberId)
    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        pillar: 'savings',
        name: 'Projet Vacances',
        allocatedAmount: 200,
        memberId: partnerId
      });

    const res = await request(app)
      .get(`/api/periods/${periodId}/analytics`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    const { analytics } = res.body;
    expect(analytics.budgetType).toBe('shared');
    expect(analytics.memberBreakdown).toHaveLength(2);

    const alexRow = analytics.memberBreakdown.find(
      (item: { userId: string }) => item.userId === ownerId
    );
    const camilleRow = analytics.memberBreakdown.find(
      (item: { userId: string }) => item.userId === partnerId
    );

    expect(alexRow).toMatchObject({
      displayName: 'Alex',
      avatarEmoji: '🦊',
      incomeContributed: 2400,
      fixedChargesPaid: 1000,
      variableExpensesPaid: 100,
      savingsContributed: 0,
      expensesPaid: 1100,
      netBalance: 1300,
      incomeSharePercentage: 60,
      expensesSharePercentage: 73.3
    });

    expect(camilleRow).toMatchObject({
      displayName: 'Camille',
      avatarEmoji: '🐼',
      incomeContributed: 1600,
      fixedChargesPaid: 0,
      variableExpensesPaid: 200,
      savingsContributed: 200,
      expensesPaid: 400,
      netBalance: 1200,
      incomeSharePercentage: 40,
      expensesSharePercentage: 26.7
    });

    // Contrôle d'accès & identifiants invalides / absents
    const forbiddenRes = await request(app)
      .get(`/api/periods/${periodId}/analytics`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(forbiddenRes.status).toBe(403);

    const notFoundRes = await request(app)
      .get(`/api/periods/${new mongoose.Types.ObjectId().toString()}/analytics`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(notFoundRes.status).toBe(404);

    const badIdRes = await request(app)
      .get('/api/periods/invalid-id/analytics')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(badIdRes.status).toBe(400);
  });

  it('reflète un remboursement supérieur aux dépenses dans memberBreakdown sans altérer plannedIncome ni le Donut', async () => {
    const ownerRes = await request(app).post('/api/auth/register').send({
      email: 'nina@eparnio.fr',
      password: 'Password123!',
      displayName: 'Nina',
      budgetStartDay: 1
    });
    const ownerToken = ownerRes.body.token as string;
    const ownerId = ownerRes.body.user.id as string;

    const partnerRes = await request(app).post('/api/auth/register').send({
      email: 'leo@eparnio.fr',
      password: 'Password123!',
      displayName: 'Léo',
      budgetStartDay: 1
    });
    const partnerId = partnerRes.body.user.id as string;

    const sharedRes = await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Foyer Nina & Léo', type: 'shared', budgetStartDay: 1 });
    const sharedBudgetId = sharedRes.body.budget.id as string;

    await BudgetModel.findByIdAndUpdate(sharedBudgetId, {
      $push: {
        members: {
          userId: new mongoose.Types.ObjectId(partnerId),
          role: 'editor',
          color: '#38BDF8',
          declaredMonthlyIncome: 2000,
          joinedAt: new Date()
        }
      }
    });

    const periodRes = await request(app)
      .get(`/api/budgets/${sharedBudgetId}/periods/by-month?year=2026&month=11`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const periodId = periodRes.body.period.id as string;

    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        pillar: 'income',
        name: 'Apport Nina',
        allocatedAmount: 2000,
        memberId: ownerId
      });

    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        pillar: 'fixed_charge',
        name: 'Assurance santé',
        allocatedAmount: 100,
        memberId: ownerId
      });

    const santeRes = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        pillar: 'variable_envelope',
        name: 'Santé',
        allocatedAmount: 150
      });
    const santeId = santeRes.body.envelope.id as string;

    // Nina dépense 20 € puis reçoit un remboursement mutuelle de 80 € (variable net = -60 €, fixed = 100 € -> expensesPaid = 40 €)
    await request(app)
      .post(`/api/periods/${periodId}/transactions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        envelopeId: santeId,
        type: 'expense',
        amount: 20,
        label: 'Pharmacie',
        paidByUserId: ownerId
      });

    await request(app)
      .post(`/api/periods/${periodId}/transactions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        envelopeId: santeId,
        type: 'income',
        amount: 80,
        label: 'Remboursement mutuelle',
        paidByUserId: ownerId,
        notes: 'Remboursement optique mois précédent'
      });

    const analyticsRes = await request(app)
      .get(`/api/periods/${periodId}/analytics`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(analyticsRes.status).toBe(200);

    const { analytics } = analyticsRes.body;
    expect(analytics.cashFlow.plannedIncome).toBe(2000);
    expect(analytics.cashFlow.spentVariables).toBe(-60);
    // Donut : variable clamped >= 0
    const variableSlice = analytics.allocation.items.find(
      (item: { key: string }) => item.key === 'variable'
    );
    expect(variableSlice.amount).toBe(0);

    const ninaRow = analytics.memberBreakdown.find(
      (item: { userId: string }) => item.userId === ownerId
    );
    expect(ninaRow).toMatchObject({
      incomeContributed: 2000,
      fixedChargesPaid: 100,
      variableExpensesPaid: -60,
      expensesPaid: 40,
      netBalance: 1960
    });
  });
});

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

describe('API Objectifs d’Épargne & Synchronisation (/api/budgets/:budgetId/goals)', () => {
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

  async function setupUserBudgetAndPeriod() {
    const ownerRes = await request(app).post('/api/auth/register').send({
      email: 'alex@eparnio.fr',
      password: 'Password123!',
      displayName: 'Alex',
      budgetStartDay: 1
    });
    const token = ownerRes.body.token as string;
    const ownerId = ownerRes.body.user.id as string;
    const budgetId = ownerRes.body.defaultBudget.id as string;

    const periodRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2025&month=12`)
      .set('Authorization', `Bearer ${token}`);
    const periodId = periodRes.body.period.id as string;

    return { token, ownerId, budgetId, periodId };
  }

  it('gère le CRUD complet des objectifs et synchronise currentAmount, plannedSavings et remainingToLive', async () => {
    const { token, budgetId, periodId } = await setupUserBudgetAndPeriod();

    // 1. Base mensuelle : 3000 € de revenu et 1000 € de charges fixes -> 2000 € disponibles
    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'income',
        name: 'Salaire',
        allocatedAmount: 3000,
        icon: '💵',
        color: '#16A34A'
      });

    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'fixed_charge',
        name: 'Loyer',
        allocatedAmount: 1000,
        icon: '🏠',
        color: '#4F46E5'
      });

    // 2. Créer un objectif Voyage Bali avec 355 € déjà épargnés sur 5000 €
    const createGoalRes = await request(app)
      .post(`/api/budgets/${budgetId}/goals`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Voyage Bali',
        targetAmount: 5000,
        initialAmount: 355,
        icon: '✈️',
        color: '#38BDF8',
        deadline: '2026-08-01T00:00:00.000Z'
      });

    expect(createGoalRes.status).toBe(201);
    const goalId = createGoalRes.body.goal.id as string;
    expect(createGoalRes.body.goal.currentAmount).toBe(355);
    expect(createGoalRes.body.goal.initialAmount).toBe(355);

    // 3. Ajouter un versement mensuel récurrent de 150 € relié à l'objectif
    const contribRes = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'savings',
        name: 'Versement mensuel Bali',
        allocatedAmount: 150,
        icon: '✈️',
        color: '#38BDF8',
        isRecurring: true,
        linkedGoalId: goalId
      });

    expect(contribRes.status).toBe(201);
    const contribEnvelopeId = contribRes.body.envelope.id as string;
    expect(contribRes.body.goal.currentAmount).toBe(505);
    expect(contribRes.body.period.summary.plannedSavings).toBe(150);
    expect(contribRes.body.period.summary.remainingToAllocate).toBe(1850);
    expect(contribRes.body.period.summary.remainingToLive).toBe(1850);

    // 4. Modifier ce versement à 200 € -> currentAmount = 555 €, plannedSavings = 200 €
    const updateContribRes = await request(app)
      .patch(`/api/periods/${periodId}/envelopes/${contribEnvelopeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ allocatedAmount: 200 });

    expect(updateContribRes.status).toBe(200);
    expect(updateContribRes.body.goal.currentAmount).toBe(555);
    expect(updateContribRes.body.period.summary.plannedSavings).toBe(200);
    expect(updateContribRes.body.period.summary.remainingToLive).toBe(1800);

    // 5. Versement via transaction d'épargne (sur une 2e enveloppe savings liée)
    const txGoalEnvelopeRes = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'savings',
        name: 'Prime versée Bali',
        allocatedAmount: 0,
        linkedGoalId: goalId
      });
    const txEnvelopeId = txGoalEnvelopeRes.body.envelope.id as string;

    const addTxRes = await request(app)
      .post(`/api/periods/${periodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        envelopeId: txEnvelopeId,
        type: 'transfer',
        amount: 80,
        label: 'Virement ponctuel'
      });

    expect(addTxRes.status).toBe(201);
    expect(addTxRes.body.envelope.allocatedAmount).toBe(80);
    expect(addTxRes.body.goal.currentAmount).toBe(635);
    expect(addTxRes.body.period.summary.plannedSavings).toBe(280);
    expect(addTxRes.body.period.summary.remainingToLive).toBe(1720);

    const txId = addTxRes.body.transaction.id as string;
    const delTxRes = await request(app)
      .delete(`/api/periods/${periodId}/transactions/${txId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(delTxRes.status).toBe(200);
    expect(delTxRes.body.goal.currentAmount).toBe(555);
    expect(delTxRes.body.period.summary.plannedSavings).toBe(200);

    // 6. Vérifier la reconduction du versement récurrent sur Janvier 2026 (+200 € -> 755 €)
    const janRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2026&month=1`)
      .set('Authorization', `Bearer ${token}`);

    expect(janRes.status).toBe(200);
    expect(janRes.body.period.summary.plannedSavings).toBe(200);

    const listGoalsAfterRollover = await request(app)
      .get(`/api/budgets/${budgetId}/goals`)
      .set('Authorization', `Bearer ${token}`);
    expect(listGoalsAfterRollover.body.goals[0].currentAmount).toBe(755);

    // 7. Mettre à jour l'objectif (nom + currentAmount ajusté + deadline supprimée)
    const patchGoalRes = await request(app)
      .patch(`/api/budgets/${budgetId}/goals/${goalId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Grand Voyage Bali',
        targetAmount: 6000,
        currentAmount: 900,
        deadline: null
      });

    expect(patchGoalRes.status).toBe(200);
    expect(patchGoalRes.body.goal.name).toBe('Grand Voyage Bali');
    expect(patchGoalRes.body.goal.currentAmount).toBe(900);
    expect(patchGoalRes.body.goal.deadline).toBeUndefined();

    // 8. Supprimer l'objectif -> supprime en cascade les versements liés et rétablit les périodes
    const deleteGoalRes = await request(app)
      .delete(`/api/budgets/${budgetId}/goals/${goalId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteGoalRes.status).toBe(200);
    expect(deleteGoalRes.body.deletedId).toBe(goalId);

    const decAfterDelete = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2025&month=12`)
      .set('Authorization', `Bearer ${token}`);
    expect(decAfterDelete.body.period.summary.plannedSavings).toBe(0);
    expect(decAfterDelete.body.period.summary.remainingToLive).toBe(2000);
  });

  it('rejette les accès non autorisés (403), objectifs inconnus (404) et liaisons inter-budgets', async () => {
    const { token: ownerToken, budgetId, periodId } = await setupUserBudgetAndPeriod();

    // Autre utilisateur indépendant avec son propre budget
    const intruderRes = await request(app).post('/api/auth/register').send({
      email: 'intruder@eparnio.fr',
      password: 'Password123!',
      displayName: 'Intruder'
    });
    const intruderToken = intruderRes.body.token as string;
    const intruderBudgetId = intruderRes.body.defaultBudget.id as string;

    const intruderGoalRes = await request(app)
      .post(`/api/budgets/${intruderBudgetId}/goals`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({
        name: 'Objectif Privé',
        targetAmount: 1000
      });
    const intruderGoalId = intruderGoalRes.body.goal.id as string;

    // Accès refusé sur le budget d'autrui
    const forbiddenList = await request(app)
      .get(`/api/budgets/${budgetId}/goals`)
      .set('Authorization', `Bearer ${intruderToken}`);
    expect(forbiddenList.status).toBe(403);

    // Création de versement liée à un objectif d'un autre budget -> 404
    const crossGoalContrib = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        pillar: 'savings',
        name: 'Versement croisé',
        allocatedAmount: 50,
        linkedGoalId: intruderGoalId
      });
    expect(crossGoalContrib.status).toBe(404);

    // Patch / Delete d'un objectif inexistant -> 404
    const missingId = new mongoose.Types.ObjectId().toString();
    const notFoundPatch = await request(app)
      .patch(`/api/budgets/${budgetId}/goals/${missingId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Test' });
    expect(notFoundPatch.status).toBe(404);

    const notFoundDelete = await request(app)
      .delete(`/api/budgets/${budgetId}/goals/${missingId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(notFoundDelete.status).toBe(404);

    // Un membre viewer ne peut pas créer d'objectif
    const budgetDoc = await BudgetModel.findById(budgetId);
    budgetDoc!.members.push({
      userId: new mongoose.Types.ObjectId(intruderRes.body.user.id as string),
      role: 'viewer',
      color: '#3B82F6',
      declaredMonthlyIncome: 0,
      joinedAt: new Date()
    });
    await budgetDoc!.save();

    const viewerCreate = await request(app)
      .post(`/api/budgets/${budgetId}/goals`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ name: 'Lecture seule', targetAmount: 500 });
    expect(viewerCreate.status).toBe(403);
  });

  it('gère le CRUD des retraits sur une cagnotte, borne currentAmount >= 0 et n’impacte pas remainingToLive', async () => {
    const { token, ownerId, budgetId, periodId } = await setupUserBudgetAndPeriod();

    // Base mensuelle : 3000 € de revenu et 500 € de charges -> remainingToLive initial = 2500 €
    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pillar: 'income', name: 'Salaire', allocatedAmount: 3000 });

    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pillar: 'fixed_charge', name: 'Loyer', allocatedAmount: 500 });

    const createGoalRes = await request(app)
      .post(`/api/budgets/${budgetId}/goals`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Vacances Japon',
        targetAmount: 3000,
        initialAmount: 800,
        icon: '✈️',
        color: '#38BDF8'
      });
    expect(createGoalRes.status).toBe(201);
    const goalId = createGoalRes.body.goal.id as string;

    // Versement de 200 € en Décembre -> currentAmount = 1000 €, plannedSavings = 200 €, remainingToLive = 2300 €
    const contribRes = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'savings',
        name: 'Versement Japon',
        allocatedAmount: 200,
        linkedGoalId: goalId
      });
    expect(contribRes.status).toBe(201);
    expect(contribRes.body.goal.currentAmount).toBe(1000);
    expect(contribRes.body.period.summary.remainingToLive).toBe(2300);

    // 1. Retrait de 420 € -> currentAmount = 580 €, mais période inchangée (plannedSavings = 200 €, remainingToLive = 2300 €)
    const addWithdrawRes = await request(app)
      .post(`/api/budgets/${budgetId}/goals/${goalId}/withdrawals`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: 420,
        label: 'Billets d’avion',
        date: '2025-12-12T12:00:00.000Z',
        memberId: ownerId,
        notes: 'Vol aller-retour'
      });
    expect(addWithdrawRes.status).toBe(201);
    expect(addWithdrawRes.body.goal.currentAmount).toBe(580);
    expect(addWithdrawRes.body.goal.withdrawals).toHaveLength(1);
    expect(addWithdrawRes.body.goal.withdrawals[0]).toMatchObject({
      amount: 420,
      label: 'Billets d’avion',
      memberId: ownerId,
      notes: 'Vol aller-retour'
    });
    const withdrawalId = addWithdrawRes.body.goal.withdrawals[0].id as string;

    const periodAfterWithdraw = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2025&month=12`)
      .set('Authorization', `Bearer ${token}`);
    expect(periodAfterWithdraw.body.period.summary.plannedSavings).toBe(200);
    expect(periodAfterWithdraw.body.period.summary.remainingToAllocate).toBe(2300);
    expect(periodAfterWithdraw.body.period.summary.remainingToLive).toBe(2300);

    // 2. Ajuster currentAmount manuellement à 700 € via PATCH /goals/:id en présence du retrait de 420 €
    // initialAmount attendu : 700 - 200 + 420 = 920 € ; puis currentAmount = 920 + 200 - 420 = 700 €
    const patchGoalCurrentRes = await request(app)
      .patch(`/api/budgets/${budgetId}/goals/${goalId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ currentAmount: 700 });
    expect(patchGoalCurrentRes.status).toBe(200);
    expect(patchGoalCurrentRes.body.goal.initialAmount).toBe(920);
    expect(patchGoalCurrentRes.body.goal.currentAmount).toBe(700);

    // 3. Modifier le retrait à 1500 € (supérieur au solde 1120 € -> currentAmount borné à 0 €) et effacer notes
    const updateWithdrawRes = await request(app)
      .patch(`/api/budgets/${budgetId}/goals/${goalId}/withdrawals/${withdrawalId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: 1500,
        label: 'Billets + Hôtel',
        notes: ''
      });
    expect(updateWithdrawRes.status).toBe(200);
    expect(updateWithdrawRes.body.goal.currentAmount).toBe(0);
    expect(updateWithdrawRes.body.goal.withdrawals[0].label).toBe('Billets + Hôtel');
    expect(updateWithdrawRes.body.goal.withdrawals[0].notes).toBeUndefined();

    // 4. Supprimer le retrait -> rétablit currentAmount à 920 + 200 = 1120 €
    const deleteWithdrawRes = await request(app)
      .delete(`/api/budgets/${budgetId}/goals/${goalId}/withdrawals/${withdrawalId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteWithdrawRes.status).toBe(200);
    expect(deleteWithdrawRes.body.deletedId).toBe(withdrawalId);
    expect(deleteWithdrawRes.body.goal.currentAmount).toBe(1120);
    expect(deleteWithdrawRes.body.goal.withdrawals).toHaveLength(0);
  });

  it('applique le contrôle d’accès et la validation sur les retraits d’épargne (400/403/404)', async () => {
    const { token: ownerToken, budgetId } = await setupUserBudgetAndPeriod();

    const createGoalRes = await request(app)
      .post(`/api/budgets/${budgetId}/goals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Matelas', targetAmount: 2000, initialAmount: 500 });
    const goalId = createGoalRes.body.goal.id as string;

    const otherRes = await request(app).post('/api/auth/register').send({
      email: 'stranger@eparnio.fr',
      password: 'Password123!',
      displayName: 'Stranger'
    });
    const otherToken = otherRes.body.token as string;
    const otherUserId = otherRes.body.user.id as string;

    // Membre étranger -> 400
    const badMemberRes = await request(app)
      .post(`/api/budgets/${budgetId}/goals/${goalId}/withdrawals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ amount: 50, label: 'Test', memberId: otherUserId });
    expect(badMemberRes.status).toBe(400);

    // Utilisateur hors budget -> 403
    const forbiddenRes = await request(app)
      .post(`/api/budgets/${budgetId}/goals/${goalId}/withdrawals`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ amount: 50, label: 'Test' });
    expect(forbiddenRes.status).toBe(403);

    // Objectif ou retrait inexistant -> 404
    const missingId = new mongoose.Types.ObjectId().toString();
    const missingGoalRes = await request(app)
      .post(`/api/budgets/${budgetId}/goals/${missingId}/withdrawals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ amount: 50, label: 'Test' });
    expect(missingGoalRes.status).toBe(404);

    const missingWithdrawalPatch = await request(app)
      .patch(`/api/budgets/${budgetId}/goals/${goalId}/withdrawals/${missingId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ amount: 30 });
    expect(missingWithdrawalPatch.status).toBe(404);

    const missingWithdrawalDelete = await request(app)
      .delete(`/api/budgets/${budgetId}/goals/${goalId}/withdrawals/${missingId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(missingWithdrawalDelete.status).toBe(404);
  });
});

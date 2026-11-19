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

describe('Étape 28 — Rituel de clôture de fin de mois (POST /periods/:periodId/close)', () => {
  const app = createApp();
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    await Promise.all([
      TransactionModel.deleteMany({}),
      EnvelopeModel.deleteMany({}),
      SavingsGoalModel.deleteMany({}),
      BudgetPeriodModel.deleteMany({}),
      BudgetModel.deleteMany({}),
      UserModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  async function registerUser(email = 'closing@eparnio.fr') {
    const res = await request(app).post('/api/auth/register').send({
      email,
      password: 'Password123!',
      displayName: 'Camille',
      budgetStartDay: 1
    });
    expect(res.status).toBe(201);
    return {
      token: res.body.token as string,
      budgetId: res.body.defaultBudget.id as string
    };
  }

  it('applique rollover_next_month, transfer_to_goal et reset_zero, ajuste M+1 et bloque une seconde clôture (409)', async () => {
    const { token, budgetId } = await registerUser();

    // Période Janvier 2026
    const janRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2026&month=1`)
      .set('Authorization', `Bearer ${token}`);
    expect(janRes.status).toBe(200);
    const janPeriodId = janRes.body.period.id as string;

    // Objectif d'épargne Vacances (initial 200 €)
    const goalRes = await request(app)
      .post(`/api/budgets/${budgetId}/goals`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Vacances',
        icon: '✈️',
        color: '#3B82F6',
        targetAmount: 2000,
        initialAmount: 200
      });
    expect(goalRes.status).toBe(201);
    const goalId = goalRes.body.goal.id as string;

    // Revenu récurrent 3 000 €
    const salaryRes = await request(app)
      .post(`/api/periods/${janPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'income',
        name: 'Salaire',
        allocatedAmount: 3000,
        isRecurring: true
      });
    const salaryId = salaryRes.body.envelope.id as string;

    // Charge fixe récurrente Loyer 900 €
    const rentRes = await request(app)
      .post(`/api/periods/${janPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'fixed_charge',
        name: 'Loyer',
        allocatedAmount: 900,
        isRecurring: true
      });
    const rentId = rentRes.body.envelope.id as string;

    // Enveloppe Courses (rolloverEnabled: false) : 300 €, dépensé 210 € -> surplus 90 € (choisi: rollover_next_month)
    const coursesRes = await request(app)
      .post(`/api/periods/${janPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'variable_envelope',
        name: 'Courses',
        allocatedAmount: 300,
        rolloverEnabled: false
      });
    const coursesId = coursesRes.body.envelope.id as string;
    await request(app)
      .post(`/api/periods/${janPeriodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ envelopeId: coursesId, label: 'Supermarché', amount: 210 });

    // Enveloppe Sorties (rolloverEnabled: false) : 200 €, dépensé 120 € -> surplus 80 € (choisi: transfer_to_goal)
    const sortiesRes = await request(app)
      .post(`/api/periods/${janPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'variable_envelope',
        name: 'Sorties',
        allocatedAmount: 200,
        rolloverEnabled: false
      });
    const sortiesId = sortiesRes.body.envelope.id as string;
    await request(app)
      .post(`/api/periods/${janPeriodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ envelopeId: sortiesId, label: 'Ciné', amount: 120 });

    // Enveloppe Shopping (rolloverEnabled: true) : 150 €, dépensé 100 € -> surplus 50 € (choisi: reset_zero)
    const shoppingRes = await request(app)
      .post(`/api/periods/${janPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'variable_envelope',
        name: 'Shopping',
        allocatedAmount: 150,
        rolloverEnabled: true
      });
    const shoppingId = shoppingRes.body.envelope.id as string;
    await request(app)
      .post(`/api/periods/${janPeriodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ envelopeId: shoppingId, label: 'Chemise', amount: 100 });

    // Clôture de Janvier 2026
    const closeRes = await request(app)
      .post(`/api/budgets/${budgetId}/periods/${janPeriodId}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        envelopeDecisions: [
          { envelopeId: coursesId, action: 'rollover_next_month' },
          { envelopeId: sortiesId, action: 'transfer_to_goal', goalId },
          { envelopeId: shoppingId, action: 'reset_zero' }
        ],
        nextMonthAdjustments: [
          { sourceEnvelopeId: salaryId, allocatedAmount: 3200, include: true },
          { sourceEnvelopeId: rentId, allocatedAmount: 900, include: false },
          { sourceEnvelopeId: coursesId, allocatedAmount: 350, include: true }
        ]
      });

    expect(closeRes.status).toBe(200);
    expect(closeRes.body.closedPeriod.closedAt).toEqual(expect.any(String));
    expect(closeRes.body.closedPeriod.summary.plannedSavings).toBe(80);
    expect(closeRes.body.transferredTotal).toBe(80);

    // Vérification objectif d'épargne mis à jour : 200 initial + 80 surplus = 280 €
    expect(closeRes.body.updatedGoals).toHaveLength(1);
    expect(closeRes.body.updatedGoals[0].currentAmount).toBe(280);

    // Vérification période M+1 (Février 2026)
    expect(closeRes.body.nextPeriod.label).toBe('Février 2026');
    const nextEnvs = closeRes.body.nextEnvelopes as Array<{
      name: string;
      pillar: string;
      allocatedAmount: number;
      rolloverAmount: number;
    }>;

    // Loyer exclu (include: false), Salaire passé à 3200 €
    expect(nextEnvs.find((e) => e.name === 'Loyer')).toBeUndefined();
    expect(nextEnvs.find((e) => e.name === 'Salaire')?.allocatedAmount).toBe(3200);

    // Courses : montant ajusté à 350 € + rolloverAmount 90 € (même si rolloverEnabled était false)
    const nextCourses = nextEnvs.find((e) => e.name === 'Courses');
    expect(nextCourses?.allocatedAmount).toBe(350);
    expect(nextCourses?.rolloverAmount).toBe(90);

    // Sorties : rolloverAmount 0 € car transféré en épargne
    expect(nextEnvs.find((e) => e.name === 'Sorties')?.rolloverAmount).toBe(0);

    // Shopping : rolloverAmount 0 € car remis à zéro (même si rolloverEnabled était true)
    expect(nextEnvs.find((e) => e.name === 'Shopping')?.rolloverAmount).toBe(0);

    // Seconde tentative de clôture -> 409 Conflict
    const retryRes = await request(app)
      .post(`/api/budgets/${budgetId}/periods/${janPeriodId}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(retryRes.status).toBe(409);
  });

  it('valide les erreurs 400 (transfer_to_goal sans goalId), 404 (goal étranger) et 403 (tiers)', async () => {
    const owner = await registerUser('owner.close@eparnio.fr');
    const intruder = await registerUser('intruder.close@eparnio.fr');

    const periodRes = await request(app)
      .get(`/api/budgets/${owner.budgetId}/periods/by-month?year=2026&month=5`)
      .set('Authorization', `Bearer ${owner.token}`);
    const periodId = periodRes.body.period.id as string;

    const envRes = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        pillar: 'variable_envelope',
        name: 'Loisirs',
        allocatedAmount: 100
      });
    const envId = envRes.body.envelope.id as string;

    const intruderGoalRes = await request(app)
      .post(`/api/budgets/${intruder.budgetId}/goals`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({
        name: 'Autre objectif',
        targetAmount: 500
      });
    const foreignGoalId = intruderGoalRes.body.goal.id as string;

    // 400 : transfer_to_goal sans goalId
    const missingGoalRes = await request(app)
      .post(`/api/budgets/${owner.budgetId}/periods/${periodId}/close`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        envelopeDecisions: [{ envelopeId: envId, action: 'transfer_to_goal' }]
      });
    expect(missingGoalRes.status).toBe(400);

    // 404 : goalId appartenant à un autre budget
    const foreignGoalRes = await request(app)
      .post(`/api/budgets/${owner.budgetId}/periods/${periodId}/close`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        envelopeDecisions: [{ envelopeId: envId, action: 'transfer_to_goal', goalId: foreignGoalId }]
      });
    expect(foreignGoalRes.status).toBe(404);

    // 403 : accès tiers refusé
    const forbiddenRes = await request(app)
      .post(`/api/budgets/${owner.budgetId}/periods/${periodId}/close`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({});
    expect(forbiddenRes.status).toBe(403);
  });
});

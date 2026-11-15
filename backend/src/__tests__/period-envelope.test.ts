import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { BudgetModel } from '../models/Budget.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { UserModel } from '../models/User.model';
import {
  computeCycleBounds,
  resolveCycleYearMonthForDate
} from '../services/periodRollover.service';
import { calculateRemainingToLive } from '../services/remainingToLive.service';
import { calculateZeroBasedSummary, roundCurrency } from '../services/zeroBasedBudget.service';

describe('Services financiers Base Zéro, Reste à vivre & Cycles', () => {
  it('calcule exactement remainingToAllocate et remainingToLive sans dérive flottante', () => {
    expect(roundCurrency(-0.001)).toBe(0);

    const summary = calculateZeroBasedSummary([
      { pillar: 'income', allocatedAmount: 1500.5, spentOrPaidAmount: 0 },
      { pillar: 'income', allocatedAmount: 2000, spentOrPaidAmount: 0 },
      { pillar: 'fixed_charge', allocatedAmount: 1069.99, spentOrPaidAmount: 0 },
      { pillar: 'variable_envelope', allocatedAmount: 500.51, spentOrPaidAmount: 120 },
      { pillar: 'savings', allocatedAmount: 150, spentOrPaidAmount: 0 }
    ]);

    expect(summary).toEqual({
      plannedIncome: 3500.5,
      plannedFixedCharges: 1069.99,
      plannedEnvelopes: 500.51,
      plannedSavings: 150,
      spentVariables: 120,
      remainingToAllocate: 1780
    });

    const remainingToLive = calculateRemainingToLive(summary);
    // 3500.50 - 1069.99 - 150 - 120 = 2160.51
    expect(remainingToLive).toBe(2160.51);
  });

  it('gère les bornes de cycle budgétaire et fins de mois (31 -> février 28/29)', () => {
    const feb2025 = computeCycleBounds(2025, 2, 31);
    expect(feb2025.label).toBe('Février 2025');
    expect(feb2025.startDate.toISOString()).toBe('2025-01-31T00:00:00.000Z');
    expect(feb2025.endDate.toISOString()).toBe('2025-02-27T23:59:59.999Z');

    const cycleOct29 = resolveCycleYearMonthForDate(new Date('2025-10-29T10:00:00.000Z'), 28);
    expect(cycleOct29).toEqual({ year: 2025, month: 11 });

    const cycleOct10 = resolveCycleYearMonthForDate(new Date('2025-10-10T10:00:00.000Z'), 28);
    expect(cycleOct10).toEqual({ year: 2025, month: 10 });
  });
});

describe('API Cycles Budgétaires & Enveloppes (/periods & /envelopes)', () => {
  const app = createApp();
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    await EnvelopeModel.deleteMany({});
    await BudgetPeriodModel.deleteMany({});
    await BudgetModel.deleteMany({});
    await UserModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  async function setupUserAndBudget(email = 'johann@eparnio.fr') {
    const res = await request(app).post('/api/auth/register').send({
      email,
      password: 'Password123!',
      displayName: 'Johann',
      budgetStartDay: 1
    });
    return {
      token: res.body.token as string,
      budgetId: res.body.defaultBudget.id as string
    };
  }

  it('crée une période /by-month, ajoute/édite/pointe/réordonne/supprime et met à jour Base Zéro', async () => {
    const { token, budgetId } = await setupUserAndBudget();

    const periodRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2025&month=12`)
      .set('Authorization', `Bearer ${token}`);

    expect(periodRes.status).toBe(200);
    expect(periodRes.body.period.label).toBe('Décembre 2025');
    expect(periodRes.body.period.summary.remainingToAllocate).toBe(0);
    const periodId = periodRes.body.period.id as string;

    // 1. Revenu 3 500 €
    const incRes = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'income',
        name: 'Salaire',
        allocatedAmount: 3500,
        icon: '💵',
        color: '#FCE96A',
        isRecurring: true
      });
    expect(incRes.status).toBe(201);
    expect(incRes.body.period.summary.plannedIncome).toBe(3500);
    expect(incRes.body.period.summary.remainingToAllocate).toBe(3500);
    expect(incRes.body.period.summary.remainingToLive).toBe(3500);
    const incomeId = incRes.body.envelope.id as string;

    // 2. Deux dépenses fixes (Loyer 950 € récurrent, Assurance 120 €)
    const rentRes = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'fixed_charge',
        name: 'Loyer',
        allocatedAmount: 950,
        icon: '🏠',
        color: '#38BDF8',
        isRecurring: true
      });
    const rentId = rentRes.body.envelope.id as string;

    const insRes = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'fixed_charge',
        name: 'Assurance',
        allocatedAmount: 120,
        icon: '🚗',
        color: '#FB923C',
        isRecurring: false
      });
    const insId = insRes.body.envelope.id as string;

    expect(insRes.body.period.summary).toMatchObject({
      plannedIncome: 3500,
      plannedFixedCharges: 1070,
      remainingToAllocate: 2430,
      remainingToLive: 2430
    });

    // 3. Pointage isPaid sur le Loyer + modification montant
    const patchRes = await request(app)
      .patch(`/api/periods/${periodId}/envelopes/${rentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isPaid: true, allocatedAmount: 1000 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.envelope.isPaid).toBe(true);
    expect(patchRes.body.period.summary.plannedFixedCharges).toBe(1120);
    expect(patchRes.body.period.summary.remainingToLive).toBe(2380);

    // 4. Réordonnancement Assurance avant Loyer
    const reorderRes = await request(app)
      .patch(`/api/periods/${periodId}/envelopes/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ orderedIds: [insId, rentId] });
    expect(reorderRes.status).toBe(200);
    expect(reorderRes.body.envelopes[0].id).toBe(insId);
    expect(reorderRes.body.envelopes[1].id).toBe(rentId);

    // 5. Suppression de l'assurance et vérification du recalcul
    const deleteRes = await request(app)
      .delete(`/api/periods/${periodId}/envelopes/${insId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.period.summary.plannedFixedCharges).toBe(1000);
    expect(deleteRes.body.period.summary.remainingToAllocate).toBe(2500);

    // 6. Contrôle d'accès tiers (403)
    const intruder = await setupUserAndBudget('intrus@eparnio.fr');
    const forbiddenRes = await request(app)
      .get(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${intruder.token}`);
    expect(forbiddenRes.status).toBe(403);

    // Nettoyage warning variable inutilisée
    expect(incomeId).toEqual(expect.any(String));
  });

  it('reconduit automatiquement les récurrents et enveloppes variables au changement de mois', async () => {
    const { token, budgetId } = await setupUserAndBudget('rollover@eparnio.fr');

    const decRes = await request(app)
      .post(`/api/budgets/${budgetId}/periods`)
      .set('Authorization', `Bearer ${token}`)
      .send({ year: 2025, month: 12 });
    expect(decRes.status).toBe(201);
    const decPeriodId = decRes.body.period.id as string;

    // Salaire récurrent (pointé payé en décembre)
    await request(app)
      .post(`/api/periods/${decPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'income',
        name: 'Salaire',
        allocatedAmount: 2500,
        isRecurring: true,
        isPaid: true
      });

    // Prime ponctuelle (non récurrente -> ne doit pas être reconduite)
    await request(app)
      .post(`/api/periods/${decPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'income',
        name: 'Prime Noël',
        allocatedAmount: 500,
        isRecurring: false
      });

    // Loyer récurrent + Enveloppe Courses
    await request(app)
      .post(`/api/periods/${decPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'fixed_charge',
        name: 'Loyer',
        allocatedAmount: 800,
        isRecurring: true,
        isPaid: true
      });

    await request(app)
      .post(`/api/periods/${decPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'variable_envelope',
        name: 'Courses',
        allocatedAmount: 400
      });

    // Passage au mois suivant (Janvier 2026) via /by-month
    const janRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2026&month=1`)
      .set('Authorization', `Bearer ${token}`);

    expect(janRes.status).toBe(200);
    expect(janRes.body.period.label).toBe('Janvier 2026');
    const janEnvelopes = janRes.body.envelopes as Array<{
      name: string;
      pillar: string;
      isPaid: boolean;
      allocatedAmount: number;
    }>;

    // Prime Noël exclue, Salaire + Loyer + Courses reconduits avec isPaid remis à false
    expect(janEnvelopes).toHaveLength(3);
    expect(janEnvelopes.find((e) => e.name === 'Prime Noël')).toBeUndefined();
    expect(janEnvelopes.find((e) => e.name === 'Salaire')?.isPaid).toBe(false);
    expect(janEnvelopes.find((e) => e.name === 'Loyer')?.isPaid).toBe(false);
    expect(janEnvelopes.find((e) => e.name === 'Courses')?.allocatedAmount).toBe(400);

    // Résumé recalculé : 2500 - 800 - 400 = 1300
    expect(janRes.body.period.summary.remainingToAllocate).toBe(1300);

    // Endpoint /current et rollover manuel POST /:periodId/rollover vers Février 2026
    const currentRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/current`)
      .set('Authorization', `Bearer ${token}`);
    expect(currentRes.status).toBe(200);

    const febRolloverRes = await request(app)
      .post(`/api/budgets/${budgetId}/periods/${janRes.body.period.id}/rollover`)
      .set('Authorization', `Bearer ${token}`);
    expect(febRolloverRes.status).toBe(200);
    expect(febRolloverRes.body.period.label).toBe('Février 2026');
    expect(febRolloverRes.body.envelopes).toHaveLength(3);
  });
});

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
  computeMonthsDifference,
  computeNextRecurrenceRemainingCount,
  isRolloverCandidate,
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

  it('évalue isRolloverCandidate et computeNextRecurrenceRemainingCount (fréquences, date de fin, mensualités)', () => {
    expect(computeMonthsDifference({ year: 2026, month: 1 }, { year: 2026, month: 4 })).toBe(3);

    expect(
      computeNextRecurrenceRemainingCount(
        { recurrenceFrequency: 'monthly', recurrenceRemainingCount: 3 },
        1
      )
    ).toBe(2);
    expect(
      computeNextRecurrenceRemainingCount(
        { recurrenceFrequency: 'quarterly', recurrenceRemainingCount: 2 },
        3
      )
    ).toBe(1);
    expect(
      computeNextRecurrenceRemainingCount(
        { recurrenceFrequency: 'monthly', recurrenceRemainingCount: 1 },
        1
      )
    ).toBeUndefined();

    const baseQuarterly = {
      pillar: 'fixed_charge' as const,
      isRecurring: true,
      recurrenceFrequency: 'quarterly' as const,
      date: new Date('2026-01-10T12:00:00.000Z')
    };

    expect(
      isRolloverCandidate(baseQuarterly, {
        sourceYear: 2026,
        sourceMonth: 1,
        targetYear: 2026,
        targetMonth: 2
      })
    ).toBe(false);
    expect(
      isRolloverCandidate(baseQuarterly, {
        sourceYear: 2026,
        sourceMonth: 1,
        targetYear: 2026,
        targetMonth: 4
      })
    ).toBe(true);

    const semiannual = {
      pillar: 'fixed_charge' as const,
      isRecurring: true,
      recurrenceFrequency: 'semiannual' as const,
      date: new Date('2026-01-10T12:00:00.000Z')
    };
    expect(
      isRolloverCandidate(semiannual, {
        sourceYear: 2026,
        sourceMonth: 1,
        targetYear: 2026,
        targetMonth: 4
      })
    ).toBe(false);
    expect(
      isRolloverCandidate(semiannual, {
        sourceYear: 2026,
        sourceMonth: 1,
        targetYear: 2026,
        targetMonth: 7
      })
    ).toBe(true);

    const yearly = {
      pillar: 'income' as const,
      isRecurring: true,
      recurrenceFrequency: 'yearly' as const,
      date: new Date('2026-01-10T12:00:00.000Z')
    };
    expect(
      isRolloverCandidate(yearly, {
        sourceYear: 2026,
        sourceMonth: 1,
        targetYear: 2027,
        targetMonth: 1
      })
    ).toBe(true);

    const limitedEndDate = {
      pillar: 'fixed_charge' as const,
      isRecurring: true,
      recurrenceFrequency: 'monthly' as const,
      recurrenceEndDate: new Date('2026-03-10T00:00:00.000Z'),
      date: new Date('2026-01-10T12:00:00.000Z')
    };
    expect(
      isRolloverCandidate(limitedEndDate, {
        sourceYear: 2026,
        sourceMonth: 2,
        targetYear: 2026,
        targetMonth: 3
      })
    ).toBe(true);
    expect(
      isRolloverCandidate(limitedEndDate, {
        sourceYear: 2026,
        sourceMonth: 3,
        targetYear: 2026,
        targetMonth: 4
      })
    ).toBe(false);

    expect(
      isRolloverCandidate(
        {
          pillar: 'fixed_charge',
          isRecurring: true,
          recurrenceFrequency: 'monthly',
          recurrenceRemainingCount: 1,
          date: new Date('2026-03-10T12:00:00.000Z')
        },
        { sourceYear: 2026, sourceMonth: 3, targetYear: 2026, targetMonth: 4 }
      )
    ).toBe(false);
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

  it('reconduit les fréquences trimestrielles/semestrielles/annuelles, décrémente les mensualités et stoppe à échéance', async () => {
    const { token, budgetId } = await setupUserAndBudget('advanced-rec@eparnio.fr');

    const janRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2026&month=1`)
      .set('Authorization', `Bearer ${token}`);
    expect(janRes.status).toBe(200);
    const janPeriodId = janRes.body.period.id as string;

    // 1. Paiement en 3x (mensualités restantes : 3 en Jan -> 2 en Fév -> 1 en Mar -> stoppé en Avr)
    const splitRes = await request(app)
      .post(`/api/periods/${janPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'fixed_charge',
        name: 'Paiement 3x',
        allocatedAmount: 100,
        date: '2026-01-05T12:00:00.000Z',
        isRecurring: true,
        recurrenceFrequency: 'monthly',
        recurrenceRemainingCount: 3
      });
    expect(splitRes.status).toBe(201);
    expect(splitRes.body.envelope.recurrenceRemainingCount).toBe(3);

    // 2. Récurrence avec date de fin inclusive (15 mars 2026)
    const endRes = await request(app)
      .post(`/api/periods/${janPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'fixed_charge',
        name: 'Salle de sport',
        allocatedAmount: 40,
        date: '2026-01-10T12:00:00.000Z',
        isRecurring: true,
        recurrenceFrequency: 'monthly',
        recurrenceEndDate: '2026-03-15T23:59:59.999Z'
      });
    expect(endRes.status).toBe(201);

    // 3. Charge trimestrielle + charge semestrielle + revenu annuel
    const quartRes = await request(app)
      .post(`/api/periods/${janPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'fixed_charge',
        name: 'Eau trimestrielle',
        allocatedAmount: 150,
        date: '2026-01-12T12:00:00.000Z',
        isRecurring: true,
        recurrenceFrequency: 'quarterly'
      });
    expect(quartRes.status).toBe(201);

    await request(app)
      .post(`/api/periods/${janPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'fixed_charge',
        name: 'Assurance semestrielle',
        allocatedAmount: 300,
        date: '2026-01-15T12:00:00.000Z',
        isRecurring: true,
        recurrenceFrequency: 'semiannual'
      });

    await request(app)
      .post(`/api/periods/${janPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'income',
        name: 'Prime annuelle',
        allocatedAmount: 1200,
        date: '2026-01-20T12:00:00.000Z',
        isRecurring: true,
        recurrenceFrequency: 'yearly'
      });

    // Février 2026 : Paiement 3x (2 restantes) + Salle de sport ; trimestrielle/semestrielle/annuelle absentes
    const febRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2026&month=2`)
      .set('Authorization', `Bearer ${token}`);
    const febEnvs = febRes.body.envelopes as Array<{
      name: string;
      recurrenceRemainingCount?: number;
    }>;
    expect(febEnvs.find((e) => e.name === 'Paiement 3x')?.recurrenceRemainingCount).toBe(2);
    expect(febEnvs.find((e) => e.name === 'Salle de sport')).toBeDefined();
    expect(febEnvs.find((e) => e.name === 'Eau trimestrielle')).toBeUndefined();

    // Mars 2026 : Paiement 3x (1 restante) + Salle de sport (10 mars <= 15 mars)
    const marRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2026&month=3`)
      .set('Authorization', `Bearer ${token}`);
    const marEnvs = marRes.body.envelopes as Array<{
      id: string;
      name: string;
      recurrenceRemainingCount?: number;
    }>;
    expect(marEnvs.find((e) => e.name === 'Paiement 3x')?.recurrenceRemainingCount).toBe(1);
    expect(marEnvs.find((e) => e.name === 'Salle de sport')).toBeDefined();
    expect(marEnvs.find((e) => e.name === 'Eau trimestrielle')).toBeUndefined();

    // Avril 2026 (navigation séquentielle depuis Mars) :
    // Paiement 3x stoppé, Salle de sport stoppée (10 avril > 15 mars), Eau trimestrielle réapparaît !
    const aprRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2026&month=4`)
      .set('Authorization', `Bearer ${token}`);
    const aprEnvs = aprRes.body.envelopes as Array<{ id: string; name: string }>;
    expect(aprEnvs.find((e) => e.name === 'Paiement 3x')).toBeUndefined();
    expect(aprEnvs.find((e) => e.name === 'Salle de sport')).toBeUndefined();
    const eauApr = aprEnvs.find((e) => e.name === 'Eau trimestrielle');
    expect(eauApr).toBeDefined();

    // PATCH réinitialisant les options en passant isRecurring à false
    const stopRes = await request(app)
      .patch(`/api/periods/${aprRes.body.period.id}/envelopes/${eauApr!.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isRecurring: false });
    expect(stopRes.status).toBe(200);
    expect(stopRes.body.envelope.isRecurring).toBe(false);
    expect(stopRes.body.envelope.recurrenceFrequency).toBe('monthly');

    // Juillet 2026 (M+6) : Assurance semestrielle présente, Eau trimestrielle stoppée en avril donc absente
    const julRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2026&month=7`)
      .set('Authorization', `Bearer ${token}`);
    const julEnvs = julRes.body.envelopes as Array<{ name: string }>;
    expect(julEnvs.find((e) => e.name === 'Assurance semestrielle')).toBeDefined();
    expect(julEnvs.find((e) => e.name === 'Eau trimestrielle')).toBeUndefined();

    // Janvier 2027 (M+12) : Prime annuelle reconduite
    const jan27Res = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2027&month=1`)
      .set('Authorization', `Bearer ${token}`);
    const jan27Envs = jan27Res.body.envelopes as Array<{ name: string }>;
    expect(jan27Envs.find((e) => e.name === 'Prime annuelle')).toBeDefined();
  });
});

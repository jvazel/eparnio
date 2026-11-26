import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { escapeCsvCell, sanitizeDownloadSlug } from '../controllers/export.controller';
import { BudgetModel } from '../models/Budget.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { SavingsGoalModel } from '../models/SavingsGoal.model';
import { TransactionModel } from '../models/Transaction.model';
import { UserModel } from '../models/User.model';

describe('Étape 29 — Export CSV / JSON & Sécurité', () => {
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

  async function registerUser(email = 'export@eparnio.fr') {
    const res = await request(app).post('/api/auth/register').send({
      email,
      password: 'Password123!',
      displayName: 'Johann',
      budgetStartDay: 1
    });
    expect(res.status).toBe(201);
    return {
      token: res.body.token as string,
      budgetId: res.body.defaultBudget.id as string
    };
  }

  it('neutralise les formules CSV (=, +, -, @, tab) et assainit le slug de nom de fichier', () => {
    expect(escapeCsvCell('=CMD("calc")')).toBe(`"'=CMD(""calc"")"`);
    expect(escapeCsvCell('+SUM(A1:A2)')).toBe("'+SUM(A1:A2)");
    expect(escapeCsvCell('-10+5')).toBe("'-10+5");
    expect(escapeCsvCell('@IMPORTXML')).toBe("'@IMPORTXML");
    expect(escapeCsvCell('\t=1+1')).toBe("'\t=1+1");
    expect(escapeCsvCell('  +A1')).toBe("'  +A1");
    expect(escapeCsvCell('Courses;Bio')).toBe('"Courses;Bio"');
    expect(escapeCsvCell(null)).toBe('');

    expect(sanitizeDownloadSlug('Budget Foyer / Été 2026!')).toBe('budget-foyer-ete-2026');
    expect(sanitizeDownloadSlug('../../../etc/passwd')).toBe('etc-passwd');
    expect(sanitizeDownloadSlug('***')).toBe('budget');
  });

  it('exporte un CSV UTF-8 BOM sécurisé (filtrable par periodId et year) et une sauvegarde JSON complète', async () => {
    const { token, budgetId } = await registerUser();

    // Période Janvier 2026 et Période Décembre 2025
    const janRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2026&month=1`)
      .set('Authorization', `Bearer ${token}`);
    const janPeriodId = janRes.body.period.id as string;

    const decRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2025&month=12`)
      .set('Authorization', `Bearer ${token}`);
    const decPeriodId = decRes.body.period.id as string;

    // Revenu + charge fixe + enveloppe variable sur Janvier 2026
    await request(app)
      .post(`/api/periods/${janPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'income',
        name: 'Salaire',
        allocatedAmount: 3000,
        date: '2026-01-05T12:00:00.000Z',
        isPaid: true
      });

    await request(app)
      .post(`/api/periods/${janPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'fixed_charge',
        name: 'Loyer',
        allocatedAmount: 950,
        date: '2026-01-03T12:00:00.000Z',
        isPaid: true
      });

    const envRes = await request(app)
      .post(`/api/periods/${janPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'variable_envelope',
        name: 'Courses',
        allocatedAmount: 400
      });
    const coursesId = envRes.body.envelope.id as string;

    // Transaction avec payload potentiellement malveillant sur libellé et note
    await request(app)
      .post(`/api/periods/${janPeriodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        envelopeId: coursesId,
        label: '=CMD("hack")',
        amount: 45.5,
        date: '2026-01-12T12:00:00.000Z',
        notes: '@evil;note'
      });

    // Remboursement en Janvier 2026
    await request(app)
      .post(`/api/periods/${janPeriodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        envelopeId: coursesId,
        type: 'income',
        label: 'Avoir magasin',
        amount: 10,
        date: '2026-01-14T12:00:00.000Z'
      });

    // Charge fixe sur Décembre 2025 (permet de vérifier le filtre year=2026)
    await request(app)
      .post(`/api/periods/${decPeriodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'fixed_charge',
        name: 'Charge Décembre 2025',
        allocatedAmount: 120,
        date: '2025-12-10T12:00:00.000Z'
      });

    // Objectif d'épargne avec retrait en Janvier 2026
    const goalRes = await request(app)
      .post(`/api/budgets/${budgetId}/goals`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Vacances',
        targetAmount: 2000,
        initialAmount: 500
      });
    const goalId = goalRes.body.goal.id as string;

    await request(app)
      .post(`/api/budgets/${budgetId}/goals/${goalId}/withdrawals`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: 100,
        label: 'Acompte billet',
        date: '2026-01-20T12:00:00.000Z'
      });

    // 1. Export CSV filtré par periodId
    const csvPeriodRes = await request(app)
      .get(`/api/budgets/${budgetId}/export/csv?periodId=${janPeriodId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(csvPeriodRes.status).toBe(200);
    expect(csvPeriodRes.headers['content-type']).toContain('text/csv');
    expect(csvPeriodRes.headers['content-disposition']).toContain('attachment; filename="eparnio-');
    expect(csvPeriodRes.headers['x-content-type-options']).toBe('nosniff');

    expect(csvPeriodRes.text.startsWith('\uFEFF')).toBe(true);
    expect(csvPeriodRes.text).toContain('Salaire');
    expect(csvPeriodRes.text).toContain('3000.00');
    expect(csvPeriodRes.text).toContain(`"'=CMD(""hack"")"`);
    expect(csvPeriodRes.text).toContain(`"'@evil;note"`);
    expect(csvPeriodRes.text).toContain('Remboursement');
    expect(csvPeriodRes.text).toContain('Retrait épargne');
    expect(csvPeriodRes.text).toContain('Acompte billet');
    expect(csvPeriodRes.text).not.toContain('Charge Décembre 2025');

    // 2. Export CSV filtré par year=2025
    const csvYearRes = await request(app)
      .get(`/api/budgets/${budgetId}/export/csv?year=2025`)
      .set('Authorization', `Bearer ${token}`);
    expect(csvYearRes.status).toBe(200);
    expect(csvYearRes.text).toContain('Charge Décembre 2025');
    expect(csvYearRes.text).not.toContain('Salaire');

    // 3. Export JSON complet
    const jsonRes = await request(app)
      .get(`/api/budgets/${budgetId}/export/json`)
      .set('Authorization', `Bearer ${token}`);
    expect(jsonRes.status).toBe(200);
    expect(jsonRes.headers['content-type']).toContain('application/json');
    expect(jsonRes.headers['content-disposition']).toContain('eparnio-backup-');
    expect(jsonRes.body.schemaVersion).toBe(2);
    expect(Array.isArray(jsonRes.body.assets)).toBe(true);
    expect(jsonRes.body.budget.id).toBe(budgetId);
    expect(jsonRes.body.periods).toHaveLength(2);
    expect(jsonRes.body.envelopes.length).toBeGreaterThanOrEqual(4);
    expect(jsonRes.body.transactions).toHaveLength(2);
    expect(jsonRes.body.goals).toHaveLength(1);
    expect(jsonRes.body.goals[0].withdrawals).toHaveLength(1);
  });

  it('refuse les exports sans JWT (401) ou sans accès membre (403) et rejette une période inconnue (404)', async () => {
    const owner = await registerUser('owner.exp@eparnio.fr');
    const intruder = await registerUser('intruder.exp@eparnio.fr');

    const unauthCsv = await request(app).get(`/api/budgets/${owner.budgetId}/export/csv`);
    expect(unauthCsv.status).toBe(401);

    const forbiddenCsv = await request(app)
      .get(`/api/budgets/${owner.budgetId}/export/csv`)
      .set('Authorization', `Bearer ${intruder.token}`);
    expect(forbiddenCsv.status).toBe(403);

    const forbiddenJson = await request(app)
      .get(`/api/budgets/${owner.budgetId}/export/json`)
      .set('Authorization', `Bearer ${intruder.token}`);
    expect(forbiddenJson.status).toBe(403);

    const missingPeriodCsv = await request(app)
      .get(
        `/api/budgets/${owner.budgetId}/export/csv?periodId=${new mongoose.Types.ObjectId().toString()}`
      )
      .set('Authorization', `Bearer ${owner.token}`);
    expect(missingPeriodCsv.status).toBe(404);
  });
});

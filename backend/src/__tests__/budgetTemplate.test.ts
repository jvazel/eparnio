import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { resetAllRateLimiters } from '../middlewares/rateLimit.middleware';
import { BudgetModel } from '../models/Budget.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { BudgetTemplateModel } from '../models/BudgetTemplate.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { SavingsGoalModel } from '../models/SavingsGoal.model';
import { TransactionModel } from '../models/Transaction.model';
import { UserModel } from '../models/User.model';

const app = createApp();
let mongoServer: MongoMemoryServer;

async function registerUser(email: string, displayName: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .set('x-test-rate-limit-key', `tpl-${email}`)
    .send({ email, password: 'Password123', displayName });
  return {
    token: res.body.token as string,
    userId: res.body.user.id as string,
    budgetId: res.body.defaultBudget.id as string
  };
}

describe('Scénarios & Modèles de Budget (Étape 52)', () => {
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
      BudgetTemplateModel.deleteMany({}),
      EnvelopeModel.deleteMany({}),
      TransactionModel.deleteMany({}),
      SavingsGoalModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('gère le CRUD complet (manuel + snapshot sourcePeriodId) et refuse les mutations aux viewers (403)', async () => {
    const owner = await registerUser('tpl-owner@eparnio.test', 'Alice');
    const viewer = await registerUser('tpl-viewer@eparnio.test', 'Bob');

    await BudgetModel.findByIdAndUpdate(owner.budgetId, {
      $set: { type: 'shared' },
      $push: {
        members: {
          userId: new mongoose.Types.ObjectId(viewer.userId),
          role: 'viewer',
          color: '#3B82F6',
          declaredMonthlyIncome: 0
        }
      }
    });

    const period = await BudgetPeriodModel.create({
      budgetId: owner.budgetId,
      month: 4,
      year: 2026,
      label: 'Avril 2026',
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2026-04-30T23:59:59.999Z')
    });

    await EnvelopeModel.create([
      {
        budgetId: owner.budgetId,
        budgetPeriodId: period._id,
        pillar: 'income',
        name: 'Salaire',
        allocatedAmount: 2500
      },
      {
        budgetId: owner.budgetId,
        budgetPeriodId: period._id,
        pillar: 'variable_envelope',
        name: 'Courses',
        icon: '🛒',
        color: '#22C55E',
        allocatedAmount: 400
      },
      {
        budgetId: owner.budgetId,
        budgetPeriodId: period._id,
        pillar: 'savings',
        name: 'Épargne Vacances',
        icon: '✈️',
        color: '#38BDF8',
        allocatedAmount: 200
      }
    ]);

    // Création par snapshot (exclut income)
    const snapRes = await request(app)
      .post(`/api/budgets/${owner.budgetId}/templates`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Mois Normal', icon: '🌿', sourcePeriodId: period._id.toString() });

    expect(snapRes.status).toBe(201);
    expect(snapRes.body.template.items).toHaveLength(2);
    expect(snapRes.body.template.totalVariableAmount).toBe(400);
    expect(snapRes.body.template.totalSavingsAmount).toBe(200);
    expect(snapRes.body.template.totalAllocatedAmount).toBe(600);

    const templateId = snapRes.body.template.id;

    // Viewer peut lire mais pas modifier ni supprimer (403)
    const listRes = await request(app)
      .get(`/api/budgets/${owner.budgetId}/templates`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.templates).toHaveLength(1);

    const patchForbidden = await request(app)
      .patch(`/api/budgets/${owner.budgetId}/templates/${templateId}`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ name: 'Hack' });
    expect(patchForbidden.status).toBe(403);

    // Owner peut modifier et supprimer
    const patchOk = await request(app)
      .patch(`/api/budgets/${owner.budgetId}/templates/${templateId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Mois Standard' });
    expect(patchOk.status).toBe(200);
    expect(patchOk.body.template.name).toBe('Mois Standard');

    const delOk = await request(app)
      .delete(`/api/budgets/${owner.budgetId}/templates/${templateId}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(delOk.status).toBe(200);
  });

  it('prévisualise (dryRun) et applique un scénario : met à 0 € sans supprimer, crée les manquantes, protège revenus/fixes/rollover', async () => {
    const owner = await registerUser('tpl-apply@eparnio.test', 'Claire');

    const goal = await SavingsGoalModel.create({
      budgetId: owner.budgetId,
      name: 'Matelas',
      icon: '🛡️',
      color: '#10B981',
      targetAmount: 5000,
      initialAmount: 1000,
      currentAmount: 1200
    });

    const period = await BudgetPeriodModel.create({
      budgetId: owner.budgetId,
      month: 5,
      year: 2026,
      label: 'Mai 2026',
      startDate: new Date('2026-05-01T00:00:00.000Z'),
      endDate: new Date('2026-05-31T23:59:59.999Z')
    });

    const [, , courses, sorties, epargne] = await EnvelopeModel.create([
      {
        budgetId: owner.budgetId,
        budgetPeriodId: period._id,
        pillar: 'income',
        name: 'Salaire',
        allocatedAmount: 2000
      },
      {
        budgetId: owner.budgetId,
        budgetPeriodId: period._id,
        pillar: 'fixed_charge',
        name: 'Loyer',
        allocatedAmount: 800
      },
      {
        budgetId: owner.budgetId,
        budgetPeriodId: period._id,
        pillar: 'variable_envelope',
        name: 'Courses',
        allocatedAmount: 400,
        spentOrPaidAmount: 320,
        rolloverEnabled: true,
        rolloverAmount: 50
      },
      {
        budgetId: owner.budgetId,
        budgetPeriodId: period._id,
        pillar: 'variable_envelope',
        name: 'Sorties',
        allocatedAmount: 200,
        spentOrPaidAmount: 40
      },
      {
        budgetId: owner.budgetId,
        budgetPeriodId: period._id,
        pillar: 'savings',
        name: 'Matelas',
        allocatedAmount: 200,
        linkedGoalId: goal._id
      }
    ]);

    // Scénario « Mois Serré » : Courses -> 250 € (< 320 € déjà dépensés !), Matelas -> 100 €, + Santé 60 €, Sorties absent (-> 0 €)
    const tplRes = await request(app)
      .post(`/api/budgets/${owner.budgetId}/templates`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Mois Serré',
        icon: '❄️',
        items: [
          {
            pillar: 'variable_envelope',
            name: 'Courses',
            icon: '🛒',
            color: '#22C55E',
            allocatedAmount: 250
          },
          {
            pillar: 'variable_envelope',
            name: 'Santé',
            icon: '💊',
            color: '#EF4444',
            allocatedAmount: 60
          },
          {
            pillar: 'savings',
            name: 'Matelas',
            icon: '🛡️',
            color: '#10B981',
            allocatedAmount: 100,
            linkedGoalId: goal._id.toString()
          }
        ]
      });
    expect(tplRes.status).toBe(201);
    const templateId = tplRes.body.template.id;

    // 1. Dry-run : zéro écriture en base
    const dryRes = await request(app)
      .post(`/api/periods/${period._id.toString()}/apply-template`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ templateId, dryRun: true });

    expect(dryRes.status).toBe(200);
    expect(dryRes.body.dryRun).toBe(true);
    expect(dryRes.body.warnings.length).toBeGreaterThanOrEqual(2);
    const coursesAfterDry = await EnvelopeModel.findById(courses._id);
    expect(coursesAfterDry?.allocatedAmount).toBe(400); // inchangé

    // 2. Application réelle
    const applyRes = await request(app)
      .post(`/api/periods/${period._id.toString()}/apply-template`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ templateId, dryRun: false });

    expect(applyRes.status).toBe(200);
    expect(applyRes.body.dryRun).toBe(false);

    // Vérifier Courses : allocatedAmount=250, spentOrPaidAmount=320 intact, rolloverAmount=50 intact
    const updatedCourses = await EnvelopeModel.findById(courses._id);
    expect(updatedCourses?.allocatedAmount).toBe(250);
    expect(updatedCourses?.spentOrPaidAmount).toBe(320);
    expect(updatedCourses?.rolloverAmount).toBe(50);

    // Vérifier Sorties : mise à 0 € et NON supprimée
    const updatedSorties = await EnvelopeModel.findById(sorties._id);
    expect(updatedSorties).not.toBeNull();
    expect(updatedSorties?.allocatedAmount).toBe(0);
    expect(updatedSorties?.spentOrPaidAmount).toBe(40);

    // Vérifier Santé : créée
    const createdSante = await EnvelopeModel.findOne({
      budgetPeriodId: period._id,
      name: 'Santé'
    });
    expect(createdSante?.allocatedAmount).toBe(60);

    // Vérifier Matelas : mis à jour à 100 € et objectif recalculé (1000 + 100 = 1100)
    const updatedEpargne = await EnvelopeModel.findById(epargne._id);
    expect(updatedEpargne?.allocatedAmount).toBe(100);
    const updatedGoal = await SavingsGoalModel.findById(goal._id);
    expect(updatedGoal?.currentAmount).toBe(1100);

    // Vérifier le résumé Base Zéro de la période (Revenus 2000 - Fixes 800 - Enveloppes 310 - Épargne 100 = 790)
    const updatedPeriod = await BudgetPeriodModel.findById(period._id);
    expect(updatedPeriod?.summary.plannedIncome).toBe(2000);
    expect(updatedPeriod?.summary.plannedFixedCharges).toBe(800);
    expect(updatedPeriod?.summary.plannedEnvelopes).toBe(310);
    expect(updatedPeriod?.summary.plannedSavings).toBe(100);
    expect(updatedPeriod?.summary.remainingToAllocate).toBe(790);
  });
});

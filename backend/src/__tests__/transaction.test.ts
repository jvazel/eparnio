import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { BudgetModel } from '../models/Budget.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { TransactionModel } from '../models/Transaction.model';
import { UserModel } from '../models/User.model';

describe('API Transactions dans les Enveloppes (/api/periods/:periodId/transactions)', () => {
  const app = createApp();
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    await TransactionModel.deleteMany({});
    await EnvelopeModel.deleteMany({});
    await BudgetPeriodModel.deleteMany({});
    await BudgetModel.deleteMany({});
    await UserModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  async function setupPeriodWithEnvelopes() {
    const ownerRes = await request(app).post('/api/auth/register').send({
      email: 'alex@eparnio.fr',
      password: 'Password123!',
      displayName: 'Alex',
      budgetStartDay: 1
    });
    const token = ownerRes.body.token as string;
    const ownerId = ownerRes.body.user.id as string;

    const partnerRes = await request(app).post('/api/auth/register').send({
      email: 'camille@eparnio.fr',
      password: 'Password123!',
      displayName: 'Camille',
      budgetStartDay: 1
    });
    const partnerId = partnerRes.body.user.id as string;

    // Créer un budget commun avec 2 membres pour valider authorId & paidByUserId
    const sharedRes = await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Budget Commun',
        type: 'shared',
        budgetStartDay: 1
      });
    const budgetId = sharedRes.body.budget.id as string;

    await BudgetModel.findByIdAndUpdate(budgetId, {
      $push: {
        members: {
          userId: new mongoose.Types.ObjectId(partnerId),
          role: 'editor',
          color: '#EC4899',
          declaredMonthlyIncome: 2200,
          joinedAt: new Date()
        }
      }
    });

    const periodRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2026&month=11`)
      .set('Authorization', `Bearer ${token}`);
    const periodId = periodRes.body.period.id as string;

    // Revenu 3 000 € + Charge fixe 900 € -> Restant à vivre initial = 2 100 €
    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'income',
        name: 'Salaire',
        allocatedAmount: 3000
      });

    await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'fixed_charge',
        name: 'Loyer',
        allocatedAmount: 900
      });

    // Deux enveloppes variables : Courses (400 €) et Sorties (150 €)
    const coursesRes = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'variable_envelope',
        name: 'Courses',
        icon: '🛒',
        color: '#16A34A',
        allocatedAmount: 400
      });

    const sortiesRes = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'variable_envelope',
        name: 'Sorties',
        icon: '🍽️',
        color: '#38BDF8',
        allocatedAmount: 150
      });

    return {
      token,
      ownerId,
      partnerId,
      budgetId,
      periodId,
      coursesEnvelopeId: coursesRes.body.envelope.id as string,
      sortiesEnvelopeId: sortiesRes.body.envelope.id as string
    };
  }

  it('crée, liste, modifie et supprime des transactions en mettant à jour spentOrPaidAmount et remainingToLive', async () => {
    const {
      token,
      ownerId,
      partnerId,
      periodId,
      coursesEnvelopeId,
      sortiesEnvelopeId
    } = await setupPeriodWithEnvelopes();

    // 1. Ajout d'une dépense de 42.80 € dans Courses (payée par Camille)
    const createRes = await request(app)
      .post(`/api/periods/${periodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        envelopeId: coursesEnvelopeId,
        amount: 42.8,
        label: 'Supermarché',
        date: '2026-11-10T12:00:00.000Z',
        paidByUserId: partnerId,
        notes: 'Courses de la semaine'
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.transaction.authorId).toBe(ownerId);
    expect(createRes.body.transaction.paidByUserId).toBe(partnerId);
    expect(createRes.body.transaction.amount).toBe(42.8);
    expect(createRes.body.envelope.spentOrPaidAmount).toBe(42.8);
    expect(createRes.body.period.summary.spentVariables).toBe(42.8);
    // Reste à vivre : 3000 - 900 - 42.80 = 2057.20
    expect(createRes.body.period.summary.remainingToLive).toBe(2057.2);
    // Base Zéro inchangé : 3000 - 900 - 400 - 150 = 1550
    expect(createRes.body.period.summary.remainingToAllocate).toBe(1550);
    const tx1Id = createRes.body.transaction.id as string;

    // 2. Ajout d'une seconde dépense dans Courses (57.20 €)
    const create2Res = await request(app)
      .post(`/api/periods/${periodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        envelopeId: coursesEnvelopeId,
        amount: 57.2,
        label: 'Boulangerie & Marché'
      });
    expect(create2Res.status).toBe(201);
    expect(create2Res.body.envelope.spentOrPaidAmount).toBe(100);
    expect(create2Res.body.period.summary.remainingToLive).toBe(2000);
    const tx2Id = create2Res.body.transaction.id as string;

    // 3. Liste filtrée par enveloppe et payeur
    const listCoursesRes = await request(app)
      .get(`/api/periods/${periodId}/transactions?envelopeId=${coursesEnvelopeId}&paidByUserId=${partnerId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(listCoursesRes.status).toBe(200);
    expect(listCoursesRes.body.transactions).toHaveLength(1);
    expect(listCoursesRes.body.transactions[0].id).toBe(tx1Id);

    // 4. Modification du montant et réaffectation de tx2 vers Sorties
    const patchRes = await request(app)
      .patch(`/api/periods/${periodId}/transactions/${tx2Id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: 30,
        label: 'Apéro',
        envelopeId: sortiesEnvelopeId,
        paidByUserId: ownerId
      });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.transaction.amount).toBe(30);
    expect(patchRes.body.envelope.id).toBe(sortiesEnvelopeId);
    expect(patchRes.body.envelope.spentOrPaidAmount).toBe(30);
    // spentVariables total = 42.80 (Courses) + 30 (Sorties) = 72.80 -> remainingToLive = 2027.20
    expect(patchRes.body.period.summary.spentVariables).toBe(72.8);
    expect(patchRes.body.period.summary.remainingToLive).toBe(2027.2);

    const coursesAfterMove = await EnvelopeModel.findById(coursesEnvelopeId);
    expect(coursesAfterMove?.spentOrPaidAmount).toBe(42.8);

    // 5. Suppression de tx1
    const deleteRes = await request(app)
      .delete(`/api/periods/${periodId}/transactions/${tx1Id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.deletedId).toBe(tx1Id);
    expect(deleteRes.body.envelope.spentOrPaidAmount).toBe(0);
    expect(deleteRes.body.period.summary.spentVariables).toBe(30);
    expect(deleteRes.body.period.summary.remainingToLive).toBe(2070);
  });

  it('rejette un payeur hors budget (400), une enveloppe/transaction absente (404) et nettoie en cascade', async () => {
    const { token, periodId, coursesEnvelopeId } = await setupPeriodWithEnvelopes();
    const fakeId = new mongoose.Types.ObjectId().toString();

    const invalidMemberRes = await request(app)
      .post(`/api/periods/${periodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        envelopeId: coursesEnvelopeId,
        amount: 20,
        label: 'Test',
        paidByUserId: fakeId
      });
    expect(invalidMemberRes.status).toBe(400);

    const missingEnvRes = await request(app)
      .post(`/api/periods/${periodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        envelopeId: fakeId,
        amount: 20,
        label: 'Test'
      });
    expect(missingEnvRes.status).toBe(404);

    await request(app)
      .post(`/api/periods/${periodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        envelopeId: coursesEnvelopeId,
        amount: 45,
        label: 'Courses bio'
      });

    // Supprimer l'enveloppe doit supprimer sa transaction et rétablir remainingToLive
    const deleteEnvRes = await request(app)
      .delete(`/api/periods/${periodId}/envelopes/${coursesEnvelopeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteEnvRes.status).toBe(200);
    expect(deleteEnvRes.body.period.summary.spentVariables).toBe(0);
    expect(deleteEnvRes.body.period.summary.remainingToLive).toBe(2100);

    const remainingTxCount = await TransactionModel.countDocuments({
      envelopeId: new mongoose.Types.ObjectId(coursesEnvelopeId)
    });
    expect(remainingTxCount).toBe(0);

    const missingTxRes = await request(app)
      .delete(`/api/periods/${periodId}/transactions/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(missingTxRes.status).toBe(404);
  });

  it('gère les remboursements (type: income), la création/modification/effacement de notes et la conversion via PATCH', async () => {
    const { token, partnerId, periodId, coursesEnvelopeId } = await setupPeriodWithEnvelopes();

    // Dépense initiale 100 € avec note
    const expenseRes = await request(app)
      .post(`/api/periods/${periodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        envelopeId: coursesEnvelopeId,
        type: 'expense',
        amount: 100,
        label: 'Achat vêtements',
        notes: 'Commande #42'
      });
    expect(expenseRes.status).toBe(201);
    expect(expenseRes.body.transaction.notes).toBe('Commande #42');
    expect(expenseRes.body.envelope.spentOrPaidAmount).toBe(100);
    expect(expenseRes.body.period.summary.remainingToLive).toBe(2000);
    expect(expenseRes.body.period.summary.remainingToAllocate).toBe(1550);

    // Remboursement de 35 € -> spentOrPaidAmount = 65 €, remainingToLive = 2035 €, remainingToAllocate inchangé
    const refundRes = await request(app)
      .post(`/api/periods/${periodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        envelopeId: coursesEnvelopeId,
        type: 'income',
        amount: 35,
        label: 'Retour article',
        paidByUserId: partnerId,
        notes: 'Avoir en caisse'
      });
    expect(refundRes.status).toBe(201);
    expect(refundRes.body.transaction.type).toBe('income');
    expect(refundRes.body.transaction.notes).toBe('Avoir en caisse');
    expect(refundRes.body.envelope.spentOrPaidAmount).toBe(65);
    expect(refundRes.body.period.summary.spentVariables).toBe(65);
    expect(refundRes.body.period.summary.remainingToLive).toBe(2035);
    expect(refundRes.body.period.summary.remainingToAllocate).toBe(1550);

    const txExpenseId = expenseRes.body.transaction.id as string;

    // Effacement de la note (notes: '') et conversion en remboursement (ou mise à jour de montant)
    const patchNoteClearRes = await request(app)
      .patch(`/api/periods/${periodId}/transactions/${txExpenseId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        notes: ''
      });
    expect(patchNoteClearRes.status).toBe(200);
    expect(patchNoteClearRes.body.transaction.notes).toBeUndefined();

    // Conversion d'une dépense en remboursement via PATCH
    const convertRes = await request(app)
      .patch(`/api/periods/${periodId}/transactions/${txExpenseId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'income',
        notes: 'Passé en avoir'
      });
    expect(convertRes.status).toBe(200);
    expect(convertRes.body.transaction.type).toBe('income');
    expect(convertRes.body.transaction.notes).toBe('Passé en avoir');
    // -100 - 35 = -135 € (crédit net)
    expect(convertRes.body.envelope.spentOrPaidAmount).toBe(-135);
    expect(convertRes.body.period.summary.remainingToLive).toBe(2235);
  });

  it('supporte un remboursement supérieur aux dépenses du mois et propage le rollover vers le mois suivant', async () => {
    const { token, budgetId, periodId } = await setupPeriodWithEnvelopes();

    // Enveloppe Santé avec rollover activé (200 € en Nov 2026)
    const santeRes = await request(app)
      .post(`/api/periods/${periodId}/envelopes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        pillar: 'variable_envelope',
        name: 'Santé',
        allocatedAmount: 200,
        rolloverEnabled: true,
        rolloverMode: 'positive_only'
      });
    expect(santeRes.status).toBe(201);
    const santeNovId = santeRes.body.envelope.id as string;

    // Créer Décembre 2026 -> rollover initial = 200 €
    const decRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2026&month=12`)
      .set('Authorization', `Bearer ${token}`);
    expect(decRes.status).toBe(200);
    const santeDecBefore = (
      decRes.body.envelopes as Array<{ name: string; rolloverAmount: number }>
    ).find((e) => e.name === 'Santé');
    expect(santeDecBefore?.rolloverAmount).toBe(200);

    // Remboursement mutuelle de 50 € en Novembre (aucune dépense préalable -> spentOrPaidAmount = -50)
    const refundRes = await request(app)
      .post(`/api/periods/${periodId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        envelopeId: santeNovId,
        type: 'income',
        amount: 50,
        label: 'Remboursement mutuelle',
        notes: 'Soins octobre'
      });
    expect(refundRes.status).toBe(201);
    expect(refundRes.body.envelope.spentOrPaidAmount).toBe(-50);
    // Remaining to live: 3000 - 900 - (-50) = 2150
    expect(refundRes.body.period.summary.remainingToLive).toBe(2150);

    // Vérifier propagation sur Décembre : 200 - (-50) = 250 € reportés
    const decAfterRes = await request(app)
      .get(`/api/budgets/${budgetId}/periods/by-month?year=2026&month=12`)
      .set('Authorization', `Bearer ${token}`);
    const santeDecAfter = (
      decAfterRes.body.envelopes as Array<{ name: string; rolloverAmount: number }>
    ).find((e) => e.name === 'Santé');
    expect(santeDecAfter?.rolloverAmount).toBe(250);
  });
});

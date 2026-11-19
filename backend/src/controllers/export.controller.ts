import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../middlewares/error.middleware';
import { toBudgetResponse } from '../models/Budget.model';
import { BudgetPeriodModel, toBudgetPeriodResponse } from '../models/BudgetPeriod.model';
import { EnvelopeModel, toEnvelopeResponse } from '../models/Envelope.model';
import { SavingsGoalModel, toSavingsGoalResponse } from '../models/SavingsGoal.model';
import { TransactionModel, toTransactionResponse } from '../models/Transaction.model';
import { UserModel } from '../models/User.model';
import { assertBudgetAccess } from '../services/budgetAccess.service';

const objectIdSchema = z
  .string()
  .refine((value) => Types.ObjectId.isValid(value), 'Identifiant invalide');

export const exportBudgetParamsSchema = z.object({
  budgetId: objectIdSchema
});

export const exportCsvQuerySchema = z.object({
  periodId: objectIdSchema.optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional()
});

/**
 * Normalise un libellé en slug ASCII strict pour les en-têtes `Content-Disposition`.
 */
export function sanitizeDownloadSlug(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return normalized || 'budget';
}

/**
 * Protège une cellule CSV contre l'injection de formules (=, +, -, @, tab, CR)
 * et applique les guillemets RFC 4180 si nécessaire (séparateur `;`).
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const raw = String(value);
  if (raw.length === 0) {
    return '';
  }

  const safe = /^[\t\r ]*[=+\-@]/.test(raw) || /^[\t\r]/.test(raw) ? `'${raw}` : raw;

  if (
    safe.includes(';') ||
    safe.includes(',') ||
    safe.includes('"') ||
    safe.includes('\n') ||
    safe.includes('\r')
  ) {
    return `"${safe.replace(/"/g, '""')}"`;
  }

  return safe;
}

function formatCsvDate(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

async function loadMemberProfilesMap(
  budgetOwnerId: Types.ObjectId,
  memberUserIds: Types.ObjectId[]
): Promise<Map<string, { displayName?: string; avatarEmoji?: string; email?: string }>> {
  const uniqueIds = Array.from(
    new Set([budgetOwnerId.toString(), ...memberUserIds.map((id) => id.toString())])
  );
  const users = await UserModel.find({ _id: { $in: uniqueIds } }).select(
    'displayName avatarEmoji email'
  );
  const map = new Map<string, { displayName?: string; avatarEmoji?: string; email?: string }>();
  for (const user of users) {
    map.set(user._id.toString(), {
      displayName: user.displayName,
      avatarEmoji: user.avatarEmoji,
      email: user.email
    });
  }
  return map;
}

/**
 * Exporte les mouvements financiers d'un budget au format CSV UTF-8 avec BOM (compatible Excel),
 * filtrable par `periodId` ou `year`.
 */
export async function exportBudgetCsv(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { budgetId } = req.params as z.infer<typeof exportBudgetParamsSchema>;
    const { periodId, year } = req.query as unknown as z.infer<typeof exportCsvQuerySchema>;

    const { budget } = await assertBudgetAccess(budgetId, req.user?.id);

    let periods = [];
    if (periodId) {
      const targetPeriod = await BudgetPeriodModel.findOne({
        _id: periodId,
        budgetId: budget._id
      });
      if (!targetPeriod) {
        throw new AppError('Période budgétaire introuvable sur ce budget', 404);
      }
      periods = [targetPeriod];
    } else if (year) {
      periods = await BudgetPeriodModel.find({ budgetId: budget._id, year }).sort({
        year: 1,
        month: 1
      });
    } else {
      periods = await BudgetPeriodModel.find({ budgetId: budget._id }).sort({
        year: 1,
        month: 1
      });
    }

    const periodIds = periods.map((p) => p._id);
    const periodById = new Map(periods.map((p) => [p._id.toString(), p]));

    const [envelopes, transactions, goals, profiles] = await Promise.all([
      periodIds.length > 0
        ? EnvelopeModel.find({ budgetPeriodId: { $in: periodIds } }).sort({
            date: 1,
            pillar: 1,
            order: 1
          })
        : Promise.resolve([]),
      periodIds.length > 0
        ? TransactionModel.find({ budgetPeriodId: { $in: periodIds } }).sort({
            date: 1,
            createdAt: 1
          })
        : Promise.resolve([]),
      SavingsGoalModel.find({ budgetId: budget._id }).sort({ order: 1, createdAt: 1 }),
      loadMemberProfilesMap(
        budget.ownerId,
        budget.members.map((m) => m.userId)
      )
    ]);

    const envelopeById = new Map(envelopes.map((e) => [e._id.toString(), e]));
    const goalById = new Map(goals.map((g) => [g._id.toString(), g]));

    interface CsvRowEntry {
      sortDate: number;
      cells: Array<string | number | null | undefined>;
    }

    const rows: CsvRowEntry[] = [];

    for (const env of envelopes) {
      if (env.pillar === 'variable_envelope') continue;
      const period = periodById.get(env.budgetPeriodId.toString());
      const memberName = env.memberId
        ? profiles.get(env.memberId.toString())?.displayName ?? ''
        : '';
      const linkedGoalName = env.linkedGoalId
        ? goalById.get(env.linkedGoalId.toString())?.name
        : undefined;

      const typeLabel =
        env.pillar === 'income'
          ? 'Revenu'
          : env.pillar === 'fixed_charge'
            ? 'Charge fixe'
            : 'Épargne';
      const categoryLabel = linkedGoalName ?? typeLabel;
      const statusLabel = env.isPaid ? 'Pointé / Payé' : 'À venir';

      rows.push({
        sortDate: new Date(env.date).getTime(),
        cells: [
          formatCsvDate(env.date),
          period?.label ?? '',
          typeLabel,
          categoryLabel,
          env.name,
          Math.abs(env.allocatedAmount).toFixed(2),
          statusLabel,
          memberName,
          ''
        ]
      });
    }

    for (const tx of transactions) {
      const period = periodById.get(tx.budgetPeriodId.toString());
      const env = envelopeById.get(tx.envelopeId.toString());
      const payerName = profiles.get(tx.paidByUserId.toString())?.displayName ?? '';
      const typeLabel =
        tx.type === 'income'
          ? 'Remboursement'
          : tx.type === 'transfer'
            ? 'Virement'
            : 'Dépense variable';

      rows.push({
        sortDate: new Date(tx.date).getTime(),
        cells: [
          formatCsvDate(tx.date),
          period?.label ?? '',
          typeLabel,
          env?.name ?? 'Enveloppe',
          tx.label,
          Math.abs(tx.amount).toFixed(2),
          'Enregistrée',
          payerName,
          tx.notes ?? ''
        ]
      });
    }

    for (const goal of goals) {
      for (const withdrawal of goal.withdrawals ?? []) {
        const wTime = new Date(withdrawal.date).getTime();
        const matchesFilter = periodId
          ? periods.some(
              (p) => wTime >= p.startDate.getTime() && wTime <= p.endDate.getTime()
            )
          : year
            ? new Date(withdrawal.date).getUTCFullYear() === year ||
              periods.some(
                (p) => wTime >= p.startDate.getTime() && wTime <= p.endDate.getTime()
              )
            : true;

        if (!matchesFilter) continue;

        const matchedPeriod = periods.find(
          (p) => wTime >= p.startDate.getTime() && wTime <= p.endDate.getTime()
        );
        const memberName = withdrawal.memberId
          ? profiles.get(withdrawal.memberId.toString())?.displayName ?? ''
          : '';

        rows.push({
          sortDate: wTime,
          cells: [
            formatCsvDate(withdrawal.date),
            matchedPeriod?.label ?? '',
            'Retrait épargne',
            goal.name,
            withdrawal.label,
            Math.abs(withdrawal.amount).toFixed(2),
            'Effectué',
            memberName,
            withdrawal.notes ?? ''
          ]
        });
      }
    }

    rows.sort((a, b) => a.sortDate - b.sortDate);

    const header = [
      'Date',
      'Période',
      'Type',
      'Catégorie / Enveloppe',
      'Libellé',
      'Montant (EUR)',
      'Statut',
      'Membre',
      'Notes'
    ];

    const lines = [
      header.map(escapeCsvCell).join(';'),
      ...rows.map((row) => row.cells.map(escapeCsvCell).join(';'))
    ];

    const csvContent = `\uFEFF${lines.join('\r\n')}`;
    const slug = sanitizeDownloadSlug(budget.name);
    const scope = periodId && periods[0]
      ? `${periods[0].year}-${String(periods[0].month).padStart(2, '0')}`
      : year
        ? String(year)
        : 'complet';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="eparnio-${slug}-${scope}.csv"`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
}

/**
 * Exporte une sauvegarde JSON structurée et complète de l'espace budgétaire
 * (métadonnées, périodes, enveloppes, transactions, objectifs d'épargne et retraits).
 */
export async function exportBudgetJson(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { budgetId } = req.params as z.infer<typeof exportBudgetParamsSchema>;
    const { budget } = await assertBudgetAccess(budgetId, req.user?.id);

    const [periods, envelopes, transactions, goals, profiles] = await Promise.all([
      BudgetPeriodModel.find({ budgetId: budget._id }).sort({ year: 1, month: 1 }),
      EnvelopeModel.find({ budgetId: budget._id }).sort({
        budgetPeriodId: 1,
        pillar: 1,
        order: 1
      }),
      TransactionModel.find({ budgetId: budget._id }).sort({ date: 1, createdAt: 1 }),
      SavingsGoalModel.find({ budgetId: budget._id }).sort({ order: 1, createdAt: 1 }),
      loadMemberProfilesMap(
        budget.ownerId,
        budget.members.map((m) => m.userId)
      )
    ]);

    const slug = sanitizeDownloadSlug(budget.name);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="eparnio-backup-${slug}.json"`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');

    res.status(200).json({
      status: 'ok',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      budget: toBudgetResponse(budget, profiles),
      periods: periods.map(toBudgetPeriodResponse),
      envelopes: envelopes.map(toEnvelopeResponse),
      transactions: transactions.map(toTransactionResponse),
      goals: goals.map(toSavingsGoalResponse)
    });
  } catch (err) {
    next(err);
  }
}

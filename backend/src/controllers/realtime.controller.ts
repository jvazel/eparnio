import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../middlewares/error.middleware';
import { assertBudgetAccess } from '../services/budgetAccess.service';
import { registerRealtimeClient } from '../services/realtime.service';

export const realtimeEventsParamsSchema = z.object({
  budgetId: z.string().refine((v) => Types.ObjectId.isValid(v), 'Identifiant de budget invalide')
});

/**
 * Ouvre un flux Server-Sent Events (SSE) authentifié pour recevoir en direct
 * les mises à jour d'un espace budgétaire (personnel ou partagé).
 */
export async function streamBudgetEvents(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.id) {
      throw new AppError('Authentification requise', 401);
    }

    const { budgetId } = req.params as z.infer<typeof realtimeEventsParamsSchema>;
    const { budget } = await assertBudgetAccess(budgetId, req.user.id);

    const cleanup = registerRealtimeClient(budget._id.toString(), req.user.id, res);
    req.on('close', cleanup);
  } catch (err) {
    next(err);
  }
}

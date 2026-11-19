import { Router } from 'express';
import {
  budgetPeriodParamsSchema,
  byMonthQuerySchema,
  closePeriod,
  closePeriodBodySchema,
  createPeriod,
  createPeriodBodySchema,
  getCurrentPeriod,
  getPeriodByMonth,
  periodRolloverParamsSchema,
  syncRecurringFromPrevious,
  triggerRollover
} from '../controllers/period.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';

const periodRouter = Router({ mergeParams: true });

periodRouter.use(requireAuth);

periodRouter.get('/current', validate({ params: budgetPeriodParamsSchema }), getCurrentPeriod);
periodRouter.get(
  '/by-month',
  validate({ params: budgetPeriodParamsSchema, query: byMonthQuerySchema }),
  getPeriodByMonth
);
periodRouter.post(
  '/',
  validate({ params: budgetPeriodParamsSchema, body: createPeriodBodySchema }),
  createPeriod
);
periodRouter.post(
  '/:periodId/rollover',
  validate({ params: periodRolloverParamsSchema }),
  triggerRollover
);
periodRouter.post(
  '/:periodId/close',
  validate({ params: periodRolloverParamsSchema, body: closePeriodBodySchema }),
  closePeriod
);

periodRouter.post(
  '/:periodId/sync-recurring',
  validate({ params: periodRolloverParamsSchema }),
  syncRecurringFromPrevious
);

export { periodRouter };

import { Router } from 'express';
import {
  budgetPeriodParamsSchema,
  byMonthQuerySchema,
  createPeriod,
  createPeriodBodySchema,
  getCurrentPeriod,
  getPeriodByMonth,
  periodRolloverParamsSchema,
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

export { periodRouter };

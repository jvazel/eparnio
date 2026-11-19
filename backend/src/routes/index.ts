import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { validate } from '../middlewares/validate.middleware';
import { requireAuth } from '../middlewares/auth.middleware';
import {
  getPeriodAnalytics,
  periodAnalyticsParamsSchema,
  periodAnalyticsQuerySchema
} from '../controllers/analytics.controller';
import {
  exportBudgetCsv,
  exportBudgetJson,
  exportBudgetParamsSchema,
  exportCsvQuerySchema
} from '../controllers/export.controller';
import { authRouter } from './auth.routes';
import { budgetRouter } from './budget.routes';
import { envelopeRouter } from './envelope.routes';
import { goalRouter } from './goal.routes';
import { periodRouter } from './period.routes';
import { transactionRouter } from './transaction.routes';

const apiRouter = Router();

const echoBodySchema = z.object({
  message: z.string().trim().min(1, 'Le message est requis')
});

apiRouter.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    app: 'Eparnio API',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

apiRouter.post('/health/echo', validate({ body: echoBodySchema }), (req, res) => {
  const { message } = req.body as z.infer<typeof echoBodySchema>;
  res.status(200).json({
    status: 'ok',
    echo: message
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/budgets', budgetRouter);
apiRouter.get(
  '/budgets/:budgetId/export/csv',
  requireAuth,
  validate({ params: exportBudgetParamsSchema, query: exportCsvQuerySchema }),
  exportBudgetCsv
);
apiRouter.get(
  '/budgets/:budgetId/export/json',
  requireAuth,
  validate({ params: exportBudgetParamsSchema }),
  exportBudgetJson
);
apiRouter.use('/budgets/:budgetId/goals', goalRouter);
apiRouter.use('/budgets/:budgetId/periods', periodRouter);
apiRouter.use('/periods/:periodId/envelopes', envelopeRouter);
apiRouter.use('/periods/:periodId/transactions', transactionRouter);
apiRouter.get(
  '/periods/:periodId/analytics',
  requireAuth,
  validate({ params: periodAnalyticsParamsSchema, query: periodAnalyticsQuerySchema }),
  getPeriodAnalytics
);

export { apiRouter };

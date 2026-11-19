import { Router } from 'express';
import {
  createTransaction,
  createTransactionBodySchema,
  deleteTransaction,
  dismissTransactionAnomaly,
  getPeriodAnomalies,
  importTransactions,
  importTransactionsBodySchema,
  listTransactions,
  listTransactionsQuerySchema,
  reconcileBalanceBodySchema,
  reconcilePeriodBalance,
  splitTransaction,
  splitTransactionBodySchema,
  transactionItemParamsSchema,
  transactionPeriodParamsSchema,
  updateTransaction,
  updateTransactionBodySchema
} from '../controllers/transaction.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';

const transactionRouter = Router({ mergeParams: true });

transactionRouter.use(requireAuth);

transactionRouter.get(
  '/',
  validate({ params: transactionPeriodParamsSchema, query: listTransactionsQuerySchema }),
  listTransactions
);
transactionRouter.post(
  '/',
  validate({ params: transactionPeriodParamsSchema, body: createTransactionBodySchema }),
  createTransaction
);
transactionRouter.post(
  '/import',
  validate({ params: transactionPeriodParamsSchema, body: importTransactionsBodySchema }),
  importTransactions
);
transactionRouter.post(
  '/reconcile',
  validate({ params: transactionPeriodParamsSchema, body: reconcileBalanceBodySchema }),
  reconcilePeriodBalance
);
transactionRouter.post(
  '/split',
  validate({ params: transactionPeriodParamsSchema, body: splitTransactionBodySchema }),
  splitTransaction
);
transactionRouter.patch(
  '/:id',
  validate({ params: transactionItemParamsSchema, body: updateTransactionBodySchema }),
  updateTransaction
);
transactionRouter.delete(
  '/:id',
  validate({ params: transactionItemParamsSchema }),
  deleteTransaction
);

transactionRouter.get(
  '/anomalies',
  validate({ params: transactionPeriodParamsSchema }),
  getPeriodAnomalies
);
transactionRouter.patch(
  '/:id/dismiss-anomaly',
  validate({ params: transactionItemParamsSchema }),
  dismissTransactionAnomaly
);

export { transactionRouter };

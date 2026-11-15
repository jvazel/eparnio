import { Router } from 'express';
import {
  createTransaction,
  createTransactionBodySchema,
  deleteTransaction,
  listTransactions,
  listTransactionsQuerySchema,
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

export { transactionRouter };

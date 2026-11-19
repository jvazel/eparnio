import { Router } from 'express';
import {
  addGoalWithdrawal,
  createGoal,
  createGoalBodySchema,
  createWithdrawalBodySchema,
  deleteGoal,
  deleteGoalWithdrawal,
  goalBudgetParamsSchema,
  goalItemParamsSchema,
  goalWithdrawalParamsSchema,
  listGoals,
  updateGoal,
  updateGoalBodySchema,
  updateGoalWithdrawal,
  updateWithdrawalBodySchema
} from '../controllers/goal.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';

const goalRouter = Router({ mergeParams: true });

goalRouter.use(requireAuth);

goalRouter.get('/', validate({ params: goalBudgetParamsSchema }), listGoals);
goalRouter.post(
  '/',
  validate({ params: goalBudgetParamsSchema, body: createGoalBodySchema }),
  createGoal
);
goalRouter.patch(
  '/:id',
  validate({ params: goalItemParamsSchema, body: updateGoalBodySchema }),
  updateGoal
);
goalRouter.delete('/:id', validate({ params: goalItemParamsSchema }), deleteGoal);

goalRouter.post(
  '/:id/withdrawals',
  validate({ params: goalItemParamsSchema, body: createWithdrawalBodySchema }),
  addGoalWithdrawal
);
goalRouter.patch(
  '/:id/withdrawals/:withdrawalId',
  validate({ params: goalWithdrawalParamsSchema, body: updateWithdrawalBodySchema }),
  updateGoalWithdrawal
);
goalRouter.delete(
  '/:id/withdrawals/:withdrawalId',
  validate({ params: goalWithdrawalParamsSchema }),
  deleteGoalWithdrawal
);

export { goalRouter };

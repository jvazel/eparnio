import { Router } from 'express';
import {
  createGoal,
  createGoalBodySchema,
  deleteGoal,
  goalBudgetParamsSchema,
  goalItemParamsSchema,
  listGoals,
  updateGoal,
  updateGoalBodySchema
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

export { goalRouter };

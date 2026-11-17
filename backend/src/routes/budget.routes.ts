import { Router } from 'express';
import { getBudgetTrends } from '../controllers/analytics.controller';
import {
  budgetIdParamsSchema,
  contributionSplitBodySchema,
  createBudget,
  createBudgetSchema,
  deleteBudget,
  generateInvite,
  inviteCodeParamsSchema,
  joinBudget,
  listBudgets,
  removeMember,
  removeMemberParamsSchema,
  updateBudget,
  updateBudgetSchema,
  updateContributionSplit
} from '../controllers/budget.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { inviteJoinRateLimiter } from '../middlewares/rateLimit.middleware';
import { validate } from '../middlewares/validate.middleware';

const budgetRouter = Router();

budgetRouter.use(requireAuth);

budgetRouter.get('/', listBudgets);
budgetRouter.post('/', validate({ body: createBudgetSchema }), createBudget);
budgetRouter.post(
  '/join/:inviteCode',
  inviteJoinRateLimiter,
  validate({ params: inviteCodeParamsSchema }),
  joinBudget
);
budgetRouter.post(
  '/:id/invite',
  validate({ params: budgetIdParamsSchema }),
  generateInvite
);
budgetRouter.patch(
  '/:id/contribution-split',
  validate({ params: budgetIdParamsSchema, body: contributionSplitBodySchema }),
  updateContributionSplit
);
budgetRouter.delete(
  '/:id/members/:userId',
  validate({ params: removeMemberParamsSchema }),
  removeMember
);
budgetRouter.patch(
  '/:id',
  validate({ params: budgetIdParamsSchema, body: updateBudgetSchema }),
  updateBudget
);
budgetRouter.delete('/:id', validate({ params: budgetIdParamsSchema }), deleteBudget);

budgetRouter.get('/:budgetId/trends', requireAuth, getBudgetTrends);

export { budgetRouter };

import { Router } from 'express';
import { getBudgetTrends } from '../controllers/analytics.controller';
import {
  getTransactionSuggestions,
  transactionSuggestionsParamsSchema
} from '../controllers/transaction.controller';
import {
  budgetIdParamsSchema,
  contributionSplitBodySchema,
  createBudget,
  createBudgetSchema,
  createQuickTemplate,
  createQuickTemplateBodySchema,
  deleteBudget,
  deleteQuickTemplate,
  generateInvite,
  inviteCodeParamsSchema,
  joinBudget,
  listBudgets,
  quickTemplateParamsSchema,
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

budgetRouter.get(
  '/:id/transactions/suggestions',
  validate({ params: transactionSuggestionsParamsSchema }),
  getTransactionSuggestions
);
budgetRouter.post(
  '/:id/quick-templates',
  validate({ params: budgetIdParamsSchema, body: createQuickTemplateBodySchema }),
  createQuickTemplate
);
budgetRouter.delete(
  '/:id/quick-templates/:templateId',
  validate({ params: quickTemplateParamsSchema }),
  deleteQuickTemplate
);

export { budgetRouter };

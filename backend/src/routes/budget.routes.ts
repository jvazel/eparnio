import { Router } from 'express';
import {
  createAssetHandler,
  createAssetSchema,
  deleteAssetHandler,
  getNetWorthHandler,
  importGoalsToAssetsHandler,
  recordAssetOperationHandler,
  recordAssetOperationSchema,
  updateAssetHandler,
  updateAssetSchema,
  updateCheckingBalanceHandler,
  updateCheckingBalanceSchema,
} from '../controllers/netWorth.controller';
import {
  getBudgetStreakHandler,
  getBudgetTrends,
  getBudgetWrappedHandler,
  getTagDetailAnalytics,
  getTagsSummary
} from '../controllers/analytics.controller';
import { getWeeklyDigestHandler } from '../controllers/weeklyHabit.controller';
import {
  searchBudget,
  searchBudgetParamsSchema
} from '../controllers/search.controller';
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
import {
  createBudgetTemplate,
  createBudgetTemplateBodySchema,
  deleteBudgetTemplate,
  listBudgetTemplates,
  templateBudgetParamsSchema,
  templateItemParamsSchema,
  updateBudgetTemplate,
  updateBudgetTemplateBodySchema
} from '../controllers/budgetTemplate.controller';
import {
  createPayeeRule,
  createPayeeRuleBodySchema,
  deletePayeeRule,
  listPayeeRules,
  payeeRuleBudgetParamsSchema,
  payeeRuleItemParamsSchema,
  reorderPayeeRules,
  reorderPayeeRulesBodySchema,
  updatePayeeRule,
  updatePayeeRuleBodySchema
} from '../controllers/payeeRule.controller';
import {
  realtimeEventsParamsSchema,
  streamBudgetEvents
} from '../controllers/realtime.controller';
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
budgetRouter.get('/:budgetId/weekly-digest', requireAuth, getWeeklyDigestHandler);
budgetRouter.get('/:budgetId/wrapped', requireAuth, getBudgetWrappedHandler);
budgetRouter.get('/:budgetId/net-worth', requireAuth, getNetWorthHandler);
budgetRouter.put(
  '/:budgetId/checking-balance',
  requireAuth,
  validate({ body: updateCheckingBalanceSchema }),
  updateCheckingBalanceHandler
);
budgetRouter.post(
  '/:budgetId/assets',
  requireAuth,
  validate({ body: createAssetSchema }),
  createAssetHandler
);
budgetRouter.patch(
  '/:budgetId/assets/:assetId',
  requireAuth,
  validate({ body: updateAssetSchema }),
  updateAssetHandler
);
budgetRouter.delete('/:budgetId/assets/:assetId', requireAuth, deleteAssetHandler);
budgetRouter.post(
  '/:budgetId/assets/import-goals',
  requireAuth,
  importGoalsToAssetsHandler
);
budgetRouter.post(
  '/:budgetId/assets/:assetId/operations',
  requireAuth,
  validate({ body: recordAssetOperationSchema }),
  recordAssetOperationHandler
);

budgetRouter.get(
  '/:id/search',
  validate({ params: searchBudgetParamsSchema }),
  searchBudget
);
budgetRouter.get(
  '/:id/tags/summary',
  validate({ params: searchBudgetParamsSchema }),
  getTagsSummary
);
budgetRouter.get(
  '/:id/tags/:tag/analytics',
  getTagDetailAnalytics
);
budgetRouter.get('/:id/streak', getBudgetStreakHandler);

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

budgetRouter.get(
  '/:budgetId/events',
  validate({ params: realtimeEventsParamsSchema }),
  streamBudgetEvents
);
budgetRouter.get(
  '/:budgetId/templates',
  validate({ params: templateBudgetParamsSchema }),
  listBudgetTemplates
);
budgetRouter.post(
  '/:budgetId/templates',
  validate({ params: templateBudgetParamsSchema, body: createBudgetTemplateBodySchema }),
  createBudgetTemplate
);
budgetRouter.patch(
  '/:budgetId/templates/:templateId',
  validate({ params: templateItemParamsSchema, body: updateBudgetTemplateBodySchema }),
  updateBudgetTemplate
);
budgetRouter.delete(
  '/:budgetId/templates/:templateId',
  validate({ params: templateItemParamsSchema }),
  deleteBudgetTemplate
);

budgetRouter.get(
  '/:budgetId/payee-rules',
  validate({ params: payeeRuleBudgetParamsSchema }),
  listPayeeRules
);
budgetRouter.post(
  '/:budgetId/payee-rules',
  validate({ params: payeeRuleBudgetParamsSchema, body: createPayeeRuleBodySchema }),
  createPayeeRule
);
budgetRouter.patch(
  '/:budgetId/payee-rules/reorder',
  validate({ params: payeeRuleBudgetParamsSchema, body: reorderPayeeRulesBodySchema }),
  reorderPayeeRules
);
budgetRouter.patch(
  '/:budgetId/payee-rules/:ruleId',
  validate({ params: payeeRuleItemParamsSchema, body: updatePayeeRuleBodySchema }),
  updatePayeeRule
);
budgetRouter.delete(
  '/:budgetId/payee-rules/:ruleId',
  validate({ params: payeeRuleItemParamsSchema }),
  deletePayeeRule
);

export { budgetRouter };

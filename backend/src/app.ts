import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { apiRateLimiter } from './middlewares/rateLimit.middleware';
import { apiRouter } from './routes';

/**
 * Construit et configure l'instance Express (sans démarrage du serveur HTTP).
 */
export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    })
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true
    })
  );
  app.use('/api/budgets/import/json', express.json({ limit: '10mb' }));
  app.use('/api/budgets/:budgetId/import/json', express.json({ limit: '10mb' }));
  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));

  app.use('/api', apiRateLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

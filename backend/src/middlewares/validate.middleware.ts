import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { AppError } from './error.middleware';

export interface RequestValidationSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

type ValidationTarget = keyof RequestValidationSchemas;

/**
 * Valide `req.body`, `req.params` et `req.query` avec Zod avant d'atteindre le contrôleur.
 */
export function validate(schemas: RequestValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: Array<{ location: ValidationTarget; path: string; message: string }> = [];

    for (const location of ['body', 'params', 'query'] as const) {
      const schema = schemas[location];
      if (!schema) continue;

      const result = schema.safeParse(req[location]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({ location, path: issue.path.join('.'), message: issue.message });
        }
      } else {
        (req as unknown as Record<ValidationTarget, unknown>)[location] = result.data;
      }
    }

    if (errors.length > 0) {
      next(new AppError('Données de requête invalides', 400, errors));
      return;
    }

    next();
  };
}

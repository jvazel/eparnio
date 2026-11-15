import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

/**
 * Erreur métier ou HTTP applicative transportant un statut HTTP et des détails optionnels.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number = 500, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Middleware capture des routes inexistantes (404).
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(`Route introuvable : ${req.method} ${req.originalUrl}`, 404));
}

/**
 * Middleware central de gestion des erreurs retournant un format JSON uniforme.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {})
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      status: 'error',
      message: 'Données invalides',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    });
    return;
  }

  console.error('Erreur serveur non gérée :', err);
  res.status(500).json({
    status: 'error',
    message: 'Erreur interne du serveur'
  });
}

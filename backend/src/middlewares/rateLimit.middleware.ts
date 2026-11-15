import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { AppError } from './error.middleware';

export interface RateLimiterOptions {
  keyPrefix: string;
  windowMs: number;
  maxRequests: number;
  message?: string;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const registeredStores = new Set<Map<string, RateLimitBucket>>();

function resolveClientIdentifier(req: Request): string {
  if (env.NODE_ENV === 'test') {
    const testKey = req.headers['x-test-rate-limit-key'];
    if (typeof testKey === 'string' && testKey.trim().length > 0) {
      return testKey.trim();
    }
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Réinitialise l'ensemble des compteurs de limitation de débit en mémoire (utile en tests).
 */
export function resetAllRateLimiters(): void {
  for (const store of registeredStores) {
    store.clear();
  }
}

/**
 * Crée un middleware Express de limitation de débit en mémoire pour contrer le brute-force.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const store = new Map<string, RateLimitBucket>();
  registeredStores.add(store);

  const defaultMessage =
    options.message ?? 'Trop de tentatives effectuées. Veuillez patienter avant de réessayer.';

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    const clientKey = resolveClientIdentifier(req);
    const bucketKey = `${options.keyPrefix}:${clientKey}`;

    if (store.size > 1000) {
      for (const [key, value] of store.entries()) {
        if (value.resetAt <= now) {
          store.delete(key);
        }
      }
    }

    const existing = store.get(bucketKey);
    if (!existing || existing.resetAt <= now) {
      store.set(bucketKey, {
        count: 1,
        resetAt: now + options.windowMs
      });
      next();
      return;
    }

    if (existing.count >= options.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      next(new AppError(defaultMessage, 429));
      return;
    }

    existing.count += 1;
    next();
  };
}

export const authRateLimiter = createRateLimiter({
  keyPrefix: 'auth',
  windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  maxRequests: env.AUTH_RATE_LIMIT_MAX,
  message: 'Trop de tentatives d’authentification. Réessayez dans quelques minutes.'
});

export const inviteJoinRateLimiter = createRateLimiter({
  keyPrefix: 'invite-join',
  windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  maxRequests: env.INVITE_RATE_LIMIT_MAX,
  message: 'Trop de tentatives avec des codes d’invitation. Réessayez plus tard.'
});

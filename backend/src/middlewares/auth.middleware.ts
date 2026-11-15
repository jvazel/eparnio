import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { env } from '../config/env';
import { UserModel } from '../models/User.model';
import { AppError } from './error.middleware';

export interface AuthenticatedUser {
  id: string;
  email: string;
  tokenVersion?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Génère un token JWT d'accès pour un utilisateur Eparnio (durée configurée par `JWT_EXPIRES_IN`).
 */
export function signAccessToken(payload: AuthenticatedUser): string {
  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      tokenVersion: payload.tokenVersion ?? 0
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  );
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AppError('Format du jeton d’authentification invalide', 401);
  }
  return token;
}

function verifyAccessToken(token: string): AuthenticatedUser {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      typeof decoded.id === 'string' &&
      typeof decoded.email === 'string'
    ) {
      return {
        id: decoded.id,
        email: decoded.email,
        tokenVersion: typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : 0
      };
    }
    throw new AppError('Jeton d’authentification invalide', 401);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Session expirée ou invalide', 401);
  }
}

async function resolveAuthenticatedUser(token: string): Promise<AuthenticatedUser> {
  const authUser = verifyAccessToken(token);

  if (mongoose.connection.readyState === 1 && Types.ObjectId.isValid(authUser.id)) {
    const dbUser = await UserModel.findById(authUser.id).select('tokenVersion').lean();
    if (dbUser && (dbUser.tokenVersion ?? 0) !== (authUser.tokenVersion ?? 0)) {
      throw new AppError(
        'Session expirée suite à une modification de sécurité. Veuillez vous reconnecter.',
        401
      );
    }
  }

  return authUser;
}

/**
 * Middleware exigeant un JWT valide dans `Authorization: Bearer <token>`.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      next(new AppError('Authentification requise', 401));
      return;
    }
    req.user = await resolveAuthenticatedUser(token);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware optionnel : attache `req.user` si un Bearer JWT est fourni, sinon poursuit sans session.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (token) {
      req.user = await resolveAuthenticatedUser(token);
    }
    next();
  } catch (err) {
    next(err);
  }
}

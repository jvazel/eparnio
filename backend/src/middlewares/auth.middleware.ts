import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { env } from '../config/env';
import { UserModel } from '../models/User.model';
import { AppError } from './error.middleware';

export const ACCESS_COOKIE_NAME = 'eparnio_access_token';
export const REFRESH_COOKIE_NAME = 'eparnio_refresh_token';

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours
const ACCESS_TTL_MS = 24 * 60 * 60 * 1000; // 24 heures

export interface AuthenticatedUser {
  id: string;
  email: string;
  tokenVersion?: number;
}

/**
 * Parse l'en-tête HTTP `Cookie` sans dépendance tierce.
 */
export function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

/**
 * Génère un refresh token JWT (`HS256`, 30j, `type: 'refresh'`).
 */
export function signRefreshToken(payload: AuthenticatedUser): string {
  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      tokenVersion: payload.tokenVersion ?? 0,
      type: 'refresh'
    },
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: '30d'
    }
  );
}

/**
 * Vérifie un refresh token JWT (`HS256`, `type === 'refresh'`).
 */
export function verifyRefreshToken(token: string): AuthenticatedUser {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      decoded.type === 'refresh' &&
      typeof decoded.id === 'string' &&
      typeof decoded.email === 'string'
    ) {
      return {
        id: decoded.id,
        email: decoded.email,
        tokenVersion: typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : 0
      };
    }
    throw new AppError('Refresh token invalide', 401);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Session expirée ou invalide', 401);
  }
}

function getBaseCookieOptions() {
  const isProd = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax'
  };
}

/**
 * Pose les cookies `HttpOnly` d'accès et de rafraîchissement sur la réponse HTTP.
 */
export function setAuthCookies(res: Response, payload: AuthenticatedUser): {
  accessToken: string;
  refreshToken: string;
} {
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const base = getBaseCookieOptions();

  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    ...base,
    path: '/api',
    maxAge: ACCESS_TTL_MS
  });
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...base,
    path: '/api/auth',
    maxAge: REFRESH_TTL_MS
  });

  return { accessToken, refreshToken };
}

/**
 * Efface les cookies `HttpOnly` d'authentification (déconnexion ou suppression de compte).
 */
export function clearAuthCookies(res: Response): void {
  const base = getBaseCookieOptions();
  res.clearCookie(ACCESS_COOKIE_NAME, { ...base, path: '/api' });
  res.clearCookie(REFRESH_COOKIE_NAME, { ...base, path: '/api/auth' });
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
    {
      algorithm: 'HS256',
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
    }
  );
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header) {
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new AppError('Format du jeton d’authentification invalide', 401);
    }
    return token;
  }

  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[ACCESS_COOKIE_NAME] || null;
}

function verifyAccessToken(token: string): AuthenticatedUser {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
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
    if (!dbUser) {
      throw new AppError('Compte introuvable ou supprimé. Veuillez vous reconnecter.', 401);
    }
    if ((dbUser.tokenVersion ?? 0) !== (authUser.tokenVersion ?? 0)) {
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

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticatorTransport,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON
} from '@simplewebauthn/server';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { signAccessToken } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/error.middleware';
import { toUserResponse, UserModel } from '../models/User.model';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const emailSchema = z.object({
  email: z.string().trim().email('Adresse e-mail invalide')
});

const loginVerifySchema = z.object({
  email: z.string().trim().email('Adresse e-mail invalide'),
  response: z.custom<AuthenticationResponseJSON>((val) => Boolean(val && typeof val === 'object'))
});

function resolveRpConfig(req: Request): { rpName: string; rpID: string; origin: string } {
  const originHeader = req.headers.origin;
  const origin =
    typeof originHeader === 'string' && originHeader.startsWith('http')
      ? originHeader
      : env.CORS_ORIGIN;
  let rpID = 'localhost';
  try {
    rpID = new URL(origin).hostname;
  } catch {
    rpID = 'localhost';
  }
  return {
    rpName: 'Eparnio',
    rpID,
    origin
  };
}

/**
 * POST /api/auth/webauthn/register/options
 * Génère les options WebAuthn pour enregistrer un passkey (Face ID / Empreinte).
 */
export async function getWebAuthnRegisterOptions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentification requise', 401);
    }

    const user = await UserModel.findById(req.user.id);
    if (!user) {
      throw new AppError('Utilisateur introuvable', 404);
    }

    const { rpName, rpID } = resolveRpConfig(req);
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.email,
      userDisplayName: user.displayName,
      attestationType: 'none',
      excludeCredentials: user.webauthnCredentials.map((cred) => ({
        id: cred.credentialId,
        transports: (cred.transports ?? []) as AuthenticatorTransport[]
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform'
      }
    });

    user.webauthnChallenge = options.challenge;
    user.webauthnChallengeExpiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
    await user.save();

    res.json({ options });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/webauthn/register/verify
 * Vérifie la réponse d'enregistrement WebAuthn et sauvegarde le credential.
 */
export async function verifyWebAuthnRegister(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentification requise', 401);
    }

    const user = await UserModel.findById(req.user.id);
    if (!user) {
      throw new AppError('Utilisateur introuvable', 404);
    }

    if (
      !user.webauthnChallenge ||
      !user.webauthnChallengeExpiresAt ||
      user.webauthnChallengeExpiresAt.getTime() < Date.now()
    ) {
      throw new AppError('Challenge biométrique expiré, veuillez réessayer', 400);
    }

    const { rpID, origin } = resolveRpConfig(req);
    const body = req.body as { response?: RegistrationResponseJSON };
    if (!body?.response) {
      throw new AppError('Réponse WebAuthn manquante', 400);
    }

    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: user.webauthnChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new AppError('Vérification biométrique échouée', 400);
    }

    const { credential } = verification.registrationInfo;
    user.webauthnCredentials.push({
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: credential.transports ?? []
    });
    user.webauthnChallenge = undefined;
    user.webauthnChallengeExpiresAt = undefined;
    await user.save();

    res.json({ user: toUserResponse(user) });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/auth/webauthn/credentials
 * Supprime les credentials biométriques de l'utilisateur connecté.
 */
export async function deleteWebAuthnCredentials(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentification requise', 401);
    }

    const user = await UserModel.findById(req.user.id);
    if (!user) {
      throw new AppError('Utilisateur introuvable', 404);
    }

    user.webauthnCredentials = [];
    user.webauthnChallenge = undefined;
    user.webauthnChallengeExpiresAt = undefined;
    await user.save();

    res.json({ user: toUserResponse(user) });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/webauthn/login/options
 * Génère le challenge d'authentification biométrique pour un e-mail donné.
 */
export async function getWebAuthnLoginOptions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email } = emailSchema.parse(req.body);
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user || user.webauthnCredentials.length === 0) {
      throw new AppError('Aucune connexion biométrique configurée pour cet e-mail', 400);
    }

    const { rpID } = resolveRpConfig(req);
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      allowCredentials: user.webauthnCredentials.map((cred) => ({
        id: cred.credentialId,
        transports: (cred.transports ?? []) as AuthenticatorTransport[]
      }))
    });

    user.webauthnChallenge = options.challenge;
    user.webauthnChallengeExpiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
    await user.save();

    res.json({ options });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/webauthn/login/verify
 * Vérifie la signature biométrique et retourne un JWT de session.
 */
export async function verifyWebAuthnLogin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, response } = loginVerifySchema.parse(req.body);
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new AppError('Identifiants biométriques invalides', 401);
    }

    if (
      !user.webauthnChallenge ||
      !user.webauthnChallengeExpiresAt ||
      user.webauthnChallengeExpiresAt.getTime() < Date.now()
    ) {
      throw new AppError('Challenge biométrique expiré, veuillez réessayer', 400);
    }

    const cred = user.webauthnCredentials.find((c) => c.credentialId === response.id);
    if (!cred) {
      throw new AppError('Identifiants biométriques invalides', 401);
    }

    const { rpID, origin } = resolveRpConfig(req);
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: user.webauthnChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.credentialId,
        publicKey: Buffer.from(cred.publicKey, 'base64url'),
        counter: cred.counter,
        transports: (cred.transports ?? []) as AuthenticatorTransport[]
      }
    });

    if (!verification.verified) {
      throw new AppError('Authentification biométrique refusée', 401);
    }

    cred.counter = verification.authenticationInfo.newCounter;
    user.webauthnChallenge = undefined;
    user.webauthnChallengeExpiresAt = undefined;
    await user.save();

    const token = signAccessToken({
      id: user._id.toString(),
      email: user.email,
      tokenVersion: user.tokenVersion ?? 0
    });
    res.json({
      token,
      user: toUserResponse(user)
    });
  } catch (error) {
    next(error);
  }
}

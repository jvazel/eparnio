import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import {
  clearAuthCookies,
  parseCookieHeader,
  REFRESH_COOKIE_NAME,
  setAuthCookies,
  signAccessToken,
  verifyRefreshToken
} from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/error.middleware';
import { BudgetModel, toBudgetResponse } from '../models/Budget.model';
import { toUserResponse, UserModel } from '../models/User.model';
import { deleteUserAccountCascade } from '../services/accountDeletion.service';
import { sendPasswordResetCodeEmail } from '../services/email.service';

const SALT_ROUNDS = env.BCRYPT_SALT_ROUNDS;
const RECOVERY_KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Génère une clé de récupération personnelle au format `EPAR-XXXX-XXXX`.
 */
export function generateRecoveryKey(): string {
  const bytes = crypto.randomBytes(8);
  let raw = '';
  for (let i = 0; i < 8; i += 1) {
    raw += RECOVERY_KEY_ALPHABET[bytes[i] % RECOVERY_KEY_ALPHABET.length];
  }
  return `EPAR-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export function normalizeRecoveryKey(rawKey: string): string {
  return rawKey.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function buildRecoveryKeyHint(key: string): string {
  return `EPAR-••••-${key.slice(-4)}`;
}

export const strongPasswordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .max(128, 'Le mot de passe est trop long')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
  .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre');

export const registerSchema = z.object({
  email: z.string().trim().email('Adresse e-mail invalide').toLowerCase(),
  password: strongPasswordSchema,
  displayName: z
    .string()
    .trim()
    .min(1, 'Le prénom ou pseudo est requis')
    .max(60, 'Le prénom ou pseudo ne doit pas dépasser 60 caractères'),
  avatarEmoji: z.string().trim().min(1).max(16).optional(),
  budgetStartDay: z.coerce.number().int().min(1).max(31).optional(),
  inviteCode: z.string().trim().max(128).optional()
});

export const loginSchema = z.object({
  email: z.string().trim().email('Adresse e-mail invalide').toLowerCase(),
  password: z.string().min(1, 'Le mot de passe est requis')
});

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Le prénom ou pseudo ne peut pas être vide')
    .max(60)
    .optional(),
  avatarEmoji: z.string().trim().min(1).max(16).optional(),
  hasCompletedOnboarding: z.boolean().optional(),
  budgetStartDay: z.coerce.number().int().min(1).max(31).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  defaultTab: z.enum(['revenus', 'depenses', 'enveloppes', 'epargne', 'budget']).optional(),
  budgetViewMode: z.enum(['essential', 'advanced']).optional(),
  currency: z.literal('EUR').optional()
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Adresse e-mail invalide').toLowerCase()
});

export const updatePasswordSchema = z.object({
  email: z.string().trim().email('Adresse e-mail invalide').toLowerCase().optional(),
  currentPassword: z.string().min(1, 'Le mot de passe actuel ne peut pas être vide').optional(),
  recoveryKey: z.string().trim().min(4, 'Clé de récupération invalide').max(32).optional(),
  emailCode: z.string().trim().regex(/^\d{6}$/, 'Le code e-mail doit contenir 6 chiffres').optional(),
  newPassword: strongPasswordSchema
});

function isValidRegistrationInviteCode(providedCode: string | undefined): boolean {
  const expected = env.REGISTRATION_INVITE_CODE;
  if (!expected) {
    return true;
  }
  const actual = (providedCode ?? '').trim();
  if (!actual) {
    return false;
  }
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(actual, 'utf8');
  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Retourne la configuration publique d'authentification (ex. si un code d'accès est requis à l'inscription).
 */
export function getAuthConfig(_req: Request, res: Response): void {
  res.json({
    status: 'ok',
    registrationRequiresInviteCode: Boolean(env.REGISTRATION_INVITE_CODE)
  });
}

/**
 * Inscription d'un utilisateur et création automatique de son premier `Budget Perso`.
 */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, displayName, avatarEmoji, budgetStartDay, inviteCode } =
      req.body as z.infer<typeof registerSchema>;

    if (!isValidRegistrationInviteCode(inviteCode)) {
      throw new AppError("Code d'accès d'inscription invalide ou manquant", 403);
    }

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      throw new AppError('Un compte existe déjà avec cette adresse e-mail', 409);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const recoveryKey = generateRecoveryKey();
    const recoveryKeyHash = await bcrypt.hash(normalizeRecoveryKey(recoveryKey), SALT_ROUNDS);
    const recoveryKeyHint = buildRecoveryKeyHint(recoveryKey);
    const startDay = budgetStartDay ?? 1;

    const user = await UserModel.create({
      email,
      passwordHash,
      recoveryKeyHash,
      recoveryKeyHint,
      tokenVersion: 0,
      displayName,
      avatarEmoji: avatarEmoji ?? '🧑',
      hasCompletedOnboarding: false,
      preferences: {
        currency: 'EUR',
        budgetStartDay: startDay,
        theme: 'light'
      }
    });

    const defaultBudget = await BudgetModel.create({
      name: 'Budget Perso',
      type: 'personal',
      ownerId: user._id,
      contributionMode: 'equal_50_50',
      members: [
        {
          userId: user._id,
          role: 'owner',
          color: '#7C3AED',
          declaredMonthlyIncome: 0,
          joinedAt: new Date()
        }
      ],
      budgetStartDay: startDay
    });

    const token = signAccessToken({
      id: user._id.toString(),
      email: user.email,
      tokenVersion: user.tokenVersion ?? 0
    });

    res.status(201).json({
      status: 'ok',
      token,
      recoveryKey,
      user: toUserResponse(user),
      defaultBudget: toBudgetResponse(defaultBudget)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Connexion par e-mail et mot de passe retournant un jeton JWT.
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const user = await UserModel.findOne({ email });

    if (!user) {
      throw new AppError('E-mail ou mot de passe incorrect', 401);
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new AppError('E-mail ou mot de passe incorrect', 401);
    }

    const { accessToken: token } = setAuthCookies(res, {
      id: user._id.toString(),
      email: user.email,
      tokenVersion: user.tokenVersion ?? 0
    });

    res.status(200).json({
      status: 'ok',
      token,
      user: toUserResponse(user)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Récupère le profil et les préférences de l'utilisateur authentifié.
 */
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await UserModel.findById(req.user?.id);
    if (!user) {
      throw new AppError('Utilisateur introuvable', 404);
    }

    res.status(200).json({
      status: 'ok',
      user: toUserResponse(user)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Met à jour le profil, l'état d'onboarding et les préférences de l'utilisateur connecté.
 */
export async function updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = req.body as z.infer<typeof updateProfileSchema>;
    const user = await UserModel.findById(req.user?.id);

    if (!user) {
      throw new AppError('Utilisateur introuvable', 404);
    }

    if (payload.displayName !== undefined) {
      user.displayName = payload.displayName;
    }
    if (payload.avatarEmoji !== undefined) {
      user.avatarEmoji = payload.avatarEmoji;
    }
    if (payload.hasCompletedOnboarding !== undefined) {
      user.hasCompletedOnboarding = payload.hasCompletedOnboarding;
    }
    if (payload.budgetStartDay !== undefined) {
      user.preferences.budgetStartDay = payload.budgetStartDay;
    }
    if (payload.theme !== undefined) {
      user.preferences.theme = payload.theme;
    }
    if (payload.currency !== undefined) {
      user.preferences.currency = payload.currency;
    }
    if (payload.defaultTab !== undefined) {
      user.preferences.defaultTab = payload.defaultTab;
    }
    if (payload.budgetViewMode !== undefined) {
      user.preferences.budgetViewMode = payload.budgetViewMode;
    }

    await user.save();

    if (payload.budgetStartDay !== undefined) {
      // Synchronise le jour de démarrage sur le budget personnel principal de l'utilisateur.
      const primaryPersonalBudget = await BudgetModel.findOne({
        ownerId: user._id,
        type: 'personal'
      }).sort({ createdAt: 1 });

      if (primaryPersonalBudget) {
        primaryPersonalBudget.budgetStartDay = payload.budgetStartDay;
        await primaryPersonalBudget.save();
      }
    }

    res.status(200).json({
      status: 'ok',
      user: toUserResponse(user)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Génère une nouvelle clé de récupération personnelle (`EPAR-XXXX-XXXX`) et révoque la précédente.
 */
export async function regenerateRecoveryKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await UserModel.findById(req.user?.id);
    if (!user) {
      throw new AppError('Utilisateur introuvable', 404);
    }

    const recoveryKey = generateRecoveryKey();
    user.recoveryKeyHash = await bcrypt.hash(normalizeRecoveryKey(recoveryKey), SALT_ROUNDS);
    user.recoveryKeyHint = buildRecoveryKeyHint(recoveryKey);
    await user.save();

    res.status(200).json({
      status: 'ok',
      recoveryKey,
      user: toUserResponse(user)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Génère et envoie un code de réinitialisation à 6 chiffres par e-mail (SMTP Gmail gratuit).
 * Retourne une réponse neutre pour empêcher l'énumération des comptes.
 */
export async function requestPasswordResetEmailCode(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email } = req.body as z.infer<typeof forgotPasswordSchema>;
    const user = await UserModel.findOne({ email });
    const ttlMinutes = env.PASSWORD_RESET_CODE_TTL_MINUTES;

    if (user) {
      const code = crypto.randomInt(100000, 1000000).toString();
      user.resetEmailCodeHash = await bcrypt.hash(code, SALT_ROUNDS);
      user.resetEmailCodeExpiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
      user.resetEmailCodeAttempts = 0;
      await user.save();

      await sendPasswordResetCodeEmail({
        to: user.email,
        displayName: user.displayName,
        code,
        ttlMinutes
      });
    }

    res.status(200).json({
      status: 'ok',
      message: `Si un compte existe pour cette adresse, un code à 6 chiffres (valable ${ttlMinutes} min) a été envoyé par e-mail.`
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Met à jour le mot de passe en vérifiant soit l'ancien mot de passe, la clé de récupération personnelle
 * hachée (`EPAR-XXXX-XXXX`), ou un code e-mail à 6 chiffres, puis incrémente `tokenVersion` pour
 * invalider les anciennes sessions JWT.
 */
export async function updatePassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, currentPassword, recoveryKey, emailCode, newPassword } = req.body as z.infer<
      typeof updatePasswordSchema
    >;

    let refreshedToken: string | undefined;

    if (req.user) {
      if (!currentPassword) {
        throw new AppError('Le mot de passe actuel est requis', 400);
      }
      const user = await UserModel.findById(req.user.id);
      if (!user) {
        throw new AppError('Utilisateur introuvable', 404);
      }

      const matches = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!matches) {
        throw new AppError('Mot de passe actuel incorrect', 401);
      }

      user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      user.resetEmailCodeHash = undefined;
      user.resetEmailCodeExpiresAt = undefined;
      user.resetEmailCodeAttempts = 0;
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      await user.save();

      refreshedToken = signAccessToken({
        id: user._id.toString(),
        email: user.email,
        tokenVersion: user.tokenVersion
      });
    } else {
      if (!email) {
        throw new AppError('L’adresse e-mail est requise pour réinitialiser le mot de passe', 400);
      }

      if (!recoveryKey && !emailCode && !currentPassword) {
        throw new AppError(
          'La clé de récupération, le code e-mail ou le mot de passe actuel est requis pour réinitialiser le mot de passe',
          401
        );
      }

      const user = await UserModel.findOne({ email });
      if (!user) {
        throw new AppError(
          recoveryKey
            ? 'Clé de récupération invalide'
            : emailCode
              ? 'Code de réinitialisation invalide ou expiré'
              : 'E-mail ou mot de passe actuel incorrect',
          401
        );
      }

      if (recoveryKey) {
        const normalized = normalizeRecoveryKey(recoveryKey);
        const matchesRecovery =
          Boolean(user.recoveryKeyHash) &&
          (await bcrypt.compare(normalized, user.recoveryKeyHash!));
        if (!matchesRecovery) {
          throw new AppError('Clé de récupération invalide', 401);
        }
      } else if (emailCode) {
        if (!user.resetEmailCodeHash || !user.resetEmailCodeExpiresAt) {
          throw new AppError('Code de réinitialisation invalide ou expiré', 401);
        }

        if (user.resetEmailCodeExpiresAt.getTime() < Date.now()) {
          user.resetEmailCodeHash = undefined;
          user.resetEmailCodeExpiresAt = undefined;
          user.resetEmailCodeAttempts = 0;
          await user.save();
          throw new AppError(
            'Le code de réinitialisation a expiré. Demandez un nouveau code par e-mail.',
            410
          );
        }

        const maxAttempts = env.PASSWORD_RESET_MAX_ATTEMPTS;

        if ((user.resetEmailCodeAttempts ?? 0) >= maxAttempts) {
          user.resetEmailCodeHash = undefined;
          user.resetEmailCodeExpiresAt = undefined;
          user.resetEmailCodeAttempts = 0;
          await user.save();
          throw new AppError(
            'Trop de tentatives erronées. Veuillez demander un nouveau code par e-mail.',
            429
          );
        }

        const matchesCode = await bcrypt.compare(emailCode, user.resetEmailCodeHash);
        if (!matchesCode) {
          user.resetEmailCodeAttempts = (user.resetEmailCodeAttempts ?? 0) + 1;
          if (user.resetEmailCodeAttempts >= maxAttempts) {
            user.resetEmailCodeHash = undefined;
            user.resetEmailCodeExpiresAt = undefined;
            user.resetEmailCodeAttempts = 0;
            await user.save();
            throw new AppError(
              'Trop de tentatives erronées. Veuillez demander un nouveau code par e-mail.',
              429
            );
          }
          await user.save();
          throw new AppError('Code de réinitialisation invalide', 401);
        }
      } else if (currentPassword) {
        const matchesCurrent = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!matchesCurrent) {
          throw new AppError('Mot de passe actuel incorrect', 401);
        }
      }

      user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      user.resetEmailCodeHash = undefined;
      user.resetEmailCodeExpiresAt = undefined;
      user.resetEmailCodeAttempts = 0;
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      await user.save();
    }

    res.status(200).json({
      status: 'ok',
      message: 'Mot de passe mis à jour avec succès',
      ...(refreshedToken ? { token: refreshedToken } : {})
    });
  } catch (err) {
    next(err);
  }
}

export const deleteAccountSchema = z.object({
  currentPassword: z.string().min(1, 'Le mot de passe actuel est requis'),
  confirmation: z.literal('SUPPRIMER', {
    error: 'Veuillez saisir exactement « SUPPRIMER » pour confirmer'
  })
});

/**
 * Supprime définitivement le compte connecté et ses données (RGPD Art. 17).
 * Vérifie le mot de passe actuel et la confirmation explicite « SUPPRIMER ».
 */
export async function deleteMe(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.id) {
      throw new AppError('Authentification requise', 401);
    }

    const { currentPassword } = req.body as z.infer<typeof deleteAccountSchema>;
    const user = await UserModel.findById(req.user.id);
    if (!user) {
      throw new AppError('Utilisateur introuvable', 404);
    }

    const matchesPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matchesPassword) {
      throw new AppError('Mot de passe actuel incorrect', 401);
    }

    const summary = await deleteUserAccountCascade(user._id.toString());
    clearAuthCookies(res);

    res.status(200).json({
      status: 'ok',
      message: 'Votre compte et vos données ont été supprimés définitivement.',
      summary
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Rafraîchit silencieusement la session à partir du cookie `HttpOnly` `eparnio_refresh_token`
 * en appliquant une rotation des cookies et en vérifiant `tokenVersion`.
 */
export async function refreshSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const cookies = parseCookieHeader(req.headers.cookie);
    const refreshToken = cookies[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      throw new AppError('Refresh token manquant', 401);
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = await UserModel.findById(decoded.id);
    if (!user) {
      clearAuthCookies(res);
      throw new AppError('Compte introuvable ou supprimé', 401);
    }

    if ((user.tokenVersion ?? 0) !== (decoded.tokenVersion ?? 0)) {
      clearAuthCookies(res);
      throw new AppError('Session révoquée. Veuillez vous reconnecter.', 401);
    }

    const { accessToken } = setAuthCookies(res, {
      id: user._id.toString(),
      email: user.email,
      tokenVersion: user.tokenVersion ?? 0
    });

    res.status(200).json({
      status: 'ok',
      token: accessToken,
      user: toUserResponse(user)
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Déconnecte la session navigateur en effaçant les cookies `HttpOnly`.
 */
export function logout(_req: Request, res: Response): void {
  clearAuthCookies(res);
  res.status(200).json({
    status: 'ok',
    message: 'Déconnexion réussie'
  });
}

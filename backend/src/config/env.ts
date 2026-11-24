import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const DEV_DEFAULT_JWT_SECRET = 'eparnio-dev-secret-key-change-in-production';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    MONGO_URI: z.string().min(1).default('mongodb://localhost:27017/eparnio'),
    CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
    JSON_BODY_LIMIT: z.string().trim().min(1).default('1mb'),
    JWT_SECRET: z
      .string()
      .min(16, 'JWT_SECRET doit contenir au moins 16 caractères')
      .default(DEV_DEFAULT_JWT_SECRET),
    JWT_EXPIRES_IN: z
      .string()
      .trim()
      .regex(/^\d+[smhdw]?$/i, 'Format JWT_EXPIRES_IN invalide (ex: 24h, 7d, 30m)')
      .default('24h'),
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(15).default(10),
    INVITE_CODE_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(24),
    RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1000).default(20),
    INVITE_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1000).default(15),
    SMTP_HOST: z.string().trim().min(1).default('smtp.gmail.com'),
    SMTP_PORT: z.coerce.number().int().positive().default(465),
    SMTP_SECURE: z
      .preprocess(
        (val) =>
          val === undefined || val === '' ? true : String(val).trim().toLowerCase() !== 'false',
        z.boolean()
      )
      .default(true),
    SMTP_USER: z.string().trim().default(''),
    SMTP_PASS: z.string().default(''),
    SMTP_FROM: z.string().trim().min(1).default('Eparnio <no-reply@eparnio.app>'),
    SMTP_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(15000),
    PASSWORD_RESET_CODE_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
    PASSWORD_RESET_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
    VAPID_PUBLIC_KEY: z.string().trim().default(''),
    VAPID_PRIVATE_KEY: z.string().trim().default(''),
    VAPID_SUBJECT: z.string().trim().default('mailto:contact@eparnio.app')
  })
  .superRefine((data, ctx) => {
    if (
      data.NODE_ENV === 'production' &&
      (data.JWT_SECRET === DEV_DEFAULT_JWT_SECRET || data.JWT_SECRET.length < 32)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message:
          'En production, JWT_SECRET doit être défini explicitement et contenir au moins 32 caractères'
      });
    }
  });

/**
 * Valide et résout les variables d'environnement serveur (avec règles strictes en production).
 */
export function parseEnvConfig(rawEnv: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.safeParse(rawEnv);

  if (!parsed.success) {
    console.error('Configuration environnement invalide :', parsed.error.flatten().fieldErrors);
    throw new Error('Variables d’environnement invalides');
  }

  return parsed.data;
}

export const env = parseEnvConfig(process.env);

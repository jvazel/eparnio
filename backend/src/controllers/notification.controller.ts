import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { PushSubscriptionModel } from '../models/PushSubscription.model';
import { UserModel } from '../models/User.model';
import {
  checkAndSendDailyReminders,
  checkAndSendDueAlerts,
  checkAndSendEnvelopeThresholdAlerts,
  checkAndSendWeeklyDigestPush,
  sendPushToUser
} from '../services/pushNotification.service';

export const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional(),
});

export const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export const notificationPreferencesSchema = z.object({
  dailyReminderEnabled: z.boolean().optional(),
  dailyReminderHour: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Format HH:MM requis')
    .optional(),
  upcomingDueAlertEnabled: z.boolean().optional(),
  envelopeThresholdAlertEnabled: z.boolean().optional(),
  envelopeThresholdPercent: z.union([z.literal(75), z.literal(80), z.literal(90)]).optional(),
  sharedActivityAlertEnabled: z.boolean().optional(),
  weeklyDigestEnabled: z.boolean().optional(),
  weeklyDigestDay: z.number().int().min(0).max(6).optional(),
  weeklyDigestHour: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Format HH:MM requis')
    .optional(),
});

export async function getVapidPublicKey(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.status(200).json({
      status: 'ok',
      publicKey: env.VAPID_PUBLIC_KEY || null,
      configured: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
    });
  } catch (err) {
    next(err);
  }
}

export async function subscribePush(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Authentification requise.' });
      return;
    }

    const { endpoint, keys, userAgent } = req.body as z.infer<typeof subscribeSchema>;

    await PushSubscriptionModel.findOneAndUpdate(
      { endpoint },
      { userId, endpoint, keys, userAgent },
      { upsert: true, new: true }
    );

    res.status(201).json({ status: 'ok', message: 'Abonnement push enregistré.' });
  } catch (err) {
    next(err);
  }
}

export async function unsubscribePush(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Authentification requise.' });
      return;
    }

    const { endpoint } = req.body as z.infer<typeof unsubscribeSchema>;
    await PushSubscriptionModel.deleteOne({ userId, endpoint });

    res.status(200).json({ status: 'ok', message: 'Abonnement push supprimé.' });
  } catch (err) {
    next(err);
  }
}

export async function updateNotificationPreferences(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Authentification requise.' });
      return;
    }

    const updates = req.body as z.infer<typeof notificationPreferencesSchema>;
    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable.' });
      return;
    }

    const current = user.notificationPreferences ?? {
      dailyReminderEnabled: false,
      dailyReminderHour: '20:00',
      upcomingDueAlertEnabled: true,
      envelopeThresholdAlertEnabled: true,
      sharedActivityAlertEnabled: true,
    };

    user.notificationPreferences = {
      dailyReminderEnabled: updates.dailyReminderEnabled ?? current.dailyReminderEnabled,
      dailyReminderHour: updates.dailyReminderHour ?? current.dailyReminderHour,
      upcomingDueAlertEnabled: updates.upcomingDueAlertEnabled ?? current.upcomingDueAlertEnabled,
      envelopeThresholdAlertEnabled:
        updates.envelopeThresholdAlertEnabled ?? current.envelopeThresholdAlertEnabled,
      envelopeThresholdPercent:
        updates.envelopeThresholdPercent ?? current.envelopeThresholdPercent ?? 80,
      sharedActivityAlertEnabled:
        updates.sharedActivityAlertEnabled ?? current.sharedActivityAlertEnabled ?? true,
      weeklyDigestEnabled:
        updates.weeklyDigestEnabled ?? current.weeklyDigestEnabled ?? false,
      weeklyDigestDay: updates.weeklyDigestDay ?? current.weeklyDigestDay ?? 0,
      weeklyDigestHour: updates.weeklyDigestHour ?? current.weeklyDigestHour ?? '18:00',
    };

    await user.save();

    res.status(200).json({
      status: 'ok',
      notificationPreferences: user.notificationPreferences,
    });
  } catch (err) {
    next(err);
  }
}

export async function sendTestNotification(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Authentification requise.' });
      return;
    }

    const result = await sendPushToUser(userId, {
      title: 'Notification test Eparnio',
      body: 'Vos rappels push PWA fonctionnent correctement !',
      url: '/?tab=budget',
      tag: 'eparnio-test',
    });

    res.status(200).json({ status: 'ok', ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * Endpoint déclenchable par un cron externe (GitHub Actions / cron-job.org sur Render Free Tier),
 * protégé par l'en-tête `X-Cron-Secret` (comparaison à temps constant).
 */
export async function runNotificationCron(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const expectedSecret =
      process.env.CRON_SECRET !== undefined ? process.env.CRON_SECRET : env.CRON_SECRET;
    if (!expectedSecret) {
      res.status(503).json({ message: 'CRON_SECRET non configuré sur le serveur.' });
      return;
    }

    const provided = String(req.headers['x-cron-secret'] ?? '');
    const expectedBuf = Buffer.from(expectedSecret, 'utf8');
    const providedBuf = Buffer.from(provided, 'utf8');
    if (
      providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      res.status(401).json({ message: 'Secret cron invalide.' });
      return;
    }

    const now = new Date();
    const hourStr = `${String(now.getHours()).padStart(2, '0')}:00`;
    const [dueAlerts, thresholdAlerts, dailyReminders, weeklyDigests] = await Promise.all([
      checkAndSendDueAlerts(now),
      checkAndSendEnvelopeThresholdAlerts(now),
      checkAndSendDailyReminders(hourStr),
      checkAndSendWeeklyDigestPush(now)
    ]);

    res.status(200).json({
      status: 'ok',
      dueAlerts,
      thresholdAlerts,
      dailyReminders,
      weeklyDigests
    });
  } catch (err) {
    next(err);
  }
}

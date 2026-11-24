import cron from 'node-cron';
import * as webpushNamespace from 'web-push';

const webpush =
  (webpushNamespace as unknown as { default?: typeof webpushNamespace }).default ??
  webpushNamespace;
import { env } from '../config/env';
import { BudgetModel } from '../models/Budget.model';
import { BudgetPeriodModel } from '../models/BudgetPeriod.model';
import { EnvelopeModel } from '../models/Envelope.model';
import { PushSubscriptionModel } from '../models/PushSubscription.model';
import { UserModel } from '../models/User.model';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let vapidConfigured = false;

export function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return false;
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  vapidConfigured = true;
  return true;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; removed: number }> {
  if (!ensureVapidConfigured()) {
    return { sent: 0, removed: 0 };
  }

  const subscriptions = await PushSubscriptionModel.find({ userId });
  let sent = 0;
  let removed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
          },
        },
        JSON.stringify(payload)
      );
      sent += 1;
    } catch (err: unknown) {
      const statusCode =
        typeof err === 'object' && err !== null && 'statusCode' in err
          ? Number((err as { statusCode: unknown }).statusCode)
          : 0;
      if (statusCode === 410 || statusCode === 404) {
        await PushSubscriptionModel.deleteOne({ _id: sub._id });
        removed += 1;
      }
    }
  }

  return { sent, removed };
}

export async function checkAndSendDueAlerts(referenceDate: Date = new Date()): Promise<number> {
  const targetStart = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate() + 2,
      0,
      0,
      0,
      0
    )
  );
  const targetEnd = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate() + 2,
      23,
      59,
      59,
      999
    )
  );

  const dueEnvelopes = await EnvelopeModel.find({
    pillar: 'fixed_charge',
    isPaid: false,
    date: { $gte: targetStart, $lte: targetEnd },
  }).lean();

  if (dueEnvelopes.length === 0) return 0;

  let notified = 0;
  for (const envItem of dueEnvelopes) {
    const budget = await BudgetModel.findById(envItem.budgetId).select('members').lean();
    if (!budget?.members?.length) continue;

    for (const member of budget.members) {
      const user = await UserModel.findById(member.userId)
        .select('notificationPreferences')
        .lean();
      if (user?.notificationPreferences?.upcomingDueAlertEnabled === false) continue;

      const res = await sendPushToUser(String(member.userId), {
        title: 'Échéance dans 2 jours',
        body: `${envItem.name} (${envItem.allocatedAmount.toFixed(2)} €) arrive à échéance.`,
        url: '/?tab=depenses',
        tag: `due-${String(envItem._id)}`,
      });
      notified += res.sent;
    }
  }

  return notified;
}

export async function checkAndSendEnvelopeThresholdAlerts(): Promise<number> {
  const now = new Date();
  const activePeriods = await BudgetPeriodModel.find({
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .select('_id budgetId')
    .lean();

  if (activePeriods.length === 0) return 0;

  let notified = 0;
  for (const period of activePeriods) {
    const envelopes = await EnvelopeModel.find({
      budgetPeriodId: period._id,
      pillar: 'variable_envelope',
      allocatedAmount: { $gt: 0 },
    }).lean();

    const alertEnvelopes = envelopes.filter(
      (e) => e.spentOrPaidAmount / e.allocatedAmount >= 0.8
    );
    if (alertEnvelopes.length === 0) continue;

    const budget = await BudgetModel.findById(period.budgetId).select('members').lean();
    if (!budget?.members?.length) continue;

    for (const envItem of alertEnvelopes) {
      const ratio = Math.round((envItem.spentOrPaidAmount / envItem.allocatedAmount) * 100);
      for (const member of budget.members) {
        const user = await UserModel.findById(member.userId)
          .select('notificationPreferences')
          .lean();
        if (user?.notificationPreferences?.envelopeThresholdAlertEnabled === false) continue;

        const res = await sendPushToUser(String(member.userId), {
          title: ratio >= 100 ? 'Enveloppe dépassée' : 'Seuil d’enveloppe atteint',
          body: `${envItem.name} est utilisée à ${ratio} % (${envItem.spentOrPaidAmount.toFixed(2)} € / ${envItem.allocatedAmount.toFixed(2)} €).`,
          url: '/?tab=enveloppes',
          tag: `threshold-${String(envItem._id)}`,
        });
        notified += res.sent;
      }
    }
  }

  return notified;
}

export async function checkAndSendDailyReminders(currentHour: string): Promise<number> {
  const users = await UserModel.find({
    'notificationPreferences.dailyReminderEnabled': true,
    'notificationPreferences.dailyReminderHour': currentHour,
  })
    .select('_id')
    .lean();

  let notified = 0;
  for (const u of users) {
    const res = await sendPushToUser(String(u._id), {
      title: 'Rappel Eparnio',
      body: 'Pensez à saisir vos dépenses du jour en 5 secondes !',
      url: '/?tab=enveloppes',
      tag: 'daily-reminder',
    });
    notified += res.sent;
  }
  return notified;
}

export function startNotificationScheduler(): void {
  cron.schedule('0 * * * *', async () => {
    const now = new Date();
    const hourStr = `${String(now.getHours()).padStart(2, '0')}:00`;
    await checkAndSendDailyReminders(hourStr);
    if (now.getHours() === 9) {
      await checkAndSendDueAlerts(now);
      await checkAndSendEnvelopeThresholdAlerts();
    }
  });
}

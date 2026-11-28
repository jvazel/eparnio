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
    lastDueAlertSentAt: { $exists: false },
    date: { $gte: targetStart, $lte: targetEnd },
  }).lean();

  if (dueEnvelopes.length === 0) return 0;

  // Regrouper les charges dues à J-2 par budget pour envoyer une alerte synthétique
  const byBudget = new Map<string, typeof dueEnvelopes>();
  for (const envItem of dueEnvelopes) {
    const key = String(envItem.budgetId);
    const list = byBudget.get(key) ?? [];
    list.push(envItem);
    byBudget.set(key, list);
  }

  let notified = 0;
  const alertedIds: unknown[] = [];

  for (const [budgetId, items] of byBudget.entries()) {
    const budget = await BudgetModel.findById(budgetId).select('members').lean();
    if (!budget?.members?.length) continue;

    const totalAmount = items.reduce((sum, item) => sum + item.allocatedAmount, 0);
    const isGrouped = items.length > 1;
    const title = isGrouped
      ? `${items.length} prélèvements dans 2 jours`
      : 'Échéance dans 2 jours';
    const body = isGrouped
      ? `${items.map((i) => i.name).join(' + ')} (${totalAmount.toFixed(2)} €) arrivent à échéance.`
      : `${items[0].name} (${items[0].allocatedAmount.toFixed(2)} €) arrive à échéance.`;

    let budgetSent = 0;
    for (const member of budget.members) {
      const user = await UserModel.findById(member.userId)
        .select('notificationPreferences')
        .lean();
      if (user?.notificationPreferences?.upcomingDueAlertEnabled === false) continue;

      const res = await sendPushToUser(String(member.userId), {
        title,
        body,
        url: '/?tab=depenses',
        tag: isGrouped ? `due-group-${budgetId}` : `due-${String(items[0]._id)}`,
      });
      budgetSent += res.sent;
      notified += res.sent;
    }

    if (budgetSent > 0) {
      for (const item of items) {
        alertedIds.push(item._id);
      }
    }
  }

  if (alertedIds.length > 0) {
    await EnvelopeModel.updateMany(
      { _id: { $in: alertedIds } },
      { $set: { lastDueAlertSentAt: referenceDate } }
    );
  }

  return notified;
}

export async function checkAndSendEnvelopeThresholdAlerts(
  referenceDate: Date = new Date()
): Promise<number> {
  const activePeriods = await BudgetPeriodModel.find({
    startDate: { $lte: referenceDate },
    endDate: { $gte: referenceDate },
  })
    .select('_id budgetId endDate')
    .lean();

  if (activePeriods.length === 0) return 0;

  let notified = 0;
  for (const period of activePeriods) {
    const envelopes = await EnvelopeModel.find({
      budgetPeriodId: period._id,
      pillar: 'variable_envelope',
      allocatedAmount: { $gt: 0 },
    }).lean();

    if (envelopes.length === 0) continue;

    const budget = await BudgetModel.findById(period.budgetId).select('members').lean();
    if (!budget?.members?.length) continue;

    const msLeft = new Date(period.endDate).getTime() - referenceDate.getTime();
    const daysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

    for (const envItem of envelopes) {
      const available = envItem.allocatedAmount + (envItem.rolloverAmount ?? 0);
      if (available <= 0) continue;
      const ratio = Math.round((envItem.spentOrPaidAmount / available) * 100);
      const previousLevel = envItem.lastThresholdAlertLevel ?? 0;

      let sentLevel = 0;
      for (const member of budget.members) {
        const user = await UserModel.findById(member.userId)
          .select('notificationPreferences')
          .lean();
        if (user?.notificationPreferences?.envelopeThresholdAlertEnabled === false) continue;

        const userThreshold = user?.notificationPreferences?.envelopeThresholdPercent ?? 80;
        const targetLevel = ratio >= 100 ? 100 : ratio >= userThreshold ? userThreshold : 0;
        if (targetLevel === 0 || targetLevel <= previousLevel) continue;

        const daysLabel =
          daysRemaining > 1
            ? ` alors qu'il reste ${daysRemaining} jours`
            : daysRemaining === 1
              ? " alors qu'il reste 1 jour"
              : '';

        const res = await sendPushToUser(String(member.userId), {
          title: ratio >= 100 ? 'Enveloppe dépassée' : 'Seuil d’enveloppe atteint',
          body: `${envItem.name} est utilisée à ${ratio} % (${envItem.spentOrPaidAmount.toFixed(2)} € / ${available.toFixed(2)} €)${daysLabel}.`,
          url: '/?tab=enveloppes',
          tag: `threshold-${String(envItem._id)}-${targetLevel}`,
        });
        if (res.sent > 0) {
          notified += res.sent;
          sentLevel = Math.max(sentLevel, targetLevel);
        }
      }

      if (sentLevel > previousLevel) {
        await EnvelopeModel.updateOne(
          { _id: envItem._id },
          { $set: { lastThresholdAlertLevel: sentLevel } }
        );
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

export async function checkAndSendWeeklyDigestPush(
  referenceDate: Date = new Date()
): Promise<number> {
  const dayOfWeek = referenceDate.getDay();
  const hourStr = `${String(referenceDate.getHours()).padStart(2, '0')}:00`;

  const users = await UserModel.find({
    'notificationPreferences.weeklyDigestEnabled': true,
    'notificationPreferences.weeklyDigestDay': dayOfWeek,
    'notificationPreferences.weeklyDigestHour': hourStr,
  })
    .select('_id')
    .lean();

  let notified = 0;
  for (const u of users) {
    const res = await sendPushToUser(String(u._id), {
      title: 'Point du dimanche — Eparnio',
      body: 'Prenez 30 secondes pour consulter votre cap de la semaine et vos prochaines échéances.',
      url: '/?tab=budget',
      tag: 'weekly-digest',
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
    await checkAndSendWeeklyDigestPush(now);
    if (now.getHours() === 9) {
      await checkAndSendDueAlerts(now);
      await checkAndSendEnvelopeThresholdAlerts(now);
    }
  });
}

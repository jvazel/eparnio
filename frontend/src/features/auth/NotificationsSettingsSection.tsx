import { Bell, Send } from 'lucide-react';
import { useState } from 'react';
import {
  getNotificationPermission,
  sendTestPushNotification,
  subscribeToPushNotifications,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '../../services/notification.service';

interface NotificationsSettingsSectionProps {
  initialPreferences?: NotificationPreferences;
}

const DEFAULT_PREFS: NotificationPreferences = {
  dailyReminderEnabled: false,
  dailyReminderHour: '20:00',
  upcomingDueAlertEnabled: true,
  envelopeThresholdAlertEnabled: true,
};

export function NotificationsSettingsSection({
  initialPreferences,
}: NotificationsSettingsSectionProps) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(
    initialPreferences ?? DEFAULT_PREFS
  );
  const [permission, setPermission] = useState(() => getNotificationPermission());
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const handleToggle = async (
    key: 'dailyReminderEnabled' | 'upcomingDueAlertEnabled' | 'envelopeThresholdAlertEnabled',
    nextVal: boolean
  ) => {
    setStatusMsg(null);
    if (nextVal && permission !== 'granted') {
      const ok = await subscribeToPushNotifications();
      setPermission(getNotificationPermission());
      if (!ok) {
        setStatusMsg('Permission notifications refusée ou non supportée.');
      }
    }

    const nextPrefs = { ...prefs, [key]: nextVal };
    setPrefs(nextPrefs);
    try {
      await updateNotificationPreferences({ [key]: nextVal });
    } catch {
      setStatusMsg('Impossible de sauvegarder vos préférences.');
    }
  };

  const handleHourChange = async (hour: string) => {
    setPrefs((prev) => ({ ...prev, dailyReminderHour: hour }));
    try {
      await updateNotificationPreferences({ dailyReminderHour: hour });
    } catch {
      setStatusMsg('Impossible de sauvegarder l’heure.');
    }
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    setStatusMsg(null);
    try {
      const subscribed = await subscribeToPushNotifications();
      setPermission(getNotificationPermission());
      if (!subscribed) {
        setStatusMsg(
          'Impossible d’abonner ce navigateur (vérifiez que le Service Worker PWA est actif).'
        );
        return;
      }
      const res = await sendTestPushNotification();
      setStatusMsg(
        res.sent > 0
          ? 'Notification test envoyée !'
          : 'Aucun appareil abonné (ou VAPID non configuré).'
      );
    } catch {
      setStatusMsg('Erreur lors de l’envoi de la notification test.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const permissionLabel =
    permission === 'granted'
      ? 'Accordée'
      : permission === 'denied'
        ? 'Refusée'
        : permission === 'unsupported'
          ? 'Non supportée'
          : 'À autoriser';

  return (
    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Notifications &amp; Rappels Push
          </span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            permission === 'granted'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
              : permission === 'denied'
                ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
          }`}
        >
          {permissionLabel}
        </span>
      </div>

      {/* 1. Rappel quotidien */}
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="toggle-daily-reminder"
          className="text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          Rappel quotidien de saisie
        </label>
        <div className="flex items-center gap-2">
          {prefs.dailyReminderEnabled && (
            <input
              type="time"
              aria-label="Heure du rappel quotidien"
              value={prefs.dailyReminderHour}
              onChange={(e) => void handleHourChange(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-2 py-1"
            />
          )}
          <input
            id="toggle-daily-reminder"
            type="checkbox"
            checked={prefs.dailyReminderEnabled}
            onChange={(e) => void handleToggle('dailyReminderEnabled', e.target.checked)}
            className="w-4 h-4 accent-violet-600"
          />
        </div>
      </div>

      {/* 2. Alerte échéances J-2 */}
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="toggle-due-alert"
          className="text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          Alerte échéances fixes à J-2
        </label>
        <input
          id="toggle-due-alert"
          type="checkbox"
          checked={prefs.upcomingDueAlertEnabled}
          onChange={(e) => void handleToggle('upcomingDueAlertEnabled', e.target.checked)}
          className="w-4 h-4 accent-violet-600"
        />
      </div>

      {/* 3. Alerte seuil d'enveloppe */}
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="toggle-threshold-alert"
          className="text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          Alerte seuil d’enveloppe (≥ 80 %)
        </label>
        <input
          id="toggle-threshold-alert"
          type="checkbox"
          checked={prefs.envelopeThresholdAlertEnabled}
          onChange={(e) =>
            void handleToggle('envelopeThresholdAlertEnabled', e.target.checked)
          }
          className="w-4 h-4 accent-violet-600"
        />
      </div>

      <button
        type="button"
        disabled={isSendingTest}
        onClick={() => void handleSendTest()}
        className="w-full py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-violet-600 dark:text-violet-400 flex items-center justify-center gap-1.5"
      >
        <Send className="w-3.5 h-3.5" />
        {isSendingTest ? 'Envoi...' : 'Envoyer une notification test'}
      </button>

      {statusMsg && (
        <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
          {statusMsg}
        </p>
      )}
    </div>
  );
}

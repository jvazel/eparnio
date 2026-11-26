import { apiClient } from './api';

export interface NotificationPreferences {
  dailyReminderEnabled: boolean;
  dailyReminderHour: string;
  upcomingDueAlertEnabled: boolean;
  envelopeThresholdAlertEnabled: boolean;
  sharedActivityAlertEnabled?: boolean;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPushNotifications(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const { data } = await apiClient.get<{
    status: string;
    publicKey: string | null;
    configured: boolean;
  }>('/notifications/vapid-public-key');

  if (!data.configured || !data.publicKey) {
    return false;
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return false;
  }

  await apiClient.post('/notifications/subscribe', {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    userAgent: navigator.userAgent,
  });

  return true;
}

export async function updateNotificationPreferences(
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const { data } = await apiClient.patch<{
    status: string;
    notificationPreferences: NotificationPreferences;
  }>('/notifications/preferences', prefs);
  return data.notificationPreferences;
}

export async function sendTestPushNotification(): Promise<{ sent: number }> {
  const { data } = await apiClient.post<{ status: string; sent: number }>(
    '/notifications/test'
  );
  return { sent: data.sent };
}

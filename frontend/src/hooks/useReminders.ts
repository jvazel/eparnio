import { useCallback, useState } from 'react';

export type ReminderFrequency = 'daily' | 'weekly';

export interface ReminderSettings {
  enabled: boolean;
  frequency: ReminderFrequency;
}

const REMINDERS_STORAGE_KEY = 'eparnio-reminders';

function loadReminderSettings(): ReminderSettings {
  if (typeof window === 'undefined') {
    return { enabled: false, frequency: 'daily' };
  }
  try {
    const raw = window.localStorage.getItem(REMINDERS_STORAGE_KEY);
    if (!raw) {
      return { enabled: false, frequency: 'daily' };
    }
    const parsed = JSON.parse(raw) as Partial<ReminderSettings>;
    return {
      enabled: Boolean(parsed.enabled),
      frequency: parsed.frequency === 'weekly' ? 'weekly' : 'daily'
    };
  } catch {
    return { enabled: false, frequency: 'daily' };
  }
}

/**
 * Hook gérant les préférences de rappels locaux PWA (API Notification + localStorage).
 */
export function useReminders() {
  const [settings, setSettings] = useState<ReminderSettings>(() => loadReminderSettings());
  const isSupported = typeof window !== 'undefined' && 'Notification' in window;

  const saveSettings = useCallback((next: ReminderSettings) => {
    setSettings(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const enableReminders = useCallback(
    async (frequency: ReminderFrequency = settings.frequency): Promise<boolean> => {
      if (!isSupported) {
        return false;
      }
      let permission = window.Notification.permission;
      if (permission === 'default') {
        permission = await window.Notification.requestPermission();
      }
      if (permission !== 'granted') {
        return false;
      }
      saveSettings({ enabled: true, frequency });
      return true;
    },
    [isSupported, saveSettings, settings.frequency]
  );

  const disableReminders = useCallback(() => {
    saveSettings({ enabled: false, frequency: settings.frequency });
  }, [saveSettings, settings.frequency]);

  const setFrequency = useCallback(
    (frequency: ReminderFrequency) => {
      saveSettings({ enabled: settings.enabled, frequency });
    },
    [saveSettings, settings.enabled]
  );

  return {
    isSupported,
    enabled: settings.enabled,
    frequency: settings.frequency,
    enableReminders,
    disableReminders,
    setFrequency
  };
}

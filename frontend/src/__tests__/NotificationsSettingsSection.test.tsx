import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsSettingsSection } from '../features/auth/NotificationsSettingsSection';
import * as notificationService from '../services/notification.service';

describe('NotificationsSettingsSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('affiche les 3 interrupteurs et synchronise les préférences', async () => {
    vi.spyOn(notificationService, 'getNotificationPermission').mockReturnValue('granted');
    const updateSpy = vi
      .spyOn(notificationService, 'updateNotificationPreferences')
      .mockResolvedValue({
        dailyReminderEnabled: true,
        dailyReminderHour: '20:00',
        upcomingDueAlertEnabled: true,
        envelopeThresholdAlertEnabled: true,
      });

    render(<NotificationsSettingsSection />);

    expect(screen.getByText('Accordée')).toBeInTheDocument();

    const dailyToggle = screen.getByLabelText('Rappel quotidien de saisie');
    fireEvent.click(dailyToggle);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({ dailyReminderEnabled: true });
    });

    expect(screen.getByLabelText('Heure du rappel quotidien')).toBeInTheDocument();
  });

  it('gère le refus de permission et le bouton de notification test', async () => {
    vi.spyOn(notificationService, 'getNotificationPermission').mockReturnValue('denied');
    vi.spyOn(notificationService, 'subscribeToPushNotifications').mockResolvedValue(false);
    const testSpy = vi
      .spyOn(notificationService, 'sendTestPushNotification')
      .mockResolvedValue({ sent: 1 });

    render(<NotificationsSettingsSection />);
    expect(screen.getByText('Refusée')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Envoyer une notification test'));
    await waitFor(() => {
      expect(testSpy).toHaveBeenCalled();
    });
    expect(await screen.findByText('Notification test envoyée !')).toBeInTheDocument();
  });
});

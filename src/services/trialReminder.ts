import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_ID = 'trial-ending-tomorrow';
const REMINDER_SECONDS = 48 * 60 * 60;

export async function scheduleTrialReminder(): Promise<void> {
  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('trial', {
        name: 'Trial reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => undefined);
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: {
        title: 'Tax Receipts: Trial Ending Tomorrow',
        body: 'Your free trial expires in 24 hours. Your receipts and vault remain completely safe.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: REMINDER_SECONDS,
        repeats: false,
        ...(Platform.OS === 'android' ? { channelId: 'trial' } : {}),
      },
    });
  } catch {
    // A denied permission or a scheduling failure must not block the purchase.
  }
}

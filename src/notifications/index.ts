import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Permission, ReminderBackend } from './types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

function permissionValue(status: Notifications.NotificationPermissionsStatus): Permission {
  return status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    ? 'granted' : status.canAskAgain ? 'default' : 'denied';
}

export function createReminderBackend(_db: SQLiteDatabase, _onError: (message: string) => void): ReminderBackend {
  async function ensureChannel() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('task-reminders', { name: 'Task reminders', importance: Notifications.AndroidImportance.HIGH, sound: 'default' });
    }
  }
  return {
    permission: async () => permissionValue(await Notifications.getPermissionsAsync()),
    requestPermission: async () => {
      await ensureChannel();
      return permissionValue(await Notifications.requestPermissionsAsync());
    },
    scheduled: async () => (await Notifications.getAllScheduledNotificationsAsync()).map((item) => ({ id: item.identifier, fingerprint: String(item.content.data?.fingerprint ?? '') })),
    cancel: async (id) => { await Notifications.cancelScheduledNotificationAsync(id); },
    schedule: async ({ id, task, at, fingerprint }) => {
      await ensureChannel();
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: { title: task.title, body: `${task.start_time}–${task.end_time} · ${task.reminder_offset_minutes ? `Starts in ${task.reminder_offset_minutes} minutes` : 'Starting now'}`, sound: 'default', data: { taskId: task.id, fingerprint } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId: 'task-reminders' },
      });
    },
  };
}

import type { SQLiteDatabase } from 'expo-sqlite';
import { getPreference, setPreference } from '../storage/preferences';
import { reminderFingerprint, type Task } from '../tasks/model';
import type { Permission, Reminder, ReminderBackend } from './types';

export function createReminderBackend(db: SQLiteDatabase, onError: (message: string) => void): ReminderBackend {
  const scheduled = new Map<string, { reminder: Reminder; timer: ReturnType<typeof setTimeout> }>();
  let disposed = false;
  let worker: Promise<ServiceWorkerRegistration> | undefined;
  function prepareWorker() {
    if ('serviceWorker' in navigator) {
      worker ??= navigator.serviceWorker.register('/notification-worker.js');
      // Desktop notifications can still work if worker registration is unavailable.
      void worker.catch(() => {});
    }
  }
  const supported = () => typeof Notification !== 'undefined';
  const permission = async (): Promise<Permission> => supported() ? Notification.permission : 'unavailable';
  return {
    permission,
    dispose: () => { disposed = true; for (const item of scheduled.values()) clearTimeout(item.timer); scheduled.clear(); },
    requestPermission: async () => {
      if (!supported()) return 'unavailable';
      const result = Notification.requestPermission();
      prepareWorker();
      return result;
    },
    scheduled: async () => [...scheduled.values()].map(({ reminder }) => reminder),
    cancel: async (id) => { const item = scheduled.get(id); if (item) clearTimeout(item.timer); scheduled.delete(id); },
    schedule: async (reminder) => {
      if (disposed) return;
      prepareWorker();
      const key = `reminder-delivered:${reminder.task.id}`;
      if (await getPreference(db, key) === reminder.fingerprint) return;
      if (disposed) return;
      const existing = scheduled.get(reminder.id);
      if (existing) clearTimeout(existing.timer);
      const tick = async () => {
        if (disposed) return;
        const remaining = reminder.at - Date.now();
        if (remaining > 0) {
          scheduled.set(reminder.id, { reminder, timer: setTimeout(() => { void tick(); }, Math.min(remaining, 2147483647)) });
          return;
        }
        scheduled.delete(reminder.id);
        try {
          if (!supported() || Notification.permission !== 'granted' || Date.now() - reminder.at > 60000) return;
          const current = await db.getFirstAsync<Task>('SELECT * FROM tasks WHERE id = ?', reminder.task.id);
          if (!current || current.is_completed || reminderFingerprint(current) !== reminder.fingerprint) return;
          if (await getPreference(db, key) === reminder.fingerprint) return;
          if (disposed) return;
          const options = { body: `${reminder.task.start_time}–${reminder.task.end_time}`, tag: reminder.id };
          try {
            const notification = new Notification(reminder.task.title, options);
            notification.onclick = () => { window.focus(); notification.close(); };
          } catch {
            if (!worker) throw new Error('Browser notification display is unavailable.');
            const registration = await worker;
            if (!registration.active) await navigator.serviceWorker.ready;
            await registration.showNotification(reminder.task.title, options);
          }
          await setPreference(db, key, reminder.fingerprint);
        } catch { onError('A reminder could not be shown. Check your browser notification settings.'); }
      };
      await tick();
    },
  };
}

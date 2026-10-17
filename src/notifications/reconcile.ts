import { reminderFingerprint, reminderTime, type Task } from '../tasks/model.ts';
import type { ReminderBackend } from './types';

export const REMINDER_PREFIX = 'dailyplanner:';

export async function reconcileReminders(backend: ReminderBackend, tasks: Task[], now = Date.now()): Promise<void> {
  const granted = await backend.permission() === 'granted';
  const desired = new Map(tasks
    .filter((task) => granted && !task.is_completed && reminderTime(task) > now)
    .map((task) => [REMINDER_PREFIX + task.id, { id: REMINDER_PREFIX + task.id, task, at: reminderTime(task), fingerprint: reminderFingerprint(task) }]));
  const existing = await backend.scheduled();
  for (const scheduled of existing) {
    if (!scheduled.id.startsWith(REMINDER_PREFIX)) continue;
    const next = desired.get(scheduled.id);
    if (!next || scheduled.fingerprint !== next.fingerprint) await backend.cancel(scheduled.id);
    else desired.delete(scheduled.id);
  }
  for (const reminder of desired.values()) await backend.schedule(reminder);
}

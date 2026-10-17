import type { Task } from '../tasks/model';

export type Permission = 'granted' | 'denied' | 'default' | 'unavailable';
export type ScheduledReminder = { id: string; fingerprint: string };
export type Reminder = ScheduledReminder & { at: number; task: Task };
export interface ReminderBackend {
  permission(): Promise<Permission>;
  requestPermission(): Promise<Permission>;
  scheduled(): Promise<ScheduledReminder[]>;
  schedule(reminder: Reminder): Promise<void>;
  cancel(id: string): Promise<void>;
  dispose?(): void;
}

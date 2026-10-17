import type { SQLiteDatabase } from 'expo-sqlite';
import { shiftDate, validateTask, type Task, type TaskDraft } from '../tasks/model.ts';

type TaskDatabase = Pick<SQLiteDatabase, 'getAllAsync' | 'getFirstAsync' | 'runAsync'>;

export function listTasks(db: TaskDatabase, date: string): Promise<Task[]> {
  return db.getAllAsync<Task>(
    "SELECT * FROM tasks WHERE date = ? OR (date = ? AND end_time < start_time AND end_time > '00:00') ORDER BY CASE WHEN date = ? THEN start_time ELSE '00:00' END, end_time, id",
    date, shiftDate(date, -1), date,
  );
}

export function listReminderTasks(db: TaskDatabase): Promise<Task[]> {
  return db.getAllAsync<Task>('SELECT * FROM tasks WHERE is_completed = 0 ORDER BY date, start_time, id');
}

export async function saveTask(db: TaskDatabase, draft: TaskDraft, id?: string): Promise<Task> {
  const error = validateTask(draft);
  if (error) throw new Error(error);
  const values = [draft.title.trim(), draft.priority, draft.date, draft.start_time, draft.end_time, draft.is_completed, draft.reminder_offset_minutes];
  if (id) {
    const result = await db.runAsync(
      'UPDATE tasks SET title = ?, priority = ?, date = ?, start_time = ?, end_time = ?, is_completed = ?, reminder_offset_minutes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ...values, id,
    );
    if (!result.changes) throw new Error('This task no longer exists. Please refresh your day.');
  } else {
    const row = await db.getFirstAsync<{ id: string }>('SELECT lower(hex(randomblob(16))) AS id');
    if (!row) throw new Error('A task ID could not be created.');
    id = row.id;
    await db.runAsync(
      'INSERT INTO tasks (title, priority, date, start_time, end_time, is_completed, reminder_offset_minutes, id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ...values, id,
    );
  }
  const task = await db.getFirstAsync<Task>('SELECT * FROM tasks WHERE id = ?', id);
  if (!task) throw new Error('Your task could not be loaded after saving.');
  return task;
}

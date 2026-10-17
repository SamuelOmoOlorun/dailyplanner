import type { SQLiteDatabase } from 'expo-sqlite';
import { dateKey } from '../tasks/model.ts';
import { pendingReview } from '../tasks/review.ts';
import { getPreference, setPreference } from './preferences.ts';
import { listReminderTasks } from './tasks.ts';

type ReviewDatabase = Pick<SQLiteDatabase, 'getAllAsync' | 'getFirstAsync' | 'runAsync'>;

export async function checkRollover(db: ReviewDatabase, now = new Date()): Promise<boolean> {
  const today = dateKey(now);
  if (await getPreference(db, 'last_opened_date') === today) return false;
  const pending = pendingReview(await listReminderTasks(db), 'rollover', now);
  // Leave the date unacknowledged until the review is resolved or explicitly deferred.
  if (pending.length) return true;
  await setPreference(db, 'last_opened_date', today);
  return false;
}

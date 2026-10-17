import type { SQLiteDatabase } from 'expo-sqlite';

type PreferenceDatabase = Pick<SQLiteDatabase, 'getFirstAsync' | 'runAsync'>;

export async function getPreference(db: PreferenceDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_preferences WHERE key = ?', key,
  );
  return row?.value ?? null;
}

export async function setPreference(db: PreferenceDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO app_preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key, value,
  );
}

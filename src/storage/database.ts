import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'dailyplanner.db';
export const DATABASE_VERSION = 1;

// The initial schema follows PRD section 5. Task behavior belongs to phase 2.
export const INITIAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  priority TEXT CHECK(priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  reminder_offset_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_preferences (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

type MigrationDatabase = Pick<SQLiteDatabase, 'execAsync' | 'getFirstAsync' | 'withTransactionAsync'>;

export async function initializeDatabase(db: MigrationDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = result?.user_version ?? 0;
  if (version > DATABASE_VERSION) {
    throw new Error('This database needs a newer version of Daily Planner.');
  }
  if (version < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(INITIAL_SCHEMA);
      await db.execAsync('PRAGMA user_version = 1');
    });
  }
}

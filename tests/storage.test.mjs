import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { initializeDatabase } from '../src/storage/database.ts';
import { getPreference, setPreference } from '../src/storage/preferences.ts';

function connection(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  const adapter = {
    execAsync: async (sql) => { sqlite.exec(sql); },
    getFirstAsync: async (sql, ...params) => sqlite.prepare(sql).get(...params),
    runAsync: async (sql, ...params) => sqlite.prepare(sql).run(...params),
    withTransactionAsync: async (task) => {
      sqlite.exec('BEGIN');
      try { await task(); sqlite.exec('COMMIT'); }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return { sqlite, adapter };
}

test('initial migration creates the PRD tables, defaults, and constraints', async (t) => {
  const { sqlite, adapter } = connection(t);
  await initializeDatabase(adapter);
  assert.equal(sqlite.prepare('PRAGMA user_version').get().user_version, 1);
  assert.deepEqual(sqlite.prepare('PRAGMA table_info(tasks)').all().map((row) => row.name), [
    'id', 'title', 'priority', 'date', 'start_time', 'end_time', 'is_completed',
    'reminder_offset_minutes', 'created_at', 'updated_at',
  ]);
  sqlite.exec("INSERT INTO tasks (id, title, date, start_time, end_time) VALUES ('1', 'Test', '2026-10-17', '09:05', '09:40')");
  const row = sqlite.prepare('SELECT * FROM tasks').get();
  assert.equal(row.priority, 'medium');
  assert.equal(row.is_completed, 0);
  assert.equal(row.reminder_offset_minutes, 0);
  assert.throws(() => sqlite.exec("UPDATE tasks SET priority = 'urgent'"), /CHECK/);
  assert.throws(() => sqlite.exec("UPDATE tasks SET start_time = NULL"), /NOT NULL/);
});

test('reopening migration preserves existing preferences and tasks', async (t) => {
  const { sqlite, adapter } = connection(t);
  await initializeDatabase(adapter);
  await setPreference(adapter, 'theme', 'dark');
  sqlite.exec("INSERT INTO tasks (id, title, date, start_time, end_time) VALUES ('1', 'Keep me', '2026-10-17', '09:05', '09:40')");
  await initializeDatabase(adapter);
  assert.equal(await getPreference(adapter, 'theme'), 'dark');
  assert.equal(sqlite.prepare('SELECT title FROM tasks').get().title, 'Keep me');
});

test('preference upsert handles missing values and parameterized text', async (t) => {
  const { sqlite, adapter } = connection(t);
  await initializeDatabase(adapter);
  assert.equal(await getPreference(adapter, 'missing'), null);
  await setPreference(adapter, 'theme', 'light');
  await setPreference(adapter, 'theme', 'dark');
  assert.equal(await getPreference(adapter, 'theme'), 'dark');
  await setPreference(adapter, "quote'key", "value'); DROP TABLE tasks; --");
  assert.equal(await getPreference(adapter, "quote'key"), "value'); DROP TABLE tasks; --");
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM app_preferences').get().count, 2);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM tasks').get().count, 0);
});

test('failed migration rolls back its schema and version', async (t) => {
  const { sqlite, adapter } = connection(t);
  const original = adapter.execAsync;
  adapter.execAsync = async (sql) => {
    if (sql.includes('PRAGMA user_version = 1')) throw new Error('Simulated write failure');
    await original(sql);
  };
  await assert.rejects(initializeDatabase(adapter), /Simulated write failure/);
  assert.equal(sqlite.prepare('PRAGMA user_version').get().user_version, 0);
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'table'").get().count, 0);
});

test('newer databases are rejected without modification', async (t) => {
  const { sqlite, adapter } = connection(t);
  sqlite.exec('PRAGMA user_version = 2');
  await assert.rejects(initializeDatabase(adapter), /newer version/);
  assert.equal(sqlite.prepare('PRAGMA user_version').get().user_version, 2);
});

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { initializeDatabase } from '../src/storage/database.ts';
import { deleteTask, listTasks, listReminderTasks, saveTask } from '../src/storage/tasks.ts';
import { checkRollover } from '../src/storage/review.ts';
import { getPreference, setPreference } from '../src/storage/preferences.ts';
import { pendingReview } from '../src/tasks/review.ts';
import { daySegment, endDate, layoutTasks, overlaps, reminderTime, validateTask } from '../src/tasks/model.ts';
import { reconcileReminders } from '../src/notifications/reconcile.ts';

const draft = { title: 'Focus', date: '2026-10-17', start_time: '09:05', end_time: '09:40', priority: 'medium', is_completed: 0, reminder_offset_minutes: 5 };
const task = (id, changes = {}) => ({ ...draft, id, created_at: '', updated_at: '', ...changes });

test('rollover checks first launch, same-day acknowledgement, new day, and multiple missed days', async (t) => {
  const db = await database(t);
  const morning = new Date('2026-10-17T08:00:00');
  assert.equal(await checkRollover(db, morning), false);
  assert.equal(await getPreference(db, 'last_opened_date'), '2026-10-17');
  await saveTask(db, { ...draft, date: '2026-10-14' });
  assert.equal(await checkRollover(db, morning), false);
  assert.equal(await checkRollover(db, new Date('2026-10-18T08:00:00')), true);
  assert.equal(await getPreference(db, 'last_opened_date'), '2026-10-17');
  await setPreference(db, 'last_opened_date', '2026-10-18');
  assert.equal(await checkRollover(db, new Date('2026-10-18T08:00:00')), false);
});

test('review excludes completed/future tasks and protects ongoing overnight blocks', () => {
  const rows = [task('old', { date: '2026-10-15' }), task('done', { date: '2026-10-15', is_completed: 1 }),
    task('night', { date: '2026-10-16', start_time: '23:00', end_time: '01:00' }), task('today'), task('future', { date: '2026-10-18' })];
  assert.deepEqual(pendingReview(rows, 'rollover', new Date('2026-10-17T00:30:00')).map(t => t.id), ['old']);
  assert.deepEqual(pendingReview(rows, 'rollover', new Date('2026-10-17T01:00:00')).map(t => t.id), ['old', 'night']);
  assert.deepEqual(pendingReview(rows, 'manual', new Date('2026-10-17T18:00:00')).map(t => t.id), ['old', 'night', 'today']);
});

test('migration preserves identity and metadata; discard deletes both overnight segments and cancels reminders', async (t) => {
  const db = await database(t);
  const saved = await saveTask(db, { ...draft, date: '2026-10-16', start_time: '23:00', end_time: '01:00', priority: 'high' });
  const moved = await saveTask(db, { ...saved, date: '2026-10-17', start_time: '23:05' }, saved.id);
  assert.equal(moved.id, saved.id);
  assert.equal(moved.created_at, saved.created_at);
  assert.equal(moved.priority, 'high');
  assert.equal(moved.reminder_offset_minutes, 5);
  const mock = backend();
  await reconcileReminders(mock, await listReminderTasks(db), new Date('2026-10-17T08:00:00').getTime());
  assert.equal(mock.entries.size, 1);
  await deleteTask(db, saved.id);
  for (const date of ['2026-10-16', '2026-10-17', '2026-10-18']) assert.equal((await listTasks(db, date)).length, 0);
  await reconcileReminders(mock, await listReminderTasks(db));
  assert.equal(mock.entries.size, 0);
  await assert.rejects(deleteTask(db, saved.id), /no longer exists/);
});

test('rollover read failure does not acknowledge the date and can be retried', async (t) => {
  const db = await database(t);
  await assert.rejects(checkRollover({ ...db, getAllAsync: async () => { throw new Error('read failed'); } }), /read failed/);
  assert.equal(await getPreference(db, 'last_opened_date'), null);
  assert.equal(await checkRollover(db), false);
});

async function database(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  const db = {
    execAsync: async (sql) => { sqlite.exec(sql); },
    getFirstAsync: async (sql, ...params) => sqlite.prepare(sql).get(...params),
    getAllAsync: async (sql, ...params) => sqlite.prepare(sql).all(...params),
    runAsync: async (sql, ...params) => sqlite.prepare(sql).run(...params),
    withTransactionAsync: async (operation) => { sqlite.exec('BEGIN'); try { await operation(); sqlite.exec('COMMIT'); } catch (error) { sqlite.exec('ROLLBACK'); throw error; } },
  };
  await initializeDatabase(db);
  return db;
}

test('minute-precise tasks persist all metadata, edit in place, and complete', async (t) => {
  const db = await database(t);
  const saved = await saveTask(db, { ...draft, title: "  Focus 'today'  ", priority: 'high', reminder_offset_minutes: 15 });
  assert.equal(saved.title, "Focus 'today'");
  assert.equal(saved.start_time, '09:05');
  assert.equal(saved.end_time, '09:40');
  assert.equal(saved.priority, 'high');
  assert.equal(saved.reminder_offset_minutes, 15);
  await saveTask(db, { ...saved, end_time: '09:43', is_completed: 1 }, saved.id);
  const rows = await listTasks(db, draft.date);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, saved.id);
  assert.equal(rows[0].end_time, '09:43');
  assert.equal(rows[0].is_completed, 1);
  assert.equal((await listReminderTasks(db)).length, 0);
});

test('tasks remain separated by date and sorted by precise start time', async (t) => {
  const db = await database(t);
  await saveTask(db, { ...draft, start_time: '14:01', end_time: '14:02' });
  await saveTask(db, draft);
  await saveTask(db, { ...draft, date: '2026-10-18' });
  assert.deepEqual((await listTasks(db, draft.date)).map((item) => item.start_time), ['09:05', '14:01']);
  assert.equal((await listTasks(db, '2026-10-18')).length, 1);
});

test('invalid or missing time slots and metadata cannot be persisted', async (t) => {
  const db = await database(t);
  for (const change of [
    { title: ' ' }, { start_time: '' }, { end_time: '' }, { start_time: '24:00' }, { end_time: '09:05' },
    { start_time: '9:05' }, { date: '2026-02-30' }, { date: '2026-13-01' },
    { priority: 'urgent' }, { is_completed: 2 }, { reminder_offset_minutes: -5 },
  ]) await assert.rejects(saveTask(db, { ...draft, ...change }));
  assert.equal((await listTasks(db, draft.date)).length, 0);
  assert.equal(validateTask({ ...draft, start_time: '00:00', end_time: '23:59' }), null);
});

test('editing a missing task fails without inserting it', async (t) => {
  const db = await database(t);
  await assert.rejects(saveTask(db, draft, 'missing'), /no longer exists/);
  assert.equal((await listTasks(db, draft.date)).length, 0);
});

test('overlaps include containment and completed tasks, but exclude boundaries, other days, and self', () => {
  const tasks = [task('self'), task('inside', { start_time: '09:10', end_time: '09:20', is_completed: 1 }),
    task('before', { start_time: '08:00', end_time: '09:05' }), task('after', { start_time: '09:40', end_time: '10:00' }),
    task('other-day', { date: '2026-10-18' })];
  assert.deepEqual(overlaps(draft, tasks, 'self').map((row) => row.id), ['inside']);
});

test('timeline assigns columns to connected overlap groups and preserves minute geometry', () => {
  const result = layoutTasks([task('b', { start_time: '09:20', end_time: '10:00' }), task('a'), task('c', { start_time: '10:00', end_time: '10:01' })]);
  assert.deepEqual(result.map(({ task, column, columns }) => [task.id, column, columns]), [['a', 0, 2], ['b', 1, 2], ['c', 0, 1]]);
});

function backend(permission = 'granted') {
  const entries = new Map();
  const events = [];
  return {
    entries, events,
    permission: async () => permission,
    scheduled: async () => [...entries.values()],
    cancel: async (id) => { events.push(['cancel', id]); entries.delete(id); },
    schedule: async (item) => { events.push(['schedule', item.id]); entries.set(item.id, item); },
  };
}

test('reminders schedule once, reschedule edits, and cancel on completion', async () => {
  const mock = backend();
  const now = new Date('2026-10-17T08:00:00').getTime();
  await reconcileReminders(mock, [task('1')], now);
  assert.equal(mock.entries.get('dailyplanner:1').at, new Date('2026-10-17T09:00:00').getTime());
  await reconcileReminders(mock, [task('1')], now);
  assert.equal(mock.events.length, 1);
  await reconcileReminders(mock, [task('1', { start_time: '09:07', title: 'Renamed' })], now);
  assert.deepEqual(mock.events.slice(1), [['cancel', 'dailyplanner:1'], ['schedule', 'dailyplanner:1']]);
  await reconcileReminders(mock, [task('1', { is_completed: 1 })], now);
  assert.equal(mock.entries.size, 0);
});

test('reminders skip elapsed triggers, restore future days, and honor permission denial', async () => {
  const mock = backend();
  const now = new Date('2026-10-17T09:00:00').getTime();
  await reconcileReminders(mock, [task('elapsed'), task('tomorrow', { date: '2026-10-18' })], now);
  assert.deepEqual([...mock.entries.keys()], ['dailyplanner:tomorrow']);
  const denied = backend('denied');
  denied.entries.set('dailyplanner:old', { id: 'dailyplanner:old', fingerprint: '' });
  denied.entries.set('external', { id: 'external', fingerprint: '' });
  await reconcileReminders(denied, [task('new')], now);
  assert.deepEqual([...denied.entries.keys()], ['external']);
});

test('zero means at start; lead time can cross a calendar date boundary', () => {
  assert.equal(reminderTime({ ...draft, reminder_offset_minutes: 0 }), new Date('2026-10-17T09:05:00').getTime());
  assert.equal(reminderTime({ ...draft, start_time: '00:05', reminder_offset_minutes: 15 }), new Date('2026-10-16T23:50:00').getTime());
});

test('failed notification scheduling is surfaced for retry', async () => {
  const mock = backend();
  mock.schedule = async () => { throw new Error('OS refused'); };
  await assert.rejects(reconcileReminders(mock, [task('1')], new Date('2026-10-17T08:00:00').getTime()), /OS refused/);
});

test('overnight tasks appear on both dates as one record and share edits/completion', async (t) => {
  const db = await database(t);
  const saved = await saveTask(db, { ...draft, date: '2026-12-31', start_time: '23:05', end_time: '01:40' });
  assert.equal(endDate(saved), '2027-01-01');
  assert.equal((await listTasks(db, '2026-12-31'))[0].id, saved.id);
  assert.equal((await listTasks(db, '2027-01-01'))[0].id, saved.id);
  assert.deepEqual(daySegment(saved, '2026-12-31'), { start: 1385, end: 1440 });
  assert.deepEqual(daySegment(saved, '2027-01-01'), { start: 0, end: 100 });
  assert.equal((await listTasks(db, '2027-01-02')).length, 0);
  assert.equal((await listReminderTasks(db)).length, 1);
  await saveTask(db, { ...saved, title: 'Finished overnight', is_completed: 1 }, saved.id);
  for (const date of ['2026-12-31', '2027-01-01']) {
    const rows = await listTasks(db, date);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, 'Finished overnight');
    assert.equal(rows[0].is_completed, 1);
  }
});

test('overnight collisions are detected on both dates; midnight boundaries do not overlap', () => {
  const night = task('night', { start_time: '23:05', end_time: '01:40' });
  const nextMorning = task('morning', { date: '2026-10-18', start_time: '01:00', end_time: '02:00' });
  assert.deepEqual(overlaps(night, [nextMorning]).map((row) => row.id), ['morning']);
  assert.deepEqual(overlaps(nextMorning, [night]).map((row) => row.id), ['night']);
  const endBoundary = task('boundary', { date: '2026-10-18', start_time: '01:40', end_time: '02:00' });
  assert.equal(overlaps(night, [endBoundary]).length, 0);
  const layout = layoutTasks([night, nextMorning], '2026-10-18');
  assert.deepEqual(layout.map(({ task, start, end, columns }) => [task.id, start, end, columns]), [['night', 0, 100, 2], ['morning', 60, 120, 2]]);
});

test('a task ending at midnight has no empty next-day block; editing back to same-day removes continuation', async (t) => {
  const db = await database(t);
  const saved = await saveTask(db, { ...draft, start_time: '23:00', end_time: '00:00' });
  assert.equal((await listTasks(db, '2026-10-18')).length, 0);
  assert.equal(daySegment(saved, '2026-10-18'), null);
  await saveTask(db, { ...saved, end_time: '01:00' }, saved.id);
  assert.equal((await listTasks(db, '2026-10-18')).length, 1);
  await saveTask(db, { ...saved, end_time: '23:59' }, saved.id);
  assert.equal((await listTasks(db, '2026-10-18')).length, 0);
});

test('overnight reminder remains anchored to original start and schedules once', async () => {
  const mock = backend();
  const night = task('night', { start_time: '23:05', end_time: '01:40', reminder_offset_minutes: 10 });
  await reconcileReminders(mock, [night], new Date('2026-10-17T20:00:00').getTime());
  assert.equal(mock.entries.size, 1);
  assert.equal(mock.entries.get('dailyplanner:night').at, new Date('2026-10-17T22:55:00').getTime());
});

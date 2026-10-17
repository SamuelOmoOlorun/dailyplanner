export type Priority = 'high' | 'medium' | 'low';
export type TaskDraft = {
  title: string;
  priority: Priority;
  date: string;
  start_time: string;
  end_time: string;
  is_completed: number;
  reminder_offset_minutes: number;
};
export type Task = TaskDraft & { id: string; created_at: string; updated_at: string };

export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function minutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

export function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isFinite(parsed.getTime()) && dateKey(parsed) === value;
}

export function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function endDate(task: TaskDraft): string {
  return minutes(task.end_time) < minutes(task.start_time) ? shiftDate(task.date, 1) : task.date;
}

export function daySegment(task: TaskDraft, date = task.date): { start: number; end: number } | null {
  const lastDate = endDate(task);
  if (date === task.date) return { start: minutes(task.start_time), end: lastDate === task.date ? minutes(task.end_time) : 1440 };
  if (date === lastDate && minutes(task.end_time) > 0) return { start: 0, end: minutes(task.end_time) };
  return null;
}

export function validateTask(task: TaskDraft): string | null {
  if (!task.title.trim()) return 'Enter a task title.';
  if (!isDate(task.date)) return 'Enter a valid date as YYYY-MM-DD.';
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timePattern.test(task.start_time) || !timePattern.test(task.end_time)) return 'Enter start and end times as HH:mm (00:00–23:59).';
  if (minutes(task.start_time) === minutes(task.end_time)) return 'End time must differ from start time. Choose an earlier end time to finish tomorrow.';
  if (!['high', 'medium', 'low'].includes(task.priority)) return 'Choose a valid priority.';
  if (![0, 1].includes(task.is_completed)) return 'Choose a valid completion status.';
  if (![0, 5, 10, 15].includes(task.reminder_offset_minutes)) return 'Choose a valid reminder lead time.';
  return null;
}

export function overlaps(draft: TaskDraft, tasks: Task[], excludeId?: string): Task[] {
  if (validateTask(draft)) return [];
  const start = new Date(`${draft.date}T${draft.start_time}:00`).getTime();
  const end = new Date(`${endDate(draft)}T${draft.end_time}:00`).getTime();
  return tasks.filter((task) => task.id !== excludeId &&
    new Date(`${task.date}T${task.start_time}:00`).getTime() < end &&
    start < new Date(`${endDate(task)}T${task.end_time}:00`).getTime());
}

export function reminderTime(task: TaskDraft): number {
  return new Date(`${task.date}T${task.start_time}:00`).getTime() - task.reminder_offset_minutes * 60000;
}

export function reminderFingerprint(task: Task): string {
  return JSON.stringify([task.id, task.title, task.date, task.start_time, task.end_time, task.reminder_offset_minutes]);
}

// Allocate overlapping tasks to columns; touching boundaries can share a column.
export function layoutTasks(tasks: Task[], date?: string) {
  const sorted = tasks.flatMap((task) => {
    const segment = daySegment(task, date ?? task.date);
    return segment && segment.end > segment.start ? [{ task, ...segment }] : [];
  }).sort((a, b) => a.start - b.start || a.end - b.end || a.task.id.localeCompare(b.task.id));
  const result: { task: Task; start: number; end: number; column: number; columns: number }[] = [];
  let group: typeof result = [];
  let ends: number[] = [];
  let groupEnd = -1;
  function flush() {
    for (const item of group) result.push({ ...item, columns: ends.length });
    group = []; ends = [];
  }
  for (const item of sorted) {
    const { start, end } = item;
    if (start >= groupEnd) flush();
    let column = ends.findIndex((end) => end <= start);
    if (column === -1) column = ends.length;
    ends[column] = end;
    groupEnd = Math.max(...ends);
    group.push({ ...item, column, columns: 1 });
  }
  flush();
  return result;
}

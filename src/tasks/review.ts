import { dateKey, endDate, type Task } from './model.ts';

export function pendingReview(tasks: Task[], mode: 'rollover' | 'manual', now = new Date()): Task[] {
  const today = dateKey(now);
  return tasks.filter((task) => !task.is_completed && (mode === 'manual'
    ? task.date <= today
    : task.date < today && new Date(`${endDate(task)}T${task.end_time}:00`).getTime() <= now.getTime()));
}

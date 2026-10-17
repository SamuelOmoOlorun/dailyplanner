import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { setPreference } from '../storage/preferences';
import { deleteTask, listReminderTasks, saveTask } from '../storage/tasks';
import { dateKey, type Task, type TaskDraft } from '../tasks/model';
import { pendingReview } from '../tasks/review';
import { useTheme } from '../theme/ThemeProvider';
import { TaskEditor } from './TaskEditor';

export function TaskReview({ mode, onClose, onChange }: {
  mode: 'rollover' | 'manual'; onClose: () => void; onChange: () => void;
}) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [discarding, setDiscarding] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setTasks(pendingReview(await listReminderTasks(db), mode)); }
    catch { setError('Your unfinished tasks could not be loaded. Please retry.'); }
    finally { setLoading(false); }
  }, [db, mode]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function close() {
    setBusy(true);
    try { await setPreference(db, 'last_opened_date', dateKey()); onClose(); }
    catch { setError('Your review could not be saved. Please retry.'); }
    finally { setBusy(false); }
  }
  async function act(operation: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await operation(); onChange(); setDiscarding(null); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'This task could not be updated. Please retry.'); }
    finally { setBusy(false); }
  }
  async function reschedule(draft: TaskDraft, id?: string) {
    await saveTask(db, draft, id);
    onChange(); setEditing(null); await refresh();
  }
  function button(label: string, action: () => void, danger = false) {
    return <Pressable accessibilityRole="button" disabled={busy || loading} onPress={action}
      style={[styles.button, { borderColor: colors.border, opacity: busy || loading ? 0.5 : 1 }]}>
      <Text style={{ color: danger ? colors.error : colors.accent }}>{label}</Text>
    </Pressable>;
  }
  if (editing) return <TaskEditor task={editing} date={dateKey()} reviewMode={mode} onClose={() => setEditing(null)} onSave={reschedule} />;
  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!busy) void close(); }}>
    <View style={styles.overlay}><ScrollView contentContainerStyle={styles.scroll}>
      <View accessibilityViewIsModal style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 24, fontWeight: '600' }}>{mode === 'rollover' ? 'A fresh start for today' : 'Wrap Up Today'}</Text>
        <Text style={{ color: colors.muted, lineHeight: 21 }}>{mode === 'rollover'
          ? 'Give unfinished tasks from earlier days a new time block today, or discard them.'
          : 'Review today and earlier unfinished tasks. Complete them, discard them, or choose a new date and time.'}</Text>
        {loading ? <ActivityIndicator accessibilityLabel="Loading review" color={colors.accent} /> : !error && tasks.length === 0
          ? <Text style={{ color: colors.text }}>All clear. No unfinished tasks to review.</Text>
          : tasks.map((task) => <View key={task.id} testID={`review-task-${task.id}`} style={[styles.task, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 17 }}>{task.title}</Text>
            <Text style={{ color: colors.muted }}>{task.date} · {task.start_time}–{task.end_time} · {task.priority} priority</Text>
            {discarding === task.id ? <>
              <Text style={{ color: colors.error }}>Permanently delete this task? This cannot be undone.</Text>
              <View style={styles.actions}>{button('Confirm discard', () => { void act(() => deleteTask(db, task.id)); }, true)}{button('Keep task', () => setDiscarding(null))}</View>
            </> : <View style={styles.actions}>
              {mode === 'manual' && button('Complete', () => { void act(() => saveTask(db, { ...task, is_completed: 1 }, task.id)); })}
              {button(mode === 'rollover' ? 'Migrate to Today' : 'Reschedule', () => setEditing(task))}
              {button('Discard', () => setDiscarding(task.id), true)}
            </View>}
          </View>)}
        {error && <><Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text>{button('Retry review', () => { void refresh(); })}</>}
        {button(tasks.length ? 'Review later' : 'Done', () => { void close(); })}
      </View>
    </ScrollView></View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }, scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 24, gap: 18, borderWidth: 1, borderRadius: 20 },
  task: { gap: 12, paddingVertical: 16, borderTopWidth: 1 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { borderWidth: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
});

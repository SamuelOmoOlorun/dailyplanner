import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { listTasks } from '../storage/tasks';
import { useTheme } from '../theme/ThemeProvider';
import { endDate, isDate, overlaps, reminderTime, shiftDate, validateTask, type Task, type TaskDraft } from '../tasks/model';
import { TimeBlockInput } from './TimeBlockInput';
import { DateTimeInput } from './DateTimeInput';

export function TaskEditor({ task, date, onClose, onSave, reviewMode }: {
  task: Task | null; date: string; onClose: () => void; onSave: (draft: TaskDraft, id?: string) => Promise<void>;
  reviewMode?: 'rollover' | 'manual';
}) {
  const { colors } = useTheme();
  const db = useSQLiteContext();
  const [draft, setDraft] = useState<TaskDraft>(task ? { ...task, ...(reviewMode ? { date, is_completed: 0 } : {}) } : { title: '', date, start_time: '09:00', end_time: '09:30', priority: 'medium', is_completed: 0, reminder_offset_minutes: 0 });
  const [candidates, setCandidates] = useState<Task[]>([]);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const change = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => { setDraft((previous) => ({ ...previous, [key]: value })); setError(null); };

  useEffect(() => {
    let active = true;
    setChecking(true); setCheckError(false); setCandidates([]);
    if (!isDate(draft.date)) { setChecking(false); return; }
    Promise.all([listTasks(db, draft.date), listTasks(db, shiftDate(draft.date, 1))]).then((groups) => {
      if (active) setCandidates([...new Map(groups.flat().map((row) => [row.id, row])).values()]);
    })
      .catch(() => { if (active) setCheckError(true); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [db, draft.date]);

  const collisions = overlaps(draft, candidates, task?.id);
  async function submit() {
    const invalid = validateTask(draft);
    if (invalid) { setError(invalid); return; }
    if (reviewMode && (draft.date < date || (reviewMode === 'rollover' && draft.date !== date))) {
      setError(reviewMode === 'rollover' ? 'Choose today to migrate this task.' : 'Choose today or a future date.'); return;
    }
    if (checking || checkError || saving) return;
    setSaving(true);
    try { await onSave(draft, task?.id); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Your task could not be saved. Please try again.'); }
    finally { setSaving(false); }
  }

  function options<T extends string | number>(label: string, values: { value: T; label: string }[], selected: T, onSelect: (value: T) => void) {
    return <View style={styles.field}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <View style={styles.options}>
        {values.map((option) => <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={`${label}: ${option.label}`}
          accessibilityState={{ selected: selected === option.value }} aria-pressed={selected === option.value} onPress={() => onSelect(option.value)}
          style={[styles.option, { borderColor: selected === option.value ? colors.accent : colors.border, backgroundColor: selected === option.value ? colors.accentSurface : colors.surface }]}>
          <Text style={{ color: colors.text }}>{option.label}</Text>
        </Pressable>)}
      </View>
    </View>;
  }

  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!saving) onClose(); }}>
    <View style={styles.overlay}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScroll}>
        <View accessibilityViewIsModal style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{task ? 'Edit time block' : 'New time block'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close editor" disabled={saving} onPress={onClose} style={styles.close}><Text style={{ color: colors.muted, fontSize: 24 }}>×</Text></Pressable>
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.muted }]}>Task title</Text>
            <TextInput accessibilityLabel="Task title" value={draft.title} onChangeText={(value) => change('title', value)} placeholder="What do you want to focus on?" placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>
          <DateTimeInput label="Task date" value={draft.date} onChange={(value) => change('date', value)} kind="date" />
          <TimeBlockInput start={draft.start_time} end={draft.end_time} onStart={(value) => change('start_time', value)} onEnd={(value) => change('end_time', value)} />
          <Text style={[styles.hint, { color: colors.muted }]}>{!validateTask(draft) && endDate(draft) !== draft.date
            ? `Ends tomorrow, ${endDate(draft)}, at ${draft.end_time}. This task will appear on both days.`
            : 'Choose any minute, in 24-hour format. An earlier end time automatically finishes the task tomorrow.'}</Text>
          {options('Priority', [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }], draft.priority, (value) => change('priority', value))}
          {options('Reminder', [0, 5, 10, 15].map((value) => ({ value, label: value === 0 ? 'At start' : `${value} min before` })), draft.reminder_offset_minutes, (value) => change('reminder_offset_minutes', value))}
          {options('Status', [{ value: 0, label: 'Pending' }, { value: 1, label: 'Completed' }], draft.is_completed, (value) => change('is_completed', value))}
          {!validateTask(draft) && !draft.is_completed && reminderTime(draft) <= Date.now() && <Text style={[styles.hint, { color: colors.muted }]}>This reminder time has passed. The task will be saved without sending a past reminder.</Text>}
          {collisions.length > 0 && <View style={[styles.warning, { borderColor: colors.accent, backgroundColor: colors.accentSurface }]}>
            <Text accessibilityRole="alert" style={{ color: colors.text }}>Overlaps with {collisions.map((item) => `“${item.title}” (${item.start_time}–${item.end_time})`).join(', ')}. You can still save this block.</Text>
          </View>}
          {checkError && <Text accessibilityRole="alert" style={{ color: colors.error }}>Existing time blocks could not be checked. Close and reopen the editor to try again.</Text>}
          {error && <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text>}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onClose} disabled={saving} style={[styles.secondary, { borderColor: colors.border }]}><Text style={{ color: colors.text }}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => { void submit(); }} disabled={saving || checking || checkError}
              style={[styles.primary, { backgroundColor: colors.accent, opacity: saving || checking || checkError ? 0.5 : 1 }]}>
              <Text style={{ color: colors.surface, fontWeight: '700' }}>{saving ? 'Saving…' : collisions.length ? 'Save with overlap' : 'Save task'}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }, modalScroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 540, alignSelf: 'center', padding: 24, gap: 16, borderRadius: 20, borderWidth: 1 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { fontSize: 23, fontWeight: '600' }, close: { padding: 6 },
  field: { gap: 8 }, label: { fontSize: 13 }, input: { borderWidth: 1, borderRadius: 10, minHeight: 48, padding: 12, fontSize: 16 },
  hint: { fontSize: 12, lineHeight: 19 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, option: { borderWidth: 1, borderRadius: 8, padding: 10 },
  warning: { padding: 12, borderWidth: 1, borderRadius: 10 }, actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  primary: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center' }, secondary: { padding: 15, borderRadius: 10, borderWidth: 1 },
});

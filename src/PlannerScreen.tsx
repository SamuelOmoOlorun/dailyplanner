import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Appearance } from './components/Appearance';
import { DailyTimeline } from './components/DailyTimeline';
import { TaskEditor } from './components/TaskEditor';
import { useReminders } from './notifications/useReminders';
import { listTasks, saveTask } from './storage/tasks';
import { dateKey, daySegment, type Task, type TaskDraft } from './tasks/model';
import { useTheme } from './theme/ThemeProvider';

export function PlannerScreen() {
  const { colors, mode } = useTheme();
  const db = useSQLiteContext();
  const [date, setDate] = useState(() => dateKey());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ task: Task | null } | null>(null);
  const reminders = useReminders(revision);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setTasks([]);
    listTasks(db, date).then((rows) => { if (active) setTasks(rows); })
      .catch(() => { if (active) setError('Your time blocks could not be loaded. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db, date, revision]);

  function moveDay(amount: number) {
    const day = new Date(`${date}T12:00:00`);
    day.setDate(day.getDate() + amount);
    setDate(dateKey(day));
  }

  async function commit(draft: TaskDraft, id?: string) {
    await saveTask(db, draft, id);
    if (!daySegment(draft, date)) setDate(draft.date);
    setRevision((value) => value + 1);
    setEditor(null);
  }

  const formattedDate = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const reminderMessage = reminders.warning ?? (reminders.permission === 'granted'
    ? Platform.OS === 'web' ? 'Reminders are on. Keep this tab open; sleep or browser suspension can delay delivery.' : 'Reminders are on for your pending tasks.'
    : reminders.permission === 'denied' ? 'Notifications are blocked. Allow notifications in browser or device settings, then retry.'
    : reminders.permission === 'unavailable' ? 'This browser does not support task notifications.' : 'Enable notifications to get a reminder before each time block.');

  return <ScrollView testID="planner-root" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.page}>
    <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
    <View style={styles.content}>
      <View style={styles.header}>
      <View style={styles.brand}>
        <View style={[styles.mark, { backgroundColor: colors.accentSurface }]}><Text style={{ color: colors.accent, fontSize: 23, fontWeight: '700' }}>D</Text></View>
        <Text style={{ color: colors.text, fontSize: 19, fontWeight: '600' }}>Daily Planner</Text>
      </View>
      <Appearance />
      </View>
      <View style={styles.intro}>
        <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.8 }}>MAKE ROOM FOR WHAT MATTERS</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Your day, intentionally.</Text>
        <Text style={{ color: colors.muted, fontSize: 16 }}>Give your priorities a place in your day.</Text>
      </View>
      <View style={styles.dayHeading}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 20, fontWeight: '600' }}>{formattedDate}</Text>
          <View style={styles.navigation}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => moveDay(-1)} style={[styles.smallButton, { borderColor: colors.border }]}><Text style={{ color: colors.text }}>‹</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => setDate(dateKey())} style={[styles.smallButton, { borderColor: colors.border }]}><Text style={{ color: colors.text }}>Today</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Next day" onPress={() => moveDay(1)} style={[styles.smallButton, { borderColor: colors.border }]}><Text style={{ color: colors.text }}>›</Text></Pressable>
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="New task" onPress={() => setEditor({ task: null })} style={[styles.addButton, { backgroundColor: colors.accent }]}><Text style={{ color: colors.surface, fontWeight: '700' }}>+ New task</Text></Pressable>
      </View>
      <View style={[styles.reminders, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text accessibilityLiveRegion="polite" style={{ color: reminders.warning ? colors.error : colors.muted, fontSize: 13, lineHeight: 20, flex: 1 }}>{reminderMessage}</Text>
        {reminders.permission !== 'unavailable' && (reminders.permission !== 'granted' || reminders.warning) && <Pressable accessibilityRole="button" disabled={reminders.requesting} onPress={() => { void reminders.requestPermission(); }} style={[styles.smallButton, { borderColor: colors.border }]}>
          <Text style={{ color: colors.accent }}>{reminders.requesting ? 'Enabling…' : reminders.permission === 'granted' || reminders.permission === 'denied' ? 'Retry reminders' : 'Enable reminders'}</Text>
        </Pressable>}
      </View>
      {loading ? <ActivityIndicator accessibilityLabel="Loading time blocks" color={colors.accent} /> : error ? <View style={{ gap: 12 }}>
        <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={() => setRevision((value) => value + 1)}><Text style={{ color: colors.accent }}>Retry loading</Text></Pressable>
      </View> : <DailyTimeline tasks={tasks} date={date} onEdit={(task) => setEditor({ task })} />}
    </View>
    {editor && <TaskEditor task={editor.task} date={date} onClose={() => setEditor(null)} onSave={commit} />}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 20, paddingVertical: 40 }, content: { width: '100%', maxWidth: 820, alignSelf: 'center', gap: 24 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 }, mark: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, zIndex: 100 },
  intro: { gap: 14, marginVertical: 16 }, title: { fontSize: 36, lineHeight: 44, fontWeight: '600', letterSpacing: -1.3 },
  dayHeading: { flexDirection: 'row', alignItems: 'center', gap: 14 }, navigation: { flexDirection: 'row', gap: 8 },
  smallButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center' },
  addButton: { paddingHorizontal: 18, paddingVertical: 15, borderRadius: 10 }, reminders: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 16 },
});

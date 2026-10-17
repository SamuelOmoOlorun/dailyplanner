import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { daySegment, endDate, layoutTasks, overlaps, type Task } from '../tasks/model';
import { useTheme } from '../theme/ThemeProvider';

export function DailyTimeline({ tasks, date, onEdit }: { tasks: Task[]; date: string; onEdit: (task: Task) => void }) {
  const { colors } = useTheme();
  const scroll = useRef<ScrollView>(null);
  const first = tasks[0] ? daySegment(tasks[0], date)?.start : undefined;
  useEffect(() => {
    const timer = setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, (first !== undefined ? first - 30 : 450) * 2), animated: false }), 60);
    return () => clearTimeout(timer);
  }, [date, first]);
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <View style={[styles.heading, { borderColor: colors.border }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Daily timeline</Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{tasks.length} {tasks.length === 1 ? 'block' : 'blocks'} · Tap a block to edit</Text>
      {!tasks.length && <Text style={{ color: colors.muted, marginTop: 8 }}>A little breathing room. Add your first time block.</Text>}
    </View>
    <ScrollView ref={scroll} nestedScrollEnabled style={styles.viewport} testID="timeline-scroll">
      <View style={styles.day}>
        {Array.from({ length: 25 }, (_, hour) => <View key={hour} style={[styles.hour, { top: hour * 120 + 20 }]}>
          <Text style={[styles.hourLabel, { color: colors.muted }]}>{String(hour).padStart(2, '0')}:00</Text>
          <View style={[styles.rule, { backgroundColor: colors.border }]} />
        </View>)}
        <View style={styles.blocks}>
          {layoutTasks(tasks, date).map(({ task, start, end, column, columns }) => {
            const duration = end - start;
            const overnight = endDate(task) !== task.date;
            const continuation = task.date !== date;
            const collision = overlaps(task, tasks, task.id).length > 0;
            return <Pressable key={task.id} accessibilityRole="button"
              accessibilityLabel={`Edit task: ${task.title}, ${task.start_time} to ${task.end_time}, ${task.priority} priority, ${task.is_completed ? 'Completed' : 'Pending'}${collision ? ', overlapping' : ''}${overnight ? continuation ? ', continues from previous day' : ', continues into next day' : ''}`}
              onPress={() => onEdit(task)} testID={`task-${task.id}`}
              style={[styles.block, { top: start * 2 + 20, height: duration * 2, left: `${column / columns * 100}%`, width: `${100 / columns}%`, backgroundColor: task.is_completed ? colors.background : colors.accentSurface, borderColor: colors.accent, opacity: task.is_completed ? 0.7 : 1 }]}>
              <Text numberOfLines={1} style={[styles.blockTitle, { color: colors.text, textDecorationLine: task.is_completed ? 'line-through' : 'none' }]}>{task.title}</Text>
              {duration >= 20 && <Text numberOfLines={1} style={[styles.blockTime, { color: colors.muted }]}>{task.start_time}–{task.end_time} · {task.priority}</Text>}
              {duration >= 35 && <Text numberOfLines={1} style={[styles.blockTime, { color: colors.accent }]}>{task.is_completed ? 'Completed' : collision ? 'Overlap' : 'Pending'}{overnight ? continuation ? ' · From yesterday' : ' · Ends tomorrow' : ''}</Text>}
            </Pressable>;
          })}
        </View>
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' }, heading: { padding: 20, gap: 6, borderBottomWidth: 1 }, title: { fontSize: 18, fontWeight: '600' },
  viewport: { height: 540 }, day: { height: 2920 }, hour: { position: 'absolute', left: 14, right: 16, flexDirection: 'row', alignItems: 'center' },
  hourLabel: { width: 48, fontSize: 11, marginTop: -7 }, rule: { flex: 1, height: 1 }, blocks: { position: 'absolute', top: 0, left: 65, right: 20, bottom: 0 },
  block: { position: 'absolute', borderLeftWidth: 3, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 0, overflow: 'hidden', borderRightWidth: 2 },
  blockTitle: { fontSize: 13, lineHeight: 19, fontWeight: '600' }, blockTime: { fontSize: 11, lineHeight: 17 },
});

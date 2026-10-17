import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { dateKey, isDate } from '../tasks/model';
import { useTheme } from '../theme/ThemeProvider';

export function DateTimeInput({ label, value, onChange, kind }: {
  label: string; value: string; onChange: (value: string) => void; kind: 'date' | 'time';
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date(`${isDate(value) ? value : dateKey()}T12:00:00`));
  const selectedTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '00:00';
  function toggle() {
    if (!open && kind === 'date') setMonth(new Date(`${isDate(value) ? value : dateKey()}T12:00:00`));
    setOpen(!open);
  }
  function changeMonth(offset: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1, 12));
  }
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1, 12).getDay();
  const days = new Date(year, monthIndex + 1, 0, 12).getDate();

  return <View style={styles.field}>
    <Text style={[styles.label, { color: colors.muted }]}>{label === 'Task date' ? 'Date' : label}</Text>
    <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={kind === 'date' ? 'YYYY-MM-DD' : 'HH:mm'}
        placeholderTextColor={colors.muted} maxLength={kind === 'date' ? 10 : 5} autoCorrect={false}
        style={[styles.input, { color: colors.text }]} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Choose ${label.toLowerCase()}`} accessibilityState={{ expanded: open }} aria-expanded={open}
        onPress={toggle} style={[styles.trigger, { borderColor: colors.border }]}>
        <Text style={{ color: colors.accent, fontSize: 22 }}>{kind === 'date' ? '▦' : '◷'}</Text>
      </Pressable>
    </View>
    {open && <View style={[styles.dropdown, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      {kind === 'date' ? <>
        <View style={styles.monthHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => changeMonth(-1)} style={styles.monthButton}><Text style={{ color: colors.accent }}>‹</Text></Pressable>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => changeMonth(1)} style={styles.monthButton}><Text style={{ color: colors.accent }}>›</Text></Pressable>
        </View>
        <View style={styles.calendar}>
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => <View key={day} style={styles.day}><Text style={{ color: colors.muted, fontSize: 11 }}>{day}</Text></View>)}
          {Array.from({ length: firstWeekday }, (_, index) => <View key={`empty-${index}`} style={styles.day} />)}
          {Array.from({ length: days }, (_, index) => {
            const day = index + 1;
            const key = dateKey(new Date(year, monthIndex, day, 12));
            return <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Select date ${key}`} aria-pressed={value === key}
              onPress={() => { onChange(key); setOpen(false); }} style={[styles.day, { borderRadius: 8, backgroundColor: value === key ? colors.accentSurface : colors.surface }]}>
              <Text style={{ color: value === key ? colors.accent : colors.text, fontWeight: value === key ? '700' : '400' }}>{day}</Text>
            </Pressable>;
          })}
        </View>
      </> : <View style={styles.timeColumns}>
        {['hour', 'minute'].map((unit, column) => <View key={unit} style={styles.timeColumn}>
          <Text style={[styles.label, { color: colors.muted, textAlign: 'center' }]}>{column === 0 ? 'Hour' : 'Minute'}</Text>
          <ScrollView nestedScrollEnabled style={styles.timeList}>
            {Array.from({ length: column === 0 ? 24 : 60 }, (_, index) => {
              const option = String(index).padStart(2, '0');
              const parts = selectedTime.split(':');
              const selected = parts[column] === option;
              return <Pressable key={option} accessibilityRole="button" accessibilityLabel={`${label} ${unit} ${option}`} aria-pressed={selected}
                onPress={() => { parts[column] = option; onChange(parts.join(':')); }} style={[styles.timeOption, { backgroundColor: selected ? colors.accentSurface : colors.surface }]}>
                <Text style={{ color: selected ? colors.accent : colors.text }}>{option}</Text>
              </Pressable>;
            })}
          </ScrollView>
        </View>)}
      </View>}
      <Pressable accessibilityRole="button" accessibilityLabel={`Done choosing ${label.toLowerCase()}`} onPress={() => setOpen(false)} style={styles.done}>
        <Text style={{ color: colors.accent, fontWeight: '600' }}>Done</Text>
      </Pressable>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  field: { flex: 1, gap: 8 }, label: { fontSize: 13 }, inputRow: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, minHeight: 48 },
  input: { flex: 1, minWidth: 0, padding: 12, fontSize: 16 }, trigger: { borderLeftWidth: 1, width: 42, alignItems: 'center', justifyContent: 'center' },
  dropdown: { borderWidth: 1, borderRadius: 12, padding: 8, gap: 8 }, monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthButton: { padding: 12 }, calendar: { flexDirection: 'row', flexWrap: 'wrap' }, day: { width: '14.285714%', height: 36, alignItems: 'center', justifyContent: 'center' },
  timeColumns: { flexDirection: 'row', gap: 4 }, timeColumn: { flex: 1, gap: 8 }, timeList: { height: 160 }, timeOption: { paddingVertical: 9, alignItems: 'center', borderRadius: 6 },
  done: { padding: 10, alignItems: 'center' },
});

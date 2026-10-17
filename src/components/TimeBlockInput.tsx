import { StyleSheet, View } from 'react-native';
import { DateTimeInput } from './DateTimeInput';

export function TimeBlockInput({ start, end, onStart, onEnd }: {
  start: string; end: string; onStart: (value: string) => void; onEnd: (value: string) => void;
}) {
  return <View style={styles.row}>
    {[{ label: 'Start time', value: start, onChange: onStart }, { label: 'End time', value: end, onChange: onEnd }].map((field) => (
      <DateTimeInput key={field.label} label={field.label} value={field.value} onChange={field.onChange} kind="time" />
    ))}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 }, field: { flex: 1, gap: 8 }, label: { fontSize: 13 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 17 },
});

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemePreference } from '../theme/tokens';

export function Appearance() {
  const { colors, preference, setTheme, saving, error } = useTheme();
  const [open, setOpen] = useState(false);
  const selectedLabel = preference[0].toUpperCase() + preference.slice(1);
  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Appearance: ${selectedLabel}`} aria-expanded={open} accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)} style={[styles.trigger, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontSize: 13 }}>Appearance: {selectedLabel} ▾</Text>
      </Pressable>
      {open && <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {(['light', 'dark', 'system'] as ThemePreference[]).map((value) => {
          const label = value[0].toUpperCase() + value.slice(1);
          return <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${label} appearance`}
            accessibilityState={{ selected: preference === value, disabled: saving }} aria-pressed={preference === value} disabled={saving}
            onPress={() => { void setTheme(value).then(() => setOpen(false)); }}
            style={[styles.choice, { backgroundColor: preference === value ? colors.accentSurface : colors.surface }]}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>{label}{preference === value ? ' ✓' : ''}</Text>
          </Pressable>;
        })}
      </View>}
      {error && <Text accessibilityLiveRegion="polite" style={{ color: colors.error, fontSize: 12 }}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', zIndex: 100 },
  trigger: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  menu: { position: 'absolute', right: 0, top: 48, width: 170, padding: 6, borderWidth: 1, borderRadius: 12, elevation: 6 },
  choice: { padding: 13, borderRadius: 8 },
});

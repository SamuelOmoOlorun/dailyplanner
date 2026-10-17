import { PlannerScreen } from './src/PlannerScreen';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { DATABASE_NAME, initializeDatabase } from './src/storage/database';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { palettes, spacing } from './src/theme/tokens';

export default function App() {
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const handleInitialize = useCallback(async (db: SQLiteDatabase) => {
    await initializeDatabase(db);
    setReady(true);
  }, []);

  if (error) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.errorTitle}>Your planner couldn’t open</Text>
        <Text style={styles.errorMessage}>Local storage is unavailable. Please try again.</Text>
        <Pressable accessibilityRole="button" onPress={() => { setError(null); setReady(false); setAttempt(attempt + 1); }} style={styles.retry}>
          <Text style={styles.retryLabel}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {!ready && <View style={styles.fallback}><ActivityIndicator accessibilityLabel="Opening your planner" color={palettes.light.accent} /></View>}
      <SQLiteProvider
        key={attempt}
        databaseName={DATABASE_NAME}
        onInit={handleInitialize}
        onError={setError}
      >
        <ThemeProvider><PlannerScreen /></ThemeProvider>
      </SQLiteProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fallback: { flex: 1, backgroundColor: palettes.light.background, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  errorTitle: { color: palettes.light.text, fontSize: 22, fontWeight: '600' },
  errorMessage: { color: palettes.light.muted, textAlign: 'center' },
  retry: { backgroundColor: palettes.light.accent, padding: spacing.md, borderRadius: 10 },
  retryLabel: { color: '#FFFFFF', fontWeight: '600' },
});
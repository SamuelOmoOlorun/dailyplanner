import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { getPreference, setPreference } from '../storage/preferences';
import { isThemePreference, palettes, resolveTheme, type ThemeMode, type ThemePreference } from './tokens';

type ThemeContextValue = {
  mode: ThemeMode;
  colors: (typeof palettes)[ThemeMode];
  preference: ThemePreference;
  saving: boolean;
  error: string | null;
  setTheme: (preference: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const systemScheme = useColorScheme();
  const [preference, setThemePreference] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getPreference(db, 'theme')
      .then((stored) => { if (active && isThemePreference(stored)) setThemePreference(stored); })
      .catch(() => { if (active) setError('Your appearance preference could not be loaded.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [db]);

  async function setTheme(next: ThemePreference) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await setPreference(db, 'theme', next);
      setThemePreference(next);
    } catch {
      setError('Your appearance preference could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const mode = resolveTheme(preference, systemScheme);
  if (!ready) return null;

  return (
    <ThemeContext.Provider value={{ mode, colors: palettes[mode], preference, saving, error, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside ThemeProvider.');
  return theme;
}

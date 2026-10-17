export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function resolveTheme(preference: ThemePreference, systemScheme: string | null | undefined): ThemeMode {
  return preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
}

export const palettes = {
  light: {
    background: '#F7F8FA', surface: '#FFFFFF', text: '#172226', muted: '#5C6B70',
    border: '#DDE3E5', accent: '#236653', accentSurface: '#E9F3EE', error: '#A02727',
  },
  dark: {
    background: '#111718', surface: '#1A2325', text: '#F0F5F4', muted: '#ABBAB9',
    border: '#344244', accent: '#9CDBC0', accentSurface: '#223C32', error: '#FFA6A6',
  },
} as const;

export const spacing = { xs: 8, sm: 12, md: 20, lg: 32, xl: 48 } as const;

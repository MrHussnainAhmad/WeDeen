import { create } from 'zustand';
import { getUiPreferences, saveUiPreferences } from '@/utils/preferences';

export type ColorScheme = 'light' | 'dark';

type ThemeState = {
  colorScheme: ColorScheme;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setColorScheme: (scheme: ColorScheme) => Promise<void>;
  toggleColorScheme: () => Promise<void>;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  colorScheme: 'light',
  hydrated: false,
  hydrate: async () => {
    const prefs = await getUiPreferences();
    set({ colorScheme: prefs.colorScheme, hydrated: true });
  },
  setColorScheme: async (scheme) => {
    const prefs = await getUiPreferences();
    await saveUiPreferences({ ...prefs, colorScheme: scheme });
    set({ colorScheme: scheme });
    try {
      const { refreshWidgetDataTheme } = require('@/services/prayerTimingUtils');
      await refreshWidgetDataTheme(scheme);
    } catch (e) {
      console.error('Failed to update widget data theme on theme change:', e);
    }
  },
  toggleColorScheme: async () => {
    const next = get().colorScheme === 'dark' ? 'light' : 'dark';
    await get().setColorScheme(next);
  },
}));

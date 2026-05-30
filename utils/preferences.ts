import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = 'wedeen_ui_preferences_v1';

export type UiPreferences = {
  arabicAyahFontSize: number;
  use24HourTime: boolean;
};

const DEFAULT_PREFERENCES: UiPreferences = {
  arabicAyahFontSize: 24,
  use24HourTime: true,
};

export async function getUiPreferences(): Promise<UiPreferences> {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as Partial<UiPreferences>;
    return {
      arabicAyahFontSize: Number.isFinite(parsed.arabicAyahFontSize)
        ? Number(parsed.arabicAyahFontSize)
        : DEFAULT_PREFERENCES.arabicAyahFontSize,
      use24HourTime:
        typeof parsed.use24HourTime === 'boolean'
          ? parsed.use24HourTime
          : DEFAULT_PREFERENCES.use24HourTime,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function saveUiPreferences(prefs: UiPreferences) {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export const uiPreferenceDefaults = DEFAULT_PREFERENCES;

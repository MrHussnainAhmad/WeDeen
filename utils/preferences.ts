import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = 'wedeen_ui_preferences_v1';

export type UiPreferences = {
  arabicAyahFontSize: number;
  use24HourTime: boolean;
  adhanAlertsEnabled: boolean;
  /** Adhan playback gain, 0..1. */
  adhanVolume: number;
  /** Opt-in: update location in the background so adhan stays accurate while traveling. */
  backgroundLocationEnabled: boolean;
};

const DEFAULT_PREFERENCES: UiPreferences = {
  arabicAyahFontSize: 24,
  use24HourTime: true,
  adhanAlertsEnabled: true,
  adhanVolume: 1,
  backgroundLocationEnabled: false,
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
      adhanAlertsEnabled:
        typeof parsed.adhanAlertsEnabled === 'boolean'
          ? parsed.adhanAlertsEnabled
          : DEFAULT_PREFERENCES.adhanAlertsEnabled,
      adhanVolume:
        typeof parsed.adhanVolume === 'number' && parsed.adhanVolume >= 0 && parsed.adhanVolume <= 1
          ? parsed.adhanVolume
          : DEFAULT_PREFERENCES.adhanVolume,
      backgroundLocationEnabled:
        typeof parsed.backgroundLocationEnabled === 'boolean'
          ? parsed.backgroundLocationEnabled
          : DEFAULT_PREFERENCES.backgroundLocationEnabled,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function saveUiPreferences(prefs: UiPreferences) {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export const uiPreferenceDefaults = DEFAULT_PREFERENCES;

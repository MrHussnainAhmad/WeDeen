import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = 'wedeen_ui_preferences_v1';

export type ColorScheme = 'light' | 'dark';
export type PrayerSchoolId = 'hanafi' | 'shafi' | 'maliki' | 'hanbali' | 'jaffri';

export const PRAYER_SCHOOLS: { id: PrayerSchoolId; label: string }[] = [
  { id: 'hanafi', label: 'Hanafi' },
  { id: 'shafi', label: 'Shafi' },
  { id: 'maliki', label: 'Maliki' },
  { id: 'hanbali', label: 'Hanbali' },
  { id: 'jaffri', label: 'Jaffri' },
];

export function normalizePrayerSchool(value: unknown): PrayerSchoolId {
  if (value === 1) return 'hanafi';
  if (value === 0) return 'shafi';
  if (typeof value !== 'string') return 'hanafi';
  const normalized = value.toLowerCase();
  if (normalized === 'hanafi') return 'hanafi';
  if (normalized === 'shafi' || normalized === 'shafii' || normalized === 'shaafi') return 'shafi';
  if (normalized === 'maliki') return 'maliki';
  if (normalized === 'hanbali') return 'hanbali';
  if (normalized === 'jaffri' || normalized === 'jafari' || normalized === 'jafri') return 'jaffri';
  return 'hanafi';
}

export function getPrayerSchoolLabel(value: unknown) {
  const school = normalizePrayerSchool(value);
  return PRAYER_SCHOOLS.find((item) => item.id === school)?.label ?? 'Hanafi';
}

export function getPrayerTimingApiParams(
  schoolValue: unknown,
  calculationMethodId: number
) {
  const school = normalizePrayerSchool(schoolValue);
  return {
    school,
    schoolParam: school === 'hanafi' ? 1 : 0,
    methodId: school === 'jaffri' ? 0 : calculationMethodId,
  };
}

export type UiPreferences = {
  arabicAyahFontSize: number;
  use24HourTime: boolean;
  adhanAlertsEnabled: boolean;
  /** Adhan playback gain, 0..1. */
  adhanVolume: number;
  /** Opt-in: update location in the background so adhan stays accurate while traveling. */
  backgroundLocationEnabled: boolean;
  /** Manual light/dark theme (not system auto). */
  colorScheme: ColorScheme;
  /** Gradually lower screen brightness at night while the app is open. */
  nightBrightnessEnabled: boolean;
  showTajweedColors: boolean;
  showTafsirOption: boolean;
  quranPlaybackRate: number;
  quranRepeatCount: number;
  madhab: PrayerSchoolId;
  calculationMethodId: number; // aladhan method id
};

const DEFAULT_PREFERENCES: UiPreferences = {
  arabicAyahFontSize: 24,
  use24HourTime: true,
  adhanAlertsEnabled: true,
  adhanVolume: 1,
  backgroundLocationEnabled: false,
  colorScheme: 'light',
  nightBrightnessEnabled: true,
  showTajweedColors: false,
  showTafsirOption: false,
  quranPlaybackRate: 1,
  quranRepeatCount: 1,
  madhab: 'hanafi',
  calculationMethodId: 2,
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
      colorScheme:
        parsed.colorScheme === 'dark' || parsed.colorScheme === 'light'
          ? parsed.colorScheme
          : DEFAULT_PREFERENCES.colorScheme,
      nightBrightnessEnabled:
        typeof parsed.nightBrightnessEnabled === 'boolean'
          ? parsed.nightBrightnessEnabled
          : DEFAULT_PREFERENCES.nightBrightnessEnabled,
      showTajweedColors:
        typeof parsed.showTajweedColors === 'boolean'
          ? parsed.showTajweedColors
          : DEFAULT_PREFERENCES.showTajweedColors,
      showTafsirOption:
        typeof parsed.showTafsirOption === 'boolean'
          ? parsed.showTafsirOption
          : DEFAULT_PREFERENCES.showTafsirOption,
      quranPlaybackRate:
        typeof parsed.quranPlaybackRate === 'number' && parsed.quranPlaybackRate >= 0.75 && parsed.quranPlaybackRate <= 1.5
          ? parsed.quranPlaybackRate
          : DEFAULT_PREFERENCES.quranPlaybackRate,
      quranRepeatCount:
        typeof parsed.quranRepeatCount === 'number' && parsed.quranRepeatCount >= 1 && parsed.quranRepeatCount <= 5
          ? Math.round(parsed.quranRepeatCount)
          : DEFAULT_PREFERENCES.quranRepeatCount,
      madhab: normalizePrayerSchool(parsed.madhab),
      calculationMethodId:
        typeof parsed.calculationMethodId === 'number'
          ? parsed.calculationMethodId
          : DEFAULT_PREFERENCES.calculationMethodId,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function saveUiPreferences(prefs: UiPreferences) {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export const uiPreferenceDefaults = DEFAULT_PREFERENCES;

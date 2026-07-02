import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPrayerSchoolLabel, getPrayerTimingApiParams, getUiPreferences } from '../utils/preferences';
import * as FileSystem from 'expo-file-system/legacy';

export const PRAYER_LABELS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
export type PrayerLabel = (typeof PRAYER_LABELS)[number];

export type PrayerLocation = {
  mode: 'coords' | 'city';
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
};

export function isPrayerLocationConfigured(
  loc: PrayerLocation | null | undefined
): loc is PrayerLocation {
  if (!loc) return false;
  if (loc.mode === 'coords') {
    return loc.latitude != null && loc.longitude != null;
  }
  return !!(loc.city?.trim() && loc.country?.trim());
}

export type PrayerWindow = {
  label: PrayerLabel;
  start: Date;
  end: Date;
};

const PRAYER_CALENDAR_PREFIX = 'prayer_calendar_v1_';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function gregorianKey(d: Date) {
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

export function normalizeTime(raw?: string) {
  return (raw || '').slice(0, 5);
}

function locationKey(loc: PrayerLocation) {
  if (loc.mode === 'coords' && loc.latitude != null && loc.longitude != null) {
    return `coords_${loc.latitude.toFixed(4)}_${loc.longitude.toFixed(4)}`;
  }
  return `city_${(loc.city || '').toLowerCase()}_${(loc.country || '').toLowerCase()}`;
}

function calendarUrl(loc: PrayerLocation, year: number, month: number, methodId: number, school: number) {
  if (loc.mode === 'coords' && loc.latitude != null && loc.longitude != null) {
    return `https://api.aladhan.com/v1/calendar?latitude=${loc.latitude}&longitude=${loc.longitude}&method=${methodId}&school=${school}&month=${month}&year=${year}`;
  }
  return `https://api.aladhan.com/v1/calendarByCity?city=${encodeURIComponent(
    loc.city
  )}&country=${encodeURIComponent(loc.country)}&method=${methodId}&school=${school}&month=${month}&year=${year}`;
}

export async function getMonthTimings(
  loc: PrayerLocation,
  year: number,
  month: number
): Promise<Record<string, Record<string, string>>> {
  const prefs = await getUiPreferences().catch(() => ({ madhab: 'hanafi', calculationMethodId: 2 }));
  const { school, schoolParam, methodId } = getPrayerTimingApiParams(
    prefs.madhab,
    prefs.calculationMethodId
  );
  const cacheKey = `${PRAYER_CALENDAR_PREFIX}${locationKey(loc)}_${school}_${schoolParam}_${methodId}_${year}-${pad(month)}`;
  let days: any[] | null = null;

  try {
    const res = await fetch(calendarUrl(loc, year, month, methodId, schoolParam));
    const json = await res.json();
    if (Array.isArray(json?.data)) {
      days = json.data;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(days)).catch(() => undefined);
    }
  } catch {
    // fall back to cache
  }

  if (!days) {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      try {
        days = JSON.parse(cached);
      } catch {
        days = null;
      }
    }
  }

  const map: Record<string, Record<string, string>> = {};
  for (const day of days ?? []) {
    const key = day?.date?.gregorian?.date;
    if (key && day?.timings) map[key] = day.timings;
  }

  if (days && days.length > 0) {
    exportWidgetData(loc, school, methodId, map).catch((err) => console.error('exportWidgetData err:', err));
  }

  return map;
}

export function parsePrayerDateTime(day: Date, timeHHmm: string) {
  const [h, m] = (timeHHmm || '').split(':').map(Number);
  const d = new Date(day);
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

export async function getPrayerWindowsForDay(
  loc: PrayerLocation,
  day: Date,
  windowMinutes: number
): Promise<PrayerWindow[]> {
  const timingsByDate = await getMonthTimings(loc, day.getFullYear(), day.getMonth() + 1);
  const timings = timingsByDate[gregorianKey(day)];
  if (!timings) return [];

  const windows: PrayerWindow[] = [];
  for (const label of PRAYER_LABELS) {
    const time = normalizeTime(timings[label]);
    if (!time) continue;
    const start = parsePrayerDateTime(day, time);
    const end = new Date(start.getTime() + windowMinutes * 60_000);
    windows.push({ label, start, end });
  }
  return windows;
}

/** Prayer window that contains `now` (adhan → adhan + windowMinutes). */
export async function getActivePrayerWindow(
  loc: PrayerLocation,
  now: Date,
  windowMinutes: number
): Promise<PrayerWindow | null> {
  const windows = await getPrayerWindowsForDay(loc, now, windowMinutes);
  const ts = now.getTime();
  for (const window of windows) {
    if (ts >= window.start.getTime() && ts < window.end.getTime()) {
      return window;
    }
  }
  return null;
}

/** Earliest prayer that has started today but is not yet marked complete. */
export async function getOutstandingPrayerWindow(
  loc: PrayerLocation,
  now: Date,
  windowMinutes: number,
  completedToday: PrayerLabel[]
): Promise<PrayerWindow | null> {
  const windows = await getPrayerWindowsForDay(loc, now, windowMinutes);
  const nowMs = now.getTime();

  for (const window of windows) {
    if (window.start.getTime() > nowMs) break;
    if (completedToday.includes(window.label)) continue;
    return window;
  }

  return null;
}

/** The very next upcoming prayer window (used for background alarm scheduling). */
export async function getNextPrayerWindow(
  loc: PrayerLocation,
  now: Date,
  windowMinutes: number
): Promise<PrayerWindow | null> {
  const windows = await getPrayerWindowsForDay(loc, now, windowMinutes);
  const ts = now.getTime();
  for (const window of windows) {
    if (window.start.getTime() > ts) {
      return window;
    }
  }
  
  // If no more prayers today, return tomorrow's Fajr
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const tomorrowWindows = await getPrayerWindowsForDay(loc, tomorrow, windowMinutes);
  return tomorrowWindows[0] || null;
}

export async function exportWidgetData(
  location: any,
  school: unknown,
  methodId: number,
  newTimings: Record<string, Record<string, string>>
) {
  try {
    const targetPath = `${FileSystem.documentDirectory}widget_data.json`;
    let timings: Record<string, Record<string, string>> = {};

    try {
      const info = await FileSystem.getInfoAsync(targetPath);
      if (info.exists) {
        const raw = await FileSystem.readAsStringAsync(targetPath);
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.timings === 'object') {
          timings = parsed.timings;
        }
      }
    } catch (e) {
      // Ignore reading errors
    }

    for (const dateKey of Object.keys(newTimings)) {
      const inputTimes = newTimings[dateKey];
      const normalized: Record<string, string> = {};
      for (const prayer of Object.keys(inputTimes)) {
        normalized[prayer] = (inputTimes[prayer] || '').slice(0, 5);
      }
      timings[dateKey] = {
        ...timings[dateKey],
        ...normalized,
      };
    }

    const sortedKeys = Object.keys(timings).sort((a, b) => {
      const [da, ma, ya] = a.split('-').map(Number);
      const [db, mb, yb] = b.split('-').map(Number);
      const ta = new Date(ya, ma - 1, da).getTime();
      const tb = new Date(yb, mb - 1, db).getTime();
      return ta - tb;
    });
    if (sortedKeys.length > 60) {
      const keysToRemove = sortedKeys.slice(0, sortedKeys.length - 60);
      for (const k of keysToRemove) {
        delete timings[k];
      }
    }

    const methodNames: Record<number, string> = {
      0: "Jafari",
      1: "Karachi",
      2: "ISNA",
      3: "MWL",
      4: "Makkah",
      5: "Egyptian",
      7: "Tehran",
      13: "Diyanet",
      15: "Russia"
    };
    const methodName = methodNames[methodId] || "Custom";
    const schoolName = getPrayerSchoolLabel(school);
    const locationName = location
      ? location.city && location.city !== 'Unknown City'
        ? `${location.city}, ${location.country}`
        : location.latitude != null && location.longitude != null
          ? `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`
          : "Unknown Location"
      : null;

    const prefs = await getUiPreferences().catch(() => null);
    const colorScheme = prefs?.colorScheme || 'light';

    const payload = {
      locationName,
      school: schoolName,
      methodName,
      timings,
      colorScheme,
      lastUpdated: Date.now()
    };

    await FileSystem.writeAsStringAsync(targetPath, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to export widget data:', err);
  }
}

export async function refreshWidgetDataTheme(scheme: 'light' | 'dark') {
  try {
    const targetPath = `${FileSystem.documentDirectory}widget_data.json`;
    const info = await FileSystem.getInfoAsync(targetPath);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(targetPath);
      const parsed = JSON.parse(raw);
      if (parsed) {
        parsed.colorScheme = scheme;
        parsed.lastUpdated = Date.now();
        await FileSystem.writeAsStringAsync(targetPath, JSON.stringify(parsed));
      }
    }
  } catch (err) {
    console.error('Failed to update widget theme in JSON:', err);
  }
}

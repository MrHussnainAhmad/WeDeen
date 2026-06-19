import AsyncStorage from '@react-native-async-storage/async-storage';

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
  if (loc.mode === 'coords' && loc.latitude && loc.longitude) {
    return `coords_${loc.latitude.toFixed(4)}_${loc.longitude.toFixed(4)}`;
  }
  return `city_${(loc.city || '').toLowerCase()}_${(loc.country || '').toLowerCase()}`;
}

function calendarUrl(loc: PrayerLocation, year: number, month: number) {
  if (loc.mode === 'coords' && loc.latitude && loc.longitude) {
    return `https://api.aladhan.com/v1/calendar?latitude=${loc.latitude}&longitude=${loc.longitude}&method=2&month=${month}&year=${year}`;
  }
  return `https://api.aladhan.com/v1/calendarByCity?city=${encodeURIComponent(
    loc.city
  )}&country=${encodeURIComponent(loc.country)}&method=2&month=${month}&year=${year}`;
}

export async function getMonthTimings(
  loc: PrayerLocation,
  year: number,
  month: number
): Promise<Record<string, Record<string, string>>> {
  const cacheKey = `${PRAYER_CALENDAR_PREFIX}${locationKey(loc)}_${year}-${pad(month)}`;
  let days: any[] | null = null;

  try {
    const res = await fetch(calendarUrl(loc, year, month));
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
export async function getOutstandingPrayerLock(
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

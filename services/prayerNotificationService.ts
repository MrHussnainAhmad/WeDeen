import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { getUiPreferences } from '@/utils/preferences';
import { armForegroundAdhan, ringAdhan, stopAdhan } from './adhanController';

const PRAYER_NOTIFICATION_IDS_KEY = 'prayer_notification_ids_v1';
const PRAYER_NOTIFICATION_SIGNATURE_KEY = 'prayer_notification_signature_v2';
const PRAYER_CALENDAR_PREFIX = 'prayer_calendar_v1_';
const PRAYER_CHANNEL_ID = 'prayer-adhan';
const ADHAN_SOUND = 'adhan.m4a';
const ADHAN_CATEGORY = 'adhan-alarm';
const ADHAN_RESPONSE_TASK = 'adhan-response-task';

export const ADHAN_SNOOZE_ACTION = 'snooze';
export const ADHAN_STOP_ACTION = 'stop';

const PRAYER_LABELS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

export type AdhanLocation = {
  mode: 'coords' | 'city';
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
};

type ExpoNotifications = typeof import('expo-notifications');
let notificationsModule: ExpoNotifications | null = null;

async function getNotifications() {
  // Scheduled notifications + custom sounds don't work in Expo Go.
  if (Constants.appOwnership === 'expo') return null;
  if (!notificationsModule) {
    notificationsModule = await import('expo-notifications');
  }
  return notificationsModule;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function gregorianKey(d: Date) {
  // "DD-MM-YYYY" — matches Aladhan's calendar `date.gregorian.date`.
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function normalizeTime(raw?: string) {
  return (raw || '').slice(0, 5);
}

function locationKey(loc: AdhanLocation) {
  if (loc.mode === 'coords' && loc.latitude && loc.longitude) {
    return `coords_${loc.latitude.toFixed(4)}_${loc.longitude.toFixed(4)}`;
  }
  return `city_${(loc.city || '').toLowerCase()}_${(loc.country || '').toLowerCase()}`;
}

function calendarUrl(loc: AdhanLocation, year: number, month: number) {
  if (loc.mode === 'coords' && loc.latitude && loc.longitude) {
    return `https://api.aladhan.com/v1/calendar?latitude=${loc.latitude}&longitude=${loc.longitude}&method=2&month=${month}&year=${year}`;
  }
  return `https://api.aladhan.com/v1/calendarByCity?city=${encodeURIComponent(
    loc.city
  )}&country=${encodeURIComponent(loc.country)}&method=2&month=${month}&year=${year}`;
}

/** Fetch (cache-first) a month of daily timings, returned as date → timings map. */
async function getMonthTimings(
  loc: AdhanLocation,
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

function parsePrayerDateTime(day: Date, timeHHmm: string) {
  const [h, m] = (timeHHmm || '').split(':').map(Number);
  const d = new Date(day);
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

export async function ensurePrayerNotificationPermission() {
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const req = await Notifications.requestPermissionsAsync();
  return !!(req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
}

export async function configurePrayerNotificationChannel() {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(PRAYER_CHANNEL_ID, {
    name: 'Prayer Alerts',
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    vibrationPattern: [0, 250, 250, 250],
    sound: ADHAN_SOUND,
    // Play on the ALARM stream so the adhan uses the device alarm volume and
    // sounds even when the ringer is on silent.
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM,
      contentType: Notifications.AndroidAudioContentType.MUSIC,
    },
  });
}

// Register the Snooze / Stop buttons that appear on the adhan notification.
async function setupAdhanCategory() {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.setNotificationCategoryAsync(ADHAN_CATEGORY, [
    {
      identifier: ADHAN_SNOOZE_ACTION,
      buttonTitle: 'Snooze 5 min',
      options: { opensAppToForeground: false },
    },
    {
      identifier: ADHAN_STOP_ACTION,
      buttonTitle: 'Stop',
      options: { opensAppToForeground: false },
    },
  ]);
}

// Channel + action buttons + background response task, all in one place.
async function ensureAdhanNotificationSetup() {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await configurePrayerNotificationChannel();
  await setupAdhanCategory();
  try {
    await Notifications.registerTaskAsync(ADHAN_RESPONSE_TASK);
  } catch {
    // best-effort — foreground/cold-start handling still works
  }
}

/**
 * Central handler for an adhan notification interaction — used by both the
 * foreground response listener (_layout) and the background task. `snooze`
 * re-rings in 5 minutes, `stop` silences, a plain tap rings the full adhan.
 */
export async function handleAdhanAction(actionIdentifier: string, prayer: string) {
  if (actionIdentifier === ADHAN_SNOOZE_ACTION) {
    await snoozeAdhan(prayer);
  } else if (actionIdentifier === ADHAN_STOP_ACTION) {
    await stopAdhan();
  } else {
    await ringAdhan(prayer);
  }
}

// Best-effort background handling so Snooze/Stop work when the app is killed.
// Defined at module load (this module is imported by the root layout). Guarded
// so Expo Go — which lacks the native task runner — never trips over it.
if (Constants.appOwnership !== 'expo') {
  try {
    if (!TaskManager.isTaskDefined(ADHAN_RESPONSE_TASK)) {
      TaskManager.defineTask(ADHAN_RESPONSE_TASK, async ({ data, error }: any) => {
        if (error) return;
        const actionIdentifier = data?.actionIdentifier;
        const prayer = String(data?.notification?.request?.content?.data?.prayer ?? 'Prayer');
        if (actionIdentifier) {
          await handleAdhanAction(actionIdentifier, prayer).catch(() => undefined);
        }
      });
    }
  } catch {
    // ignore — falls back to foreground/cold-start handling
  }
}

export async function cancelAllPrayerAdhan() {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  const raw = await AsyncStorage.getItem(PRAYER_NOTIFICATION_IDS_KEY);
  const ids = raw ? (JSON.parse(raw) as string[]) : [];
  if (ids.length) {
    await Promise.all(
      ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined))
    );
  }
  await AsyncStorage.removeItem(PRAYER_NOTIFICATION_IDS_KEY);
  await AsyncStorage.removeItem(PRAYER_NOTIFICATION_SIGNATURE_KEY);
}

/**
 * Schedule adhan notifications for the next `days` days at the given location.
 * Idempotent within a day/location via a signature so repeated launches don't
 * churn. Respects the `adhanAlertsEnabled` preference (disabled → cancels all).
 *
 * Serialized: the boot effect and the location-refresh effect can both call this
 * near-simultaneously. Without a lock they could each pass the signature guard
 * before either writes it, schedule the full set, and leave DUPLICATE
 * notifications in the bar. The in-flight promise guarantees one runs at a time.
 */
let schedulingPromise: Promise<boolean> | null = null;

export function schedulePrayerAdhan(
  location: AdhanLocation | null,
  options: { days?: number } = {}
): Promise<boolean> {
  const run = (schedulingPromise ?? Promise.resolve(true)).then(() =>
    schedulePrayerAdhanInner(location, options)
  );
  // Keep the chain alive for the next caller, but don't let a rejection poison it.
  schedulingPromise = run.catch(() => false);
  return run;
}

async function schedulePrayerAdhanInner(
  location: AdhanLocation | null,
  options: { days?: number } = {}
): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications || !location) return false;

  const prefs = await getUiPreferences();
  if (!prefs.adhanAlertsEnabled) {
    await cancelAllPrayerAdhan();
    return false;
  }

  const granted = await ensurePrayerNotificationPermission();
  if (!granted) return false;

  const days = options.days ?? 7;
  const now = new Date();
  const startDay = new Date(now);
  startDay.setHours(0, 0, 0, 0);

  // Plan-based signature (not affected by prayers already passed today), so we
  // only reschedule when the day, window, location or toggle actually changes.
  const signature = JSON.stringify({
    enabled: true,
    loc: locationKey(location),
    start: gregorianKey(startDay),
    days,
  });
  const previousSignature = await AsyncStorage.getItem(PRAYER_NOTIFICATION_SIGNATURE_KEY);
  if (previousSignature === signature) return true;

  // Gather the month calendars the window spans (usually 1, sometimes 2).
  const months = new Map<string, { year: number; month: number }>();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(startDay);
    d.setDate(d.getDate() + i);
    months.set(`${d.getFullYear()}-${d.getMonth() + 1}`, {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    });
  }
  const timingsByDate: Record<string, Record<string, string>> = {};
  for (const { year, month } of months.values()) {
    Object.assign(timingsByDate, await getMonthTimings(location, year, month));
  }
  if (!Object.keys(timingsByDate).length) return false;

  await ensureAdhanNotificationSetup();
  await cancelAllPrayerAdhan();

  const ids: string[] = [];
  for (let i = 0; i < days; i += 1) {
    const day = new Date(startDay);
    day.setDate(day.getDate() + i);
    const timings = timingsByDate[gregorianKey(day)];
    if (!timings) continue;

    for (const label of PRAYER_LABELS) {
      const time = normalizeTime(timings[label]);
      if (!time) continue;
      const target = parsePrayerDateTime(day, time);
      if (target.getTime() <= now.getTime()) continue;

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Adhan Time: ${label}`,
          body: `It's time for ${label} prayer.`,
          sound: ADHAN_SOUND,
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryIdentifier: ADHAN_CATEGORY,
          data: { type: 'adhan', prayer: label },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: target,
          channelId: PRAYER_CHANNEL_ID,
        },
      });
      ids.push(id);
    }
  }

  await AsyncStorage.setItem(PRAYER_NOTIFICATION_IDS_KEY, JSON.stringify(ids));
  await AsyncStorage.setItem(PRAYER_NOTIFICATION_SIGNATURE_KEY, signature);
  return true;
}

/**
 * Fire a one-off adhan after `delayMs` (used by the test button and Snooze).
 * In Expo Go it arms a navigation-independent foreground timer that rings the
 * in-app alarm (the app must stay open). On a dev/EAS build it schedules a real
 * notification, so it also fires when the app is backgrounded/closed. Returns
 * the expected epoch ms.
 */
export async function scheduleAdhanIn(delayMs: number, prayer = 'Prayer'): Promise<number> {
  const fireAt = Date.now() + delayMs;

  if (Constants.appOwnership === 'expo') {
    armForegroundAdhan(delayMs, prayer);
    return fireAt;
  }

  const Notifications = await getNotifications();
  if (!Notifications) return fireAt;
  const granted = await ensurePrayerNotificationPermission();
  if (!granted) return fireAt;
  await ensureAdhanNotificationSetup();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Adhan Time: ${prayer}`,
      body: `It's time for ${prayer} prayer.`,
      sound: ADHAN_SOUND,
      priority: Notifications.AndroidNotificationPriority.MAX,
      categoryIdentifier: ADHAN_CATEGORY,
      data: { type: 'adhan', prayer },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(fireAt),
      channelId: PRAYER_CHANNEL_ID,
    },
  });
  return fireAt;
}

/** One-minute test adhan (from Settings). */
export function scheduleTestAdhan(delayMs = 60_000) {
  return scheduleAdhanIn(delayMs, 'Test');
}

/** Snooze the current adhan: silence it now, ring again after `minutes`. */
export async function snoozeAdhan(prayer = 'Prayer', minutes = 5) {
  await stopAdhan();
  await scheduleAdhanIn(minutes * 60_000, prayer);
}

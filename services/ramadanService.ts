import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './http';
import { getMonthTimings, normalizeTime, parsePrayerDateTime, type PrayerLocation } from './prayerTimingUtils';
import { getTodayStr } from './prayerTrackerService';
import { AchievementManager } from '@/store/achievementStore';
import { useAuthStore } from '@/store/authStore';

const FASTING_LOGS_KEY = 'wedeen_fasting_logs_v1';
const RAMADAN_MODE_KEY = 'wedeen_ramadan_mode_v1';

export type FastingStatus = 'pending' | 'completed' | 'missed';

export type FastingLog = {
  date: string;
  status: FastingStatus;
  taraweehRakats: number;
  suhoorAt?: number | null;
  iftarAt?: number | null;
  notes?: string;
};

export async function getFastingLogs(): Promise<Record<string, FastingLog>> {
  const raw = await AsyncStorage.getItem(FASTING_LOGS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, FastingLog>;
  } catch {
    return {};
  }
}

export async function saveFastingLog(log: FastingLog, token?: string | null) {
  const { user } = useAuthStore.getState();
  const logs = await getFastingLogs();
  if (!user) return logs; // Strict gating: Do not save progress for guests

  logs[log.date] = log;
  await AsyncStorage.setItem(FASTING_LOGS_KEY, JSON.stringify(logs));
  if (log.status === 'completed') {
    AchievementManager.trackEvent('dev_ramadan_fast', 1).catch(() => undefined);
  }
  if (log.taraweehRakats > 0) {
    AchievementManager.trackEvent('dev_taraweeh', log.taraweehRakats).catch(() => undefined);
  }
  if (token) syncFastingLogs(token).catch(() => undefined);
  return logs;
}

export function calculateFastingStats(logs: Record<string, FastingLog>) {
  const completed = Object.values(logs).filter((log) => log.status === 'completed').length;
  const missed = Object.values(logs).filter((log) => log.status === 'missed').length;
  let streak = 0;
  const cursor = new Date();
  while (logs[getTodayStr(cursor)]?.status === 'completed') {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { completed, missed, streak };
}

export async function getSuhoorIftarTimes(location: PrayerLocation, date = new Date()) {
  const timings = await getMonthTimings(location, date.getFullYear(), date.getMonth() + 1);
  const key = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
  const day = timings[key];
  if (!day) return null;
  return {
    suhoorEndsAt: parsePrayerDateTime(date, normalizeTime(day.Fajr)),
    iftarAt: parsePrayerDateTime(date, normalizeTime(day.Maghrib)),
  };
}

export async function getRamadanMode() {
  return (await AsyncStorage.getItem(RAMADAN_MODE_KEY)) === 'true';
}

export async function setRamadanMode(value: boolean) {
  await AsyncStorage.setItem(RAMADAN_MODE_KEY, value ? 'true' : 'false');
}

export async function syncFastingLogs(token: string) {
  const logs = await getFastingLogs();
  const items = Object.values(logs);
  if (!items.length) return;
  await api.post('/sync/fasting', { items }, { headers: { Authorization: `Bearer ${token}` } });
}

export async function restoreFastingLogs(token: string) {
  const { data } = await api.get<{ items: FastingLog[] }>('/sync/fasting', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const logs = await getFastingLogs();
  for (const item of data.items ?? []) {
    logs[item.date] = item;
  }
  await AsyncStorage.setItem(FASTING_LOGS_KEY, JSON.stringify(logs));
  return logs;
}

export async function preloadRamadanFastingTimes(location: PrayerLocation) {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed

    // Fetch current month's timings (will automatically query API and save to AsyncStorage cache)
    await getMonthTimings(location, currentYear, currentMonth);

    // Fetch next month's timings to handle mid-month transitions smoothly
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    await getMonthTimings(location, nextYear, nextMonth);
  } catch (err) {
    console.error('Failed to pre-fetch Ramadan fasting times for offline cache:', err);
  }
}

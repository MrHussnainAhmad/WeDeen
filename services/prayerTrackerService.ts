import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './http';
import { getMonthTimings, type PrayerLabel } from './prayerTimingUtils';
import { AchievementManager } from '../store/achievementStore';

const SALAH_LOGS_KEY = 'wedeen_salah_logs_v2';
const SALAH_SYNC_QUEUE_KEY = 'wedeen_salah_sync_queue_v2';

export type SalahStatus = 'upcoming' | 'pending' | 'prayed' | 'missed';

export type SalahLogItem = {
  status: SalahStatus;
  timestamp?: number; // when marked prayed
};

export type DaySalahLog = Record<PrayerLabel, SalahLogItem>;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function getTodayStr(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parsePrayerMoment(dateStr: string, timeStr: string): Date {
  // dateStr is "YYYY-MM-DD" or "DD-MM-YYYY"
  // Let's check which format it is
  let year = 0, month = 0, day = 0;
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = Number(parts[0]);
      month = Number(parts[1]) - 1;
      day = Number(parts[2]);
    } else {
      // DD-MM-YYYY
      day = Number(parts[0]);
      month = Number(parts[1]) - 1;
      year = Number(parts[2]);
    }
  }
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(year, month, day);
  d.setHours(h, m, 0, 0);
  return d;
}

export async function getSalahLogs(): Promise<Record<string, DaySalahLog>> {
  try {
    const raw = await AsyncStorage.getItem(SALAH_LOGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveSalahLogs(logs: Record<string, DaySalahLog>) {
  await AsyncStorage.setItem(SALAH_LOGS_KEY, JSON.stringify(logs));
}

export async function updateSalahLogsState(location: any) {
  if (!location) return;
  const now = new Date();
  const logs = await getSalahLogs();
  
  // Update yesterday, today, and tomorrow
  const datesToUpdate = [];
  for (let i = -1; i <= 0; i++) {
    const d = new Date();
    d.setDate(now.getDate() + i);
    datesToUpdate.push(d);
  }

  const OBLIGATORY: PrayerLabel[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  for (const dateObj of datesToUpdate) {
    const dateKey = getTodayStr(dateObj); // YYYY-MM-DD
    const timingsKey = `${pad(dateObj.getDate())}-${pad(dateObj.getMonth() + 1)}-${dateObj.getFullYear()}`; // DD-MM-YYYY
    
    // Fetch month timings
    const timings = await getMonthTimings(location, dateObj.getFullYear(), dateObj.getMonth() + 1).catch(() => ({} as Record<string, Record<string, string>>));
    const dayTimings = timings[timingsKey];

    if (!dayTimings) continue;

    if (!logs[dateKey]) {
      logs[dateKey] = {} as DaySalahLog;
    }

    // Need tomorrow's Fajr for today's Isha end window
    const tomObj = new Date(dateObj);
    tomObj.setDate(tomObj.getDate() + 1);
    const tomTimingsKey = `${pad(tomObj.getDate())}-${pad(tomObj.getMonth() + 1)}-${tomObj.getFullYear()}`;
    const tomTimings = timings[tomTimingsKey] || {};
    const tomFajrStr = tomTimings['Fajr'] || '05:00';

    for (let idx = 0; idx < OBLIGATORY.length; idx++) {
      const prayer = OBLIGATORY[idx];
      const timeStr = dayTimings[prayer];
      if (!timeStr) continue;

      const currentItem = logs[dateKey][prayer] || { status: 'upcoming' };

      // Calculate start and end moments of the prayer window
      const startMoment = parsePrayerMoment(dateKey, timeStr);
      let endMoment: Date;

      if (prayer === 'Isha') {
        const tomFajrMoment = parsePrayerMoment(getTodayStr(tomObj), tomFajrStr);
        // Cutoff is 90 mins after Isha, or midnight, or tomorrow's Fajr (whichever is earlier)
        const ninetyMinsAfterIsha = new Date(startMoment.getTime() + 90 * 60 * 1000);
        
        const midnight = new Date(dateKey);
        midnight.setHours(23, 59, 59, 999);
        
        // Choose max of midnight or ninetyMinsAfterIsha
        const ishaCutoff = ninetyMinsAfterIsha.getTime() > midnight.getTime() ? ninetyMinsAfterIsha : midnight;
        
        // Ensure it doesn't extend past tomorrow's Fajr
        endMoment = ishaCutoff.getTime() < tomFajrMoment.getTime() ? ishaCutoff : tomFajrMoment;
      } else {
        const nextPrayer = OBLIGATORY[idx + 1];
        const nextTimeStr = dayTimings[nextPrayer];
        endMoment = parsePrayerMoment(dateKey, nextTimeStr);
      }

      const nowMs = now.getTime();
      const startMs = startMoment.getTime();
      const endMs = endMoment.getTime();

      if (currentItem.status === 'prayed') {
        // Stay prayed
        continue;
      }

      if (nowMs < startMs) {
        logs[dateKey][prayer] = { status: 'upcoming' };
      } else if (nowMs >= startMs && nowMs < endMs) {
        // Inside active window
        logs[dateKey][prayer] = { status: 'pending' };
      } else if (nowMs >= endMs) {
        // Window passed and not prayed
        logs[dateKey][prayer] = { status: 'missed' };
      }
    }
  }

  await saveSalahLogs(logs);
}

export async function markPrayerAsPrayed(
  prayer: PrayerLabel,
  dateKey: string,
  token?: string | null,
  userId?: string | null
) {
  const logs = await getSalahLogs();
  if (!logs[dateKey]) {
    logs[dateKey] = {} as DaySalahLog;
  }

  const prevItem = logs[dateKey][prayer];
  if (prevItem?.status === 'prayed') return;

  logs[dateKey][prayer] = {
    status: 'prayed',
    timestamp: Date.now(),
  };

  await saveSalahLogs(logs);

  try {
    const { exportPrayerWidgetSnapshots } = require('./prayerWidgetService');
    exportPrayerWidgetSnapshots().catch(() => undefined);
  } catch (e) {
    // Ignore circular import errors
  }

  // Track achievements
  AchievementManager.trackEvent('salah', 1).catch(() => undefined);

  // Check 100 and 500 total prayers
  let totalPrayed = 0;
  Object.values(logs).forEach((dayLog) => {
    Object.values(dayLog).forEach((item) => {
      if (item.status === 'prayed') totalPrayed++;
    });
  });
  if (totalPrayed >= 100) {
    AchievementManager.trackEvent('salah', totalPrayed).catch(() => undefined);
  }
  if (totalPrayed >= 500) {
    AchievementManager.trackEvent('salah', totalPrayed).catch(() => undefined);
  }

  // Check daily complete
  const obligatory: PrayerLabel[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const dayLog = logs[dateKey];
  const allPrayedToday = obligatory.every((p) => dayLog[p]?.status === 'prayed');
  if (allPrayedToday) {
    AchievementManager.trackEvent('salah', 1, 'daily_full').catch(() => undefined);
  }

  // Calculate streaks
  const streaks = calculateStreakStats(logs);
  if (streaks.streak > 0) {
    AchievementManager.trackEvent('salah', streaks.streak, 'salah_streak').catch(() => undefined);
  }
  if (streaks.fajrStreak > 0) {
    AchievementManager.trackEvent('salah', streaks.fajrStreak, 'fajr_streak').catch(() => undefined);
  }

  // Queue sync
  if (userId) {
    await queueSalahSync(userId, dateKey, prayer, 'prayed', Date.now());
    if (token) {
      syncSalahQueue(token, userId).catch(() => undefined);
    }
  }
}

export async function setPrayerStatus(
  prayer: PrayerLabel,
  dateKey: string,
  status: SalahStatus,
  token?: string | null,
  userId?: string | null
) {
  const logs = await getSalahLogs();
  if (!logs[dateKey]) {
    logs[dateKey] = {} as DaySalahLog;
  }

  logs[dateKey][prayer] = {
    status,
    timestamp: status === 'prayed' ? Date.now() : undefined,
  };

  await saveSalahLogs(logs);

  try {
    const { exportPrayerWidgetSnapshots } = require('./prayerWidgetService');
    exportPrayerWidgetSnapshots().catch(() => undefined);
  } catch (e) {
    // Ignore circular import errors
  }

  if (status === 'prayed') {
    AchievementManager.trackEvent('salah', 1).catch(() => undefined);
  }

  if (userId) {
    await queueSalahSync(userId, dateKey, prayer, status, Date.now());
    if (token) {
      syncSalahQueue(token, userId).catch(() => undefined);
    }
  }
}

export function calculateStreakStats(logs: Record<string, DaySalahLog>) {
  const sortedDates = Object.keys(logs).sort().reverse(); // newest first
  let streak = 0;
  let maxStreak = 0;
  let fajrStreak = 0;
  let maxFajrStreak = 0;

  const obligatory: PrayerLabel[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  // 1. Calculate current streaks
  let streakBroken = false;
  let fajrStreakBroken = false;
  
  // We can scan chronologically to find best and current streaks
  const chronoDates = Object.keys(logs).sort(); // oldest first
  let currentStreak = 0;
  let bestStreak = 0;
  let currentFajrStreak = 0;
  let bestFajrStreak = 0;

  for (const d of chronoDates) {
    const dayLog = logs[d];
    
    // Check all 5
    const allPrayed = obligatory.every(p => dayLog[p]?.status === 'prayed');
    if (allPrayed) {
      currentStreak++;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
    } else {
      currentStreak = 0;
    }

    // Check Fajr
    const fajrPrayed = dayLog['Fajr']?.status === 'prayed';
    if (fajrPrayed) {
      currentFajrStreak++;
      if (currentFajrStreak > bestFajrStreak) bestFajrStreak = currentFajrStreak;
    } else {
      currentFajrStreak = 0;
    }
  }

  // Active current streak checking (ending today or yesterday)
  const todayStr = getTodayStr(new Date());
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = getTodayStr(yesterdayObj);

  // Check if today or yesterday is completed to find active streak
  let activeStreak = 0;
  let checkObj = new Date();
  
  // First, check if check date is all completed. If not today, check yesterday.
  let startCheckStr = getTodayStr(checkObj);
  let startAll = obligatory.every(p => logs[startCheckStr]?.[p]?.status === 'prayed');
  if (!startAll) {
    checkObj.setDate(checkObj.getDate() - 1);
    startCheckStr = getTodayStr(checkObj);
    startAll = obligatory.every(p => logs[startCheckStr]?.[p]?.status === 'prayed');
  }

  if (startAll) {
    while (true) {
      const checkStr = getTodayStr(checkObj);
      const dayAll = obligatory.every(p => logs[checkStr]?.[p]?.status === 'prayed');
      if (dayAll) {
        activeStreak++;
        checkObj.setDate(checkObj.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Active Fajr streak
  let activeFajrStreak = 0;
  let fajrCheckObj = new Date();
  let startFajrCheckStr = getTodayStr(fajrCheckObj);
  let startFajr = logs[startFajrCheckStr]?.['Fajr']?.status === 'prayed';
  if (!startFajr) {
    fajrCheckObj.setDate(fajrCheckObj.getDate() - 1);
    startFajrCheckStr = getTodayStr(fajrCheckObj);
    startFajr = logs[startFajrCheckStr]?.['Fajr']?.status === 'prayed';
  }

  if (startFajr) {
    while (true) {
      const checkStr = getTodayStr(fajrCheckObj);
      const fajrPrayed = logs[checkStr]?.['Fajr']?.status === 'prayed';
      if (fajrPrayed) {
        activeFajrStreak++;
        fajrCheckObj.setDate(fajrCheckObj.getDate() - 1);
      } else {
        break;
      }
    }
  }

  return {
    streak: activeStreak,
    bestStreak: bestStreak,
    fajrStreak: activeFajrStreak,
    bestFajrStreak: bestFajrStreak,
  };
}

async function queueSalahSync(userId: string, date: string, prayer: PrayerLabel, status: SalahStatus, timestamp: number) {
  const queueKey = `${SALAH_SYNC_QUEUE_KEY}_${userId}`;
  try {
    const raw = await AsyncStorage.getItem(queueKey);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({ date, prayerName: prayer, status, prayedAt: timestamp });
    await AsyncStorage.setItem(queueKey, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export async function syncSalahQueue(token: string, userId: string) {
  const queueKey = `${SALAH_SYNC_QUEUE_KEY}_${userId}`;
  try {
    const raw = await AsyncStorage.getItem(queueKey);
    if (!raw) return;
    const queue = JSON.parse(raw) as any[];
    if (queue.length === 0) return;

    await api.post('/sync/salah', { items: queue }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    await AsyncStorage.removeItem(queueKey);
  } catch (err) {
    console.error('Failed to sync salah queue:', err);
  }
}

export async function restoreSalahHistory(token: string) {
  try {
    const { data } = await api.get<{ items: { date: string; prayerName: PrayerLabel; status: SalahStatus; prayedAt?: number }[] }>('/sync/salah', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (data && Array.isArray(data.items)) {
      const logs = await getSalahLogs();
      for (const item of data.items) {
        if (!logs[item.date]) {
          logs[item.date] = {} as DaySalahLog;
        }
        // Restore if server has a prayed status or newer info
        const existing = logs[item.date][item.prayerName];
        if (!existing || existing.status !== 'prayed' || (item.status === 'prayed' && item.prayedAt)) {
          logs[item.date][item.prayerName] = {
            status: item.status,
            timestamp: item.prayedAt,
          };
        }
      }
      await saveSalahLogs(logs);
    }
  } catch (err) {
    console.error('Failed to restore salah history:', err);
  }
}

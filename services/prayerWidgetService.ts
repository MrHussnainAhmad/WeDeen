import * as FileSystem from 'expo-file-system/legacy';
import { getSavedLocation } from './locationService';
import {
  getMonthTimings,
  normalizeTime,
  parsePrayerDateTime,
  PRAYER_LABELS,
  type PrayerLabel,
} from './prayerTimingUtils';
import {
  getSalahLogs,
  getTodayStr,
  markPrayerAsPrayed,
  type SalahStatus,
} from './prayerTrackerService';
import { getPrayerSchoolLabel, getPrayerTimingApiParams, getUiPreferences } from '@/utils/preferences';

export type PrayerWidgetSize = 'small' | 'medium' | 'large';

export type PrayerWidgetPrayer = {
  label: PrayerLabel;
  time: string;
  status: SalahStatus;
  isCurrent: boolean;
  isNext: boolean;
};

export type PrayerWidgetSnapshot = {
  size: PrayerWidgetSize;
  locationName: string | null;
  methodName: string;
  schoolName: string;
  generatedAt: number;
  currentTime: string;
  currentPrayer: PrayerWidgetPrayer | null;
  nextPrayer: PrayerWidgetPrayer | null;
  timeRemainingText: string;
  progress: number;
  prayers: PrayerWidgetPrayer[];
  canMarkCurrent: boolean;
};

const WIDGET_EXPORT_PATH = `${FileSystem.documentDirectory}prayer_widget_v2.json`;

const METHOD_NAMES: Record<number, string> = {
  0: 'Jafari',
  1: 'Karachi',
  2: 'ISNA',
  3: 'MWL',
  4: 'Makkah',
  5: 'Egyptian',
  7: 'Tehran',
  13: 'Diyanet',
  15: 'Russia',
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatClock(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatRemaining(target: Date, now: Date) {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return 'Now';
  const mins = Math.ceil(diffMs / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function locationName(location: Awaited<ReturnType<typeof getSavedLocation>>) {
  if (!location) return null;
  if (location.city && location.country) return `${location.city}, ${location.country}`;
  if (location.latitude != null && location.longitude != null) {
    return `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`;
  }
  return null;
}

function statusFor(
  label: PrayerLabel,
  dateKey: string,
  logs: Awaited<ReturnType<typeof getSalahLogs>>
): SalahStatus {
  return logs[dateKey]?.[label]?.status ?? 'upcoming';
}

export async function buildPrayerWidgetSnapshot(
  size: PrayerWidgetSize = 'medium',
  now = new Date()
): Promise<PrayerWidgetSnapshot | null> {
  const location = await getSavedLocation();
  if (!location) return null;

  const prefs = await getUiPreferences();
  const timings = await getMonthTimings(location, now.getFullYear(), now.getMonth() + 1);
  const apiKey = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
  const dayTimings = timings[apiKey];
  if (!dayTimings) return null;

  const dateKey = getTodayStr(now);
  const logs = await getSalahLogs();
  const moments = PRAYER_LABELS.map((label) => ({
    label,
    time: normalizeTime(dayTimings[label]),
  }))
    .filter((entry) => entry.time)
    .map((entry) => ({
      ...entry,
      moment: parsePrayerDateTime(now, entry.time),
    }));

  if (!moments.length) return null;

  const nowMs = now.getTime();
  let nextIndex = moments.findIndex((entry) => entry.moment.getTime() >= nowMs);
  if (nextIndex < 0) nextIndex = 0;

  const currentIndex =
    moments[nextIndex]?.moment.getTime() > nowMs
      ? Math.max(0, nextIndex - 1)
      : nextIndex;
  const currentMoment = moments[currentIndex] ?? null;
  const nextMoment = moments[nextIndex] ?? moments[0];
  const endMoment =
    moments[currentIndex + 1]?.moment ??
    new Date(moments[0].moment.getTime() + 24 * 60 * 60 * 1000);

  const progress =
    currentMoment && endMoment.getTime() > currentMoment.moment.getTime()
      ? Math.max(
          0,
          Math.min(
            1,
            (nowMs - currentMoment.moment.getTime()) /
              (endMoment.getTime() - currentMoment.moment.getTime())
          )
        )
      : 0;

  const prayers: PrayerWidgetPrayer[] = moments.map((entry, index) => ({
    label: entry.label,
    time: entry.time,
    status: statusFor(entry.label, dateKey, logs),
    isCurrent: index === currentIndex,
    isNext: index === nextIndex,
  }));

  const currentPrayer = prayers.find((p) => p.isCurrent) ?? null;
  const nextPrayer = prayers.find((p) => p.isNext) ?? prayers[0] ?? null;
  const prayerTimingParams = getPrayerTimingApiParams(
    prefs.madhab,
    prefs.calculationMethodId
  );

  return {
    size,
    locationName: locationName(location),
    methodName: METHOD_NAMES[prayerTimingParams.methodId] ?? 'Custom',
    schoolName: getPrayerSchoolLabel(prefs.madhab),
    generatedAt: Date.now(),
    currentTime: formatClock(now),
    currentPrayer,
    nextPrayer,
    timeRemainingText: nextMoment ? formatRemaining(nextMoment.moment, now) : '',
    progress,
    prayers: size === 'small' ? prayers.filter((p) => p.isCurrent || p.isNext).slice(0, 2) : prayers,
    canMarkCurrent: !!currentPrayer && currentPrayer.status !== 'prayed',
  };
}

export async function exportPrayerWidgetSnapshots() {
  const [small, medium, large] = await Promise.all([
    buildPrayerWidgetSnapshot('small'),
    buildPrayerWidgetSnapshot('medium'),
    buildPrayerWidgetSnapshot('large'),
  ]);
  const payload = {
    version: 2,
    lastUpdated: Date.now(),
    sizes: { small, medium, large },
  };
  await FileSystem.writeAsStringAsync(WIDGET_EXPORT_PATH, JSON.stringify(payload));
  return payload;
}

export async function markWidgetPrayerAsPrayed(
  prayer?: PrayerLabel,
  token?: string | null,
  userId?: string | null
) {
  const snapshot = await buildPrayerWidgetSnapshot('medium');
  const target = prayer ?? snapshot?.currentPrayer?.label;
  if (!target) return false;
  await markPrayerAsPrayed(target, getTodayStr(), token, userId);
  await exportPrayerWidgetSnapshots().catch(() => undefined);
  return true;
}

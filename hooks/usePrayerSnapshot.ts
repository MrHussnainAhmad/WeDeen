import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { schedulePrayerAdhan } from '@/services/prayerNotificationService';

/**
 * Lightweight prayer-time snapshot for the Home screen.
 *
 * Deliberately shares the same storage keys, Aladhan endpoint (method=2) and
 * per-day cache strategy used by the Timings tab, so the "next prayer" shown on
 * Home always agrees with the full schedule and we never double-fetch.
 */

type SavedLocation = {
  mode: 'coords' | 'city';
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  locked: boolean;
};

export type PrayerKey = 'Fajr' | 'Sunrise' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export type PrayerEntry = {
  key: PrayerKey;
  /** "HH:mm" 24h string, or '--:--' when unavailable. */
  time: string;
};

const LOCATION_KEY = 'timings_location_v1';
const TIMINGS_CACHE_PREFIX = 'timings_cache_v1_';

// Order used to find the upcoming prayer. Sunrise is tracked for the timeline
// but excluded from the "next obligatory prayer" calculation.
const SEQUENCE: PrayerKey[] = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const OBLIGATORY: PrayerKey[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalizeTime(raw?: string) {
  return (raw || '').slice(0, 5);
}

function getLocationCacheKey(loc: SavedLocation) {
  if (loc.mode === 'coords' && loc.latitude && loc.longitude) {
    return `coords_${loc.latitude.toFixed(4)}_${loc.longitude.toFixed(4)}`;
  }
  return `city_${(loc.city || '').toLowerCase()}_${(loc.country || '').toLowerCase()}`;
}

async function getSavedLocation(): Promise<SavedLocation | null> {
  const raw = await AsyncStorage.getItem(LOCATION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedLocation;
  } catch {
    return null;
  }
}

async function saveLocation(loc: SavedLocation) {
  await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
}

function parsePrayerMoment(time: string, day: Date) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(day);
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

export function formatPrayerTime(value: string, use24HourTime: boolean) {
  if (!value || value === '--:--') return '--:--';
  if (use24HourTime) return value;
  const [hRaw, mRaw] = value.split(':');
  const hours = Number(hRaw);
  const mins = Number(mRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return value;
  const period = hours >= 12 ? 'PM' : 'AM';
  const converted = hours % 12 || 12;
  return `${converted}:${pad(mins)} ${period}`;
}

type TimingsPayload = {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
};

/**
 * Resolves the user's saved location (without prompting). The Home widget stays
 * passive — it shows a gentle "enable" prompt instead of demanding permission,
 * and only requests it when the user taps via `enableLocation()`.
 */
export function usePrayerSnapshot(nowTick: number) {
  const [location, setLocation] = useState<SavedLocation | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    let mounted = true;
    getSavedLocation()
      .then((saved) => {
        if (!mounted) return;
        if (saved) setLocation(saved);
      })
      .finally(() => {
        if (mounted) setLocationReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const enableLocation = useCallback(async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setPermissionDenied(true);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const geo = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const loc: SavedLocation = {
        mode: 'coords',
        city: geo?.[0]?.city || geo?.[0]?.subregion || 'Unknown City',
        country: geo?.[0]?.country || 'Unknown Country',
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        locked: false,
      };
      await saveLocation(loc);
      setLocation(loc);
      setPermissionDenied(false);
      // Arm the adhan alarms immediately so users who enable location from Home
      // (and never open the Timings tab) still get prayer alerts.
      schedulePrayerAdhan(loc).catch(() => undefined);
    } catch {
      setPermissionDenied(true);
    }
  }, []);

  const timingsQuery = useQuery({
    queryKey: [
      'home-prayer-timings',
      location?.mode,
      location?.city,
      location?.country,
      location?.latitude,
      location?.longitude,
      todayKey(),
    ],
    enabled: !!location,
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<TimingsPayload | null> => {
      if (!location) return null;
      const date = `${pad(new Date().getDate())}-${pad(new Date().getMonth() + 1)}-${new Date().getFullYear()}`;
      const cacheKey = `${TIMINGS_CACHE_PREFIX}${todayKey()}_${getLocationCacheKey(location)}`;
      const url =
        location.mode === 'coords' && location.latitude && location.longitude
          ? `https://api.aladhan.com/v1/timings/${date}?latitude=${location.latitude}&longitude=${location.longitude}&method=2`
          : `https://api.aladhan.com/v1/timingsByCity/${date}?city=${encodeURIComponent(location.city)}&country=${encodeURIComponent(location.country)}&method=2`;

      try {
        const res = await fetch(url);
        const json = await res.json();
        const t = json?.data?.timings || {};
        return {
          fajr: normalizeTime(t.Fajr),
          sunrise: normalizeTime(t.Sunrise),
          dhuhr: normalizeTime(t.Dhuhr),
          asr: normalizeTime(t.Asr),
          maghrib: normalizeTime(t.Maghrib),
          isha: normalizeTime(t.Isha),
        };
      } catch {
        // Fall back to whatever the Timings tab last cached for today.
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            return {
              fajr: parsed.fajr ?? '--:--',
              sunrise: parsed.sunrise ?? '--:--',
              dhuhr: parsed.dhuhr ?? '--:--',
              asr: parsed.asr ?? '--:--',
              maghrib: parsed.maghrib ?? '--:--',
              isha: parsed.isha ?? '--:--',
            };
          } catch {
            // ignore corrupt cache
          }
        }
        throw new Error('Unable to load prayer timings.');
      }
    },
  });

  const entries: PrayerEntry[] = useMemo(() => {
    const d = timingsQuery.data;
    return [
      { key: 'Fajr', time: d?.fajr ?? '--:--' },
      { key: 'Sunrise', time: d?.sunrise ?? '--:--' },
      { key: 'Dhuhr', time: d?.dhuhr ?? '--:--' },
      { key: 'Asr', time: d?.asr ?? '--:--' },
      { key: 'Maghrib', time: d?.maghrib ?? '--:--' },
      { key: 'Isha', time: d?.isha ?? '--:--' },
    ];
  }, [timingsQuery.data]);

  // Next obligatory prayer + the window we're currently inside, with progress.
  const schedule = useMemo(() => {
    const data = timingsQuery.data;
    if (!data) {
      return { next: null, current: null, progress: 0, msToNext: 0 };
    }
    const now = new Date(nowTick);

    const moments = OBLIGATORY.map((key) => {
      const time = (data as any)[key.toLowerCase()] as string;
      return { key, time, at: parsePrayerMoment(time, now) };
    }).filter((m) => m.time && m.time !== '--:--');

    if (!moments.length) {
      return { next: null, current: null, progress: 0, msToNext: 0 };
    }

    let nextIdx = moments.findIndex((m) => m.at.getTime() > now.getTime());

    // After Isha → next is tomorrow's Fajr; "current" window is Isha.
    if (nextIdx === -1) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const fajrTomorrow = parsePrayerMoment(moments[0].time, tomorrow);
      const ishaToday = moments[moments.length - 1];
      const windowMs = fajrTomorrow.getTime() - ishaToday.at.getTime();
      const elapsed = now.getTime() - ishaToday.at.getTime();
      return {
        next: { key: moments[0].key, time: moments[0].time, at: fajrTomorrow, tomorrow: true },
        current: { key: ishaToday.key, time: ishaToday.time },
        progress: windowMs > 0 ? Math.min(1, Math.max(0, elapsed / windowMs)) : 0,
        msToNext: fajrTomorrow.getTime() - now.getTime(),
      };
    }

    const next = moments[nextIdx];
    const prev = nextIdx > 0 ? moments[nextIdx - 1] : null;

    let progress = 0;
    if (prev) {
      const windowMs = next.at.getTime() - prev.at.getTime();
      const elapsed = now.getTime() - prev.at.getTime();
      progress = windowMs > 0 ? Math.min(1, Math.max(0, elapsed / windowMs)) : 0;
    } else {
      // Before Fajr — count down within the pre-dawn window from yesterday's Isha.
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const ishaYesterday = parsePrayerMoment(
        (data as any).isha as string,
        yesterday
      );
      const windowMs = next.at.getTime() - ishaYesterday.getTime();
      const elapsed = now.getTime() - ishaYesterday.getTime();
      progress = windowMs > 0 ? Math.min(1, Math.max(0, elapsed / windowMs)) : 0;
    }

    return {
      next: { key: next.key, time: next.time, at: next.at, tomorrow: false },
      current: prev ? { key: prev.key, time: prev.time } : null,
      progress,
      msToNext: next.at.getTime() - now.getTime(),
    };
  }, [timingsQuery.data, nowTick]);

  return {
    location,
    locationReady,
    hasLocation: !!location,
    permissionDenied,
    enableLocation,
    entries,
    schedule,
    isLoading: timingsQuery.isLoading,
    isFetching: timingsQuery.isFetching,
    isError: timingsQuery.isError,
    refetch: timingsQuery.refetch,
  };
}

export function formatCountdown(ms: number) {
  if (ms <= 0) return { h: 0, m: 0, s: 0, label: 'Now' };
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const label = h > 0 ? `${h}h ${pad(m)}m` : `${m}m ${pad(s)}s`;
  return { h, m, s, label };
}

export { SEQUENCE };

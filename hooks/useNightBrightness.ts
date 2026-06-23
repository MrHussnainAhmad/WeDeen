import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Brightness from 'expo-brightness';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  getMonthTimings,
  gregorianKey,
  normalizeTime,
  parsePrayerDateTime,
  type PrayerLocation,
} from '@/services/prayerTimingUtils';
import { getUiPreferences } from '@/utils/preferences';

const LOCATION_KEY = 'timings_location_v1';
const MIN_BRIGHTNESS = 0.3;
const NIGHT_FALLBACK_HOUR = 19;
const NIGHT_END_HOUR = 6;
const LERP_INTERVAL_MS = 30_000;

async function loadLocation(): Promise<PrayerLocation | null> {
  const raw = await AsyncStorage.getItem(LOCATION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PrayerLocation;
  } catch {
    return null;
  }
}

async function getMaghribTime(day: Date, loc: PrayerLocation | null): Promise<Date | null> {
  if (!loc) return null;
  try {
    const timingsByDate = await getMonthTimings(loc, day.getFullYear(), day.getMonth() + 1);
    const timings = timingsByDate[gregorianKey(day)];
    const maghribRaw = normalizeTime(timings?.Maghrib);
    if (!maghribRaw) return null;
    return parsePrayerDateTime(day, maghribRaw);
  } catch {
    return null;
  }
}

export async function isNighttime(now = new Date()): Promise<boolean> {
  const hour = now.getHours();
  if (hour < NIGHT_END_HOUR) return true;

  const loc = await loadLocation();
  const maghrib = await getMaghribTime(now, loc);
  if (maghrib) return now >= maghrib;

  return hour >= NIGHT_FALLBACK_HOUR;
}

/** Target brightness based on how far into the night window we are (0..1). */
export async function getNightBrightnessTarget(now = new Date()): Promise<number> {
  const loc = await loadLocation();
  const maghrib = (await getMaghribTime(now, loc)) ?? (() => {
    const d = new Date(now);
    d.setHours(NIGHT_FALLBACK_HOUR, 0, 0, 0);
    return d;
  })();

  const nightEnd = new Date(now);
  nightEnd.setHours(NIGHT_END_HOUR, 0, 0, 0);
  if (nightEnd <= now) nightEnd.setDate(nightEnd.getDate() + 1);

  let nightStart = maghrib;
  if (now.getHours() < NIGHT_END_HOUR) {
    nightStart = (await getMaghribTime(new Date(now.getTime() - 86_400_000), loc)) ?? (() => {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      d.setHours(NIGHT_FALLBACK_HOUR, 0, 0, 0);
      return d;
    })();
  }

  const span = Math.max(nightEnd.getTime() - nightStart.getTime(), 1);
  const progress = Math.min(Math.max((now.getTime() - nightStart.getTime()) / span, 0), 1);
  const systemBrightness = await Brightness.getBrightnessAsync().catch(() => 1);
  const floor = Math.min(MIN_BRIGHTNESS, systemBrightness);
  return systemBrightness - (systemBrightness - floor) * progress;
}

/**
 * Lowers screen brightness at night while the app is foregrounded;
 * restores the saved level when backgrounded.
 */
export function useNightBrightness() {
  const savedBrightness = useRef<number | null>(null);
  const lerpTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const active = useRef(false);

  useEffect(() => {
    let mounted = true;

    const clearLerp = () => {
      if (lerpTimer.current) {
        clearInterval(lerpTimer.current);
        lerpTimer.current = null;
      }
    };

    const restoreBrightness = async () => {
      clearLerp();
      if (savedBrightness.current != null) {
        await Brightness.setBrightnessAsync(savedBrightness.current).catch(() => undefined);
        savedBrightness.current = null;
      }
      active.current = false;
    };

    const applyNightBrightness = async () => {
      const prefs = await getUiPreferences();
      if (!prefs.nightBrightnessEnabled) {
        await restoreBrightness();
        return;
      }

      const night = await isNighttime();
      if (!night) {
        await restoreBrightness();
        return;
      }

      if (savedBrightness.current == null) {
        const current = await Brightness.getBrightnessAsync().catch(() => null);
        if (current != null) savedBrightness.current = current;
      }

      const target = await getNightBrightnessTarget();
      const current = await Brightness.getBrightnessAsync().catch(() => target);
      const next = current + (target - current) * 0.35;
      await Brightness.setBrightnessAsync(next).catch(() => undefined);
      active.current = true;
    };

    const startLerpIfNeeded = () => {
      clearLerp();
      lerpTimer.current = setInterval(() => {
        applyNightBrightness().catch(() => undefined);
      }, LERP_INTERVAL_MS);
    };

    const onAppState = async (state: AppStateStatus) => {
      if (!mounted) return;
      if (state === 'active') {
        await applyNightBrightness();
        startLerpIfNeeded();
      } else {
        await restoreBrightness();
      }
    };

    applyNightBrightness()
      .then(() => {
        if (mounted && AppState.currentState === 'active') startLerpIfNeeded();
      })
      .catch(() => undefined);

    const sub = AppState.addEventListener('change', onAppState);
    return () => {
      mounted = false;
      sub.remove();
      restoreBrightness().catch(() => undefined);
    };
  }, []);
}

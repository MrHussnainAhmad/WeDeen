import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { isPrayerLocationConfigured } from './prayerTimingUtils';
import { schedulePrayerAdhan } from './prayerNotificationService';

// Shared with the Timings tab / Home widget. Location lives only on-device.
const LOCATION_KEY = 'timings_location_v1';

// Only update + reschedule when the user has actually moved a meaningful
// distance, so a few hundred metres of GPS drift never rebuilds the schedule.
const MOVE_THRESHOLD_KM = 20;

export type SavedLocation = {
  mode: 'coords' | 'city';
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  locked: boolean;
};

export async function getSavedLocation(): Promise<SavedLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_KEY);
    return raw ? (JSON.parse(raw) as SavedLocation) : null;
  } catch {
    return null;
  }
}

export async function hasPrayerLocationConfigured() {
  return isPrayerLocationConfigured(await getSavedLocation());
}

export async function saveLocation(loc: SavedLocation) {
  await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * If location is already granted, read the current position and — when the user
 * has moved past the threshold (or there's no saved location yet) — update the
 * saved location and reschedule the adhan. Never prompts; safe to call on launch
 * and from the background task. Returns true if the location was updated.
 */
export async function maybeRefreshLocation(): Promise<boolean> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return false;

    const saved = await getSavedLocation();
    // Respect a manual pin: if the user locked the timings to a chosen city,
    // never override it with GPS.
    if (saved?.locked) return false;

    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude, longitude } = pos.coords;

    if (
      saved?.latitude != null &&
      saved?.longitude != null &&
      distanceKm(saved.latitude, saved.longitude, latitude, longitude) < MOVE_THRESHOLD_KM
    ) {
      return false; // still in the same area
    }

    let city = saved?.city || 'Unknown City';
    let country = saved?.country || 'Unknown Country';
    try {
      const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
      city = geo?.[0]?.city || geo?.[0]?.subregion || city;
      country = geo?.[0]?.country || country;
    } catch {
      // keep previous names; coords are what actually drive the timings
    }

    const next: SavedLocation = {
      mode: 'coords',
      city,
      country,
      latitude,
      longitude,
      locked: false,
    };
    await saveLocation(next);
    await schedulePrayerAdhan(next).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

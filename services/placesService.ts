import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { api } from './http';
import { AchievementManager } from '@/store/achievementStore';

const PLACES_CACHE_KEY = 'wedeen_places_last_results_v1';
const PLACE_FAVORITES_KEY = 'wedeen_place_favorites_v1';

export type PlaceType = 'mosque' | 'restaurant' | 'prayer_space';

export type PlaceSearchFilters = {
  halalCertified: boolean;
  hasPrayerSpace: boolean;
  openNow: boolean;
};

export type WedeenPlace = {
  placeId: string;
  name: string;
  type: PlaceType;
  latitude: number;
  longitude: number;
  address: string;
  distanceKm: number;
  rating: number | null;
  hasPrayerSpace: boolean;
  halalCertified: boolean;
  openNow: boolean;
  savedAt?: number;
};

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

async function resolveManualCity(city: string) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}`,
    {
      headers: {
        'User-Agent': 'MuslimDeenQuranPrayerApp/1.0',
      },
    }
  );
  const json = await response.json();
  const first = Array.isArray(json) ? json[0] : null;
  if (!first) throw new Error('CITY_NOT_FOUND');
  return {
    latitude: Number(first.lat),
    longitude: Number(first.lon),
    label: first.display_name as string,
  };
}

async function resolveCurrentLocation() {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') throw new Error('LOCATION_DENIED');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    label: 'Current location',
  };
}

function overpassQuery(latitude: number, longitude: number) {
  return `
    [out:json][timeout:18];
    (
      node["amenity"="place_of_worship"]["religion"="muslim"](around:6000,${latitude},${longitude});
      way["amenity"="place_of_worship"]["religion"="muslim"](around:6000,${latitude},${longitude});
      node["amenity"="restaurant"]["halal"](around:6000,${latitude},${longitude});
      way["amenity"="restaurant"]["halal"](around:6000,${latitude},${longitude});
      node["amenity"="restaurant"]["cuisine"~"halal|pakistani|turkish|arab|indian",i](around:6000,${latitude},${longitude});
      way["amenity"="restaurant"]["cuisine"~"halal|pakistani|turkish|arab|indian",i](around:6000,${latitude},${longitude});
    );
    out center tags;
  `;
}

function normalizePlace(item: any, originLat: number, originLon: number): WedeenPlace | null {
  const tags = item?.tags ?? {};
  const latitude = Number(item.lat ?? item.center?.lat);
  const longitude = Number(item.lon ?? item.center?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const isMosque = tags.amenity === 'place_of_worship' || tags.religion === 'muslim';
  const halalCertified =
    String(tags.halal || '').toLowerCase() === 'yes' ||
    String(tags['diet:halal'] || '').toLowerCase() === 'yes';
  const hasPrayerSpace = isMosque || String(tags.prayer_room || '').toLowerCase() === 'yes';
  const type: PlaceType = isMosque ? 'mosque' : hasPrayerSpace ? 'prayer_space' : 'restaurant';
  return {
    placeId: `${item.type}_${item.id}`,
    name: tags.name || (isMosque ? 'Mosque / Prayer Space' : 'Halal restaurant'),
    type,
    latitude,
    longitude,
    address: [tags['addr:street'], tags['addr:city']].filter(Boolean).join(', ') || tags.name || '',
    distanceKm: distanceKm(originLat, originLon, latitude, longitude),
    rating: null,
    hasPrayerSpace,
    halalCertified,
    openNow: String(tags.opening_hours || '').toLowerCase() !== 'closed',
  };
}

export async function searchNearbyPlaces(options: {
  city?: string;
  filters: PlaceSearchFilters;
}): Promise<WedeenPlace[]> {
  const origin = options.city?.trim()
    ? await resolveManualCity(options.city.trim())
    : await resolveCurrentLocation();

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'User-Agent': 'MuslimDeenQuranPrayerApp/1.0',
      },
      body: overpassQuery(origin.latitude, origin.longitude),
    });
    const json = await response.json();
    const places = (json?.elements ?? [])
      .map((item: any) => normalizePlace(item, origin.latitude, origin.longitude))
      .filter(Boolean) as WedeenPlace[];
    const filtered = applyPlaceFilters(places, options.filters).sort((a, b) => a.distanceKm - b.distanceKm);
    await AsyncStorage.setItem(PLACES_CACHE_KEY, JSON.stringify(filtered));
    AchievementManager.trackEvent('dev_places', 1).catch(() => undefined);
    return filtered;
  } catch {
    return getCachedPlaces(options.filters);
  }
}

export function applyPlaceFilters(places: WedeenPlace[], filters: PlaceSearchFilters) {
  return places.filter((place) => {
    if (filters.halalCertified && !place.halalCertified) return false;
    if (filters.hasPrayerSpace && !place.hasPrayerSpace) return false;
    if (filters.openNow && !place.openNow) return false;
    return true;
  });
}

export async function getCachedPlaces(filters?: PlaceSearchFilters) {
  const raw = await AsyncStorage.getItem(PLACES_CACHE_KEY);
  if (!raw) return [];
  try {
    const places = JSON.parse(raw) as WedeenPlace[];
    return filters ? applyPlaceFilters(places, filters) : places;
  } catch {
    return [];
  }
}

export async function getFavoritePlaces(): Promise<WedeenPlace[]> {
  const raw = await AsyncStorage.getItem(PLACE_FAVORITES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as WedeenPlace[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function toggleFavoritePlace(place: WedeenPlace, token?: string | null) {
  const favorites = await getFavoritePlaces();
  const exists = favorites.some((item) => item.placeId === place.placeId);
  const next = exists
    ? favorites.filter((item) => item.placeId !== place.placeId)
    : [{ ...place, savedAt: Date.now() }, ...favorites].slice(0, 100);
  await AsyncStorage.setItem(PLACE_FAVORITES_KEY, JSON.stringify(next));
  if (token) syncFavoritePlaces(token).catch(() => undefined);
  return { favorites: next, favorite: !exists };
}

export async function syncFavoritePlaces(token: string) {
  const items = await getFavoritePlaces();
  if (!items.length) return;
  await api.post('/sync/place-favorites', { items }, { headers: { Authorization: `Bearer ${token}` } });
}

export async function restoreFavoritePlaces(token: string) {
  const { data } = await api.get<{ items: WedeenPlace[] }>('/sync/place-favorites', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const local = await getFavoritePlaces();
  const merged = new Map<string, WedeenPlace>();
  for (const item of [...local, ...(data.items ?? [])]) merged.set(item.placeId, item);
  const list = Array.from(merged.values());
  await AsyncStorage.setItem(PLACE_FAVORITES_KEY, JSON.stringify(list));
  return list;
}

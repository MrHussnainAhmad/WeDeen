import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './http';
import { useAuthStore } from '@/store/authStore';

const STORAGE_KEY = 'wedeen_favorite_ayahs_v1';
const MAX_FAVORITES = 100;

export type FavoriteAyah = {
  surahNumber: number;
  surahNameEnglish: string;
  surahNameArabic?: string;
  ayahNumber: number;
  arabicText: string;
  savedAt: number;
};

function key(surahNumber: number, ayahNumber: number) {
  return `${surahNumber}:${ayahNumber}`;
}

export async function getFavoriteAyahs(): Promise<FavoriteAyah[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as FavoriteAyah[];
    return Array.isArray(list)
      ? list.sort((a, b) => b.savedAt - a.savedAt)
      : [];
  } catch {
    return [];
  }
}

export async function isAyahFavorite(surahNumber: number, ayahNumber: number): Promise<boolean> {
  const list = await getFavoriteAyahs();
  return list.some((f) => f.surahNumber === surahNumber && f.ayahNumber === ayahNumber);
}

export async function getFavoriteAyahKeys(): Promise<Set<string>> {
  const list = await getFavoriteAyahs();
  return new Set(list.map((f) => key(f.surahNumber, f.ayahNumber)));
}

export async function addFavoriteAyah(entry: Omit<FavoriteAyah, 'savedAt'>): Promise<FavoriteAyah[]> {
  const list = await getFavoriteAyahs();
  const exists = list.some(
    (f) => f.surahNumber === entry.surahNumber && f.ayahNumber === entry.ayahNumber
  );
  if (exists) return list;

  const next: FavoriteAyah = { ...entry, savedAt: Date.now() };
  const merged = [next, ...list].slice(0, MAX_FAVORITES);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

export async function removeFavoriteAyah(surahNumber: number, ayahNumber: number): Promise<FavoriteAyah[]> {
  const list = await getFavoriteAyahs();
  const next = list.filter((f) => !(f.surahNumber === surahNumber && f.ayahNumber === ayahNumber));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function toggleFavoriteAyah(entry: Omit<FavoriteAyah, 'savedAt'>): Promise<{
  favorites: FavoriteAyah[];
  starred: boolean;
}> {
  const { user } = useAuthStore.getState();
  const list = await getFavoriteAyahs();
  if (!user) {
    return { favorites: list, starred: false };
  }

  const exists = list.some(
    (f) => f.surahNumber === entry.surahNumber && f.ayahNumber === entry.ayahNumber
  );
  if (exists) {
    const favorites = await removeFavoriteAyah(entry.surahNumber, entry.ayahNumber);
    return { favorites, starred: false };
  }
  const favorites = await addFavoriteAyah(entry);
  return { favorites, starred: true };
}

export async function syncFavorites(token: string) {
  try {
    const list = await getFavoriteAyahs();
    if (list.length === 0) return;
    await api.post('/sync/favorites', { items: list }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (err) {
    console.error('Failed to sync favorites:', err);
  }
}

export async function restoreFavorites(token: string): Promise<FavoriteAyah[]> {
  try {
    const { data } = await api.get<{ items: FavoriteAyah[] }>('/sync/favorites', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (data && Array.isArray(data.items)) {
      const localList = await getFavoriteAyahs();
      const mergedMap = new Map<string, FavoriteAyah>();
      for (const item of [...localList, ...data.items]) {
        const itemKey = `${item.surahNumber}:${item.ayahNumber}`;
        const existing = mergedMap.get(itemKey);
        if (!existing || item.savedAt > existing.savedAt) {
          mergedMap.set(itemKey, item);
        }
      }
      const mergedList = Array.from(mergedMap.values()).sort((a, b) => b.savedAt - a.savedAt);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mergedList));
      return mergedList;
    }
  } catch (err) {
    console.error('Failed to restore favorites:', err);
  }
  return getFavoriteAyahs();
}

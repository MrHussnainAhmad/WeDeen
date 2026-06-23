import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const list = await getFavoriteAyahs();
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

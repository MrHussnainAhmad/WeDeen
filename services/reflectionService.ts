import AsyncStorage from '@react-native-async-storage/async-storage';

const REFLECTIONS_KEY = 'wedeen_reflections_v1';

export type ReflectionEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  text: string;
  createdAt: number;
};

function sortReflections(items: ReflectionEntry[]): ReflectionEntry[] {
  return [...items].sort((a, b) => b.createdAt - a.createdAt);
}

function mergeReflections(local: ReflectionEntry[], remote: ReflectionEntry[]): ReflectionEntry[] {
  const byId = new Map<string, ReflectionEntry>();
  for (const item of remote) {
    if (item?.id) byId.set(item.id, item);
  }
  for (const item of local) {
    if (!item?.id) continue;
    const existing = byId.get(item.id);
    if (!existing || item.createdAt >= existing.createdAt) {
      byId.set(item.id, item);
    }
  }
  return sortReflections(Array.from(byId.values()));
}

export async function getReflections(): Promise<ReflectionEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(REFLECTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReflectionEntry[];
    return sortReflections(parsed);
  } catch {
    return [];
  }
}

export async function saveReflection(text: string, token: string | null): Promise<ReflectionEntry[]> {
  const current = await getReflections();
  const dateStr = new Date().toISOString().split('T')[0];
  
  const entry: ReflectionEntry = {
    id: Math.random().toString(36).substring(2, 9),
    date: dateStr,
    text,
    createdAt: Date.now(),
  };

  const next = [entry, ...current];
  await AsyncStorage.setItem(REFLECTIONS_KEY, JSON.stringify(next));

  if (token) {
    try {
      const { api } = require('./http');
      await api.post('/sync/reflections', { items: next }, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // Offline fallback
    }
  }
  return next;
}

export async function restoreReflections(token: string): Promise<ReflectionEntry[]> {
  const local = await getReflections();
  try {
    const { api } = require('./http');
    const { data } = await api.get('/sync/reflections', { headers: { Authorization: `Bearer ${token}` } });
    if (data?.items && Array.isArray(data.items)) {
      const merged = mergeReflections(local, data.items);
      await AsyncStorage.setItem(REFLECTIONS_KEY, JSON.stringify(merged));
      if (merged.length !== data.items.length || local.length) {
        await api
          .post('/sync/reflections', { items: merged }, { headers: { Authorization: `Bearer ${token}` } })
          .catch(() => undefined);
      }
      return merged;
    }
  } catch {
    // Return local if sync fails
  }
  return local;
}

export async function deleteReflection(id: string, token: string | null): Promise<ReflectionEntry[]> {
  const current = await getReflections();
  const next = current.filter(r => r.id !== id);
  await AsyncStorage.setItem(REFLECTIONS_KEY, JSON.stringify(next));

  if (token) {
    try {
      const { api } = require('./http');
      await api.post('/sync/reflections', { items: next }, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // Ignore
    }
  }
  return next;
}

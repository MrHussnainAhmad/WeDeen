import AsyncStorage from '@react-native-async-storage/async-storage';

const REFLECTIONS_KEY = 'wedeen_reflections_v1';

export type ReflectionEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  text: string;
  createdAt: number;
};

export async function getReflections(): Promise<ReflectionEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(REFLECTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReflectionEntry[];
    return parsed.sort((a, b) => b.createdAt - a.createdAt);
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
  try {
    const { api } = require('./http');
    const { data } = await api.get('/sync/reflections', { headers: { Authorization: `Bearer ${token}` } });
    if (data?.items && Array.isArray(data.items)) {
      await AsyncStorage.setItem(REFLECTIONS_KEY, JSON.stringify(data.items));
      return data.items.sort((a: any, b: any) => b.createdAt - a.createdAt);
    }
  } catch {
    // Return local if sync fails
  }
  return getReflections();
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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './http';
import type { LearningProgress, MemorizationItem } from '@/types';

const OFFLINE_QUEUE = 'memorization_queue_v1';

export async function fetchMemorization(token: string) {
  const { data } = await api.get<{ items: MemorizationItem[] }>('/memorization', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data.items;
}

export async function fetchStats(token: string) {
  const { data } = await api.get('/memorization/stats', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
}

export async function markMemorized(token: string, item: MemorizationItem) {
  const { data } = await api.post('/memorization/mark', item, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data.item;
}

export async function queueMemorization(item: MemorizationItem) {
  const raw = await AsyncStorage.getItem(OFFLINE_QUEUE);
  const queue = raw ? (JSON.parse(raw) as MemorizationItem[]) : [];
  queue.push(item);
  await AsyncStorage.setItem(OFFLINE_QUEUE, JSON.stringify(queue));
}

export async function flushQueue(token: string) {
  const raw = await AsyncStorage.getItem(OFFLINE_QUEUE);
  if (!raw) return;
  const queue = JSON.parse(raw) as MemorizationItem[];
  for (const item of queue) {
    await markMemorized(token, item);
  }
  await AsyncStorage.removeItem(OFFLINE_QUEUE);
}

export async function fetchLearningProgress(token: string) {
  const { data } = await api.get<LearningProgress>('/memorization/progress', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
}

export async function unlockNextSurah(token: string, surahNumber: number) {
  const { data } = await api.post<LearningProgress>(
    '/memorization/progress/unlock',
    { surahNumber },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

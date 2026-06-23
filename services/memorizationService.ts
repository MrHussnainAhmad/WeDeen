import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './http';
import type { LearningProgress, MemorizationItem } from '@/types';

const LEGACY_OFFLINE_QUEUE = 'memorization_queue_v1';
const LEGACY_PROGRESS_CACHE_KEY = 'learning_progress_v1';

function accountKey(prefix: string, accountId: string) {
  return `${prefix}_${encodeURIComponent(accountId)}`;
}

function offlineQueueKey(accountId: string) {
  return accountKey('memorization_queue_v2', accountId);
}

function progressCacheKey(accountId: string) {
  return accountKey('learning_progress_v2', accountId);
}

let legacyStorageCleared = false;
async function clearUnsafeLegacyStorage() {
  if (legacyStorageCleared) return;
  legacyStorageCleared = true;
  await AsyncStorage.multiRemove([LEGACY_OFFLINE_QUEUE, LEGACY_PROGRESS_CACHE_KEY]);
}

const lastSyncAttemptByAccount = new Map<string, number>();
const queueWriteChainByAccount = new Map<string, Promise<void>>();
const SYNC_MIN_INTERVAL_MS = 30_000;

export async function getCachedLearningProgress(accountId: string): Promise<LearningProgress | null> {
  await clearUnsafeLegacyStorage();
  const raw = await AsyncStorage.getItem(progressCacheKey(accountId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LearningProgress;
    if (typeof parsed?.unlockedSurah === 'number') return parsed;
  } catch {
    // ignore
  }
  return null;
}

export async function cacheLearningProgress(accountId: string, progress: LearningProgress) {
  await clearUnsafeLegacyStorage();
  await AsyncStorage.setItem(progressCacheKey(accountId), JSON.stringify(progress));
}

export async function hasQueuedMemorization(accountId: string): Promise<boolean> {
  await clearUnsafeLegacyStorage();
  const raw = await AsyncStorage.getItem(offlineQueueKey(accountId));
  if (!raw) return false;
  try {
    const queue = JSON.parse(raw) as MemorizationItem[];
    return Array.isArray(queue) && queue.length > 0;
  } catch {
    return false;
  }
}

/** Throttled foreground sync — skips if recently synced or queue is empty. */
export async function syncMemorizationQueueThrottled(
  token: string | null | undefined,
  accountId: string | null | undefined,
  options?: { force?: boolean }
): Promise<number> {
  if (!token || !accountId) return 0;
  const now = Date.now();
  const lastSyncAttemptMs = lastSyncAttemptByAccount.get(accountId) ?? 0;
  if (!options?.force && now - lastSyncAttemptMs < SYNC_MIN_INTERVAL_MS) return 0;
  lastSyncAttemptByAccount.set(accountId, now);

  const hasQueue = await hasQueuedMemorization(accountId);
  if (!hasQueue) return 0;

  return syncMemorizationQueue(token, accountId);
}

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

export async function queueMemorization(accountId: string, item: MemorizationItem) {
  const previous = queueWriteChainByAccount.get(accountId) ?? Promise.resolve();
  const write = previous.catch(() => undefined).then(async () => {
    await clearUnsafeLegacyStorage();
    const key = offlineQueueKey(accountId);
    const raw = await AsyncStorage.getItem(key);
    let queue: MemorizationItem[] = [];
    try {
      queue = raw ? (JSON.parse(raw) as MemorizationItem[]) : [];
      if (!Array.isArray(queue)) queue = [];
    } catch {
      queue = [];
    }
    const existingIndex = queue.findIndex(
      (queued) =>
        queued.surahNumber === item.surahNumber && queued.ayahNumber === item.ayahNumber
    );
    if (existingIndex >= 0) queue[existingIndex] = item;
    else queue.push(item);
    await AsyncStorage.setItem(key, JSON.stringify(queue));
  });
  queueWriteChainByAccount.set(accountId, write);
  try {
    await write;
  } finally {
    if (queueWriteChainByAccount.get(accountId) === write) {
      queueWriteChainByAccount.delete(accountId);
    }
  }
}

export async function flushQueue(token: string, accountId: string) {
  await clearUnsafeLegacyStorage();
  const key = offlineQueueKey(accountId);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return 0;
  let queue: MemorizationItem[];
  try {
    queue = JSON.parse(raw) as MemorizationItem[];
    if (!Array.isArray(queue)) throw new Error('Invalid queue');
  } catch {
    await AsyncStorage.removeItem(key);
    return 0;
  }
  const remaining: MemorizationItem[] = [];

  for (const item of queue) {
    try {
      await markMemorized(token, item);
    } catch {
      remaining.push(item);
    }
  }

  if (remaining.length) {
    await AsyncStorage.setItem(key, JSON.stringify(remaining));
  } else {
    await AsyncStorage.removeItem(key);
  }

  return queue.length - remaining.length;
}

export async function syncMemorizationQueue(
  token: string | null | undefined,
  accountId: string | null | undefined
) {
  if (!token || !accountId) return 0;
  try {
    return await flushQueue(token, accountId);
  } catch {
    return 0;
  }
}

export async function fetchLearningProgress(token: string, accountId: string) {
  const { data } = await api.get<LearningProgress>('/memorization/progress', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const progress = {
    unlockedSurah: Math.max(1, Math.min(114, data.unlockedSurah || 1)),
  };
  await cacheLearningProgress(accountId, progress);
  return progress;
}

export async function unlockNextSurah(token: string, accountId: string, surahNumber: number) {
  const { data } = await api.post<LearningProgress>(
    '/memorization/progress/unlock',
    { surahNumber },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const progress = {
    unlockedSurah: Math.max(1, Math.min(114, data.unlockedSurah || 1)),
  };
  await cacheLearningProgress(accountId, progress);
  return progress;
}

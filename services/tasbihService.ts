import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './http';
import { AchievementManager } from '../store/achievementStore';

const TASBIH_TOTALS_KEY = 'wedeen_tasbih_totals_v1';
const TASBIH_QUEUE_KEY = 'wedeen_tasbih_queue_v1';

export type TasbihPreset = {
  id: string;
  name: string;
  arabic: string;
  target: number;
};

export const PRESET_TASBIHS: TasbihPreset[] = [
  { id: 'subhanallah', name: 'SubhanAllah', arabic: 'سُبْحَانَ اللّٰه', target: 33 },
  { id: 'alhamdulillah', name: 'Alhamdulillah', arabic: 'اَلْحَمْدُ لِلّٰه', target: 33 },
  { id: 'allahuakbar', name: 'AllahuAkbar', arabic: 'اَللّٰهُ أَكْبَر', target: 34 },
];

function getTodayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function getTodayTasbihCount(): Promise<number> {
  const today = getTodayStr();
  const totals = await getTasbihTotals();
  return totals[today] || 0;
}

export async function getTasbihTotals(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(TASBIH_TOTALS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function recordTasbihTaps(amount: number, token?: string | null, userId?: string | null) {
  const today = getTodayStr();
  const totals = await getTasbihTotals();
  const newCount = (totals[today] || 0) + amount;
  totals[today] = newCount;

  await AsyncStorage.setItem(TASBIH_TOTALS_KEY, JSON.stringify(totals));

  // Track achievements
  AchievementManager.trackEvent('dhikr_tap', amount).catch(() => undefined);

  // Sync to backend if logged in
  if (userId) {
    await queueTasbihSync(userId, today, amount);
    if (token) {
      syncTasbihQueue(token, userId).catch(() => undefined);
    }
  }
}

async function queueTasbihSync(userId: string, date: string, count: number) {
  const queueKey = `${TASBIH_QUEUE_KEY}_${userId}`;
  try {
    const raw = await AsyncStorage.getItem(queueKey);
    const queue: Record<string, number> = raw ? JSON.parse(raw) : {};
    queue[date] = (queue[date] || 0) + count;
    await AsyncStorage.setItem(queueKey, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export async function syncTasbihQueue(token: string, userId: string): Promise<void> {
  const queueKey = `${TASBIH_QUEUE_KEY}_${userId}`;
  try {
    const raw = await AsyncStorage.getItem(queueKey);
    if (!raw) return;
    const queue: Record<string, number> = JSON.parse(raw);
    const dates = Object.keys(queue);
    if (dates.length === 0) return;

    const items = dates.map((d) => ({ date: d, count: queue[d] }));
    await api.post('/sync/tasbih', { items }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    await AsyncStorage.removeItem(queueKey);
  } catch (err) {
    console.error('Failed to sync tasbih queue:', err);
  }
}

export async function restoreTasbihHistory(token: string) {
  try {
    const { data } = await api.get<{ items: { date: string; count: number }[] }>('/sync/tasbih', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (data && Array.isArray(data.items)) {
      const totals = await getTasbihTotals();
      for (const item of data.items) {
        totals[item.date] = Math.max(totals[item.date] || 0, item.count);
      }
      await AsyncStorage.setItem(TASBIH_TOTALS_KEY, JSON.stringify(totals));
    }
  } catch (err) {
    console.error('Failed to restore tasbih history:', err);
  }
}

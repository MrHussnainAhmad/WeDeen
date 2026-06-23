import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './http';
import { AchievementManager } from '@/store/achievementStore';

const ZAKAT_HISTORY_KEY = 'wedeen_zakat_history_v1';

export type ZakatInput = {
  currency: string;
  cashSavings: number;
  goldValue: number;
  silverValue: number;
  investments: number;
  businessAssets: number;
  liabilities: number;
  nisabThreshold: number;
};

export type ZakatCalculation = ZakatInput & {
  calculationId: string;
  zakatableTotal: number;
  zakatDue: number;
  createdAt: number;
};

export function calculateZakat(input: ZakatInput): ZakatCalculation {
  const assets =
    Number(input.cashSavings || 0) +
    Number(input.goldValue || 0) +
    Number(input.silverValue || 0) +
    Number(input.investments || 0) +
    Number(input.businessAssets || 0);
  const zakatableTotal = Math.max(0, assets - Number(input.liabilities || 0));
  const eligible = zakatableTotal >= Number(input.nisabThreshold || 0);
  return {
    ...input,
    calculationId: `zakat_${Date.now()}`,
    zakatableTotal,
    zakatDue: eligible ? zakatableTotal * 0.025 : 0,
    createdAt: Date.now(),
  };
}

export async function getZakatHistory(): Promise<ZakatCalculation[]> {
  const raw = await AsyncStorage.getItem(ZAKAT_HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ZakatCalculation[];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.createdAt - a.createdAt) : [];
  } catch {
    return [];
  }
}

async function saveHistory(items: ZakatCalculation[]) {
  await AsyncStorage.setItem(ZAKAT_HISTORY_KEY, JSON.stringify(items.slice(0, 50)));
}

export async function saveZakatCalculation(item: ZakatCalculation, token?: string | null) {
  const existing = await getZakatHistory();
  const next = [item, ...existing.filter((x) => x.calculationId !== item.calculationId)];
  await saveHistory(next);
  AchievementManager.trackEvent('dev_zakat', 1).catch(() => undefined);
  if (token) syncZakatHistory(token).catch(() => undefined);
  return next;
}

export async function syncZakatHistory(token: string) {
  const items = await getZakatHistory();
  if (!items.length) return;
  await api.post('/sync/zakat', { items }, { headers: { Authorization: `Bearer ${token}` } });
}

export async function restoreZakatHistory(token: string) {
  const { data } = await api.get<{ items: ZakatCalculation[] }>('/sync/zakat', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const local = await getZakatHistory();
  const merged = new Map<string, ZakatCalculation>();
  for (const item of [...local, ...(data.items ?? [])]) {
    merged.set(item.calculationId, item);
  }
  const list = Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt);
  await saveHistory(list);
  return list;
}

export function buildZakatReport(item: ZakatCalculation) {
  const money = (value: number) => `${item.currency} ${value.toFixed(2)}`;
  return [
    'WeDeen Zakat Calculation',
    '',
    `Cash & Savings: ${money(item.cashSavings)}`,
    `Gold Value: ${money(item.goldValue)}`,
    `Silver Value: ${money(item.silverValue)}`,
    `Stocks & Investments: ${money(item.investments)}`,
    `Business Assets: ${money(item.businessAssets)}`,
    `Liabilities: ${money(item.liabilities)}`,
    `Nisab Threshold: ${money(item.nisabThreshold)}`,
    '',
    `Zakatable Total: ${money(item.zakatableTotal)}`,
    `Zakat Due (2.5%): ${money(item.zakatDue)}`,
    '',
    'This is an estimate. Confirm complex assets with a qualified scholar.',
  ].join('\n');
}

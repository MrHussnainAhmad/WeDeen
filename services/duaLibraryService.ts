import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './http';
import { playManagedAudio } from './audioManager';
import { AchievementManager } from '@/store/achievementStore';

const DUA_PROGRESS_KEY = 'wedeen_dua_progress_v1';
const DUA_AUDIO_PLACEHOLDER = require('@/assets/audio/Allah.m4a');

export type DuaCategory = {
  id: string;
  title: string;
  description: string;
};

export type DuaItem = {
  id: string;
  categoryId: string;
  title: string;
  arabic: string;
  transliteration: string;
  translation: string;
  reference?: string;
};

export type DuaProgress = {
  duaId: string;
  categoryId: string;
  readCount: number;
  favorite: boolean;
  lastReadAt: number | null;
};

export const DUA_CATEGORIES: DuaCategory[] = [
  { id: 'morning-evening', title: 'Morning & Evening', description: 'Daily protection and remembrance' },
  { id: 'after-salah', title: 'After Salah', description: 'Short duas and dhikr after prayer' },
  { id: 'travel', title: 'Travel', description: 'Duas for journeys and returning home' },
  { id: 'anxiety', title: 'Anxiety & Ease', description: 'Duas for worry, hardship, and calm' },
  { id: 'sleep', title: 'Sleeping', description: 'Before sleep and waking up' },
  { id: 'ramadan', title: 'Ramadan', description: 'Fasting, iftar, and Laylatul Qadr' },
];

export const DUAS: DuaItem[] = [
  {
    id: 'morning-1',
    categoryId: 'morning-evening',
    title: 'Morning protection',
    arabic: 'اللهم بك أصبحنا وبك أمسينا وبك نحيا وبك نموت وإليك النشور',
    transliteration: 'Allahumma bika asbahna wa bika amsayna wa bika nahya wa bika namutu wa ilaykan-nushur.',
    translation: 'O Allah, by You we enter the morning and evening, by You we live and die, and to You is the resurrection.',
  },
  {
    id: 'evening-1',
    categoryId: 'morning-evening',
    title: 'Evening protection',
    arabic: 'أعوذ بكلمات الله التامات من شر ما خلق',
    transliteration: 'Audu bi kalimatillahit-tammati min sharri ma khalaq.',
    translation: 'I seek refuge in the perfect words of Allah from the evil of what He created.',
  },
  {
    id: 'after-salah-1',
    categoryId: 'after-salah',
    title: 'After prayer forgiveness',
    arabic: 'أستغفر الله',
    transliteration: 'Astaghfirullah.',
    translation: 'I seek forgiveness from Allah.',
    reference: 'Said after Salah.',
  },
  {
    id: 'after-salah-2',
    categoryId: 'after-salah',
    title: 'Tasbih after Salah',
    arabic: 'سبحان الله والحمد لله والله أكبر',
    transliteration: 'SubhanAllah, Alhamdulillah, Allahu Akbar.',
    translation: 'Glory be to Allah, praise be to Allah, and Allah is the Greatest.',
  },
  {
    id: 'travel-1',
    categoryId: 'travel',
    title: 'Beginning a journey',
    arabic: 'سبحان الذي سخر لنا هذا وما كنا له مقرنين وإنا إلى ربنا لمنقلبون',
    transliteration: 'Subhanalladhi sakhkhara lana hadha wa ma kunna lahu muqrinin wa inna ila rabbina lamunqalibun.',
    translation: 'Glory is to the One who subjected this to us, and we could not have done it ourselves. To our Lord we return.',
  },
  {
    id: 'anxiety-1',
    categoryId: 'anxiety',
    title: 'For anxiety and sadness',
    arabic: 'اللهم إني أعوذ بك من الهم والحزن',
    transliteration: 'Allahumma inni audhu bika minal-hammi wal-hazan.',
    translation: 'O Allah, I seek refuge in You from anxiety and sadness.',
  },
  {
    id: 'sleep-1',
    categoryId: 'sleep',
    title: 'Before sleeping',
    arabic: 'باسمك اللهم أموت وأحيا',
    transliteration: 'Bismika Allahumma amutu wa ahya.',
    translation: 'In Your name, O Allah, I die and I live.',
  },
  {
    id: 'ramadan-iftar',
    categoryId: 'ramadan',
    title: 'At iftar',
    arabic: 'ذهب الظمأ وابتلت العروق وثبت الأجر إن شاء الله',
    transliteration: 'Dhahabaz-zamau wabtallatil-uruqu wa thabatal-ajru in sha Allah.',
    translation: 'The thirst has gone, the veins are moistened, and the reward is confirmed, if Allah wills.',
  },
  {
    id: 'laylatul-qadr',
    categoryId: 'ramadan',
    title: 'Laylatul Qadr',
    arabic: 'اللهم إنك عفو تحب العفو فاعف عني',
    transliteration: 'Allahumma innaka afuwwun tuhibbul-afwa fafu anni.',
    translation: 'O Allah, You are Pardoning and love pardon, so pardon me.',
  },
];

export function getDailyRecommendedDuas() {
  const day = new Date().getDate();
  return [DUAS[day % DUAS.length], DUAS[(day + 3) % DUAS.length]].filter(Boolean);
}

export async function getDuaProgress(): Promise<Record<string, DuaProgress>> {
  const raw = await AsyncStorage.getItem(DUA_PROGRESS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, DuaProgress>;
  } catch {
    return {};
  }
}

async function saveProgress(progress: Record<string, DuaProgress>) {
  await AsyncStorage.setItem(DUA_PROGRESS_KEY, JSON.stringify(progress));
}

export async function markDuaRead(dua: DuaItem, token?: string | null) {
  const progress = await getDuaProgress();
  const existing = progress[dua.id];
  progress[dua.id] = {
    duaId: dua.id,
    categoryId: dua.categoryId,
    readCount: (existing?.readCount ?? 0) + 1,
    favorite: existing?.favorite ?? false,
    lastReadAt: Date.now(),
  };
  await saveProgress(progress);
  AchievementManager.trackEvent('dhikr_azkar_read', 1).catch(() => undefined);
  if (token) syncDuaProgress(token).catch(() => undefined);
  return progress;
}

export async function toggleDuaFavorite(dua: DuaItem, token?: string | null) {
  const progress = await getDuaProgress();
  const existing = progress[dua.id];
  progress[dua.id] = {
    duaId: dua.id,
    categoryId: dua.categoryId,
    readCount: existing?.readCount ?? 0,
    favorite: !(existing?.favorite ?? false),
    lastReadAt: existing?.lastReadAt ?? null,
  };
  await saveProgress(progress);
  if (token) syncDuaProgress(token).catch(() => undefined);
  return progress;
}

export async function syncDuaProgress(token: string) {
  const progress = await getDuaProgress();
  const items = Object.values(progress);
  if (!items.length) return;
  await api.post('/sync/duas', { items }, { headers: { Authorization: `Bearer ${token}` } });
}

export async function restoreDuaProgress(token: string) {
  const { data } = await api.get<{ items: DuaProgress[] }>('/sync/duas', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const progress = await getDuaProgress();
  for (const item of data.items ?? []) {
    const existing = progress[item.duaId];
    progress[item.duaId] = {
      ...item,
      readCount: Math.max(existing?.readCount ?? 0, item.readCount ?? 0),
      favorite: (existing?.favorite ?? false) || item.favorite,
      lastReadAt: Math.max(existing?.lastReadAt ?? 0, item.lastReadAt ?? 0) || null,
    };
  }
  await saveProgress(progress);
  return progress;
}

export async function playDuaAudio() {
  await playManagedAudio(DUA_AUDIO_PLACEHOLDER);
}

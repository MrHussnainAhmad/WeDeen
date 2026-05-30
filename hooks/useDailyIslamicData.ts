import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ummahApi } from '@/services/http';

const ONE_DAY = 24 * 60 * 60 * 1000;
const DEVICE_SEED_KEY = 'daily_personalization_seed_v1';

const AZKAR_POOL = [
  { categoryEn: 'Morning Azkar', textAr: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ.' },
  { categoryEn: 'Evening Azkar', textAr: 'حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ.' },
  { categoryEn: 'After Salah', textAr: 'أَسْتَغْفِرُ اللَّهَ (٣ مرات)، اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ.' },
  { categoryEn: 'Before Sleep', textAr: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا.' },
  { categoryEn: 'Upon Waking', textAr: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا.' },
  { categoryEn: 'Before Eating', textAr: 'بِسْمِ اللَّهِ.' },
  { categoryEn: 'After Eating', textAr: 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا وَسَقَانَا.' },
  { categoryEn: 'Entering Home', textAr: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَ الْمَوْلِجِ وَخَيْرَ الْمَخْرَجِ.' },
  { categoryEn: 'Leaving Home', textAr: 'بِسْمِ اللَّهِ، تَوَكَّلْتُ عَلَى اللَّهِ، لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ.' },
  { categoryEn: 'Travel Duas', textAr: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَٰذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ.' },
  { categoryEn: 'Rain Duas', textAr: 'اللَّهُمَّ صَيِّبًا نَافِعًا.' },
  { categoryEn: 'Distress & Anxiety', textAr: 'لَا إِلَٰهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ.' }
];

function formatTodayForAladhan(date: Date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function getLocalDateKey(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

async function getOrCreateDeviceSeed() {
  const existing = await AsyncStorage.getItem(DEVICE_SEED_KEY);
  if (existing) return existing;
  const created = `seed_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  await AsyncStorage.setItem(DEVICE_SEED_KEY, created);
  return created;
}

export function useDailyIslamicData() {
  const localDateKey = getLocalDateKey(new Date());

  return useQuery({
    queryKey: ['daily-islamic-data-v5', localDateKey],
    queryFn: async () => {
      const now = new Date();
      const today = formatTodayForAladhan(now);
      const dateKey = getLocalDateKey(now);
      const seed = await getOrCreateDeviceSeed();

      const ayahIndex = (hashString(`${seed}:${dateKey}:reminder`) % 6236) + 1;
      const hadithIndex = (hashString(`${seed}:${dateKey}:hadith`) % 4930) + 1;

      const [hijriRes, reminderRes, hadithRes] = await Promise.allSettled([
        axios.get(`https://api.aladhan.com/v1/gToH?date=${today}`, { timeout: 12000 }),
        ummahApi.get(`/ayah/${ayahIndex}/en.asad`),
        axios.get(`https://api.hadith.gading.dev/books/muslim/${hadithIndex}`, { timeout: 12000 })
      ]);

      const hijriDate =
        hijriRes.status === 'fulfilled'
          ? `${hijriRes.value.data?.data?.hijri?.day ?? ''} ${hijriRes.value.data?.data?.hijri?.month?.en ?? ''} ${hijriRes.value.data?.data?.hijri?.year ?? ''} AH`.trim()
          : 'Hijri date unavailable';

      const reminder =
        reminderRes.status === 'fulfilled'
          ? reminderRes.value.data?.data?.text ?? 'Reminder unavailable'
          : 'Reminder unavailable';

      const hadith =
        hadithRes.status === 'fulfilled'
          ? hadithRes.value.data?.data?.contents?.arab ??
            hadithRes.value.data?.data?.contents?.id ??
            'Hadith unavailable'
          : 'Hadith unavailable';

      const dailyAzkarStart = hashString(`azkar:${dateKey}`) % AZKAR_POOL.length;
      const azkar = Array.from({ length: 4 }, (_, i) => AZKAR_POOL[(dailyAzkarStart + i) % AZKAR_POOL.length]);

      return {
        hijriDate,
        reminder,
        hadith,
        azkar
      };
    },
    staleTime: ONE_DAY,
    gcTime: ONE_DAY,
    retry: 1
  });
}

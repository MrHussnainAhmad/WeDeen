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

// Free, CDN-hosted hadith dataset (fawazahmed0/hadith-api) — same source the
// hadith library uses. Replaces api.hadith.gading.dev, which now 402s on every
// request. Sahih Muslim is numbered 1..7563 in this dataset.
const HADITH_CDN = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions';
const MUSLIM_HADITH_COUNT = 7563;

// Fetch one hadith by number, preferring the original Arabic and falling back to
// the English translation so the card always has text to show.
async function fetchDailyHadith(index: number): Promise<string> {
  for (const edition of ['ara-muslim', 'eng-muslim']) {
    try {
      const res = await axios.get(`${HADITH_CDN}/${edition}/${index}.min.json`, { timeout: 12000 });
      const text = res.data?.hadiths?.[0]?.text;
      if (text) return text;
    } catch {
      // try the next edition
    }
  }
  return 'Hadith unavailable';
}

export function useDailyIslamicData() {
  const localDateKey = getLocalDateKey(new Date());

  return useQuery({
    queryKey: ['daily-islamic-data-v7', localDateKey],
    queryFn: async () => {
      const now = new Date();
      const today = formatTodayForAladhan(now);
      const dateKey = getLocalDateKey(now);
      const seed = await getOrCreateDeviceSeed();

      const ayahIndex = (hashString(`${seed}:${dateKey}:reminder`) % 6236) + 1;
      const hadithIndex = (hashString(`${seed}:${dateKey}:hadith`) % MUSLIM_HADITH_COUNT) + 1;

      const [hijriRes, reminderRes, hadithRes] = await Promise.allSettled([
        axios.get(`https://api.aladhan.com/v1/gToH?date=${today}`, { timeout: 12000 }),
        // Fetch the original Arabic (Uthmani) alongside the English translation in one call.
        ummahApi.get(`/ayah/${ayahIndex}/editions/quran-uthmani,en.asad`),
        fetchDailyHadith(hadithIndex)
      ]);

      const hijri = hijriRes.status === 'fulfilled' ? hijriRes.value.data?.data?.hijri : null;
      const hijriDate = hijri
        ? `${hijri.day ?? ''} ${hijri.month?.en ?? ''} ${hijri.year ?? ''} AH`.trim()
        : 'Hijri date unavailable';
      const hijriDay = hijri?.day ?? null;
      const hijriMonth = hijri?.month?.en ?? null;
      const hijriYear = hijri?.year ?? null;
      const hijriWeekday = hijri?.weekday?.en ?? null;

      // The editions endpoint returns an array: [arabic edition, english edition].
      const editions = reminderRes.status === 'fulfilled' ? reminderRes.value.data?.data : null;
      const arabicEdition = Array.isArray(editions) ? editions[0] : null;
      const englishEdition = Array.isArray(editions) ? editions[1] : editions;

      const reminder = englishEdition?.text ?? 'Reminder unavailable';
      const reminderArabic = arabicEdition?.text ?? null;
      const surahEnglish = englishEdition?.surah?.englishName ?? arabicEdition?.surah?.englishName ?? null;
      const surahArabic = englishEdition?.surah?.name ?? arabicEdition?.surah?.name ?? null;
      const surahNumber = englishEdition?.surah?.number ?? arabicEdition?.surah?.number ?? null;
      const ayahNumberInSurah = englishEdition?.numberInSurah ?? arabicEdition?.numberInSurah ?? null;
      const verseReference =
        surahEnglish && ayahNumberInSurah ? `${surahEnglish} · ${surahNumber}:${ayahNumberInSurah}` : null;

      const hadith = hadithRes.status === 'fulfilled' ? hadithRes.value : 'Hadith unavailable';

      const dailyAzkarStart = hashString(`azkar:${dateKey}`) % AZKAR_POOL.length;
      const azkar = Array.from({ length: 4 }, (_, i) => AZKAR_POOL[(dailyAzkarStart + i) % AZKAR_POOL.length]);

      return {
        hijriDate,
        hijriDay,
        hijriMonth,
        hijriYear,
        hijriWeekday,
        reminder,
        reminderArabic,
        verseReference,
        surahArabic,
        surahEnglish,
        surahNumber,
        ayahNumberInSurah,
        hadith,
        azkar
      };
    },
    staleTime: ONE_DAY,
    gcTime: ONE_DAY,
    retry: 1
  });
}

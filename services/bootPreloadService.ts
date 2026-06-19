import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Font from 'expo-font';
import { FontAwesome6, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getOrDownloadQuran, isQuranFileCached, type QuranDownloadProgress } from './quranService';
import { areAllBooksCached } from './hadithService';
import { MUHAMMAD_99_NAMES } from '@/constants/muhammadNames';

const BOOT_PRELOAD_DONE_KEY = 'boot_preload_done_v1';
const HADITH_PROMPT_ASKED_KEY = 'hadith_predownload_asked_v1';
const ALLAH_NAMES_CACHE_KEY = 'names_allah_cache_v1';
const MUHAMMAD_NAMES_CACHE_KEY = 'names_muhammad_cache_v3';

/** Max time to keep the user on the first-launch boot screen for Quran download. */
const BOOT_QURAN_BUDGET_MS = 10_000;

export type BootPreloadResult = 'completed_on_boot' | 'continued_in_background';

let backgroundPreloadPromise: Promise<void> | null = null;

function buildMuhammadTextNames() {
  return MUHAMMAD_99_NAMES.map((item, index) => ({
    id: index + 1,
    arabic: `\u0627\u0633\u0645 \u0645\u062d\u0645\u062f ${index + 1}`,
    transliteration: item.transliteration,
    meaning: item.meaning,
  }));
}

async function preloadNamesTextData() {
  try {
    const response = await fetch('https://asmaul-husna-api-coral.vercel.app/api/asmaul-husna?lang=english');
    if (response.ok) {
      const json = await response.json();
      const results = Array.isArray(json?.results) ? json.results : [];
      await AsyncStorage.setItem(ALLAH_NAMES_CACHE_KEY, JSON.stringify(results.slice(0, 99)));
    }
  } catch {
    // Non-fatal on first run; names screen can fetch later too.
  }

  const muhammadNames = buildMuhammadTextNames();
  await AsyncStorage.setItem(MUHAMMAD_NAMES_CACHE_KEY, JSON.stringify(muhammadNames));
}

async function warmupUiAssets() {
  await Font.loadAsync({
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
    ...FontAwesome6.font,
  });
}

async function retryQuranPreload(
  onProgress?: (p: QuranDownloadProgress) => void,
  maxAttempts = 3,
  delayMs = 1200
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await getOrDownloadQuran(onProgress);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  const finalError = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`QURAN_PRELOAD_FAILED: ${finalError}`);
}

async function finishOptionalBootAssets() {
  await Promise.allSettled([preloadNamesTextData(), warmupUiAssets()]);
}

async function markBootFlowComplete() {
  await AsyncStorage.setItem(BOOT_PRELOAD_DONE_KEY, '1');
}

/** Continue Quran + optional assets after the user has entered the app. */
export function continueBootPreloadInBackground() {
  if (backgroundPreloadPromise) return backgroundPreloadPromise;

  backgroundPreloadPromise = (async () => {
    try {
      if (!(await isQuranFileCached())) {
        await retryQuranPreload(undefined, 5, 2000);
      }
      await finishOptionalBootAssets();
    } catch {
      // Quran reader will retry on demand.
    } finally {
      backgroundPreloadPromise = null;
    }
  })();

  return backgroundPreloadPromise;
}

export async function shouldRunBootPreload() {
  const done = await AsyncStorage.getItem(BOOT_PRELOAD_DONE_KEY);
  if (done) return false;
  if (await isQuranFileCached()) {
    await markBootFlowComplete();
    return false;
  }
  return true;
}

export async function shouldAskHadithPredownload() {
  const asked = await AsyncStorage.getItem(HADITH_PROMPT_ASKED_KEY);
  if (asked) return false;
  try {
    if (await areAllBooksCached()) {
      await markHadithPredownloadAsked();
      return false;
    }
  } catch {
    // Couldn't determine cache state — fall through and ask.
  }
  return true;
}

export async function markHadithPredownloadAsked() {
  await AsyncStorage.setItem(HADITH_PROMPT_ASKED_KEY, '1');
}

/**
 * First-launch boot preload. If Quran finishes within ~10s, stay on boot screen.
 * Otherwise send the user to Home and finish the download in the background.
 */
export async function runBootPreloadOnce(
  onQuranProgress?: (p: QuranDownloadProgress) => void
): Promise<BootPreloadResult> {
  let quranFinished = false;

  const quranWork = retryQuranPreload(onQuranProgress)
    .then(() => {
      quranFinished = true;
    })
    .catch((error) => {
      throw error;
    });

  await Promise.race([
    quranWork.catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, BOOT_QURAN_BUDGET_MS)),
  ]);

  if (quranFinished) {
    await finishOptionalBootAssets();
    await markBootFlowComplete();
    return 'completed_on_boot';
  }

  await markBootFlowComplete();

  quranWork
    .then(async () => finishOptionalBootAssets())
    .catch(() => continueBootPreloadInBackground());

  return 'continued_in_background';
}

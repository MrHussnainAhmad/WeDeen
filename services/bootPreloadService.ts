import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Font from 'expo-font';
import { FontAwesome6, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getOrDownloadQuran } from './quranService';
import { areAllBooksCached } from './hadithService';
import { MUHAMMAD_99_NAMES } from '@/constants/muhammadNames';

const BOOT_PRELOAD_DONE_KEY = 'boot_preload_done_v1';
const HADITH_PROMPT_ASKED_KEY = 'hadith_predownload_asked_v1';
const ALLAH_NAMES_CACHE_KEY = 'names_allah_cache_v1';
const MUHAMMAD_NAMES_CACHE_KEY = 'names_muhammad_cache_v3';

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

async function retryQuranPreload(maxAttempts = 3, delayMs = 1200) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      console.log(`[Boot] Quran preload attempt ${attempt}/${maxAttempts}...`);
      await getOrDownloadQuran();
      console.log('[Boot] Quran preload succeeded');
      return;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[Boot] Quran preload attempt ${attempt} failed:`, errorMsg);
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  const finalError = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`QURAN_PRELOAD_FAILED: ${finalError}`);
}

export async function shouldRunBootPreload() {
  const done = await AsyncStorage.getItem(BOOT_PRELOAD_DONE_KEY);
  return !done;
}

/**
 * Whether to show the "Download Hadith Books?" prompt. Shown once: skipped if
 * already asked, or if every book is already cached (offline-ready). Network
 * issues default to showing it — asking is harmless.
 */
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

export async function runBootPreloadOnce() {
  // Quran preload is required for first-launch completion.
  await retryQuranPreload();

  // Keep these non-blocking so first launch doesn't fail for optional assets.
  await Promise.allSettled([
    preloadNamesTextData(),
    warmupUiAssets(),
  ]);

  await AsyncStorage.setItem(BOOT_PRELOAD_DONE_KEY, '1');
}



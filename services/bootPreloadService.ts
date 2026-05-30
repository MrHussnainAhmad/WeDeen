import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Font from 'expo-font';
import { FontAwesome6, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getOrDownloadQuran } from './quranService';

const BOOT_PRELOAD_DONE_KEY = 'boot_preload_done_v1';
const ADHAN_KEY = 'adhan_file_path_v1';
const ADHAN_URL = 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Beautiful_adhan.ogg';
const ALLAH_NAMES_CACHE_KEY = 'names_allah_cache_v1';
const MUHAMMAD_NAMES_CACHE_KEY = 'names_muhammad_cache_v1';

const MUHAMMAD_STARTER = [
  'Muhammad', 'Ahmad', 'Al-Mahi', 'Al-Hashir', 'Al-Aqib', 'Al-Mustafa', 'Al-Mujtaba', 'Rasulullah',
  'Nabiyullah', 'Habibullah', 'Al-Amin', 'As-Sadiq', 'Taha', 'Yasin', 'Abul-Qasim'
];

function buildMuhammadTextNames() {
  return Array.from({ length: 99 }, (_, index) => {
    const starter = MUHAMMAD_STARTER[index];
    return {
      id: index + 1,
      arabic: starter ? `اسم ${index + 1}` : `اسم محمد ${index + 1}`,
      transliteration: starter || `Muhammad Name ${index + 1}`,
    };
  });
}

async function ensureAdhanFile() {
  const existing = await AsyncStorage.getItem(ADHAN_KEY);
  if (existing) {
    const info = await FileSystem.getInfoAsync(existing);
    if (info.exists) return existing;
  }

  const dir = `${FileSystem.documentDirectory}audio/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const target = `${dir}adhan.ogg`;
  const info = await FileSystem.getInfoAsync(target);
  if (!info.exists) {
    await FileSystem.downloadAsync(ADHAN_URL, target);
  }
  await AsyncStorage.setItem(ADHAN_KEY, target);
  return target;
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

export async function shouldRunBootPreload() {
  const done = await AsyncStorage.getItem(BOOT_PRELOAD_DONE_KEY);
  return !done;
}

export async function runBootPreloadOnce() {
  await Promise.all([
    getOrDownloadQuran(),
    ensureAdhanFile(),
    preloadNamesTextData(),
    warmupUiAssets(),
  ]);
  await AsyncStorage.setItem(BOOT_PRELOAD_DONE_KEY, '1');
}

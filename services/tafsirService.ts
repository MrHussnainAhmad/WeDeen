import * as FileSystem from 'expo-file-system/legacy';
import axios from 'axios';

const TAFSIR_DIR = `${FileSystem.documentDirectory}tafsir/`;

export interface TafsirData {
  key: string;
  name: string;
  language: string;
  author: string;
  text: string;
}

export async function getCachedTafsir(
  tafsirKey: string,
  surah: number,
  ayah: number
): Promise<string | null> {
  try {
    const filePath = `${TAFSIR_DIR}${tafsirKey}_${surah}_${ayah}.json`;
    const info = await FileSystem.getInfoAsync(filePath);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(filePath);
    const parsed = JSON.parse(raw);
    return parsed.text || null;
  } catch {
    return null;
  }
}

export async function saveTafsirToCache(
  tafsirKey: string,
  surah: number,
  ayah: number,
  text: string
): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(TAFSIR_DIR, { intermediates: true });
    const filePath = `${TAFSIR_DIR}${tafsirKey}_${surah}_${ayah}.json`;
    await FileSystem.writeAsStringAsync(filePath, JSON.stringify({ text }));
  } catch (error) {
    console.warn('[TafsirCache] Failed to save to cache:', error);
  }
}

export async function fetchTafsir(
  tafsirKey: string,
  surah: number,
  ayah: number
): Promise<string> {
  // Check cache first
  const cached = await getCachedTafsir(tafsirKey, surah, ayah);
  if (cached) return cached;

  const url = `https://ummahapi.com/api/tafsir/${tafsirKey}/surah/${surah}/ayah/${ayah}`;
  const response = await axios.get(url, { timeout: 12000 });
  
  if (response.data?.success && response.data?.data?.tafsir?.text) {
    const text = response.data.data.tafsir.text;
    await saveTafsirToCache(tafsirKey, surah, ayah, text);
    return text;
  }
  
  throw new Error('Tafsir not found in response');
}

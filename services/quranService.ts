import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { ummahApi } from './http';
import { playManagedAudio, stopAllAudio } from './audioManager';

const QURAN_KEY = 'quran_uthmani_full_v1';
const AUDIO_MAP_KEY = 'surah_audio_paths_v1';
const AYAH_AUDIO_MAP_KEY = 'ayah_audio_paths_v1';
const ACTIVE_RECITER_KEY = 'active_reciter_by_surah_v1';

let activeSurahDownload: FileSystem.DownloadResumable | null = null;
let activeAyahDownload: FileSystem.DownloadResumable | null = null;
let cancelRequested = false;
let sequenceToken = 0;

function normalizeQuranPayload(payload: any) {
  if (payload?.data?.surahs) return payload.data;
  if (payload?.surahs) return payload;
  return { surahs: [] };
}

function normalizeSurahAudioMapShape(
  map: Record<string, any>,
  surahNumber: number,
  fallbackEdition = '__legacy__'
) {
  const key = `${surahNumber}`;
  const value = map?.[key];
  if (!value) {
    map[key] = {};
    return;
  }
  if (typeof value === 'string') {
    map[key] = { [fallbackEdition]: value };
  }
}

export async function getOrDownloadQuran() {
  const cached = await AsyncStorage.getItem(QURAN_KEY);
  if (cached) {
    try {
      return normalizeQuranPayload(JSON.parse(cached));
    } catch {
      await AsyncStorage.removeItem(QURAN_KEY);
    }
  }

  const { data } = await ummahApi.get('/quran/quran-uthmani');
  await AsyncStorage.setItem(QURAN_KEY, JSON.stringify(data));
  return normalizeQuranPayload(data);
}

export async function refreshQuranCacheInBackground() {
  try {
    const { data } = await ummahApi.get('/quran/quran-uthmani');
    await AsyncStorage.setItem(QURAN_KEY, JSON.stringify(data));
  } catch {
    // Keep existing cache if refresh fails.
  }
}

export async function getReciters() {
  const { data } = await ummahApi.get('/edition?format=audio&language=ar&type=versebyverse');
  return data?.data ?? [];
}

export async function downloadSurahAudio(surahNumber: number, edition = 'ar.alafasy') {
  const audioDir = `${FileSystem.documentDirectory}audio/`;
  await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });

  const fileUri = `${audioDir}surah-${surahNumber}-${edition}.mp3`;
  const remote = `https://cdn.islamic.network/quran/audio-surah/128/${edition}/${surahNumber}.mp3`;

  const existing = await FileSystem.getInfoAsync(fileUri);
  if (!existing.exists) {
    await FileSystem.downloadAsync(remote, fileUri);
  }

  const rawMap = await AsyncStorage.getItem(AUDIO_MAP_KEY);
  const map = rawMap ? JSON.parse(rawMap) : {};
  normalizeSurahAudioMapShape(map, surahNumber, edition);
  map[`${surahNumber}`][edition] = fileUri;
  await AsyncStorage.setItem(AUDIO_MAP_KEY, JSON.stringify(map));
  await setActiveReciterForSurah(surahNumber, edition);
  return fileUri;
}

export async function downloadSurahAudioWithProgress(
  surahNumber: number,
  onProgress: (progress: number) => void,
  edition = 'ar.alafasy'
) {
  cancelRequested = false;
  const audioDir = `${FileSystem.documentDirectory}audio/`;
  await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });

  const fileUri = `${audioDir}surah-${surahNumber}-${edition}.mp3`;
  const remote = `https://cdn.islamic.network/quran/audio-surah/128/${edition}/${surahNumber}.mp3`;

  const existing = await FileSystem.getInfoAsync(fileUri);
  if (!existing.exists) {
    const download = FileSystem.createDownloadResumable(
      remote,
      fileUri,
      {},
      (event) => {
        if (!event.totalBytesExpectedToWrite) return;
        const progress = event.totalBytesWritten / event.totalBytesExpectedToWrite;
        onProgress(Math.max(0, Math.min(0.7, progress * 0.7)));
      }
    );
    activeSurahDownload = download;
    try {
      await download.downloadAsync();
    } catch (error: any) {
      if (cancelRequested) {
        throw new Error('DOWNLOAD_CANCELED');
      }
      throw error;
    } finally {
      activeSurahDownload = null;
    }
  } else {
    onProgress(0.7);
  }

  const rawMap = await AsyncStorage.getItem(AUDIO_MAP_KEY);
  const map = rawMap ? JSON.parse(rawMap) : {};
  normalizeSurahAudioMapShape(map, surahNumber, edition);
  map[`${surahNumber}`] = map[`${surahNumber}`] || {};
  map[`${surahNumber}`][edition] = fileUri;
  await AsyncStorage.setItem(AUDIO_MAP_KEY, JSON.stringify(map));

  // Download ayah-by-ayah audio files too so each ayah can be played offline.
  const ayahAudioResponse = await ummahApi.get(`/surah/${surahNumber}/${edition}`);
  const ayahs = ayahAudioResponse?.data?.data?.ayahs ?? [];
  const ayahDir = `${audioDir}ayahs/surah-${surahNumber}/`;
  await FileSystem.makeDirectoryAsync(ayahDir, { intermediates: true });

  const rawAyahMap = await AsyncStorage.getItem(AYAH_AUDIO_MAP_KEY);
  const ayahMap = rawAyahMap ? JSON.parse(rawAyahMap) : {};
  ayahMap[`${surahNumber}`] = ayahMap[`${surahNumber}`] || {};
  ayahMap[`${surahNumber}`][edition] = ayahMap[`${surahNumber}`][edition] || {};

  for (let i = 0; i < ayahs.length; i += 1) {
    if (cancelRequested) {
      throw new Error('DOWNLOAD_CANCELED');
    }

    const ayah = ayahs[i];
    const localAyahUri = `${ayahDir}ayah-${ayah.numberInSurah}.mp3`;
    const localAyahInfo = await FileSystem.getInfoAsync(localAyahUri);

    if (!localAyahInfo.exists && ayah.audio) {
      const ayahDownload = FileSystem.createDownloadResumable(ayah.audio, localAyahUri);
      activeAyahDownload = ayahDownload;
      try {
        await ayahDownload.downloadAsync();
      } catch (error: any) {
        if (cancelRequested) {
          throw new Error('DOWNLOAD_CANCELED');
        }
        throw error;
      } finally {
        activeAyahDownload = null;
      }
    }

    ayahMap[`${surahNumber}`][edition][`${ayah.numberInSurah}`] = localAyahUri;
    const ayahProgress = (i + 1) / Math.max(1, ayahs.length);
    onProgress(0.7 + ayahProgress * 0.3);
  }

  await AsyncStorage.setItem(AYAH_AUDIO_MAP_KEY, JSON.stringify(ayahMap));
  await setActiveReciterForSurah(surahNumber, edition);
  onProgress(1);
  return fileUri;
}

export async function cancelSurahAudioDownload() {
  cancelRequested = true;
  if (activeSurahDownload) {
    try {
      await activeSurahDownload.cancelAsync();
    } catch {
      // noop
    } finally {
      activeSurahDownload = null;
    }
  }
  if (activeAyahDownload) {
    try {
      await activeAyahDownload.cancelAsync();
    } catch {
      // noop
    } finally {
      activeAyahDownload = null;
    }
  }
}

export async function getLocalAudioPath(surahNumber: number) {
  const raw = await AsyncStorage.getItem(AUDIO_MAP_KEY);
  if (!raw) return null;
  const map = JSON.parse(raw) as Record<string, any>;
  normalizeSurahAudioMapShape(map, surahNumber);
  const activeReciter = await getActiveReciterForSurah(surahNumber);
  if (activeReciter && map?.[`${surahNumber}`]?.[activeReciter]) {
    return map[`${surahNumber}`][activeReciter];
  }
  const firstReciterPath = Object.values(map?.[`${surahNumber}`] || {})[0];
  return firstReciterPath ?? null;
}

export async function getLocalAudioPathForReciter(surahNumber: number, edition: string) {
  const raw = await AsyncStorage.getItem(AUDIO_MAP_KEY);
  if (!raw) return null;
  const map = JSON.parse(raw) as Record<string, any>;
  normalizeSurahAudioMapShape(map, surahNumber);
  return map?.[`${surahNumber}`]?.[edition] ?? null;
}

export async function getLocalAyahAudioPath(surahNumber: number, ayahNumber: number) {
  const raw = await AsyncStorage.getItem(AYAH_AUDIO_MAP_KEY);
  if (!raw) return null;
  const map = JSON.parse(raw) as Record<string, Record<string, Record<string, string>>>;
  const activeReciter = await getActiveReciterForSurah(surahNumber);
  if (activeReciter && map?.[`${surahNumber}`]?.[activeReciter]?.[`${ayahNumber}`]) {
    return map[`${surahNumber}`][activeReciter][`${ayahNumber}`];
  }
  const firstReciter = Object.values(map?.[`${surahNumber}`] || {})[0] as Record<string, string> | undefined;
  return firstReciter?.[`${ayahNumber}`] ?? null;
}

export async function getLocalAyahAudioPathForReciter(surahNumber: number, ayahNumber: number, edition: string) {
  const raw = await AsyncStorage.getItem(AYAH_AUDIO_MAP_KEY);
  if (!raw) return null;
  const map = JSON.parse(raw) as Record<string, Record<string, Record<string, string>>>;
  return map?.[`${surahNumber}`]?.[edition]?.[`${ayahNumber}`] ?? null;
}

export async function hasDownloadedSurahForReciter(surahNumber: number, edition: string) {
  const raw = await AsyncStorage.getItem(AUDIO_MAP_KEY);
  if (!raw) return false;
  const map = JSON.parse(raw) as Record<string, any>;
  normalizeSurahAudioMapShape(map, surahNumber);
  return !!map?.[`${surahNumber}`]?.[edition];
}

export async function localFileExists(uri: string) {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) return false;
  const size = (info as any).size;
  if (typeof size === 'number' && size <= 0) return false;
  return true;
}

export async function setActiveReciterForSurah(surahNumber: number, edition: string) {
  const raw = await AsyncStorage.getItem(ACTIVE_RECITER_KEY);
  const map = raw ? JSON.parse(raw) : {};
  map[`${surahNumber}`] = edition;
  await AsyncStorage.setItem(ACTIVE_RECITER_KEY, JSON.stringify(map));
}

export async function getActiveReciterForSurah(surahNumber: number) {
  const raw = await AsyncStorage.getItem(ACTIVE_RECITER_KEY);
  if (!raw) return null;
  const map = JSON.parse(raw) as Record<string, string>;
  return map?.[`${surahNumber}`] ?? null;
}

export async function playAudio(uri: string) {
  sequenceToken += 1;
  return playManagedAudio({ uri });
}

export async function playAudioSequence(uris: string[]) {
  sequenceToken += 1;
  const currentToken = sequenceToken;
  const validUris = uris.filter(Boolean);
  if (!validUris.length) {
    throw new Error('NO_SEQUENCE_AUDIO');
  }

  await stopAllAudio();

  const playAt = async (index: number): Promise<void> => {
    if (currentToken !== sequenceToken) return;
    if (index >= validUris.length) return;
    await playManagedAudio(
      { uri: validUris[index] },
      { onDidFinish: () => void playAt(index + 1).catch(() => undefined) }
    );
  };

  await playAt(0);
}

export async function getAllLocalAyahAudioPathsForReciter(surahNumber: number, edition: string) {
  const raw = await AsyncStorage.getItem(AYAH_AUDIO_MAP_KEY);
  if (!raw) return [];
  const map = JSON.parse(raw) as Record<string, Record<string, Record<string, string>>>;
  const ayahMap = map?.[`${surahNumber}`]?.[edition];
  if (!ayahMap) return [];
  return Object.keys(ayahMap)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
    .map((n) => ayahMap[`${n}`])
    .filter(Boolean);
}

export async function stopAudio() {
  sequenceToken += 1;
  await stopAllAudio();
}

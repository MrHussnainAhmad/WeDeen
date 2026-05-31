import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { playManagedAudio, stopAllAudio } from '@/services/audioManager';
import { MUHAMMAD_99_NAMES } from '@/constants/muhammadNames';

type NameItem = {
  id: number;
  arabic: string;
  transliteration: string;
  meaning?: string;
  audioUrl?: string;
};

type AllahApiResult = {
  number: number;
  name?: {
    arabic?: string;
    transliteration?: string;
    translated?: string;
  };
  meaning?: string;
  audio_url?: string;
};

const ALLAH_NAMES_CACHE_KEY = 'names_allah_cache_v1';
const MUHAMMAD_NAMES_CACHE_KEY = 'names_muhammad_cache_v3';
const MUHAMMAD_AUDIO_MAP_KEY = 'names_muhammad_audio_map_v1';
const NAMES_DOWNLOAD_FLAG_PREFIX = 'names_downloaded_v1_';
const MUHAMMAD_AUDIO_DIR = `${FileSystem.documentDirectory}names-muhammad-audio/`;

function buildMuhammadFallback(): NameItem[] {
  return MUHAMMAD_99_NAMES.map((item, index) => ({
    id: index + 1,
    arabic: `اسم محمد ${index + 1}`,
    transliteration: item.transliteration,
    meaning: item.meaning,
  }));
}

async function fetchAllahNames(): Promise<NameItem[]> {
  const response = await fetch('https://asmaul-husna-api-coral.vercel.app/api/asmaul-husna?lang=english');
  if (!response.ok) {
    throw new Error('Failed to fetch Allah names from API.');
  }

  const json = await response.json();
  const results: AllahApiResult[] = Array.isArray(json?.results) ? json.results : [];

  return results
    .map((item) => ({
      id: item.number,
      arabic: item.name?.arabic || `اسم ${item.number}`,
      transliteration: item.name?.transliteration || `Name ${item.number}`,
      meaning: item.name?.translated || item.meaning,
      audioUrl: item.audio_url,
    }))
    .sort((a, b) => a.id - b.id)
    .slice(0, 99);
}

function stripTags(input: string) {
  return input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeHtml(input: string) {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function getMuhammadTtsCandidates(text: string) {
  const encoded = encodeURIComponent(text);
  return [
    {
      url: `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encoded}&tl=ar&client=tw-ob`,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    },
    {
      url: `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=ar&client=tw-ob`,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    },
    {
      url: `https://api.streamelements.com/kappa/v2/speech?voice=Zeina&text=${encoded}`,
      headers: undefined as Record<string, string> | undefined,
    },
  ];
}

async function downloadWithFallback(targetPath: string, text: string) {
  let lastError: unknown;
  const candidates = getMuhammadTtsCandidates(text);
  for (const candidate of candidates) {
    try {
      await FileSystem.downloadAsync(candidate.url, targetPath, candidate.headers ? { headers: candidate.headers } : undefined);
      const info = await FileSystem.getInfoAsync(targetPath);
      if (info.exists) return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('No audio provider succeeded.');
}

async function fetchMuhammadNamesFromApi(): Promise<NameItem[]> {
  const response = await fetch('https://www.quranhomeschool.com/blog/tag/asma-un-nabi/');
  if (!response.ok) throw new Error('Failed to fetch Muhammad names source.');
  const html = await response.text();

  const start = html.indexOf('The List of 99 Titles and Names of Prophet Muhammad');
  if (start < 0) throw new Error('Muhammad names table not found in source.');
  const tableStart = html.indexOf('<table', start);
  const tableEnd = html.indexOf('</table>', tableStart);
  if (tableStart < 0 || tableEnd < 0) throw new Error('Muhammad names table unavailable.');

  const tableHtml = html.slice(tableStart, tableEnd);
  const rows = [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)];
  const parsed: NameItem[] = [];

  for (const rowMatch of rows) {
    const cells = [...rowMatch[0].matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)].map((m) => decodeHtml(stripTags(m[1])));
    if (cells.length < 4) continue;
    const id = Number(cells[0].replace(/[^\d]/g, ''));
    const arabic = cells[1];
    const transliteration = cells[2];
    const meaning = cells[3];
    if (!Number.isFinite(id) || id < 1 || id > 99) continue;
    if (!arabic || !transliteration) continue;
    parsed.push({ id, arabic, transliteration, meaning });
  }

  const deduped = new Map<number, NameItem>();
  for (const item of parsed) {
    if (!deduped.has(item.id)) deduped.set(item.id, item);
  }
  const result = Array.from(deduped.values()).sort((a, b) => a.id - b.id).slice(0, 99);
  if (result.length < 99) throw new Error('Muhammad names source returned incomplete data.');
  return result;
}

async function getCachedNames(type: 'allah' | 'muhammad'): Promise<NameItem[] | null> {
  const key = type === 'allah' ? ALLAH_NAMES_CACHE_KEY : MUHAMMAD_NAMES_CACHE_KEY;
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as any[];
    if (!Array.isArray(parsed)) return null;
    if (type === 'muhammad') {
      const names = parsed as NameItem[];
      if (names.length !== 99) return null;
      return names;
    }
    return parsed
      .map((item) => ({
        id: item.number,
        arabic: item.name?.arabic || `اسم ${item.number}`,
        transliteration: item.name?.transliteration || `Name ${item.number}`,
        meaning: item.name?.translated || item.meaning,
        audioUrl: item.audio_url,
      }))
      .sort((a, b) => a.id - b.id)
      .slice(0, 99);
  } catch {
    return null;
  }
}

export default function NamesDetailScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const normalizedType = type === 'muhammad' ? 'muhammad' : 'allah';
  const title = normalizedType === 'allah' ? '99 Names of Allah' : '99 Names of Muhammad';

  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [names, setNames] = useState<NameItem[]>([]);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [audioBusy, setAudioBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      setFetchError(null);
      setPlayingId(null);
      const downloadFlag = await AsyncStorage.getItem(`${NAMES_DOWNLOAD_FLAG_PREFIX}${normalizedType}`);
      setIsDownloaded(downloadFlag === '1');
      try {
        if (normalizedType === 'allah') {
          const cached = await getCachedNames('allah');
          if (cached?.length) {
            if (!mounted) return;
            setNames(cached);
            setIsLoading(false);
          }
          const apiNames = await fetchAllahNames();
          if (!mounted) return;
          setNames(apiNames);
          await AsyncStorage.setItem(
            ALLAH_NAMES_CACHE_KEY,
            JSON.stringify(
              apiNames.map((item) => ({
                number: item.id,
                name: {
                  arabic: item.arabic,
                  transliteration: item.transliteration,
                  translated: item.meaning,
                },
                meaning: item.meaning,
                audio_url: item.audioUrl,
              }))
            )
          );
        } else {
          const cached = await getCachedNames('muhammad');
          if (cached?.length && mounted) {
            setNames(cached);
            setIsLoading(false);
          }
          const apiNames = await fetchMuhammadNamesFromApi();
          if (!mounted) return;
          setNames(apiNames);
          await AsyncStorage.setItem(MUHAMMAD_NAMES_CACHE_KEY, JSON.stringify(apiNames));
        }
      } catch (error: any) {
        if (!mounted) return;
        setFetchError(error?.message || 'Unable to fetch names.');
        const cached = await getCachedNames(normalizedType);
        if (cached?.length) {
          setNames(cached);
        } else {
          setNames(normalizedType === 'allah' ? [] : buildMuhammadFallback());
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [normalizedType]);

  useEffect(() => {
    return () => {
      stopAllAudio().catch(() => undefined);
    };
  }, []);

  const downloadableCount = useMemo(
    () => names.filter((item) => typeof item.audioUrl === 'string' && item.audioUrl.length > 0).length,
    [names]
  );

  const onDownloadAll = async () => {
    if (names.length === 0) {
      Alert.alert('No names', 'No items available to download yet.');
      return;
    }

    if (normalizedType === 'muhammad') {
      setDownloadingAll(true);
      try {
        await FileSystem.makeDirectoryAsync(MUHAMMAD_AUDIO_DIR, { intermediates: true });
        const audioMap: Record<string, string> = {};
        for (const item of names) {
          const text = (item.arabic || '').trim();
          if (!text) continue;
          const localFile = `${MUHAMMAD_AUDIO_DIR}${item.id}.mp3`;
          const info = await FileSystem.getInfoAsync(localFile);
          if (!info.exists) {
            await downloadWithFallback(localFile, text);
          }
          audioMap[`${item.id}`] = localFile;
        }
        await AsyncStorage.setItem(MUHAMMAD_AUDIO_MAP_KEY, JSON.stringify(audioMap));
        setIsDownloaded(true);
        await AsyncStorage.setItem(`${NAMES_DOWNLOAD_FLAG_PREFIX}${normalizedType}`, '1');
        Alert.alert('Download complete', 'Each Muhammad name audio is downloaded.');
      } catch (error: any) {
        Alert.alert('Download failed', error?.message || 'Could not download Muhammad names audio.');
      } finally {
        setDownloadingAll(false);
      }
      return;
    }

    if (downloadableCount === 0) {
      Alert.alert('Audio missing', 'Audio links are not available from API right now.');
      return;
    }

    setDownloadingAll(true);
    try {
      await Promise.all(
        names
          .filter((item) => item.audioUrl)
          .map(async (item) => {
            const response = await fetch(item.audioUrl as string, { method: 'HEAD' });
            if (!response.ok) {
              throw new Error(`Audio check failed at item ${item.id}.`);
            }
          })
      );
      setIsDownloaded(true);
      await AsyncStorage.setItem(`${NAMES_DOWNLOAD_FLAG_PREFIX}${normalizedType}`, '1');
      Alert.alert('Download complete', 'All 99 names are ready for listening.');
    } catch (error: any) {
      Alert.alert('Download failed', error?.message || 'Could not verify all audio files.');
    } finally {
      setDownloadingAll(false);
    }
  };

  const onListen = async (item: NameItem) => {
    if (!isDownloaded) {
      Alert.alert('Download required', 'Please download all 99 names first.');
      return;
    }

    try {
      if (audioBusy) return;
      setAudioBusy(true);
      setIsPlayingAll(false);

      if (normalizedType === 'muhammad') {
        const rawMap = await AsyncStorage.getItem(MUHAMMAD_AUDIO_MAP_KEY);
        const map = rawMap ? (JSON.parse(rawMap) as Record<string, string>) : {};
        const uri = map?.[`${item.id}`];
        if (!uri) {
          Alert.alert('Audio unavailable', 'Please download Muhammad names audio first.');
          return;
        }
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) {
          Alert.alert('Audio missing', 'Please download again.');
          return;
        }
        await playManagedAudio({ uri }, {
          onDidFinish: () => {
            setPlayingId((current) => (current === item.id ? null : current));
          },
        });
        setPlayingId(item.id);
        return;
      }

      if (!item.audioUrl) {
        Alert.alert('Audio unavailable', 'Audio is not available for this name from current API data.');
        setPlayingId(null);
        return;
      }
      await playManagedAudio(
        { uri: item.audioUrl },
        {
          onDidFinish: () => {
            setPlayingId((current) => (current === item.id ? null : current));
          },
        }
      );
      setPlayingId(item.id);
    } catch {
      Alert.alert('Playback error', 'Unable to play this audio right now.');
      setPlayingId(null);
    } finally {
      setAudioBusy(false);
    }
  };

  const onPlayAll = async () => {
    if (!isDownloaded) {
      Alert.alert('Download required', 'Please download all 99 names first.');
      return;
    }

    try {
      if (audioBusy) return;
      setAudioBusy(true);
      await stopAllAudio();

      if (isPlayingAll) {
        setIsPlayingAll(false);
        return;
      }

      const source =
        normalizedType === 'allah'
          ? require('@/assets/audio/Allah.m4a')
          : require('@/assets/audio/Muhammad.m4a');

      await playManagedAudio(source, {
        onDidFinish: () => {
          setIsPlayingAll(false);
        },
      });
      setIsPlayingAll(true);
      setPlayingId(null);
    } catch {
      Alert.alert('Playback error', 'Unable to play local full audio right now.');
      setIsPlayingAll(false);
    } finally {
      setAudioBusy(false);
    }
  };

  return (
    <FlatList
      data={isLoading ? [] : names}
      keyExtractor={(item) => `${item.id}`}
      style={styles.screen}
      contentContainerStyle={styles.content}
      removeClippedSubviews
      initialNumToRender={14}
      maxToRenderPerBatch={18}
      windowSize={9}
      ListHeaderComponent={
        <View style={styles.headerCard}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Read every name here. Listening unlocks after you download all 99 names.</Text>
        {fetchError ? <Text style={styles.errorText}>{fetchError}</Text> : null}

        <Pressable
          onPress={onDownloadAll}
          disabled={downloadingAll || isLoading}
          style={({ pressed }) => [styles.downloadButton, (pressed || downloadingAll || isLoading) && styles.pressed]}
        >
          {downloadingAll ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="download-outline" size={16} color="#fff" />
          )}
          <Text style={styles.downloadText}>
            {isDownloaded ? 'Downloaded' : downloadingAll ? 'Preparing...' : 'Download all 99 names'}
          </Text>
        </Pressable>
        {isDownloaded ? (
          <Pressable onPress={() => void onPlayAll()} style={({ pressed }) => [styles.playAllButton, pressed && styles.pressed]}>
            <MaterialCommunityIcons name={isPlayingAll ? 'stop-circle-outline' : 'play-circle-outline'} size={16} color={colors.primary} />
            <Text style={styles.playAllText}>{isPlayingAll ? 'Stop Play All' : 'Play All 99 Names'}</Text>
          </Pressable>
        ) : null}
        </View>
      }
      ListEmptyComponent={
        isLoading ? (
          <View style={[styles.listCard, styles.loadingWrap]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Fetching names from Islamic API...</Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.indexBubble}>
            <Text style={styles.indexText}>{item.id}</Text>
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.arabic}>{item.arabic}</Text>
            <Text style={styles.transliteration}>{item.transliteration}</Text>
            {item.meaning ? <Text style={styles.meaning}>{item.meaning}</Text> : null}
          </View>
          <Pressable onPress={() => void onListen(item)} style={({ pressed }) => [styles.listenBtn, pressed && styles.pressed]}>
            <MaterialCommunityIcons
              name={playingId === item.id ? 'pause-circle-outline' : 'play-circle-outline'}
              size={20}
              color={colors.primary}
            />
          </Pressable>
        </View>
      )}
      ListFooterComponent={<View style={styles.listBottomGap} />}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6E0D5',
    padding: 14,
  },
  title: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 18,
  },
  subtitle: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 12,
  },
  errorText: {
    marginTop: 6,
    color: '#A02929',
    fontSize: 12,
    fontWeight: '600',
  },
  downloadButton: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  downloadText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  playAllButton: {
    marginTop: 8,
    backgroundColor: '#EBF5F1',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: '#CFE6DE',
  },
  playAllText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6E0D5',
    paddingVertical: 6,
  },
  loadingWrap: {
    paddingVertical: 18,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1ECE2',
    gap: 10,
  },
  listBottomGap: {
    height: 8,
  },
  indexBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EBF5F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 11,
  },
  textBlock: {
    flex: 1,
  },
  arabic: {
    color: colors.text,
    fontSize: 22,
    fontFamily: 'KFGQPCNastaleeq',
    textAlign: 'right',
  },
  transliteration: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
  },
  meaning: {
    marginTop: 2,
    color: '#54615B',
    fontSize: 11,
  },
  listenBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EBF5F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
});

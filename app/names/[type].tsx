import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { playManagedAudio, stopAllAudio } from '@/services/audioManager';

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

const MUHAMMAD_STARTER = [
  'Muhammad',
  'Ahmad',
  'Al-Mahi',
  'Al-Hashir',
  'Al-Aqib',
  'Al-Mustafa',
  'Al-Mujtaba',
  'Rasulullah',
  'Nabiyullah',
  'Habibullah',
  'Al-Amin',
  'As-Sadiq',
  'Taha',
  'Yasin',
  'Abul-Qasim',
];

function buildMuhammadFallback(): NameItem[] {
  return Array.from({ length: 99 }, (_, index) => {
    const starter = MUHAMMAD_STARTER[index];
    return {
      id: index + 1,
      arabic: starter ? `اسم ${index + 1}` : `اسم محمد ${index + 1}`,
      transliteration: starter || `Muhammad Name ${index + 1}`,
    };
  });
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
      setIsDownloaded(false);
      setPlayingId(null);
      try {
        if (normalizedType === 'allah') {
          const apiNames = await fetchAllahNames();
          if (!mounted) return;
          setNames(apiNames);
        } else {
          if (!mounted) return;
          setNames(buildMuhammadFallback());
        }
      } catch (error: any) {
        if (!mounted) return;
        setFetchError(error?.message || 'Unable to fetch names.');
        setNames(normalizedType === 'allah' ? [] : buildMuhammadFallback());
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
      setIsDownloaded(true);
      Alert.alert('Ready', 'Muhammad names are loaded. Audio source is not available from the current API.');
      return;
    }

    if (downloadableCount === 0) {
      Alert.alert('Audio missing', 'Audio links are not available from API right now.');
      return;
    }

    setDownloadingAll(true);
    try {
      // Keep UX lightweight: we verify all audio URLs are reachable before allowing playback.
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

    if (!item.audioUrl) {
      Alert.alert('Audio unavailable', 'Audio is not available for this name from current API data.');
      return;
    }

    try {
      if (audioBusy) return;
      setAudioBusy(true);
      setIsPlayingAll(false);
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
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

      <View style={styles.listCard}>
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Fetching names from Islamic API...</Text>
          </View>
        ) : (
          names.map((item) => (
            <View key={item.id} style={styles.row}>
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
          ))
        )}
      </View>
    </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1ECE2',
    gap: 10,
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
    fontSize: 14,
    fontWeight: '700',
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

import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  cancelSurahAudioDownload,
  downloadSurahAudioWithProgress,
  getActiveReciterForSurah,
  getReciters,
  hasDownloadedSurahForReciter,
  getLocalAudioPathForReciter,
  getLocalAyahAudioPathForReciter,
  getAllLocalAyahAudioPathsForReciter,
  localFileExists,
  playAudioSequence,
  setActiveReciterForSurah,
  getLocalAyahAudioPath,
  getLocalAudioPath,
  getOrDownloadQuran,
  playAudio,
  pauseAudio,
  resumeAudio,
  stopAudio
} from '@/services/quranService';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { EightPointStar, GeometricDivider, StarFieldWatermark } from '@/components/IslamicMotifs';
import { PressableScale } from '@/components/Anim';
import { getUiPreferences, uiPreferenceDefaults } from '@/utils/preferences';

export default function SurahDetailScreen() {
  const { surah } = useLocalSearchParams<{ surah: string }>();
  const insets = useSafeAreaInsets();
  const surahNumber = Number(surah);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [activeAyah, setActiveAyah] = useState<number | null>(null);
  const [playback, setPlayback] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [selectedEdition, setSelectedEdition] = useState('ar.alafasy');
  const [showReciterDropdown, setShowReciterDropdown] = useState(false);
  const [arabicAyahFontSize, setArabicAyahFontSize] = useState(
    uiPreferenceDefaults.arabicAyahFontSize
  );

  const quranQuery = useQuery({ queryKey: ['quran-full'], queryFn: () => getOrDownloadQuran() });
  const recitersQuery = useQuery({ queryKey: ['reciters'], queryFn: getReciters });
  const surahData = quranQuery.data?.surahs?.find((s: any) => s.number === surahNumber);
  const surahAyahCount =
    surahData?.numberOfAyahs ??
    surahData?.ayahs?.length ??
    surahData?.ayahCount ??
    surahData?.totalAyahs ??
    0;
  const reciters = (recitersQuery.data ?? []).filter((r: any) => r?.identifier && r?.name);

  useEffect(() => {
    getActiveReciterForSurah(surahNumber)
      .then((edition) => {
        if (edition) setSelectedEdition(edition);
      })
      .catch(() => undefined);
  }, [surahNumber]);

  useFocusEffect(
    useCallback(() => {
      getUiPreferences()
        .then((prefs) => setArabicAyahFontSize(prefs.arabicAyahFontSize))
        .catch(() => undefined);
      return () => undefined;
    }, [])
  );

  // Stop playback when leaving the surah so audio doesn't keep going on other screens.
  useEffect(() => {
    return () => {
      stopAudio().catch(() => undefined);
    };
  }, []);

  const onDownloadAudio = async (edition: string) => {
    try {
      setDownloaded(false);
      setDownloadProgress(0);
      setIsDownloading(true);
      setShowReciterDropdown(false);
      setSelectedEdition(edition);
      await downloadSurahAudioWithProgress(surahNumber, setDownloadProgress, edition);
      setDownloaded(true);
      const selectedReciter = reciters.find((r: any) => r.identifier === edition);
      if (selectedReciter?.englishName || selectedReciter?.name) {
        setStatusMessage(`Downloaded with reciter: ${selectedReciter.englishName ?? selectedReciter.name}`);
      }
    } catch (error: any) {
      if (error?.message === 'DOWNLOAD_CANCELED') {
        setStatusMessage('Download canceled.');
      } else {
        setStatusMessage('Download failed. Please try again.');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const onCancelDownload = async () => {
    setIsDownloading(false);
    setStatusMessage('Canceling download...');
    await cancelSurahAudioDownload();
  };

  // Start full-surah playback from the beginning (used by both a fresh Play and
  // the Restart action while already playing).
  const startFromBeginning = async () => {
    setShowReciterDropdown(false);
    const localSelected = await getLocalAudioPathForReciter(surahNumber, selectedEdition);
    const selectedValid = localSelected ? await localFileExists(localSelected) : false;
    const fallback = await getLocalAudioPath(surahNumber);
    const fallbackValid = fallback ? await localFileExists(fallback) : false;
    const local = selectedValid ? localSelected : fallbackValid ? fallback : null;
    setStatusMessage('');
    setActiveAyah(null);

    if (local) {
      try {
        await playAudio(local, () => setPlayback('idle'));
        setPlayback('playing');
        return;
      } catch {
        // fallback below
      }
    }

    const ayahUris = await getAllLocalAyahAudioPathsForReciter(surahNumber, selectedEdition);
    if (!ayahUris.length) {
      setStatusMessage('Please download this surah audio first.');
      setPlayback('idle');
      return;
    }
    await playAudioSequence(ayahUris, () => setPlayback('idle'));
    setPlayback('playing');
    setStatusMessage('Playing full surah using ayah-by-ayah audio.');
  };

  const onPlay = async () => {
    // While playing, this button acts as "Restart" — begin again from the top.
    if (playback === 'playing') {
      await startFromBeginning();
      return;
    }
    // If paused, resume from where it stopped.
    if (playback === 'paused') {
      const resumed = await resumeAudio();
      if (resumed) {
        setPlayback('playing');
        return;
      }
      // Nothing to resume (sound was torn down) — fall through to a fresh start.
    }
    await startFromBeginning();
  };

  const onPause = async () => {
    // Pause full-surah playback, keeping position so Play can resume.
    if (playback === 'playing') {
      const paused = await pauseAudio();
      if (paused) {
        setPlayback('paused');
        return;
      }
    }
    // Couldn't pause (e.g. ayah-by-ayah sequence) — stop cleanly instead.
    await stopAudio();
    setPlayback('idle');
    setActiveAyah(null);
  };

  const onPlayAyah = async (ayahNumber: number) => {
    if (activeAyah === ayahNumber) {
      await stopAudio();
      setActiveAyah(null);
      return;
    }

    const localAyahSelected = await getLocalAyahAudioPathForReciter(surahNumber, ayahNumber, selectedEdition);
    const selectedAyahValid = localAyahSelected ? await localFileExists(localAyahSelected) : false;
    const fallbackAyah = await getLocalAyahAudioPath(surahNumber, ayahNumber);
    const fallbackAyahValid = fallbackAyah ? await localFileExists(fallbackAyah) : false;
    const localAyah = selectedAyahValid ? localAyahSelected : fallbackAyahValid ? fallbackAyah : null;
    if (!localAyah) {
      setStatusMessage('Download complete surah first to enable ayah playback.');
      return;
    }

    setStatusMessage('');
    // A single-ayah tap takes over from any full-surah playback.
    setPlayback('idle');
    setActiveAyah(ayahNumber);
    // Reset the button when this ayah finishes on its own, so it doesn't stay
    // stuck showing the pause icon.
    await playAudio(localAyah, () =>
      setActiveAyah((current) => (current === ayahNumber ? null : current))
    );
  };

  const onSelectReciterForDownload = async (edition: string) => {
    // Switching reciter discards any current/paused playback so the next Play
    // starts fresh with the newly chosen reciter (never resumes the old audio).
    await stopAudio();
    setPlayback('idle');
    setActiveAyah(null);

    const exists = await hasDownloadedSurahForReciter(surahNumber, edition);
    const localForReciter = await getLocalAudioPathForReciter(surahNumber, edition);
    const validFile = localForReciter ? await localFileExists(localForReciter) : false;
    if (exists && validFile) {
      setSelectedEdition(edition);
      await setActiveReciterForSurah(surahNumber, edition);
      setShowReciterDropdown(false);
      setStatusMessage('This reciter is already downloaded. Switched to it without re-downloading.');
      return;
    }
    await onDownloadAudio(edition);
  };

  return (
    <View style={styles.container}>
      {/* Custom Emerald Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <StarFieldWatermark rows={2} cols={6} starSize={18} color="rgba(255,255,255,0.05)" />
        <View style={styles.headerTopRow}>
          <PressableScale onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </PressableScale>
          <View style={styles.headerCenter}>
            <Text style={styles.surahTitle}>{surahData?.englishName || 'Surah'}</Text>
            <Text style={styles.ayahCount}>{surahAyahCount} Verses</Text>
          </View>
          <View style={styles.headerArabicWrap}>
            <Text style={styles.surahSubtitle}>{surahData?.name}</Text>
          </View>
        </View>
        <GeometricDivider color="rgba(197,155,39,0.5)" style={{ marginTop: 12 }} />
      </View>

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        <View style={styles.buttonWrap}>
          <PressableScale
            onPress={() => setShowReciterDropdown((prev) => !prev)}
            disabled={isDownloading || recitersQuery.isLoading || playback === 'playing'}
            style={[
              styles.button,
              styles.buttonPrimary,
              (isDownloading || playback === 'playing') && { opacity: 0.6 },
            ]}
          >
            <MaterialCommunityIcons name="microphone-outline" size={18} color="#fff" />
            <Text style={styles.buttonText}>
              {isDownloading ? `${Math.round(downloadProgress * 100)}%` : 'Reciter'}
            </Text>
          </PressableScale>
        </View>
        <View style={styles.buttonWrap}>
          <PressableScale onPress={onPlay} style={[styles.button, styles.buttonGold]}>
            <Ionicons name={playback === 'playing' ? 'refresh' : 'play'} size={18} color={colors.primaryDeep} />
            <Text style={[styles.buttonText, { color: colors.primaryDeep }]}>
              {playback === 'playing' ? 'Restart' : playback === 'paused' ? 'Resume' : 'Play'}
            </Text>
          </PressableScale>
        </View>
        <View style={styles.buttonWrap}>
          <PressableScale
            onPress={onPause}
            disabled={playback !== 'playing'}
            style={[
              styles.button,
              styles.buttonSecondary,
              playback !== 'playing' && { opacity: 0.6 },
            ]}
          >
            <Ionicons name="pause" size={18} color="#fff" />
            <Text style={styles.buttonText}>Pause</Text>
          </PressableScale>
        </View>
      </View>

      {/* Reciter Dropdown */}
      {showReciterDropdown && !isDownloading && (
        <View style={styles.reciterDropdown}>
          <Text style={styles.reciterTitle}>Select Reciter</Text>
          <FlatList
            data={reciters.slice(0, 12)}
            keyExtractor={(item: any) => item.identifier}
            scrollEnabled={reciters.length > 5}
            nestedScrollEnabled
            style={{ maxHeight: 250 }}
            renderItem={({ item }: any) => (
              <Pressable
                onPress={() => onSelectReciterForDownload(item.identifier)}
                style={[
                  styles.reciterItem,
                  item.identifier === selectedEdition && styles.reciterItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.reciterItemText,
                    item.identifier === selectedEdition && styles.reciterItemTextActive,
                  ]}
                >
                  {item.englishName ?? item.name}
                </Text>
                {item.identifier === selectedEdition && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </Pressable>
            )}
          />
        </View>
      )}

      {/* Download Progress */}
      {isDownloading && (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressText}>Downloading Audio</Text>
              <Text style={styles.progressPercent}>{Math.round(downloadProgress * 100)}%</Text>
            </View>
            <Pressable onPress={onCancelDownload} style={styles.cancelButton}>
              <Ionicons name="close" size={20} color={colors.danger} />
            </Pressable>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.round(downloadProgress * 100)}%` }]} />
          </View>
        </View>
      )}

      {/* Status Messages */}
      {downloaded && (
        <View style={styles.successMessage}>
          <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
          <Text style={styles.successText}>Audio downloaded successfully</Text>
        </View>
      )}

      {statusMessage && (
        <View style={styles.infoMessage}>
          <Ionicons name="information-circle" size={18} color={colors.goldDeep} />
          <Text style={styles.infoText}>{statusMessage}</Text>
        </View>
      )}

      {/* Ayahs List */}
      <FlatList
        data={surahData?.ayahs ?? []}
        keyExtractor={(item: any) => `${item.numberInSurah}`}
        scrollEventThrottle={16}
        decelerationRate="fast"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews={true}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        ListHeaderComponent={
          surahNumber !== 1 && surahNumber !== 9 ? (
            <View style={styles.bismillahCard}>
              <Text style={styles.bismillahText}>{'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          quranQuery.isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : null
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        renderItem={({ item }: any) => (
          <View style={styles.ayahCard}>
            <View style={styles.ayahRow}>
              <View style={styles.ayahControlColumn}>
                <View style={styles.ayahBadge}>
                  <EightPointStar size={34} color={colors.primarySoft} />
                  <Text style={styles.ayahNumber}>{item.numberInSurah}</Text>
                </View>
                <Pressable
                  onPress={() => onPlayAyah(item.numberInSurah)}
                  style={[
                    styles.playButton,
                    activeAyah === item.numberInSurah && styles.playButtonActive,
                  ]}
                >
                  <Ionicons
                    name={activeAyah === item.numberInSurah ? 'pause' : 'play'}
                    size={15}
                    color={activeAyah === item.numberInSurah ? '#fff' : colors.primary}
                  />
                </Pressable>
              </View>
              <Text
                style={[
                  styles.ayahText,
                  { fontSize: arabicAyahFontSize, lineHeight: Math.round(arabicAyahFontSize * 1.75) },
                ]}
              >
                {item.text}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    backgroundColor: colors.primaryDeep,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
    ...shadow.raised,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  headerArabicWrap: {
    minWidth: 90,
    alignItems: 'flex-end',
  },
  surahTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    fontFamily: fonts.serif,
  },
  surahSubtitle: {
    fontSize: 28,
    color: colors.gold,
    fontFamily: fonts.arabic,
    textAlign: 'right',
  },
  ayahCount: {
    fontSize: 12.5,
    color: colors.onDarkMuted,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  controlsContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  buttonWrap: {
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: radius.sm,
    gap: 6,
    ...shadow.soft,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonGold: {
    backgroundColor: colors.gold,
  },
  buttonSecondary: {
    backgroundColor: colors.muted,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  reciterDropdown: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  reciterTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
    fontFamily: fonts.serif,
  },
  reciterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: radius.sm,
    marginBottom: 6,
    backgroundColor: colors.cardAlt,
  },
  reciterItemActive: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryTint,
  },
  reciterItemText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  reciterItemTextActive: {
    fontWeight: '800',
    color: colors.primary,
  },
  progressContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  progressPercent: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  cancelButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.bgDeep,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 4,
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primaryTint,
  },
  successText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  infoMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: colors.goldSoft,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.goldDeep,
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  bismillahCard: {
    alignItems: 'center',
    paddingVertical: 18,
    marginBottom: 4,
  },
  bismillahText: {
    fontFamily: fonts.arabic,
    color: colors.primaryDark,
    fontSize: 26,
    lineHeight: 46,
    textAlign: 'center',
  },
  ayahCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRightWidth: 4,
    borderRightColor: colors.gold,
    ...shadow.soft,
  },
  ayahRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  ayahControlColumn: {
    alignItems: 'center',
    gap: 10,
  },
  ayahBadge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ayahNumber: {
    position: 'absolute',
    fontSize: 12.5,
    fontWeight: '900',
    color: colors.primary,
  },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ayahText: {
    flex: 1,
    marginTop: 6,
    color: colors.text,
    textAlign: 'right',
    fontFamily: fonts.arabic,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
});

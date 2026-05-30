import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons, FontAwesome6, MaterialCommunityIcons } from '@expo/vector-icons';
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
  stopAudio
} from '@/services/quranService';
import { colors } from '@/theme/colors';
import { getUiPreferences, uiPreferenceDefaults } from '@/utils/preferences';

export default function SurahDetailScreen() {
  const { surah } = useLocalSearchParams<{ surah: string }>();
  const surahNumber = Number(surah);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [activeAyah, setActiveAyah] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [selectedEdition, setSelectedEdition] = useState('ar.alafasy');
  const [showReciterDropdown, setShowReciterDropdown] = useState(false);
  const [arabicAyahFontSize, setArabicAyahFontSize] = useState(
    uiPreferenceDefaults.arabicAyahFontSize
  );

  const quranQuery = useQuery({ queryKey: ['quran-full'], queryFn: getOrDownloadQuran });
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

  const onPlay = async () => {
    const localSelected = await getLocalAudioPathForReciter(surahNumber, selectedEdition);
    const selectedValid = localSelected ? await localFileExists(localSelected) : false;
    const fallback = await getLocalAudioPath(surahNumber);
    const fallbackValid = fallback ? await localFileExists(fallback) : false;
    const local = selectedValid ? localSelected : fallbackValid ? fallback : null;
    setStatusMessage('');
    setActiveAyah(null);

    if (local) {
      try {
        await playAudio(local);
        return;
      } catch {
        // fallback below
      }
    }

    const ayahUris = await getAllLocalAyahAudioPathsForReciter(surahNumber, selectedEdition);
    if (!ayahUris.length) {
      setStatusMessage('Please download this surah audio first.');
      return;
    }
    await playAudioSequence(ayahUris);
    setStatusMessage('Playing full surah using ayah-by-ayah audio.');
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
    setActiveAyah(ayahNumber);
    await playAudio(localAyah);
  };

  const onSelectReciterForDownload = async (edition: string) => {
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

  const THEME = {
    primary: colors.primary,
    bg: colors.bg,
    card: '#FFFFFF',
    text: colors.text,
    muted: colors.muted,
    border: colors.border,
  };

  return (
    <View style={styles.container}>
      {/* Header with Surah Info */}
      <View style={styles.header}>
        <View style={styles.surahInfo}>
          <View style={styles.surahLeftSection}>
            <Text style={styles.surahTitle}>{surahData?.englishName || 'Surah'}</Text>
            <Text style={styles.ayahCount}>{surahAyahCount} Verses</Text>
          </View>
          <Text style={styles.surahSubtitle}>{surahData?.name}</Text>
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        <Pressable
          onPress={() => setShowReciterDropdown((prev) => !prev)}
          disabled={isDownloading || recitersQuery.isLoading}
          style={[styles.button, styles.buttonPrimary, isDownloading && { opacity: 0.6 }]}
        >
          <MaterialCommunityIcons name="microphone-outline" size={18} color="#fff" />
          <Text style={styles.buttonText}>
            {isDownloading ? `${Math.round(downloadProgress * 100)}%` : 'Reciter'}
          </Text>
        </Pressable>
        <Pressable onPress={onPlay} style={[styles.button, styles.buttonSuccess]}>
          <Ionicons name="play" size={18} color="#fff" />
          <Text style={styles.buttonText}>Play</Text>
        </Pressable>
        <Pressable onPress={stopAudio} style={[styles.button, styles.buttonSecondary]}>
          <Ionicons name="pause" size={18} color="#fff" />
          <Text style={styles.buttonText}>Pause</Text>
        </Pressable>
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
                  <Ionicons name="checkmark" size={20} color={THEME.primary} />
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
              <Text style={styles.progressPercent}>
                {Math.round(downloadProgress * 100)}%
              </Text>
            </View>
            <Pressable
              onPress={onCancelDownload}
              style={styles.cancelButton}
            >
              <Ionicons name="close" size={20} color="#E74C3C" />
            </Pressable>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(downloadProgress * 100)}%` }
              ]}
            />
          </View>
        </View>
      )}

      {/* Status Messages */}
      {downloaded && (
        <View style={styles.successMessage}>
          <Ionicons name="checkmark-circle" size={18} color={THEME.primary} />
          <Text style={styles.successText}>Audio downloaded successfully</Text>
        </View>
      )}

      {statusMessage && (
        <View style={styles.infoMessage}>
          <Ionicons name="information-circle" size={18} color="#9A5D00" />
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
        ListEmptyComponent={
          quranQuery.isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={THEME.primary} />
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }: any) => (
          <View style={styles.ayahCard}>
            <View style={styles.ayahRow}>
              <View style={styles.ayahControlColumn}>
                <View style={styles.ayahBadge}>
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
                    size={16}
                    color={activeAyah === item.numberInSurah ? '#fff' : THEME.primary}
                  />
                </Pressable>
              </View>
              <Text
                style={[
                  styles.ayahText,
                  {
                    fontSize: arabicAyahFontSize,
                    lineHeight: Math.round(arabicAyahFontSize * 1.75),
                  },
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
    paddingVertical: 20,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  surahInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  surahLeftSection: {
    flex: 1,
  },
  surahTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  surahSubtitle: {
    fontSize: 24,
    color: '#fff',
    fontFamily: 'KFGQPCNastaleeq',
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 100,
  },
  ayahCount: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  controlsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.bg,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonSuccess: {
    backgroundColor: '#27AE60',
  },
  buttonSecondary: {
    backgroundColor: '#7F8C8D',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  reciterDropdown: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  reciterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  reciterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: colors.bg,
  },
  reciterItemActive: {
    backgroundColor: 'rgba(15, 122, 90, 0.1)',
  },
  reciterItemText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  reciterItemTextActive: {
    fontWeight: '700',
    color: colors.primary,
  },
  progressContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
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
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(15, 122, 90, 0.1)',
    borderRadius: 10,
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  infoMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(154, 93, 0, 0.1)',
    borderRadius: 10,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9A5D00',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  ayahCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  ayahRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  ayahControlColumn: {
    alignItems: 'center',
    gap: 8,
  },
  ayahBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 122, 90, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ayahNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 122, 90, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonActive: {
    backgroundColor: colors.primary,
  },
  ayahText: {
    flex: 1,
    marginTop: 34,
    color: colors.text,
    textAlign: 'right',
    fontFamily: 'KFGQPCNastaleeq',
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
});

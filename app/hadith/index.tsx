import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  areAllBooksCached,
  cacheAllBooksInBackground,
  getHadithBooks,
  type HadithBook,
} from '@/services/hadithService';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { EightPointStar } from '@/components/IslamicMotifs';
import { FadeInView, PressableScale } from '@/components/Anim';

type DownloadState = 'idle' | 'running' | 'done';

export default function HadithBooksScreen() {
  const insets = useSafeAreaInsets();
  const [dlState, setDlState] = useState<DownloadState>('idle');
  const [progress, setProgress] = useState({ fraction: 0, booksDone: 0, booksTotal: 0 });

  const { data, error, isLoading, isError, refetch } = useQuery({
    queryKey: ['hadith-books'],
    queryFn: getHadithBooks,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
  });

  // Reflect existing offline state on entry.
  useEffect(() => {
    let mounted = true;
    areAllBooksCached()
      .then((all) => {
        if (mounted && all) setDlState('done');
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const startOfflineDownload = () => {
    if (dlState !== 'idle') return;
    setDlState('running');
    setProgress({ fraction: 0, booksDone: 0, booksTotal: 0 });
    cacheAllBooksInBackground((p) =>
      setProgress({ fraction: p.fraction, booksDone: p.booksDone, booksTotal: p.booksTotal })
    )
      .then(async () => {
        const all = await areAllBooksCached().catch(() => false);
        setDlState(all ? 'done' : 'idle');
      })
      .catch(() => setDlState('idle'));
  };

  if (isLoading) {
    return (
      <View style={styles.skeletonWrap}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.skeletonRow} />
        ))}
      </View>
    );
  }

  if (isError) {
    const message = (error as any)?.message || 'Could not load hadith collections right now.';
    return (
      <View style={styles.center}>
        <View style={styles.errorIcon}>
          <Ionicons name="cloud-offline-outline" size={30} color={colors.danger} />
        </View>
        <Text style={styles.errorText}>{message}</Text>
        <PressableScale onPress={() => refetch()} style={styles.retryButton}>
          <Text style={styles.retryText}>Try Again</Text>
        </PressableScale>
      </View>
    );
  }

  const books = data ?? [];

  return (
    <FlatList
      style={styles.screen}
      data={books}
      keyExtractor={(item: HadithBook) => item.slug}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderArabic}>{'كُتُب الحَديث'}</Text>
          <Text style={styles.listHeaderSub}>{books.length} collections · Tap to read</Text>
          {dlState === 'done' ? null : dlState === 'running' ? (
            <View style={styles.offlineBtnWrap}>
              <View style={styles.progressCard}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel} numberOfLines={1}>
                    {progress.booksTotal
                      ? `Saving for offline · ${progress.booksDone}/${progress.booksTotal} books`
                      : 'Preparing download…'}
                  </Text>
                  <Text style={styles.progressPct}>{Math.round(progress.fraction * 100)}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${Math.max(3, Math.round(progress.fraction * 100))}%` }]}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.offlineBtnWrap}>
              <PressableScale style={styles.offlineBtn} onPress={startOfflineDownload}>
                <Ionicons name="cloud-download-outline" size={16} color={colors.primary} />
                <Text style={styles.offlineBtnText}>Download for offline</Text>
              </PressableScale>
            </View>
          )}
        </View>
      }
      renderItem={({ item, index }) => (
        <FadeInView index={Math.min(index, 10)}>
          <Link href={{ pathname: '/hadith/[book]', params: { book: item.slug, name: item.name } }} asChild>
            <PressableScale style={styles.rowCard}>
              <View style={styles.medallion}>
                <EightPointStar size={44} color={colors.primarySoft} />
                <Ionicons name="book-outline" size={18} color={colors.primary} style={styles.medallionIcon} />
              </View>
              <View style={styles.leftColumn}>
                <Text style={styles.englishName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.metaText}>
                  {item.hasChapters
                    ? `${item.chapterCount} chapters · ${item.hadithCount} hadith`
                    : `${item.hadithCount} hadith`}
                </Text>
              </View>
              {item.arabicName ? <Text style={styles.arabicName} numberOfLines={1}>{item.arabicName}</Text> : null}
            </PressableScale>
          </Link>
        </FadeInView>
      )}
      contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  skeletonWrap: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 14, paddingTop: 14, gap: 12 },
  skeletonRow: { height: 76, borderRadius: radius.lg, backgroundColor: colors.bgDeep },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { color: colors.text, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  retryButton: { backgroundColor: colors.primary, paddingHorizontal: 22, paddingVertical: 12, borderRadius: radius.sm },
  retryText: { color: '#fff', fontWeight: '800' },
  listContent: { paddingTop: 14, paddingHorizontal: 14 },
  listHeader: { alignItems: 'center', paddingVertical: 16, marginBottom: 6 },
  listHeaderArabic: { fontFamily: fonts.arabic, color: colors.primaryDark, fontSize: 32, lineHeight: 54, writingDirection: 'rtl' },
  listHeaderSub: { color: colors.muted, fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  offlineBtnWrap: { alignSelf: 'stretch', marginTop: 14, paddingHorizontal: 6 },
  offlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  offlineBtnText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  progressCard: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  progressLabel: { flex: 1, color: colors.primaryDark, fontWeight: '700', fontSize: 12.5 },
  progressPct: { color: colors.primary, fontWeight: '900', fontSize: 13, fontVariant: ['tabular-nums'] },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  rowCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...shadow.card,
  },
  medallion: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  medallionIcon: { position: 'absolute' },
  leftColumn: { flex: 1 },
  englishName: { color: colors.text, fontWeight: '800', fontSize: 16.5, fontFamily: fonts.serif },
  metaText: {
    color: colors.muted,
    marginTop: 3,
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  arabicName: { color: colors.primary, fontFamily: fonts.arabic, fontSize: 22, textAlign: 'right', includeFontPadding: false, maxWidth: 120 },
});

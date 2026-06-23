import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getOrDownloadQuran } from '@/services/quranService';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { EightPointStar } from '@/components/IslamicMotifs';
import { ListRowSkeleton } from '@/components/loading/ListRowSkeleton';
import { FadeInView, PressableScale } from '@/components/Anim';
import { useResponsive } from '@/theme/responsive';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { goBackOrReplace } from '@/utils/navigation';

export default function QuranListScreen() {
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();

  const goHome = useCallback(() => {
    goBackOrReplace('/(tabs)/index');
    return true;
  }, []);
  useHardwareBack(goHome);

  const { data, error, isLoading, isError, refetch } = useQuery({
    queryKey: ['quran-full'],
    queryFn: () => getOrDownloadQuran()
  });

  if (isLoading) {
    return <ListRowSkeleton rows={6} rowHeight={76} />;
  }

  const surahs = data?.surahs ?? [];

  if (isError) {
    const errorMessage = (error as any)?.message || 'Could not load Quran right now.';
    return (
      <View style={styles.center}>
        <View style={styles.errorIcon}>
          <Ionicons name="cloud-offline-outline" size={30} color={colors.danger} />
        </View>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <PressableScale onPress={() => refetch()} style={styles.retryButton}>
          <Text style={styles.retryText}>Try Again</Text>
        </PressableScale>
      </View>
    );
  }

  if (!surahs.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No surahs available yet. Check your internet and tap Try Again.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={surahs}
      keyExtractor={(item: any) => String(item.number)}
      initialNumToRender={12}
      windowSize={7}
      removeClippedSubviews
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderArabic}>{'القرآن الكريم'}</Text>
          <Text style={styles.listHeaderSub}>114 Surahs · Tap to read & listen</Text>
        </View>
      }
      renderItem={({ item, index }: any) => {
        const ayahCount =
          item?.numberOfAyahs ?? item?.ayahs?.length ?? item?.ayahCount ?? item?.totalAyahs ?? 0;
        return (
          <FadeInView index={Math.min(index, 10)}>
            <Link href={`/quran/${item.number}`} asChild>
              <PressableScale style={styles.rowCard}>
                <View style={styles.numberMedallion}>
                  <EightPointStar size={42} color={colors.primarySoft} />
                  <Text style={styles.numberText}>{item.number}</Text>
                </View>
                <View style={styles.leftColumn}>
                  <Text style={styles.englishName}>{item.englishName}</Text>
                  <Text style={styles.metaText}>{ayahCount} Ayahs</Text>
                </View>
                <Text style={styles.arabicName}>{item.name}</Text>
              </PressableScale>
            </Link>
          </FadeInView>
        );
      }}
      contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }, responsive.centerContent]}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { color: colors.text, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  emptyText: { color: colors.muted, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radius.sm,
  },
  retryText: { color: '#fff', fontWeight: '800' },
  listContent: {
    paddingTop: 14,
    paddingHorizontal: 14,
  },
  listHeader: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 6,
  },
  listHeaderArabic: {
    fontFamily: fonts.arabic,
    color: colors.primaryDark,
    fontSize: 34,
    lineHeight: 56,
  },
  listHeaderSub: {
    color: colors.muted,
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
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
  numberMedallion: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    position: 'absolute',
    color: colors.primary,
    fontWeight: '900',
    fontSize: 14,
  },
  leftColumn: { flex: 1 },
  englishName: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16.5,
    fontFamily: fonts.serif,
  },
  metaText: {
    color: colors.muted,
    marginTop: 3,
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  arabicName: {
    color: colors.primary,
    fontFamily: fonts.arabic,
    fontSize: 28,
    textAlign: 'right',
    includeFontPadding: false,
  },
});

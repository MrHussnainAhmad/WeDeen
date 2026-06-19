import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getHadithSection, type HadithItem } from '@/services/hadithService';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { EightPointStar } from '@/components/IslamicMotifs';
import { ListRowSkeleton } from '@/components/loading/ListRowSkeleton';
import { PressableScale } from '@/components/Anim';

/**
 * Shared bilingual hadith reader. Used both by the dedicated section screen and
 * inline by single-section books (e.g. the 40-hadith collections).
 */
export function HadithList({ slug, section }: { slug: string; section: string }) {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['hadith-section', slug, section],
    queryFn: () => getHadithSection(slug, section),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    enabled: !!slug && !!section,
  });

  // Guard: with missing route params the query stays disabled (perpetually
  // "loading"), so surface a clear message instead of an endless skeleton.
  if (!slug || !section) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>This hadith chapter is unavailable.</Text>
      </View>
    );
  }

  if (isLoading) {
    return <ListRowSkeleton rows={4} rowHeight={130} />;
  }

  if (isError) {
    const message = (error as any)?.message || 'Could not load this hadith chapter right now.';
    return (
      <View style={styles.center}>
        <View style={styles.errorIcon}>
          <Ionicons name="cloud-offline-outline" size={28} color={colors.danger} />
        </View>
        <Text style={styles.errorText}>{message}</Text>
        <PressableScale onPress={() => refetch()} style={styles.retryButton}>
          <Text style={styles.retryText}>Try Again</Text>
        </PressableScale>
      </View>
    );
  }

  const hadiths = data?.hadiths ?? [];
  if (!hadiths.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No hadiths available in this chapter.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={hadiths}
      keyExtractor={(item: HadithItem) => String(item.number)}
      initialNumToRender={6}
      maxToRenderPerBatch={8}
      updateCellsBatchingPeriod={50}
      windowSize={7}
      removeClippedSubviews
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 28 }]}
      renderItem={({ item }) => <HadithCard item={item} />}
    />
  );
}

function HadithCard({ item }: { item: HadithItem }) {
  const grade = item.grades?.[0];
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.badge}>
          <EightPointStar size={36} color={colors.primarySoft} />
          <Text style={styles.badgeText}>{item.number}</Text>
        </View>
        <View style={styles.headerMeta}>
          <Text style={styles.headerLabel}>Hadith {item.number}</Text>
          {item.reference ? (
            <Text style={styles.headerRef}>
              Book {item.reference.book} · No. {item.reference.hadith}
            </Text>
          ) : null}
        </View>
        {grade?.grade ? (
          <View style={styles.gradeChip}>
            <Text style={styles.gradeText} numberOfLines={1}>
              {grade.grade}
            </Text>
          </View>
        ) : null}
      </View>

      {item.arabic ? <Text style={styles.arabic}>{item.arabic}</Text> : null}

      {item.arabic && item.english ? <View style={styles.divider} /> : null}

      {item.english ? <Text style={styles.english}>{item.english}</Text> : null}

      {grade?.grade && grade?.name ? (
        <Text style={styles.gradeSource}>Grade: {grade.grade} — {grade.name}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  listContent: { paddingHorizontal: 14, paddingTop: 14 },

  skeletonWrap: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 14, paddingTop: 14, gap: 12 },

  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  errorIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { color: colors.text, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  emptyText: { color: colors.muted, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  retryButton: { backgroundColor: colors.primary, paddingHorizontal: 22, paddingVertical: 12, borderRadius: radius.sm },
  retryText: { color: '#fff', fontWeight: '800' },

  card: {
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  badge: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  badgeText: { position: 'absolute', fontSize: 12, fontWeight: '900', color: colors.primary },
  headerMeta: { flex: 1 },
  headerLabel: { color: colors.text, fontWeight: '800', fontSize: 13.5, fontFamily: fonts.serif },
  headerRef: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 1 },
  gradeChip: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 110,
  },
  gradeText: { color: colors.primary, fontSize: 11, fontWeight: '800' },

  arabic: {
    color: colors.text,
    fontFamily: fonts.arabic,
    fontSize: 20,
    lineHeight: 38,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: 12 },
  english: { color: colors.text, fontSize: 14.5, lineHeight: 23 },
  gradeSource: { color: colors.faint, fontSize: 11, marginTop: 10, fontStyle: 'italic' },
});

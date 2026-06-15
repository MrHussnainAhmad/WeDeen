import { useQuery } from '@tanstack/react-query';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { cacheBook, getHadithChapters, type HadithChapter } from '@/services/hadithService';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { FadeInView, PressableScale } from '@/components/Anim';
import { HadithList } from '@/components/hadith/HadithList';

export default function HadithBookScreen() {
  const insets = useSafeAreaInsets();
  const { book, name } = useLocalSearchParams<{ book: string; name?: string }>();

  const { data, error, isLoading, isError, refetch } = useQuery({
    queryKey: ['hadith-chapters', book],
    queryFn: () => getHadithChapters(book),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    enabled: !!book,
  });

  // Cache this book's full text to disk the first time it's opened, so it can
  // be read offline later. Idempotent and non-blocking.
  useEffect(() => {
    if (book) {
      cacheBook(book).catch(() => undefined);
    }
  }, [book]);

  const headerTitle = name || data?.book?.name || 'Hadith';
  const chapters = data?.chapters ?? [];
  // Books with a single (or no) titled section show their hadiths directly.
  const showContent = !isLoading && !isError && chapters.length <= 1;

  return (
    <>
      <Stack.Screen options={{ title: headerTitle }} />

      {isLoading ? (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.skeletonRow} />
          ))}
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <View style={styles.errorIcon}>
            <Ionicons name="cloud-offline-outline" size={30} color={colors.danger} />
          </View>
          <Text style={styles.errorText}>
            {(error as any)?.message || 'Could not load this collection right now.'}
          </Text>
          <PressableScale onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Try Again</Text>
          </PressableScale>
        </View>
      ) : showContent ? (
        <HadithList slug={book} section={chapters[0]?.number ?? '1'} />
      ) : (
        <FlatList
          style={styles.screen}
          data={chapters}
          keyExtractor={(item: HadithChapter) => item.number}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderSub}>{chapters.length} chapters</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <FadeInView index={Math.min(index, 10)}>
              <Link
                href={{
                  pathname: '/hadith/[book]/[section]',
                  params: { book, section: item.number, title: item.title },
                }}
                asChild
              >
                <PressableScale style={styles.rowCard}>
                  <View style={styles.numberBubble}>
                    <Text style={styles.numberText}>{item.number}</Text>
                  </View>
                  <View style={styles.leftColumn}>
                    <Text style={styles.chapterTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {item.hadithCount > 0 ? (
                      <Text style={styles.metaText}>{item.hadithCount} hadith</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.faint} />
                </PressableScale>
              </Link>
            </FadeInView>
          )}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={14}
          maxToRenderPerBatch={12}
          updateCellsBatchingPeriod={50}
          windowSize={9}
          removeClippedSubviews
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  skeletonWrap: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 14, paddingTop: 14, gap: 12 },
  skeletonRow: { height: 64, borderRadius: radius.lg, backgroundColor: colors.bgDeep },
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
  listContent: { paddingTop: 12, paddingHorizontal: 14 },
  listHeader: { paddingVertical: 8, paddingHorizontal: 4 },
  listHeaderSub: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  rowCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...shadow.soft,
  },
  numberBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { color: colors.primary, fontWeight: '900', fontSize: 12.5 },
  leftColumn: { flex: 1 },
  chapterTitle: { color: colors.text, fontWeight: '700', fontSize: 14.5, fontFamily: fonts.serif, lineHeight: 20 },
  metaText: { color: colors.muted, marginTop: 2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
});

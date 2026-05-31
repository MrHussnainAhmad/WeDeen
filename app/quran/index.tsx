import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getOrDownloadQuran } from '@/services/quranService';
import { colors } from '@/theme/colors';

export default function QuranListScreen() {
  const insets = useSafeAreaInsets();
  const { data, error, isLoading, isError, refetch } = useQuery({
    queryKey: ['quran-full'],
    queryFn: getOrDownloadQuran
  });

  if (isLoading) {
    return (
      <View style={[styles.skeletonWrap, { paddingTop: Math.max(insets.top + 18, 24) }]}>
        <View style={styles.skeletonRow} />
        <View style={styles.skeletonRow} />
        <View style={styles.skeletonRow} />
        <View style={styles.skeletonRow} />
        <View style={styles.skeletonRow} />
      </View>
    );
  }

  const surahs = data?.surahs ?? [];

  if (isError) {
    const errorMessage =
      (error as any)?.message ||
      'Could not load Quran right now.';
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ color: colors.text, marginBottom: 10, textAlign: 'center' }}>{errorMessage}</Text>
        <Pressable
          onPress={() => refetch()}
          style={{ backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  if (!surahs.length) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ color: colors.text }}>No surahs available yet. Please check internet and tap Try Again.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={surahs}
      keyExtractor={(item: any) => String(item.number)}
      initialNumToRender={12}
      windowSize={7}
      removeClippedSubviews
      renderItem={({ item }: any) => {
        const ayahCount =
          item?.numberOfAyahs ??
          item?.ayahs?.length ??
          item?.ayahCount ??
          item?.totalAyahs ??
          0;

        return (
        <Link href={`/quran/${item.number}`} asChild>
          <Pressable
            style={({ pressed }) => [styles.rowCard, pressed && styles.rowCardPressed]}
          >
            <View style={styles.leftColumn}>
              <Text style={styles.englishName}>
                {item.number}. {item.englishName}
              </Text>
              <Text style={styles.metaText}>
                {ayahCount} Ayahs
              </Text>
            </View>

            <Text style={styles.arabicName}>
              {item.name}
            </Text>
          </Pressable>
        </Link>
      );
      }}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  skeletonWrap: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  skeletonRow: {
    height: 70,
    borderRadius: 14,
    backgroundColor: '#ECE7DC',
  },
  listContent: {
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 18,
  },
  rowCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  rowCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  leftColumn: {
    flex: 1,
  },
  englishName: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 21,
  },
  metaText: {
    color: colors.muted,
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  arabicName: {
    color: colors.primary,
    fontFamily: 'KFGQPCNastaleeq',
    fontSize: 26,
    textAlign: 'right',
    includeFontPadding: false,
  },
});

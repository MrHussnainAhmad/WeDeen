import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/Anim';
import { OrnateCard, SectionHeader } from '@/components/ui';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { useResponsive } from '@/theme/responsive';
import { useAuthStore } from '@/store/authStore';
import {
  DUA_CATEGORIES,
  DUAS,
  getDailyRecommendedDuas,
  getDuaProgress,
  markDuaRead,
  playDuaAudio,
  restoreDuaProgress,
  toggleDuaFavorite,
  type DuaItem,
  type DuaProgress,
} from '@/services/duaLibraryService';

export default function DuasScreen() {
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();
  const token = useAuthStore((s) => s.token);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [progress, setProgress] = useState<Record<string, DuaProgress>>({});
  const recommended = getDailyRecommendedDuas();

  useEffect(() => {
    getDuaProgress().then(setProgress).catch(() => undefined);
    if (token) restoreDuaProgress(token).then(setProgress).catch(() => undefined);
  }, [token]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DUAS.filter((dua) => {
      if (activeCategory === 'favorites' && !progress[dua.id]?.favorite) return false;
      if (activeCategory !== 'all' && activeCategory !== 'favorites' && dua.categoryId !== activeCategory) return false;
      if (!q) return true;
      return [dua.title, dua.translation, dua.transliteration, dua.arabic].join(' ').toLowerCase().includes(q);
    });
  }, [query, activeCategory, progress]);

  const read = async (dua: DuaItem) => {
    const next = await markDuaRead(dua, token);
    setProgress(next);
  };

  const favorite = async (dua: DuaItem) => {
    const next = await toggleDuaFavorite(dua, token);
    setProgress(next);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 14, 24) }, responsive.centerContent]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Duas & Azkar</Text>
          <Text style={styles.headerText}>Categorized remembrance with search, favorites, and progress tracking.</Text>
        </View>
      </View>

      <OrnateCard>
        <SectionHeader
          title="Daily Recommended"
          subtitle="A small set for today"
          icon={<MaterialCommunityIcons name="hands-pray" size={18} color={colors.primary} />}
        />
        {recommended.map((dua) => (
          <DuaCard
            key={dua.id}
            dua={dua}
            progress={progress[dua.id]}
            onRead={() => read(dua)}
            onFavorite={() => favorite(dua)}
            onPlayAudio={() => playDuaAudio().catch(() => undefined)}
          />
        ))}
      </OrnateCard>

      <OrnateCard>
        <SectionHeader
          title="Library"
          subtitle={`${filtered.length} duas available offline`}
          icon={<Ionicons name="library-outline" size={18} color={colors.primary} />}
        />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search duas, translations, categories"
          placeholderTextColor={colors.faint}
          style={styles.input}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRail}>
          <CategoryChip label="All" active={activeCategory === 'all'} onPress={() => setActiveCategory('all')} />
          <CategoryChip label="Favorites" active={activeCategory === 'favorites'} onPress={() => setActiveCategory('favorites')} />
          {DUA_CATEGORIES.map((category) => (
            <CategoryChip
              key={category.id}
              label={category.title}
              active={activeCategory === category.id}
              onPress={() => setActiveCategory(category.id)}
            />
          ))}
        </ScrollView>
        <View style={styles.duaList}>
          {filtered.map((dua) => (
            <DuaCard
              key={dua.id}
              dua={dua}
              progress={progress[dua.id]}
              onRead={() => read(dua)}
              onFavorite={() => favorite(dua)}
              onPlayAudio={() => playDuaAudio().catch(() => undefined)}
            />
          ))}
        </View>
      </OrnateCard>
    </ScrollView>
  );
}

function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={[styles.categoryChip, active && styles.categoryChipActive]}>
      <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{label}</Text>
    </PressableScale>
  );
}

function DuaCard({
  dua,
  progress,
  onRead,
  onFavorite,
  onPlayAudio,
}: {
  dua: DuaItem;
  progress?: DuaProgress;
  onRead: () => void;
  onFavorite: () => void;
  onPlayAudio: () => void;
}) {
  return (
    <View style={styles.duaCard}>
      <View style={styles.duaTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.duaTitle}>{dua.title}</Text>
          <Text style={styles.duaMeta}>Read {progress?.readCount ?? 0} times</Text>
        </View>
        <PressableScale onPress={onFavorite} style={styles.iconButton}>
          <Ionicons name={progress?.favorite ? 'star' : 'star-outline'} size={20} color={progress?.favorite ? colors.gold : colors.muted} />
        </PressableScale>
      </View>
      <Text style={styles.duaArabic}>{dua.arabic}</Text>
      <Text style={styles.transliteration}>{dua.transliteration}</Text>
      <Text style={styles.translation}>{dua.translation}</Text>
      {dua.reference ? <Text style={styles.reference}>{dua.reference}</Text> : null}
      <View style={styles.duaActions}>
        <PressableScale onPress={onRead} style={styles.readButton}>
          <Ionicons name="checkmark-done-outline" size={16} color="#fff" />
          <Text style={styles.readButtonText}>Mark Read</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  header: {
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.xl,
    padding: 18,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    ...shadow.raised,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', fontFamily: fonts.serif },
  headerText: { color: colors.onDarkMuted, marginTop: 4, fontSize: 12.5, lineHeight: 18 },
  input: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
  },
  categoryRail: { gap: 8, paddingVertical: 12 },
  categoryChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryText: { color: colors.text, fontWeight: '800', fontSize: 12 },
  categoryTextActive: { color: '#fff' },
  duaList: { gap: 10 },
  duaCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 13,
    marginBottom: 10,
  },
  duaTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  duaTitle: { color: colors.text, fontWeight: '900', fontSize: 15, fontFamily: fonts.serif },
  duaMeta: { color: colors.muted, fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  iconButton: { padding: 8 },
  duaArabic: {
    color: colors.primaryDark,
    fontFamily: fonts.arabic,
    fontSize: 24,
    lineHeight: 44,
    textAlign: 'right',
    marginTop: 10,
  },
  transliteration: { color: colors.goldDeep, fontSize: 12.5, lineHeight: 18, fontWeight: '700', marginTop: 6 },
  translation: { color: colors.text, fontSize: 13, lineHeight: 20, marginTop: 6 },
  reference: { color: colors.muted, fontSize: 11.5, marginTop: 6, fontStyle: 'italic' },
  duaActions: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' },
  readButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  readButtonText: { color: '#fff', fontWeight: '900', fontSize: 12.5 },
  audioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  audioText: { color: colors.primary, fontWeight: '800', fontSize: 11.5 },
});

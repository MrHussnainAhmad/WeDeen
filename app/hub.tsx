import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/Anim';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { useResponsive } from '@/theme/responsive';
import { useThemeColors } from '@/theme/useThemeColors';
import { useAuthStore } from '@/store/authStore';

const ALL_TOOLS = [
  { href: '/quran', title: 'Read Quran', arabic: 'القرآن الكريم', subtitle: 'Tajweed & translations', icon: 'book-open-page-variant' as const, color: '#0B6B4F', tint: '#E7F1EC', tintBorder: '#D2E6DD' },
  { href: '/hadith', title: 'Read Hadith', arabic: 'الحديث الشريف', subtitle: 'Bukhari, Muslim & more', icon: 'script-text-outline' as const, color: '#7C5A3C', tint: '#F5EDE5', tintBorder: '#E6D5C3' },
  { href: '/reflections', title: 'Daily Reflections', arabic: 'تأملات يومية', subtitle: 'Journal your thoughts', icon: 'notebook-outline' as const, color: '#5B5095', tint: '#EEEAF5', tintBorder: '#DBD5EA' },
  { href: '/qibla', title: 'Qibla Compass', arabic: 'القبلة', subtitle: 'Accurate Kaaba direction', icon: 'compass-outline' as const, color: '#2B7A7A', tint: '#E5F2F2', tintBorder: '#C8E3E3' },
  { href: '/hijri', title: 'Hijri Calendar', arabic: 'التقويم الهجري', subtitle: 'Dates & fasting days', icon: 'calendar-star' as const, color: '#3A6098', tint: '#E8EEF5', tintBorder: '#D0DDEB' },
  { href: '/tasbih', title: 'Tasbih Counter', arabic: 'التسبيح', subtitle: 'Track your daily Dhikr', icon: 'counter' as const, color: '#2D6A4F', tint: '#E7F1EC', tintBorder: '#CDE3D6' },
  { href: '/duas', title: 'Duas & Azkar', arabic: 'الأدعية والأذكار', subtitle: 'Daily supplications', icon: 'hands-pray' as const, color: '#C59B27', tint: '#FAF3E1', tintBorder: '#E9D9AE' },
  { href: { pathname: '/names/[type]', params: { type: 'allah' } }, title: '99 Names of Allah', arabic: 'أسماء الله الحسنى', subtitle: 'Audio & meanings', icon: 'star-four-points-outline' as const, color: '#A0522D', tint: '#F5EDE5', tintBorder: '#E2CDB8' },
  { href: '/zakat', title: 'Zakat Calculator', arabic: 'حاسبة الزكاة', subtitle: 'Obligatory 2.5% Zakat', icon: 'calculator-variant' as const, color: '#5A7040', tint: '#EDF2E8', tintBorder: '#D5E0CC' },
  { href: '/insights', title: 'Insights', arabic: 'رؤى العبادة', subtitle: 'Worship trends', icon: 'chart-pie' as const, color: '#D4830A', tint: '#FDF3E3', tintBorder: '#F0DDBA' },
  { href: '/guide', title: 'Guide', arabic: 'الدليل', subtitle: 'How to use Muslim Deen: Quran & Prayer', icon: 'book-information-variant' as const, color: '#4A6572', tint: '#EBEFF1', tintBorder: '#CAD4DA' },
];

function chunkTools<T>(items: T[], columns: number) {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

export default function HubScreen() {
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();
  const themeColors = useThemeColors();
  const { user } = useAuthStore();
  const { type } = useLocalSearchParams<{ type?: string }>();

  const [suggestedTools, setSuggestedTools] = useState<typeof ALL_TOOLS>([]);

  useEffect(() => {
    const hour = new Date().getHours();
    const dynamicSuggestions = [];

    if (hour >= 4 && hour <= 10) {
      dynamicSuggestions.push(ALL_TOOLS.find((t) => t.href === '/duas')!);
    } else if (hour >= 18 || hour <= 3) {
      dynamicSuggestions.push(ALL_TOOLS.find((t) => t.href === '/reflections')!);
      if (hour >= 20 || hour <= 3) {
        dynamicSuggestions.push(ALL_TOOLS.find((t) => t.href === '/quran')!);
      }
    } else {
      dynamicSuggestions.push(ALL_TOOLS.find((t) => t.href === '/tasbih')!);
      dynamicSuggestions.push(ALL_TOOLS.find((t) => t.href === '/hadith')!);
    }

    setSuggestedTools(dynamicSuggestions.filter(Boolean));
  }, []);

  const displayTools = useMemo(() => {
    if (type === 'quran_hadith') {
      const order = ['Read Quran', 'Read Hadith'];
      return ALL_TOOLS.filter((t) => order.includes(t.title)).sort(
        (a, b) => order.indexOf(a.title) - order.indexOf(b.title)
      );
    }
    if (type === 'tasbih_azkar') {
      const order = ['Tasbih Counter', 'Duas & Azkar', '99 Names of Allah', 'Zakat Calculator'];
      return ALL_TOOLS.filter((t) => order.includes(t.title)).sort(
        (a, b) => order.indexOf(a.title) - order.indexOf(b.title)
      );
    }
    if (type === 'tools') {
      const order = ['Qibla Compass', 'Hijri Calendar', 'Insights', 'Daily Reflections', 'Guide'];
      return ALL_TOOLS.filter((t) => order.includes(t.title)).sort(
        (a, b) => order.indexOf(a.title) - order.indexOf(b.title)
      );
    }
    return ALL_TOOLS;
  }, [type]);

  const hubTitle =
    type === 'quran_hadith'
      ? 'Quran & Hadith'
      : type === 'tasbih_azkar'
        ? 'Tasbih & Azkar'
        : type === 'tools'
          ? 'Tools'
          : 'Discover Hub';
  const contentShell = responsive.isLarge
    ? styles.contentLarge
    : responsive.isTablet
      ? styles.contentTablet
      : null;
  const columnCount = responsive.isTablet && displayTools.length >= 3 ? 3 : 2;
  const tileWidth = columnCount === 3 ? styles.heroTileThird : styles.heroTileHalf;
  const toolRows = useMemo(() => chunkTools(displayTools, columnCount), [displayTools, columnCount]);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: themeColors.bg }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top + 14, 24) },
        contentShell,
      ]}
    >
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{hubTitle}</Text>
          <Text style={styles.headerSubtitle}>Tools & Insights to grow your faith.</Text>
        </View>
      </View>

      {!type ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Up Next for You</Text>
          {user ? (
            <View style={styles.discoverGrid}>
              <Link href="/insights" asChild>
                <PressableScale style={[styles.discoverCard, { backgroundColor: themeColors.primarySoft, borderColor: themeColors.primaryTint }]}>
                  <Ionicons name="pie-chart" size={24} color={themeColors.primary} />
                  <Text style={[styles.discoverTitle, { color: themeColors.text }]}>Insights</Text>
                  <Text style={[styles.discoverSubtitle, { color: themeColors.muted }]}>View your worship trends</Text>
                </PressableScale>
              </Link>
              {suggestedTools.length > 0 ? (
                <Link href={suggestedTools[0].href as any} asChild>
                  <PressableScale style={[styles.discoverCard, { backgroundColor: themeColors.goldSoft, borderColor: themeColors.goldBorder }]}>
                    <MaterialCommunityIcons name={suggestedTools[0].icon} size={24} color={themeColors.goldDeep} />
                    <Text style={[styles.discoverTitle, { color: themeColors.text }]}>{suggestedTools[0].title}</Text>
                    <Text style={[styles.discoverSubtitle, { color: themeColors.muted }]}>Suggested for you</Text>
                  </PressableScale>
                </Link>
              ) : null}
            </View>
          ) : (
            <View style={[styles.guestCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Ionicons name="person-circle-outline" size={32} color={themeColors.muted} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.guestTitle, { color: themeColors.text }]}>Sign In for Insights</Text>
                <Text style={[styles.guestSubtitle, { color: themeColors.muted }]}>Track streaks and get personalized worship recommendations.</Text>
              </View>
              <PressableScale onPress={() => router.push('/profile')} style={[styles.signInBtn, { backgroundColor: themeColors.primary }]}>
                <Text style={styles.signInBtnText}>Sign In</Text>
              </PressableScale>
            </View>
          )}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{type ? 'Tools' : 'All Tools'}</Text>

        <View style={styles.toolsGrid}>
          {toolRows.map((row, rowIndex) => (
            <View
              key={`row-${rowIndex}`}
              style={[styles.toolRow, row.length < columnCount && styles.toolRowIncomplete]}
            >
              {row.map((tool) => (
                <View key={tool.title} style={tileWidth}>
                  <Link href={tool.href as any} asChild>
                    <PressableScale style={[styles.heroTile, { backgroundColor: tool.tint, borderColor: tool.tintBorder }]}>
                      <View style={[styles.heroIconCircle, { backgroundColor: tool.color }]}>
                        <MaterialCommunityIcons name={tool.icon} size={26} color="#fff" />
                      </View>
                      <Text style={[styles.heroTitle, { color: themeColors.text }]} numberOfLines={1}>{tool.title}</Text>
                      <Text style={[styles.heroArabic, { color: tool.color }]} numberOfLines={1}>{tool.arabic}</Text>
                      <Text style={[styles.heroSubtitle, { color: themeColors.muted }]} numberOfLines={2}>{tool.subtitle}</Text>
                    </PressableScale>
                  </Link>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', alignSelf: 'center', padding: 16, gap: 24, paddingBottom: 40 },
  contentTablet: { maxWidth: 860 },
  contentLarge: { maxWidth: 980 },

  header: {
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.xl,
    padding: 20,
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
  headerSubtitle: { color: colors.onDarkMuted, marginTop: 6, fontSize: 13, lineHeight: 18 },

  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', fontFamily: fonts.serif, marginLeft: 4 },

  discoverGrid: { flexDirection: 'row', gap: 12 },
  discoverCard: { flex: 1, padding: 16, borderRadius: radius.lg, borderWidth: 1, gap: 8, ...shadow.card },
  discoverTitle: { fontSize: 15, fontWeight: 'bold' },
  discoverSubtitle: { fontSize: 12 },
  guestCard: { flexDirection: 'row', padding: 16, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', ...shadow.card },
  guestTitle: { fontSize: 15, fontWeight: 'bold' },
  guestSubtitle: { fontSize: 12, marginTop: 4 },
  signInBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.sm, marginLeft: 12 },
  signInBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  toolsGrid: {
    gap: 16,
  },
  toolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: 14,
  },
  toolRowIncomplete: {
    justifyContent: 'center',
  },
  heroTileHalf: {
    width: '48.4%',
  },
  heroTileThird: {
    width: '31.6%',
  },
  heroTile: {
    width: '100%',
    minHeight: 176,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: 18,
    gap: 10,
    ...shadow.card,
  },
  heroIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    ...shadow.soft,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: fonts.serif,
  },
  heroArabic: {
    fontSize: 13,
    fontFamily: fonts.arabic,
    lineHeight: 22,
    marginTop: -4,
  },
  heroSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
});

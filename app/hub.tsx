import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/Anim';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { useResponsive } from '@/theme/responsive';
import { useThemeColors } from '@/theme/useThemeColors';
import { useAuthStore } from '@/store/authStore';
import { getSalahLogs, calculateStreakStats } from '@/services/prayerTrackerService';
import { getCachedLearningProgress } from '@/services/memorizationService';
import { getSalahFocusConfig, isSalahFocusSupported } from '@/services/salahFocusService';

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
];

export default function HubScreen() {
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();
  const themeColors = useThemeColors();
  const { user } = useAuthStore();
  const { type } = useLocalSearchParams<{ type?: string }>();

  const [streak, setStreak] = useState(0);
  const [memorizationSurah, setMemorizationSurah] = useState(1);
  const [focusConfigured, setFocusConfigured] = useState(true);
  const [focusSupported, setFocusSupported] = useState(false);

  const [suggestedTools, setSuggestedTools] = useState<typeof ALL_TOOLS>([]);

  useEffect(() => {
    const hour = new Date().getHours();
    let dynamicSuggestions = [];

    // Morning suggestions
    if (hour >= 4 && hour <= 10) {
      dynamicSuggestions.push(ALL_TOOLS.find(t => t.href === '/duas')!);
    }
    // Evening/Night suggestions
    else if (hour >= 18 || hour <= 3) {
      dynamicSuggestions.push(ALL_TOOLS.find(t => t.href === '/reflections')!);
      if (hour >= 20 || hour <= 3) {
        dynamicSuggestions.push(ALL_TOOLS.find(t => t.href === '/quran')!);
      }
    }
    // Midday suggestions
    else {
      dynamicSuggestions.push(ALL_TOOLS.find(t => t.href === '/tasbih')!);
      dynamicSuggestions.push(ALL_TOOLS.find(t => t.href === '/hadith')!);
    }

    setSuggestedTools(dynamicSuggestions.filter(Boolean));
    
    setFocusSupported(isSalahFocusSupported());
    if (user) {
      getSalahLogs().then((logs) => {
        const stats = calculateStreakStats(logs);
        setStreak(stats.streak);
      });
      getCachedLearningProgress(user.id).then((progress) => {
        if (progress) setMemorizationSurah(progress.unlockedSurah);
      });
      getSalahFocusConfig().then((cfg) => {
        setFocusConfigured(cfg.setupComplete);
      });
    }
  }, [user]);

  // Filter tools based on type
  const displayTools = React.useMemo(() => {
    if (type === 'quran_hadith') {
      return ALL_TOOLS.filter(t => 
        ['Read Quran', 'Read Hadith'].includes(t.title)
      ).sort((a, b) => {
        const order = ['Read Quran', 'Read Hadith'];
        return order.indexOf(a.title) - order.indexOf(b.title);
      });
    }
    if (type === 'tasbih_azkar') {
      return ALL_TOOLS.filter(t => 
        ['Tasbih Counter', 'Duas & Azkar', '99 Names of Allah', 'Zakat Calculator'].includes(t.title)
      ).sort((a, b) => {
        const order = ['Tasbih Counter', 'Duas & Azkar', '99 Names of Allah', 'Zakat Calculator'];
        return order.indexOf(a.title) - order.indexOf(b.title);
      });
    }
    if (type === 'tools') {
      return ALL_TOOLS.filter(t => 
        ['Qibla Compass', 'Hijri Calendar', 'Insights', 'Daily Reflections'].includes(t.title)
      ).sort((a, b) => {
        const order = ['Qibla Compass', 'Hijri Calendar', 'Insights', 'Daily Reflections'];
        return order.indexOf(a.title) - order.indexOf(b.title);
      });
    }
    return ALL_TOOLS;
  }, [type]);

  const hubTitle = 
    type === 'quran_hadith' ? 'Quran & Hadith' :
    type === 'tasbih_azkar' ? 'Tasbih & Azkar' :
    type === 'tools' ? 'Tools' : 'Discover Hub';

  return (
    <ScrollView style={[styles.screen, { backgroundColor: themeColors.bg }]} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 14, 24) }, responsive.centerContent]}>
      {/* Header */}
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{hubTitle}</Text>
          <Text style={styles.headerSubtitle}>Tools & Insights to grow your faith.</Text>
        </View>
      </View>

      {/* Up Next / Discover Section - Only show when no specific category is selected */}
      {!type && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Up Next for You</Text>
          {user ? (
            <View style={styles.discoverGrid}>
              <Link href={"/insights" as any} asChild>
                <PressableScale style={[styles.discoverCard, { backgroundColor: themeColors.primarySoft, borderColor: themeColors.primaryTint }]}>
                  <Ionicons name="pie-chart" size={24} color={themeColors.primary} />
                  <Text style={[styles.discoverTitle, { color: themeColors.text }]}>Insights</Text>
                  <Text style={[styles.discoverSubtitle, { color: themeColors.muted }]}>View your worship trends</Text>
                </PressableScale>
              </Link>
              {focusSupported && !focusConfigured ? (
                <Link href="/salah-focus" asChild>
                  <PressableScale style={[styles.discoverCard, { backgroundColor: themeColors.dangerSoft, borderColor: themeColors.danger }]}>
                    <Ionicons name="lock-closed" size={24} color={themeColors.danger} />
                    <Text style={[styles.discoverTitle, { color: themeColors.text }]}>Prayer Lock</Text>
                    <Text style={[styles.discoverSubtitle, { color: themeColors.muted }]}>Set up to reduce distraction</Text>
                  </PressableScale>
                </Link>
              ) : suggestedTools.length > 0 && (
                <Link href={suggestedTools[0].href as any} asChild>
                  <PressableScale style={[styles.discoverCard, { backgroundColor: themeColors.goldSoft, borderColor: themeColors.goldBorder }]}>
                    <MaterialCommunityIcons name={suggestedTools[0].icon} size={24} color={themeColors.goldDeep} />
                    <Text style={[styles.discoverTitle, { color: themeColors.text }]}>{suggestedTools[0].title}</Text>
                    <Text style={[styles.discoverSubtitle, { color: themeColors.muted }]}>Suggested for you</Text>
                  </PressableScale>
                </Link>
              )}
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
      )}

      {/* Tools */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{type ? 'Tools' : 'All Tools'}</Text>

        {/* When 4 or fewer tools, render ALL as hero tiles in a 2-col grid */}
        {displayTools.length <= 4 ? (
          <View style={styles.heroGrid}>
            {displayTools.map((a) => (
              <Link key={a.title} href={a.href as any} asChild>
                <PressableScale style={[styles.heroTile, { backgroundColor: a.tint, borderColor: a.tintBorder }]}>
                  <View style={[styles.heroIconCircle, { backgroundColor: a.color }]}>  
                    <MaterialCommunityIcons name={a.icon} size={26} color="#fff" />
                  </View>
                  <Text style={[styles.heroTitle, { color: themeColors.text }]} numberOfLines={1}>{a.title}</Text>
                  <Text style={[styles.heroArabic, { color: a.color }]} numberOfLines={1}>{a.arabic}</Text>
                  <Text style={[styles.heroSubtitle, { color: themeColors.muted }]} numberOfLines={2}>{a.subtitle}</Text>
                </PressableScale>
              </Link>
            ))}
          </View>
        ) : (
          <>
            {/* Featured pair — first two tools get large tinted tiles */}
            <View style={styles.heroPair}>
              {displayTools.slice(0, 2).map((a) => (
                <Link key={a.title} href={a.href as any} asChild>
                  <PressableScale style={[styles.heroTile, { backgroundColor: a.tint, borderColor: a.tintBorder }]}>
                    <View style={[styles.heroIconCircle, { backgroundColor: a.color }]}>  
                      <MaterialCommunityIcons name={a.icon} size={26} color="#fff" />
                    </View>
                    <Text style={[styles.heroTitle, { color: themeColors.text }]} numberOfLines={1}>{a.title}</Text>
                    <Text style={[styles.heroArabic, { color: a.color }]}>{a.arabic}</Text>
                    <Text style={[styles.heroSubtitle, { color: themeColors.muted }]} numberOfLines={2}>{a.subtitle}</Text>
                  </PressableScale>
                </Link>
              ))}
            </View>

            {/* Rest — clean horizontal cards */}
            {displayTools.slice(2).map((a) => (
              <Link key={a.title} href={a.href as any} asChild>
                <PressableScale style={[styles.toolCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                  <View style={[styles.toolIcon, { backgroundColor: a.tint, borderColor: a.tintBorder }]}>
                    <MaterialCommunityIcons name={a.icon} size={22} color={a.color} />
                  </View>
                  <View style={styles.toolBody}>
                    <Text style={[styles.toolTitle, { color: themeColors.text }]} numberOfLines={1}>{a.title}</Text>
                    <Text style={[styles.toolSub, { color: themeColors.muted }]} numberOfLines={1}>{a.subtitle}</Text>
                  </View>
                  <View style={styles.toolChevron}>
                    <Ionicons name="chevron-forward" size={16} color={themeColors.faint} />
                  </View>
                </PressableScale>
              </Link>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 24, paddingBottom: 40 },

  /* Header */
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
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', fontFamily: fonts.serif },
  headerSubtitle: { color: colors.onDarkMuted, marginTop: 6, fontSize: 13, lineHeight: 18 },

  /* Section */
  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', fontFamily: fonts.serif, marginLeft: 4 },

  /* Discover */
  discoverGrid: { flexDirection: 'row', gap: 12 },
  discoverCard: { flex: 1, padding: 16, borderRadius: radius.lg, borderWidth: 1, gap: 8, ...shadow.card },
  discoverTitle: { fontSize: 15, fontWeight: 'bold' },
  discoverSubtitle: { fontSize: 12 },
  guestCard: { flexDirection: 'row', padding: 16, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', ...shadow.card },
  guestTitle: { fontSize: 15, fontWeight: 'bold' },
  guestSubtitle: { fontSize: 12, marginTop: 4 },
  signInBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.sm, marginLeft: 12 },
  signInBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  /* ── Hero grid ── */
  heroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  heroPair: {
    flexDirection: 'row',
    gap: 12,
  },
  heroTile: {
    width: '48%',
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: 18,
    gap: 10,
    ...shadow.card,
  },
  heroIconCircle: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
    ...shadow.soft,
  },
  heroTitle: {
    fontSize: 16, fontWeight: '900', fontFamily: fonts.serif,
  },
  heroArabic: {
    fontSize: 13, fontFamily: fonts.arabic, lineHeight: 22,
    marginTop: -4,
  },
  heroSubtitle: {
    fontSize: 12, lineHeight: 17, fontWeight: '500',
  },

  /* ── Tool cards (remaining) ── */
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    overflow: 'hidden',
    ...shadow.card,
  },
  toolIcon: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  toolBody: {
    flex: 1, gap: 3, overflow: 'hidden',
  },
  toolTitle: {
    fontSize: 15, fontWeight: '800', fontFamily: fonts.serif,
  },
  toolSub: {
    fontSize: 12.5, lineHeight: 16, fontWeight: '500',
  },
  toolChevron: {
    width: 24, height: 24,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
});

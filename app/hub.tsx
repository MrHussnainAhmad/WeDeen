import React, { useMemo, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/Anim';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { useResponsive } from '@/theme/responsive';
import { useThemeColors } from '@/theme/useThemeColors';
import { useDailyIslamicData } from '@/hooks/useDailyIslamicData';
import { getZakatHistory } from '@/services/zakatService';

type SubAction = {
  href: any;
  title: string;
  arabic: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tone: 'emerald' | 'gold';
};

type HubConfig = {
  title: string;
  subtitle: string;
  actions: SubAction[];
};

const HUB_CONFIGS: Record<string, HubConfig> = {
  quran_hadith: {
    title: 'Quran & Hadith',
    subtitle: 'Access the holy Quran recitation, translations, and authentic Hadith collections.',
    actions: [
      {
        href: '/quran',
        title: 'Read Quran',
        arabic: 'القرآن',
        subtitle: 'Surahs, Tajweed & translations',
        icon: 'book-open-page-variant',
        tone: 'emerald',
      },
      {
        href: '/hadith',
        title: 'Read Hadith',
        arabic: 'الحديث',
        subtitle: 'Sahih Muslim, Bukhari & chapters',
        icon: 'script-text-outline',
        tone: 'gold',
      },
    ],
  },
  qibla_calendar: {
    title: 'Qibla & Calendar',
    subtitle: 'Find Qibla compass direction and view the interactive Hijri calendar.',
    actions: [
      {
        href: '/qibla',
        title: 'Qibla Compass',
        arabic: 'القبلة',
        subtitle: 'Find the accurate Kaaba direction',
        icon: 'compass-outline',
        tone: 'gold',
      },
      {
        href: '/hijri',
        title: 'Hijri Calendar',
        arabic: 'التقويم',
        subtitle: 'Hijri dates & Sunnah fasting days',
        icon: 'calendar-star',
        tone: 'emerald',
      },
    ],
  },
  tasbih_azkar: {
    title: 'Tasbih & Azkar',
    subtitle: "Make Dhikr, read daily Duas, learn Allah's Names, and calculate Zakat.",
    actions: [
      {
        href: '/tasbih',
        title: 'Tasbih Counter',
        arabic: 'التسبيح',
        subtitle: 'Log and track your daily Dhikr',
        icon: 'radiobox-blank',
        tone: 'emerald',
      },
      {
        href: '/duas',
        title: 'Duas & Azkar',
        arabic: 'الأدعية',
        subtitle: 'Supplications & morning/evening Azkar',
        icon: 'hands-pray',
        tone: 'gold',
      },
      {
        href: { pathname: '/names/[type]', params: { type: 'allah' } },
        title: '99 Names of Allah',
        arabic: 'أسماء الله',
        subtitle: 'Asma ul Husna with audio & meanings',
        icon: 'star-four-points-outline',
        tone: 'gold',
      },
      {
        href: '/zakat',
        title: 'Zakat Calculator',
        arabic: 'الزكاة',
        subtitle: 'Calculate your obligatory 2.5% Zakat',
        icon: 'calculator-variant',
        tone: 'emerald',
      },
    ],
  },
};

export default function HubScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();
  const themeColors = useThemeColors();
  
  const { data: dailyData } = useDailyIslamicData();
  const [lastZakat, setLastZakat] = useState<string | null>(null);

  useEffect(() => {
    getZakatHistory()
      .then((history) => {
        if (history.length > 0) {
          const latest = history[0];
          setLastZakat(`Last calculated: ${latest.currency} ${latest.zakatDue.toFixed(2)}`);
        }
      })
      .catch(() => undefined);
  }, []);

  const config = useMemo(() => {
    return HUB_CONFIGS[type || ''] || HUB_CONFIGS.quran_hadith;
  }, [type]);

  const hijriDateStr = useMemo(() => {
    if (dailyData?.hijriDate) return dailyData.hijriDate;
    return null;
  }, [dailyData]);


  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: themeColors.bg }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top + 14, 24) },
        responsive.centerContent,
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{config.title}</Text>
          <Text style={styles.headerSubtitle}>{config.subtitle}</Text>
        </View>
      </View>

      {/* Grid of Sub-Actions */}
      <View style={[styles.actionList, responsive.isTablet && styles.actionListTablet]}>
        {config.actions.map((a) => {
          const emerald = a.tone === 'emerald';
          const primaryColor = emerald ? themeColors.primary : themeColors.gold;
          const iconBg = emerald ? themeColors.primarySoft : themeColors.goldSoft;
          const iconBorder = emerald ? themeColors.primaryTint : themeColors.goldBorder;

          let dynamicSubtitle = a.subtitle;
          if (a.href === '/hijri' && hijriDateStr) {
            dynamicSubtitle = `Today: ${hijriDateStr}`;
          } else if (a.href === '/zakat' && lastZakat) {
            dynamicSubtitle = lastZakat;
          }

          return (
            <Link key={a.title} href={a.href} asChild>
              <PressableScale
                style={[
                  styles.card,
                  {
                    backgroundColor: themeColors.card,
                    borderColor: themeColors.border,
                    borderLeftWidth: 4,
                    borderLeftColor: primaryColor,
                  },
                  responsive.isTablet && { width: '48.5%' }
                ]}
              >
                <View
                  style={[
                    styles.iconWrap,
                    {
                      backgroundColor: iconBg,
                      borderColor: iconBorder,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={a.icon}
                    size={24}
                    color={emerald ? themeColors.primary : themeColors.goldDeep}
                  />
                </View>
                <View style={styles.textWrap}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={1}>
                      {a.title}
                    </Text>
                    <Text style={[styles.arabic, { color: themeColors.gold }]} numberOfLines={1}>
                      {a.arabic}
                    </Text>
                  </View>
                  <Text style={[styles.subtitle, { color: themeColors.muted }]} numberOfLines={2}>
                    {dynamicSubtitle}
                  </Text>
                </View>
                <View
                  style={[
                    styles.arrowWrap,
                    {
                      backgroundColor: iconBg,
                      borderColor: iconBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={emerald ? themeColors.primary : themeColors.goldDeep}
                  />
                </View>
              </PressableScale>
            </Link>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
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
  actionList: { gap: 14 },
  actionListTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    ...shadow.card,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 16,
  },
  textWrap: { flex: 1, gap: 4, marginRight: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  title: { fontWeight: '800', fontSize: 16, fontFamily: fonts.serif },
  arabic: { fontSize: 13, fontFamily: fonts.arabic, lineHeight: 22 },
  subtitle: { fontSize: 12.5, lineHeight: 18 },
  arrowWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});

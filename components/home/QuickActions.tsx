import React from 'react';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { PressableScale } from '@/components/Anim';

type Action = {
  href: any;
  title: string;
  arabic: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tone: 'emerald' | 'gold';
};

const ACTIONS: Action[] = [
  {
    href: { pathname: '/hub', params: { type: 'quran_hadith' } },
    title: 'Quran/Hadith',
    arabic: 'القرآن والحديث',
    subtitle: 'Read Quran & Hadith',
    icon: 'book-open-page-variant',
    tone: 'emerald',
  },
  {
    href: { pathname: '/hub', params: { type: 'tools' } },
    title: 'Tools',
    arabic: 'أدوات',
    subtitle: 'Qibla, Calendar & more',
    icon: 'compass-outline',
    tone: 'gold',
  },
  {
    href: { pathname: '/hub', params: { type: 'tasbih_azkar' } },
    title: 'Tasbih & Azkar',
    arabic: 'التسبيح والأذكار',
    subtitle: 'Dhikr, Duas & Zakat',
    icon: 'hands-pray',
    tone: 'emerald',
  },
  {
    href: '/ramadan',
    title: 'Ramadan',
    arabic: 'رمضان',
    subtitle: 'Suhoor & iftar tracker',
    icon: 'moon-waning-crescent',
    tone: 'gold',
  },
  {
    href: '/places',
    title: 'Find Places',
    arabic: 'أماكن',
    subtitle: 'Mosques & halal food',
    icon: 'map-marker-radius-outline',
    tone: 'emerald',
  },
];

interface QuickActionsProps {
  type: 'top' | 'remaining';
}

export const QuickActions = React.memo(function QuickActions({ type }: QuickActionsProps) {
  const actionsToShow = type === 'top'
    ? ACTIONS.filter(a => a.title === 'Quran/Hadith' || a.title === 'Tasbih & Azkar')
    : ACTIONS.filter(a => a.title !== 'Quran/Hadith' && a.title !== 'Tasbih & Azkar');

  return (
    <View style={styles.grid}>
      {actionsToShow.map((a, index) => {
        const emerald = a.tone === 'emerald';
        // With an odd number of actions, let the last card span the full width so
        // the 2-column grid never leaves a lonely, unbalanced trailing card.
        const isWide = actionsToShow.length % 2 === 1 && index === actionsToShow.length - 1;
        return (
          <View key={a.title} style={[styles.cardSlot, isWide && styles.cardSlotWide]}>
            <Link href={a.href} asChild>
              <PressableScale style={styles.card}>
                <View
                  style={[
                    styles.iconWrap,
                    emerald
                      ? { backgroundColor: colors.primarySoft, borderColor: colors.primaryTint }
                      : { backgroundColor: colors.goldSoft, borderColor: colors.goldBorder },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={a.icon}
                    size={22}
                    color={emerald ? colors.primary : colors.goldDeep}
                  />
                </View>
                <View style={styles.textWrap}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={1}>{a.title}</Text>
                    <Text style={styles.arabic} numberOfLines={1}>{a.arabic}</Text>
                  </View>
                  <Text style={styles.subtitle} numberOfLines={1}>{a.subtitle}</Text>
                </View>
                <View style={styles.arrowWrap}>
                  <Ionicons
                    name="arrow-forward"
                    size={13}
                    color={emerald ? colors.primary : colors.goldDeep}
                  />
                </View>
              </PressableScale>
            </Link>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  cardSlot: {
    width: '48.2%',
  },
  cardSlotWide: {
    width: '100%',
  },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 12,
  },
  textWrap: { gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  title: { color: colors.text, fontWeight: '800', fontSize: 14.5, fontFamily: fonts.serif, flexShrink: 1 },
  arabic: { color: colors.gold, fontSize: 12, fontFamily: fonts.arabic, lineHeight: 20, flexShrink: 1 },
  subtitle: { color: colors.muted, fontSize: 11.5, lineHeight: 16 },
  arrowWrap: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp, TextStyle } from 'react-native';
import { colors, radius, shadow, fonts } from '@/theme/colors';
import { EightPointStar, GeometricDivider, StarFieldWatermark, CornerFlourish } from './IslamicMotifs';

/**
 * Full-screen warm paper background with a faint geometric texture at the top.
 */
export function ScreenBackground({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.screen, style]}>
      <View pointerEvents="none" style={styles.bgTextureTop}>
        <StarFieldWatermark rows={2} cols={7} starSize={26} color="rgba(11,107,79,0.035)" />
      </View>
      {children}
    </View>
  );
}

/**
 * Section header with an emerald icon chip, title, optional subtitle, and a star accent.
 */
export function SectionHeader({
  title,
  subtitle,
  icon,
  accent = colors.primary,
  style,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      {icon ? (
        <View style={[styles.iconChip, { backgroundColor: colors.primarySoft, borderColor: colors.primaryTint }]}>
          {icon}
        </View>
      ) : (
        <EightPointStar size={16} color={colors.gold} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

/**
 * The standard cream/white card with warm shadow, hairline border and optional
 * corner flourishes + ornamental title row. The workhorse surface of the app.
 */
export function OrnateCard({
  children,
  style,
  flourish = false,
  index,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  flourish?: boolean;
  index?: number;
  padded?: boolean;
}) {
  const inner = (
    <View style={[styles.card, padded && styles.cardPadded, style]}>
      {flourish ? (
        <>
          <CornerFlourish corner="tl" />
          <CornerFlourish corner="tr" />
          <CornerFlourish corner="bl" />
          <CornerFlourish corner="br" />
        </>
      ) : null}
      {children}
    </View>
  );
  return inner;
}

/**
 * Reusable emerald hero panel with starfield, arch crown, and gold framing.
 * Title can mix an Arabic line and an English line.
 */
export function EmeraldHero({
  children,
  style,
  rounded = radius.xl,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  rounded?: number;
}) {
  return (
    <View style={[styles.hero, { borderRadius: rounded }, style]}>
      <StarFieldWatermark rows={3} cols={6} starSize={18} color="rgba(255,255,255,0.05)" />
      <View style={styles.heroGoldLineTop} />
      {children}
      <View style={styles.heroGoldLineBottom} />
    </View>
  );
}

// A pill/badge with gold or emerald styling.
export function Pill({
  label,
  icon,
  tone = 'emerald',
  style,
  textStyle,
}: {
  label: string;
  icon?: React.ReactNode;
  tone?: 'emerald' | 'gold' | 'onDark';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const toneStyle =
    tone === 'gold'
      ? { bg: colors.goldSoft, border: colors.goldBorder, text: colors.goldDeep }
      : tone === 'onDark'
        ? { bg: 'rgba(255,255,255,0.16)', border: 'rgba(255,255,255,0.28)', text: '#fff' }
        : { bg: colors.primarySoft, border: colors.primaryTint, text: colors.primary };
  return (
    <View style={[styles.pill, { backgroundColor: toneStyle.bg, borderColor: toneStyle.border }, style]}>
      {icon}
      <Text style={[styles.pillText, { color: toneStyle.text }, textStyle]}>{label}</Text>
    </View>
  );
}

export { GeometricDivider };

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  bgTextureTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  iconChip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.2,
    fontFamily: fonts.serif,
  },
  sectionSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 1,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardPadded: {
    padding: 18,
  },
  hero: {
    backgroundColor: colors.primaryDeep,
    overflow: 'hidden',
    padding: 20,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    ...shadow.raised,
  },
  heroGoldLineTop: {
    position: 'absolute',
    top: 0,
    left: '15%',
    right: '15%',
    height: 2,
    backgroundColor: colors.gold,
    opacity: 0.5,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  heroGoldLineBottom: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: colors.gold,
    opacity: 0.35,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, radius } from '@/theme/colors';
import { SectionHeader } from '@/components/ui';
import { EightPointStar } from '@/components/IslamicMotifs';
import { FadeInView } from '@/components/Anim';

type AzkarItem = { categoryEn?: string; category?: string; textAr?: string; text?: string } | string;

/**
 * Horizontal "rail" of daily azkar cards. The horizontal scroll keeps the home
 * feed compact while letting the large Arabic script breathe on each card.
 */
export const AzkarRail = React.memo(function AzkarRail({ index, items }: { index: number; items: AzkarItem[] }) {
  const data = items ?? [];

  return (
    <FadeInView index={index}>
      <View style={styles.headerWrap}>
        <SectionHeader
          title="Duʿā & Azkar"
          subtitle="Remembrance for today"
          icon={<MaterialCommunityIcons name="hands-pray" size={18} color={colors.primary} />}
        />
      </View>

      {data.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={266}
          snapToAlignment="start"
          contentContainerStyle={styles.rail}
        >
          {data.map((item, idx) => {
            const category =
              typeof item === 'string'
                ? 'Daily Zikr'
                : item?.categoryEn ?? item?.category ?? 'Daily Zikr';
            const text = typeof item === 'string' ? item : item?.textAr ?? item?.text ?? '';
            return (
              <View key={`azkar-${idx}`} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.bubble}>
                    <Text style={styles.bubbleText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.tag}>
                    <Text style={styles.tagText} numberOfLines={1}>{category}</Text>
                  </View>
                </View>
                <Text style={styles.arabic}>{text}</Text>
                <View style={styles.cardFoot}>
                  <EightPointStar size={13} color={colors.goldBorder} filled={false} />
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons name="hands-pray" size={24} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Azkar yet</Text>
          <Text style={styles.emptyText}>Pull down to refresh today's remembrance.</Text>
        </View>
      )}
    </FadeInView>
  );
});

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: 16 },
  rail: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 4, gap: 12 },
  card: {
    width: 254,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    minHeight: 150,
    justifyContent: 'space-between',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  bubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  tag: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.primaryTint,
  },
  tagText: { color: colors.primary, fontSize: 11.5, fontWeight: '700' },
  arabic: {
    fontFamily: fonts.arabic,
    color: colors.primaryDark,
    fontSize: 22,
    lineHeight: 42,
    textAlign: 'right',
    marginTop: 12,
  },
  cardFoot: { alignItems: 'flex-start', marginTop: 10 },
  empty: { alignItems: 'center', paddingVertical: 26, gap: 6, marginHorizontal: 16 },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { color: colors.text, fontWeight: '800', fontSize: 14, fontFamily: fonts.serif },
  emptyText: { color: colors.muted, fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
});

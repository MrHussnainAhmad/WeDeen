import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme/colors';
import { Shimmer } from './Shimmer';

/**
 * Loading state for the Home screen. Mirrors the real layout block-for-block so
 * the transition into content feels like a settle, not a swap.
 */
export function HomeSkeleton({ topPad }: { topPad: number }) {
  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Greeting */}
      <View style={styles.greetingRow}>
        <View style={{ flex: 1, gap: 8 }}>
          <Shimmer width={120} height={13} />
          <Shimmer width={190} height={22} />
        </View>
        <Shimmer width={44} height={44} radius={14} />
      </View>

      {/* Prayer hero */}
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Shimmer width={90} height={12} radius={6} />
          <Shimmer width={64} height={24} radius={radius.pill} />
        </View>
        <Shimmer width={160} height={34} radius={10} style={{ marginTop: 18 }} />
        <Shimmer width={110} height={14} style={{ marginTop: 12 }} />
        <Shimmer height={8} radius={radius.pill} style={{ marginTop: 22 }} />
        <View style={styles.timelineRow}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={styles.timelineItem}>
              <Shimmer width={26} height={26} radius={13} />
              <Shimmer width={30} height={10} />
              <Shimmer width={34} height={11} />
            </View>
          ))}
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.quickRow}>
        <Shimmer height={120} radius={radius.lg} style={{ flex: 1 }} />
        <Shimmer height={120} radius={radius.lg} style={{ flex: 1 }} />
      </View>

      {/* Verse card */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Shimmer width={38} height={38} radius={12} />
          <View style={{ gap: 6 }}>
            <Shimmer width={150} height={15} />
            <Shimmer width={90} height={11} />
          </View>
        </View>
        <Shimmer height={28} style={{ marginTop: 18 }} />
        <Shimmer width="70%" height={28} style={{ marginTop: 10 }} />
        <Shimmer height={14} style={{ marginTop: 18 }} />
        <Shimmer width="85%" height={14} style={{ marginTop: 8 }} />
      </View>

      {/* Hadith card */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Shimmer width={38} height={38} radius={12} />
          <View style={{ gap: 6 }}>
            <Shimmer width={140} height={15} />
            <Shimmer width={80} height={11} />
          </View>
        </View>
        <Shimmer height={14} style={{ marginTop: 18 }} />
        <Shimmer height={14} style={{ marginTop: 8 }} />
        <Shimmer width="60%" height={14} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 18, backgroundColor: colors.bg },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  hero: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.xl,
    padding: 22,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 },
  timelineItem: { alignItems: 'center', gap: 7 },
  quickRow: { flexDirection: 'row', gap: 14 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 18,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { PressableScale } from '@/components/Anim';
import { GeometricDivider, SectionHeader } from '@/components/ui';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { useAuthStore } from '@/store/authStore';
import {
  buildPrayerWidgetSnapshot,
  exportPrayerWidgetSnapshots,
  markWidgetPrayerAsPrayed,
  type PrayerWidgetSize,
  type PrayerWidgetSnapshot,
} from '@/services/prayerWidgetService';

const SIZES: PrayerWidgetSize[] = ['small', 'medium', 'large'];

export function PrayerWidgetPreview() {
  const themeColors = useThemeColors();
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);
  const [size, setSize] = useState<PrayerWidgetSize>('medium');
  const [snapshot, setSnapshot] = useState<PrayerWidgetSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await buildPrayerWidgetSnapshot(size);
      setSnapshot(next);
      exportPrayerWidgetSnapshots().catch(() => undefined);
    } finally {
      setLoading(false);
    }
  }, [size]);

  useEffect(() => {
    refresh().catch(() => undefined);
    const id = setInterval(() => refresh().catch(() => undefined), 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const markPrayed = async () => {
    if (!snapshot?.currentPrayer || marking) return;
    setMarking(true);
    try {
      await markWidgetPrayerAsPrayed(snapshot.currentPrayer.label, token, userId);
      await refresh();
      setSuccessMessage(`✓ Marked ${snapshot.currentPrayer.label} as prayed!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } finally {
      setMarking(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <SectionHeader
        title="Prayer Widget"
        subtitle="Fast prayer status and one-tap tracking"
        icon={<MaterialCommunityIcons name="widgets-outline" size={18} color={colors.primary} />}
      />

      <View style={styles.sizeRow}>
        {SIZES.map((item) => {
          const active = item === size;
          return (
            <PressableScale
              key={item}
              onPress={() => setSize(item)}
              style={[
                styles.sizeChip,
                active && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
              ]}
            >
              <Text style={[styles.sizeText, active && styles.sizeTextActive]}>{item}</Text>
            </PressableScale>
          );
        })}
      </View>

      <View
        style={[
          styles.widgetCard,
          size === 'small' && styles.widgetSmall,
          size === 'large' && styles.widgetLarge,
          { backgroundColor: themeColors.primaryDeep },
        ]}
      >
        <View style={styles.widgetTop}>
          <View>
            <Text style={styles.widgetEyebrow}>
              {snapshot?.schoolName ?? 'School'} · {snapshot?.methodName ?? 'Method'}
            </Text>
            <Text style={styles.widgetTitle}>
              {snapshot?.currentPrayer?.label ?? 'Prayer'} window
            </Text>
          </View>
          <View style={styles.timePill}>
            <Text style={styles.timePillText}>{snapshot?.currentTime ?? '--:--'}</Text>
          </View>
        </View>

        {successMessage ? (
          <View style={[styles.successToast, { backgroundColor: themeColors.primarySoft, borderColor: themeColors.primary }]}>
            <Text style={[styles.successToastText, { color: themeColors.text }]}>{successMessage}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.loadingText}>Preparing widget data</Text>
          </View>
        ) : snapshot ? (
          <>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(snapshot.progress * 100)}%` }]} />
            </View>
            <View style={styles.primaryRow}>
              <View>
                <Text style={styles.nextLabel}>NEXT PRAYER</Text>
                <Text style={styles.nextPrayer}>
                  {snapshot.nextPrayer?.label} · {snapshot.nextPrayer?.time}
                </Text>
              </View>
              <Text style={styles.remaining}>{snapshot.timeRemainingText}</Text>
            </View>

            {size === 'large' ? (
              <>
                <GeometricDivider color="rgba(197,155,39,0.45)" style={{ marginVertical: 12 }} />
                <View style={styles.prayerGrid}>
                  {snapshot.prayers.map((p) => (
                    <View key={p.label} style={[styles.prayerChip, p.isCurrent && styles.prayerChipCurrent]}>
                      <Text style={[styles.prayerChipLabel, p.isCurrent && styles.prayerChipActiveText]}>
                        {p.label}
                      </Text>
                      <Text style={[styles.prayerChipTime, p.isCurrent && styles.prayerChipActiveText]}>
                        {p.time}
                      </Text>
                      {p.status === 'prayed' ? (
                        <Ionicons name="checkmark-circle" size={13} color={colors.gold} />
                      ) : null}
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            <PressableScale
              onPress={markPrayed}
              disabled={!snapshot.canMarkCurrent || marking}
              style={[styles.markButton, (!snapshot.canMarkCurrent || marking) && styles.markButtonDisabled]}
            >
              {marking ? (
                <ActivityIndicator size="small" color={themeColors.primaryDeep} />
              ) : (
                <Ionicons name="checkmark-done" size={16} color={themeColors.primaryDeep} />
              )}
              <Text style={styles.markText}>
                {snapshot.currentPrayer?.status === 'prayed' ? 'Already prayed' : 'Mark current as prayed'}
              </Text>
            </PressableScale>
          </>
        ) : (
          <Text style={styles.emptyText}>Set your prayer location to generate widget data.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  sizeRow: { flexDirection: 'row', gap: 8 },
  sizeChip: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    paddingVertical: 8,
    alignItems: 'center',
  },
  sizeText: { color: colors.text, fontSize: 12.5, fontWeight: '800', textTransform: 'capitalize' },
  sizeTextActive: { color: '#fff' },
  widgetCard: {
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    ...shadow.raised,
  },
  widgetSmall: { minHeight: 160 },
  widgetLarge: { minHeight: 280 },
  widgetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  widgetEyebrow: { color: colors.gold, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.7 },
  widgetTitle: { color: '#fff', fontSize: 18, fontWeight: '900', fontFamily: fonts.serif, marginTop: 3 },
  timePill: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  timePillText: { color: '#fff', fontWeight: '900', fontVariant: ['tabular-nums'] },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 26 },
  loadingText: { color: colors.onDarkMuted, fontWeight: '700' },
  progressTrack: {
    height: 9,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginTop: 16,
  },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.gold },
  primaryRow: { marginTop: 14, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  nextLabel: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  nextPrayer: { color: '#fff', fontSize: 17, fontWeight: '900', marginTop: 2 },
  remaining: { color: colors.gold, fontSize: 18, fontWeight: '900' },
  prayerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prayerChip: {
    width: '31.6%',
    minHeight: 62,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 9,
  },
  prayerChipCurrent: { backgroundColor: 'rgba(197,155,39,0.2)', borderColor: 'rgba(197,155,39,0.45)' },
  prayerChipLabel: { color: colors.onDarkMuted, fontSize: 11, fontWeight: '800' },
  prayerChipTime: { color: '#fff', fontSize: 14, fontWeight: '900', marginTop: 4 },
  prayerChipActiveText: { color: '#fff' },
  markButton: {
    marginTop: 16,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  markButtonDisabled: { opacity: 0.65 },
  markText: { color: colors.primaryDeep, fontSize: 13.5, fontWeight: '900' },
  emptyText: { color: colors.onDarkMuted, fontSize: 13, fontWeight: '700', marginTop: 18 },
  successToast: {
    marginTop: 12,
    padding: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successToastText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
});


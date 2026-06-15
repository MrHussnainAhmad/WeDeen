import React, { useMemo } from 'react';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { PressableScale } from '@/components/Anim';
import { StarFieldWatermark, MihrabArch } from '@/components/IslamicMotifs';
import {
  formatCountdown,
  formatPrayerTime,
  PrayerEntry,
  PrayerKey,
} from '@/hooks/usePrayerSnapshot';

type Schedule = {
  next: { key: PrayerKey; time: string; at: Date; tomorrow: boolean } | null;
  current: { key: PrayerKey; time: string } | null;
  progress: number;
  msToNext: number;
};

const ARABIC_NAMES: Record<PrayerKey, string> = {
  Fajr: 'الفجر',
  Sunrise: 'الشروق',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
};

const ICONS: Record<PrayerKey, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Fajr: 'weather-sunset-up',
  Sunrise: 'white-balance-sunny',
  Dhuhr: 'weather-sunny',
  Asr: 'weather-partly-cloudy',
  Maghrib: 'weather-sunset-down',
  Isha: 'weather-night',
};

/** The 5 obligatory prayers for the timeline strip (Sunrise omitted). */
const TIMELINE: PrayerKey[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export const PrayerCard = React.memo(function PrayerCard({
  entries,
  schedule,
  use24HourTime,
  hasLocation,
  isLoading,
  permissionDenied,
  onEnableLocation,
}: {
  entries: PrayerEntry[];
  schedule: Schedule;
  use24HourTime: boolean;
  hasLocation: boolean;
  isLoading: boolean;
  permissionDenied: boolean;
  onEnableLocation: () => void;
}) {
  const countdown = useMemo(() => formatCountdown(schedule.msToNext), [schedule.msToNext]);
  const next = schedule.next;

  return (
    <View style={styles.card}>
      <StarFieldWatermark rows={3} cols={6} starSize={18} color="rgba(255,255,255,0.045)" />
      <View style={styles.archWrap}>
        <MihrabArch width={150} height={66} color="rgba(197,155,39,0.32)" />
      </View>
      <View style={styles.goldTop} />

      {/* Header */}
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <MaterialCommunityIcons name="mosque" size={16} color={colors.gold} />
          </View>
          <Text style={styles.brandText}>PRAYER TIMES</Text>
        </View>
        <Link href="/hijri" asChild>
          <PressableScale style={styles.allBtn}>
            <Text style={styles.allBtnText}>All</Text>
            <Ionicons name="chevron-forward" size={12} color="#fff" />
          </PressableScale>
        </Link>
      </View>

      {!hasLocation ? (
        <LocationPrompt permissionDenied={permissionDenied} onEnable={onEnableLocation} />
      ) : (
        <>
          {/* Next prayer + live countdown */}
          <View style={styles.nextRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nextLabel}>
                {next?.tomorrow ? 'NEXT · TOMORROW' : 'NEXT PRAYER'}
              </Text>
              <View style={styles.nameRow}>
                <Text style={styles.nextName}>{next ? next.key : '—'}</Text>
                {next ? <Text style={styles.nextNameArabic}>{ARABIC_NAMES[next.key]}</Text> : null}
              </View>
              <Text style={styles.nextTime}>
                {next ? formatPrayerTime(next.time, use24HourTime) : isLoading ? 'Loading…' : '--:--'}
              </Text>
            </View>

            <View style={styles.countdownWrap}>
              <Text style={styles.countdownValue}>{countdown.label}</Text>
              <Text style={styles.countdownCaption}>remaining</Text>
            </View>
          </View>

          {/* Progress through the current window */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(schedule.progress * 100)}%` }]}>
              <View style={styles.progressKnob} />
            </View>
          </View>

          {/* Timeline strip */}
          <View style={styles.timeline}>
            {TIMELINE.map((key) => {
              const entry = entries.find((e) => e.key === key);
              const isNext = next?.key === key && !next?.tomorrow;
              const isPassed =
                schedule.current?.key === key ||
                (!!schedule.current &&
                  TIMELINE.indexOf(key) < TIMELINE.indexOf(schedule.current.key));
              return (
                <View key={key} style={styles.tItem}>
                  <View
                    style={[
                      styles.tIconWrap,
                      isPassed && styles.tIconPassed,
                      isNext && styles.tIconNext,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={ICONS[key]}
                      size={16}
                      color={isNext ? colors.primaryDeep : isPassed ? colors.gold : 'rgba(255,255,255,0.6)'}
                    />
                  </View>
                  <Text style={[styles.tName, isNext && styles.tNameActive]}>{key}</Text>
                  <Text style={[styles.tTime, isNext && styles.tTimeActive]}>
                    {entry ? formatPrayerTime(entry.time, use24HourTime) : '--:--'}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
});

function LocationPrompt({
  permissionDenied,
  onEnable,
}: {
  permissionDenied: boolean;
  onEnable: () => void;
}) {
  return (
    <View style={styles.promptWrap}>
      <View style={styles.promptIcon}>
        <Ionicons name="location-outline" size={22} color={colors.gold} />
      </View>
      <Text style={styles.promptTitle}>See your prayer times</Text>
      <Text style={styles.promptText}>
        {permissionDenied
          ? 'Location is off. Enable it to show accurate timings for where you are.'
          : 'Allow location to calculate accurate prayer times for your area.'}
      </Text>
      <PressableScale onPress={onEnable} style={styles.promptBtn}>
        <Ionicons name="navigate" size={14} color={colors.primaryDeep} style={{ marginRight: 6 }} />
        <Text style={styles.promptBtnText}>Enable Location</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    overflow: 'hidden',
    ...shadow.raised,
  },
  archWrap: { position: 'absolute', top: 0, alignSelf: 'center' },
  goldTop: {
    position: 'absolute', top: 0, left: '22%', right: '22%', height: 2,
    backgroundColor: colors.gold, opacity: 0.45,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandIcon: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(197,155,39,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  brandText: { color: colors.onDarkMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  allBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 10,
  },
  allBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  // Next prayer
  nextRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 20 },
  nextLabel: { color: colors.gold, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 6 },
  nextName: { color: '#fff', fontSize: 30, fontWeight: '800', fontFamily: fonts.serif },
  nextNameArabic: { color: colors.gold, fontSize: 22, fontFamily: fonts.arabic, lineHeight: 34 },
  nextTime: { color: colors.onDarkMuted, fontSize: 14, fontWeight: '600', marginTop: 2 },
  countdownWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(197,155,39,0.16)',
    borderWidth: 1, borderColor: 'rgba(197,155,39,0.32)',
    borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 14, minWidth: 92,
  },
  countdownValue: { color: '#fff', fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  countdownCaption: { color: colors.onDarkMuted, fontSize: 10, fontWeight: '600', marginTop: 1 },

  // Progress
  progressTrack: {
    height: 6, borderRadius: 3, marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'visible',
  },
  progressFill: {
    height: 6, borderRadius: 3, backgroundColor: colors.gold,
    minWidth: 6, justifyContent: 'center',
  },
  progressKnob: {
    position: 'absolute', right: -3, width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#fff', borderWidth: 2.5, borderColor: colors.gold,
  },

  // Timeline
  timeline: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  tItem: { alignItems: 'center', flex: 1, gap: 6 },
  tIconWrap: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  tIconPassed: {
    backgroundColor: 'rgba(197,155,39,0.14)',
    borderColor: 'rgba(197,155,39,0.34)',
  },
  tIconNext: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
    transform: [{ scale: 1.08 }],
  },
  tName: { color: 'rgba(255,255,255,0.62)', fontSize: 10.5, fontWeight: '700' },
  tNameActive: { color: '#fff', fontWeight: '800' },
  tTime: {
    color: 'rgba(255,255,255,0.5)', fontSize: 10.5, fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  tTimeActive: { color: colors.gold, fontWeight: '800' },

  // Location prompt
  promptWrap: { alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8, marginTop: 8 },
  promptIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(197,155,39,0.14)',
    borderWidth: 1, borderColor: 'rgba(197,155,39,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  promptTitle: { color: '#fff', fontSize: 16, fontWeight: '800', fontFamily: fonts.serif },
  promptText: {
    color: colors.onDarkMuted, fontSize: 12.5, lineHeight: 19,
    textAlign: 'center', marginTop: 6, maxWidth: 280,
  },
  promptBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.gold, borderRadius: radius.pill,
    paddingVertical: 10, paddingHorizontal: 18, marginTop: 16,
  },
  promptBtnText: { color: colors.primaryDeep, fontWeight: '800', fontSize: 13.5 },
});

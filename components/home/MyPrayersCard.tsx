import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { colors, fonts, radius, shadow } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { PressableScale } from '@/components/Anim';
import { getSalahLogs, getTodayStr, calculateStreakStats, type DaySalahLog } from '@/services/prayerTrackerService';
import { type PrayerLabel } from '@/services/prayerTimingUtils';

export const MyPrayersCard = React.memo(function MyPrayersCard() {
  const themeColors = useThemeColors();
  const [todayLog, setTodayLog] = useState<Partial<DaySalahLog>>({});
  const [streak, setStreak] = useState<number>(0);

  const loadData = useCallback(async () => {
    try {
      const logs = await getSalahLogs();
      const todayKey = getTodayStr();
      setTodayLog(logs[todayKey] || {});
      const streaks = calculateStreakStats(logs);
      setStreak(streaks.streak);
    } catch (err) {
      console.error('Failed to load prayer tracker data on home card:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => undefined;
    }, [loadData])
  );

  const obligatory: PrayerLabel[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'prayed':
        return <Ionicons name="checkmark-circle" size={24} color="#0B6B4F" />;
      case 'missed':
        return <Ionicons name="close-circle" size={24} color="#A8321F" />;
      case 'pending':
        return <Ionicons name="time" size={24} color={themeColors.gold} />;
      case 'upcoming':
      default:
        return <Ionicons name="ellipse-outline" size={24} color={themeColors.faint} />;
    }
  };

  return (
    <PressableScale
      style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border, ...shadow.card }]}
      onPress={() => router.push('/prayer-tracker' as any)}
    >
      {/* Title block */}
      <View style={styles.titleRow}>
        <View style={styles.titleLeft}>
          <MaterialCommunityIcons name="mosque" size={18} color={themeColors.primary} />
          <Text style={[styles.titleText, { color: themeColors.text }]}>My Prayers Today</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={themeColors.muted} />
      </View>

      {/* Grid of 5 prayers */}
      <View style={styles.prayersRow}>
        {obligatory.map((p) => {
          const item = todayLog[p];
          const status = item?.status || 'upcoming';
          return (
            <View key={p} style={styles.prayerCol}>
              <Text style={[styles.prayerName, { color: themeColors.muted }]}>{p}</Text>
              <View style={styles.iconWrap}>{getStatusIcon(status)}</View>
            </View>
          );
        })}
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: themeColors.borderSoft }]} />

      {/* Streak information */}
      <View style={styles.streakRow}>
        <Ionicons name="flame" size={16} color="#E05A45" />
        <Text style={[styles.streakText, { color: themeColors.text }]}>
          {streak > 0 ? `${streak} day streak` : 'Start your streak today!'}
        </Text>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.serif,
  },
  prayersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  prayerCol: {
    alignItems: 'center',
    gap: 6,
  },
  prayerName: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  iconWrap: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: 10,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streakText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
});

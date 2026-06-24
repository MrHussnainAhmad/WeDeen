import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/authStore';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { PressableScale } from '@/components/Anim';
import { getSalahLogs, getTodayStr, calculateStreakStats, calculateConsistencyScore, setPrayerStatus, type DaySalahLog } from '@/services/prayerTrackerService';
import { getSalahFocusTotalCompleted } from '@/services/salahFocusService';
import { type PrayerLabel } from '@/services/prayerTimingUtils';

export default function PrayerTrackerScreen() {
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuthStore();
  const [logs, setLogs] = useState<Record<string, DaySalahLog>>({});
  const [streakStats, setStreakStats] = useState({ streak: 0, bestStreak: 0 });
  const [thisWeekCount, setThisWeekCount] = useState(0);
  const [mostMissed, setMostMissed] = useState<string>('None');
  const [consistencyScore, setConsistencyScore] = useState(0);
  const [focusCompleted, setFocusCompleted] = useState(0);

  const obligatory: PrayerLabel[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  // Get dates of the current week (Monday to Sunday)
  const weekDates = React.useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sun, 1 = Mon, ...
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;

    const monday = new Date();
    monday.setDate(now.getDate() + distanceToMonday);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      dates.push(day);
    }
    return dates;
  }, []);

  const loadData = useCallback(async () => {
    try {
      const savedLogs = await getSalahLogs();
      setLogs(savedLogs);
      
      const stats = calculateStreakStats(savedLogs);
      setStreakStats({ streak: stats.streak, bestStreak: stats.bestStreak });

      // Calculate this week's prayed count
      let weekPrayed = 0;
      const weekKeys = weekDates.map((d) => getTodayStr(d));
      weekKeys.forEach((key) => {
        const dayLog = savedLogs[key];
        if (dayLog) {
          obligatory.forEach((p) => {
            if (dayLog[p]?.status === 'prayed') weekPrayed++;
          });
        }
      });
      setThisWeekCount(weekPrayed);

      // Calculate most missed prayer
      const missedCounts: Record<string, number> = { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 };
      Object.values(savedLogs).forEach((dayLog) => {
        obligatory.forEach((p) => {
          if (dayLog[p]?.status === 'missed') {
            missedCounts[p] = (missedCounts[p] || 0) + 1;
          }
        });
      });

      let maxMissedVal = 0;
      let maxMissedName = 'None';
      obligatory.forEach((p) => {
        if (missedCounts[p] > maxMissedVal) {
          maxMissedVal = missedCounts[p];
          maxMissedName = p;
        }
      });
      setMostMissed(maxMissedVal > 0 ? maxMissedName : 'None');

      const score = calculateConsistencyScore(savedLogs);
      setConsistencyScore(score);

      const focusCount = await getSalahFocusTotalCompleted();
      setFocusCompleted(focusCount);
    } catch (err) {
      console.error('Failed to load prayer tracker data:', err);
    }
  }, [weekDates]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => undefined;
    }, [loadData])
  );

  const handleCellPress = async (dayKey: string, prayer: PrayerLabel) => {
    const dayLog = logs[dayKey];
    const item = dayLog?.[prayer];
    let status = item?.status;

    if (!status) {
      status = dayKey < getTodayStr(new Date()) ? 'missed' : 'upcoming';
    }

    if (status === 'upcoming') return; // Cannot mark future prayers

    const nextStatus = status === 'prayed' ? 'missed' : status === 'missed' ? 'pending' : 'prayed';
    
    // Optimistic UI update
    setLogs((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        [prayer]: { status: nextStatus, timestamp: Date.now() },
      },
    }));

    await setPrayerStatus(prayer, dayKey, nextStatus as any, null, null);
    loadData(); // Re-sync stats
  };

  const getCellIcon = (dayKey: string, prayer: PrayerLabel) => {
    const dayLog = logs[dayKey];
    const item = dayLog?.[prayer];
    let status = item?.status;
    
    if (!status) {
      status = dayKey < getTodayStr(new Date()) ? 'missed' : 'upcoming';
    }

    switch (status) {
      case 'prayed':
        return <Ionicons name="checkmark-circle" size={22} color="#0B6B4F" />;
      case 'missed':
        return <Ionicons name="close-circle" size={22} color="#A8321F" />;
      case 'pending':
        return <Ionicons name="time" size={22} color={themeColors.gold} />;
      case 'upcoming':
      default:
        return <Ionicons name="ellipse-outline" size={22} color={themeColors.faint} />;
    }
  };

  const dayNamesShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (!token) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.bg, padding: 16, justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="lock-closed-outline" size={48} color={themeColors.muted} style={{ marginBottom: 16 }} />
        <Text style={[styles.sectionTitle, { color: themeColors.text, textAlign: 'center', marginBottom: 8 }]}>Sign In Required</Text>
        <Text style={[styles.sectionSubtitle, { color: themeColors.muted, textAlign: 'center', marginBottom: 24 }]}>
          Sign in to save your progress, track your Salah, and view your worship insights.
        </Text>
        <PressableScale
          style={[styles.signInButton, { backgroundColor: themeColors.primary }]}
          onPress={() => router.push('/profile')}
        >
          <Text style={styles.signInText}>Go to Sign In</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Week Title */}
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Weekly Tracker</Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.muted }]}>
            {weekDates[0].toLocaleDateString([], { month: 'short', day: 'numeric' })} –{' '}
            {weekDates[6].toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>

        {/* 7x5 Grid Card */}
        <View style={[styles.gridCard, { backgroundColor: themeColors.card, borderColor: themeColors.border, ...shadow.card }]}>
          {/* Header Row: Days of Week */}
          <View style={styles.gridHeaderRow}>
            <View style={styles.labelColEmpty} />
            {weekDates.map((d, idx) => {
              const todayStr = getTodayStr(d);
              const isToday = todayStr === getTodayStr(new Date());
              return (
                <View key={idx} style={[styles.dayHeaderCol, isToday && [styles.todayHighlight, { backgroundColor: themeColors.primarySoft }]]}>
                  <Text style={[styles.dayName, { color: isToday ? themeColors.primary : themeColors.muted }]}>
                    {dayNamesShort[idx]}
                  </Text>
                  <Text style={[styles.dayDate, { color: isToday ? themeColors.primary : themeColors.text }]}>
                    {d.getDate()}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Divider */}
          <View style={[styles.gridDivider, { backgroundColor: themeColors.borderSoft }]} />

          {/* Prayer Rows */}
          {obligatory.map((prayer) => (
            <View key={prayer} style={styles.gridRow}>
              {/* Row Label */}
              <View style={styles.labelCol}>
                <Text style={[styles.prayerLabelText, { color: themeColors.text }]}>{prayer}</Text>
              </View>

              {/* Status Cells */}
              {weekDates.map((d, idx) => {
                const dayKey = getTodayStr(d);
                return (
                  <PressableScale 
                    key={idx} 
                    style={styles.gridCell}
                    onPress={() => handleCellPress(dayKey, prayer)}
                  >
                    {getCellIcon(dayKey, prayer)}
                  </PressableScale>
                );
              })}
            </View>
          ))}
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <Ionicons name="checkmark-circle" size={14} color="#0B6B4F" />
            <Text style={[styles.legendText, { color: themeColors.muted }]}>Prayed</Text>
          </View>
          <View style={styles.legendItem}>
            <Ionicons name="close-circle" size={14} color="#A8321F" />
            <Text style={[styles.legendText, { color: themeColors.muted }]}>Missed</Text>
          </View>
          <View style={styles.legendItem}>
            <Ionicons name="time" size={14} color={themeColors.gold} />
            <Text style={[styles.legendText, { color: themeColors.muted }]}>Pending</Text>
          </View>
          <View style={styles.legendItem}>
            <Ionicons name="ellipse-outline" size={14} color={themeColors.faint} />
            <Text style={[styles.legendText, { color: themeColors.muted }]}>Upcoming</Text>
          </View>
        </View>

        {/* Statistics section */}
        <Text style={[styles.sectionTitle, styles.statsTitle, { color: themeColors.text }]}>Statistics</Text>
        
        <View style={styles.statsContainer}>
          {/* Card 1: Count */}
          <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={[styles.statIconWrap, { backgroundColor: themeColors.primarySoft }]}>
              <Ionicons name="bar-chart-outline" size={20} color={themeColors.primary} />
            </View>
            <View style={styles.statInfo}>
              <Text style={[styles.statLabel, { color: themeColors.muted }]}>This week</Text>
              <Text style={[styles.statValue, { color: themeColors.text }]}>{thisWeekCount} / 35 prayers</Text>
            </View>
          </View>

          {/* Card 2: Streaks */}
          <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={[styles.statIconWrap, { backgroundColor: '#FBEAE6' }]}>
              <Ionicons name="flame-outline" size={20} color="#E05A45" />
            </View>
            <View style={styles.statInfo}>
              <Text style={[styles.statLabel, { color: themeColors.muted }]}>Current / Best Streak</Text>
              <Text style={[styles.statValue, { color: themeColors.text }]}>
                {streakStats.streak} days / {streakStats.bestStreak} days
              </Text>
            </View>
          </View>

          {/* Card 3: Most Missed */}
          <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={[styles.statIconWrap, { backgroundColor: themeColors.goldSoft }]}>
              <Ionicons name="warning-outline" size={20} color={themeColors.goldDeep} />
            </View>
            <View style={styles.statInfo}>
              <Text style={[styles.statLabel, { color: themeColors.muted }]}>Most Missed</Text>
              <Text style={[styles.statValue, { color: themeColors.text }]}>{mostMissed}</Text>
            </View>
          </View>
        </View>

        {/* Worship Insights section */}
        <Text style={[styles.sectionTitle, styles.statsTitle, { color: themeColors.text }]}>Worship Insights</Text>

        <View style={styles.statsContainer}>
          {/* Card 4: Consistency Score */}
          <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={[styles.statIconWrap, { backgroundColor: themeColors.primarySoft }]}>
              <Ionicons name="speedometer-outline" size={20} color={themeColors.primary} />
            </View>
            <View style={styles.statInfo}>
              <Text style={[styles.statLabel, { color: themeColors.muted }]}>Consistency Score (30 Days)</Text>
              <Text style={[styles.statValue, { color: themeColors.text }]}>{consistencyScore}%</Text>
            </View>
          </View>

          {/* Card 5: Prayer Lock */}
          <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={[styles.statIconWrap, { backgroundColor: themeColors.goldSoft }]}>
              <Ionicons name="lock-closed-outline" size={20} color={themeColors.goldDeep} />
            </View>
            <View style={styles.statInfo}>
              <Text style={[styles.statLabel, { color: themeColors.muted }]}>Prayer Focus</Text>
              <Text style={[styles.statValue, { color: themeColors.text }]}>
                {focusCompleted > 0 ? `Stayed focused during ${focusCompleted} prayers` : 'No focused prayers yet'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 999,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: fonts.serif,
  },
  headerRight: { width: 38 },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.serif,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  gridCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 12,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelColEmpty: {
    width: 60,
  },
  dayHeaderCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  todayHighlight: {
    borderRadius: radius.sm,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '700',
  },
  dayDate: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  gridDivider: {
    height: 1,
    width: '100%',
    marginBottom: 10,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  labelCol: {
    width: 60,
    justifyContent: 'center',
  },
  prayerLabelText: {
    fontSize: 12,
    fontWeight: '700',
  },
  gridCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statsTitle: {
    marginTop: 24,
    marginBottom: 12,
  },
  statsContainer: {
    gap: 10,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statInfo: {
    gap: 2,
  },
  statLabel: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  signInButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  signInText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

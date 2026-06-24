import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useDailyIslamicData } from '@/hooks/useDailyIslamicData';
import { usePrayerSnapshot } from '@/hooks/usePrayerSnapshot';
import { useAuthStore } from '@/store/authStore';
import { getUiPreferences, uiPreferenceDefaults } from '@/utils/preferences';
import { radius, colors, fonts, shadow } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { PressableScale, TabFadeInView } from '@/components/Anim';
import { TabSceneGuard } from '@/components/navigation/TabSceneGuard';
import { GeometricDivider } from '@/components/IslamicMotifs';
import { ISLAMIC_EVENTS } from '@/services/hijriCalendarService';

import { GreetingHeader } from '@/components/home/GreetingHeader';
import { RamadanBanner } from '@/components/home/RamadanBanner';
import { PrayerCard } from '@/components/home/PrayerCard';
import { MyPrayersCard } from '@/components/home/MyPrayersCard';
import { FavoriteVersesCard } from '@/components/home/FavoriteVersesCard';
import { QuickActions } from '@/components/home/QuickActions';
import { VerseCard } from '@/components/home/VerseCard';
import { HadithCard } from '@/components/home/HadithCard';
import { AzkarRail } from '@/components/home/AzkarRail';
import { HomeSkeleton } from '@/components/home/HomeSkeleton';
import { useResponsive } from '@/theme/responsive';
import { BannerAdSpace } from '@/components/BannerAdSpace';
import { useAchievementStore } from '@/store/achievementStore';
import { getSalahLogs, calculateStreakStats } from '@/services/prayerTrackerService';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top + 12, 22);
  const responsive = useResponsive();
  const themeColors = useThemeColors();

  const { data, isLoading, isError, refetch, isFetching } = useDailyIslamicData();
  const user = useAuthStore((s) => s.user);
  
  const rankTitle = useAchievementStore((s) => s.rankTitle);
  const [streak, setStreak] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        getSalahLogs().then((logs) => {
          const stats = calculateStreakStats(logs);
          setStreak(stats.streak);
        }).catch(() => undefined);
      }
    }, [user])
  );

  const upcomingEvents = useMemo(() => {
    if (!data?.hijriMonthNumber || !data?.hijriDay) return [];
    const currentMonth = Number(data.hijriMonthNumber);
    const currentDay = Number(data.hijriDay);
    return ISLAMIC_EVENTS.filter((event) => {
      if (event.hijriMonth === currentMonth) {
        const diff = event.hijriDay - currentDay;
        return diff >= 0 && diff <= 7;
      }
      return false;
    });
  }, [data?.hijriMonthNumber, data?.hijriDay]);

  // A single 1s clock drives the live countdown. Kept in this parent so only the
  // memoized PrayerCard re-renders each tick — the heavier cards below stay put.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const prayer = usePrayerSnapshot(nowTick);

  // Pre-fetch and update Ramadan fasting times (Sehri & Iftar) every day at 12:00 AM (midnight)
  // or on app launch/resume when the user is in the Ramadan month.
  const lastPrefetchDate = useRef<string | null>(null);

  useEffect(() => {
    const loc = prayer.location;
    if (!loc) return;

    // Check if it is the Ramadan month (Hijri month 9)
    const isRamadan = data?.hijriMonthNumber === 9;
    if (!isRamadan) return;

    const todayStr = new Date(nowTick).toDateString(); // changes precisely at 12:00 AM midnight
    if (lastPrefetchDate.current !== todayStr) {
      lastPrefetchDate.current = todayStr;

      // Lazy import the service function to keep app startup lightweight
      import('@/services/ramadanService')
        .then(({ preloadRamadanFastingTimes }) => {
          preloadRamadanFastingTimes(loc).catch(() => undefined);
        })
        .catch(() => undefined);
    }
  }, [prayer.location, data?.hijriMonthNumber, nowTick]);

  const [use24HourTime, setUse24HourTime] = useState(uiPreferenceDefaults.use24HourTime);
  useFocusEffect(
    useCallback(() => {
      getUiPreferences()
        .then((prefs) => setUse24HourTime(prefs.use24HourTime))
        .catch(() => undefined);
      return () => undefined;
    }, [])
  );

  const greetingHour = useMemo(() => new Date(nowTick).getHours(), [Math.floor(nowTick / 60000)]);

  // Show the full skeleton during the initial content load, but stop blocking as
  // soon as the (independent) prayer snapshot has resolved — so a slow content API
  // never holds up the prayer hero. `locationReady` covers the brief window while
  // the saved location is read from storage.
  if (isLoading && (!prayer.locationReady || prayer.isLoading)) {
    return (
      <TabSceneGuard>
        <View style={[styles.screen, { backgroundColor: themeColors.bg }]}>
          <HomeSkeleton topPad={topPad} />
        </View>
      </TabSceneGuard>
    );
  }

  const onRefresh = () => {
    refetch();
    prayer.refetch();
  };

  return (
    <TabSceneGuard>
    <ScrollView
      style={[styles.screen, { backgroundColor: themeColors.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad }, responsive.centerContent]}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={isFetching || prayer.isFetching}
          onRefresh={onRefresh}
          colors={[themeColors.primary]}
          tintColor={themeColors.primary}
          progressViewOffset={topPad}
        />
      }
    >
      {/* Greeting */}
      <TabFadeInView style={styles.section}>
        <GreetingHeader name={user?.name} hour={greetingHour} />
      </TabFadeInView>

      {/* Ramadan Dashboard Banner - Render only in Ramadan */}
      {data?.hijriMonthNumber === 9 && (
        <TabFadeInView style={styles.section}>
          <RamadanBanner location={prayer.location} nowTick={nowTick} />
        </TabFadeInView>
      )}



      {/* Compact Event Banner for Logged-In Users */}
      {user && upcomingEvents.length > 0 && (
        <TabFadeInView style={[styles.section, { marginBottom: -10, marginTop: -6 }]}>
          {(() => {
            const event = upcomingEvents[0];
            const diff = event.hijriDay - Number(data?.hijriDay);
            const dayLabel = diff === 0 ? 'Today!' : diff === 1 ? 'Tomorrow' : `in ${diff} days`;
            return (
              <View style={styles.compactEventRow}>
                <Text style={styles.compactEventTitle}>{event.title}</Text>
                <Text style={styles.compactEventDay}>{dayLabel}</Text>
              </View>
            );
          })()}
        </TabFadeInView>
      )}

      {/* 1. Prayer hero / Prayer Times Card */}
      <TabFadeInView style={styles.section}>
        <PrayerCard
          entries={prayer.entries}
          schedule={prayer.schedule}
          use24HourTime={use24HourTime}
          hasLocation={prayer.hasLocation}
          isLoading={prayer.isLoading || !prayer.locationReady}
          permissionDenied={prayer.permissionDenied}
          onEnableLocation={prayer.enableLocation}
        />
      </TabFadeInView>

      {/* 2. Top Quick Actions: Quran/Hadith, Tasbih & Azkar */}
      <TabFadeInView style={styles.section}>
        <QuickActions type="top" />
      </TabFadeInView>

      {/* 3. My Prayers Today (logged in) OR Hijri Calendar Banner (logged out) */}
      {user ? (
        <TabFadeInView style={styles.section}>
          <MyPrayersCard />
        </TabFadeInView>
      ) : upcomingEvents.length > 0 ? (
        upcomingEvents.map((event) => {
          const diff = event.hijriDay - Number(data?.hijriDay);
          const dayLabel = diff === 0 ? 'Today!' : diff === 1 ? 'Tomorrow' : `in ${diff} days`;
          return (
            <TabFadeInView key={event.id} style={styles.section}>
              <View style={[styles.eventCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                <View style={styles.eventIconWrap}>
                  <Ionicons name="calendar-outline" size={20} color={themeColors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Text style={[styles.eventTitle, { color: themeColors.text }]}>{event.title}</Text>
                    <Text style={[styles.eventDayLabel, { color: themeColors.gold }]}>{dayLabel}</Text>
                  </View>
                  <Text style={[styles.eventDesc, { color: themeColors.muted }]}>{event.description}</Text>
                </View>
              </View>
            </TabFadeInView>
          );
        })
      ) : (
        <TabFadeInView style={styles.section}>
          <Link href="/hijri" asChild>
            <PressableScale style={[styles.eventCard, { backgroundColor: themeColors.card, borderColor: themeColors.border, flexDirection: 'row', alignItems: 'center' }]}>
              <View style={styles.eventIconWrap}>
                <Ionicons name="calendar-outline" size={20} color={themeColors.gold} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.eventTitle, { color: themeColors.text }]}>Hijri Calendar</Text>
                <Text style={[styles.eventDesc, { color: themeColors.muted }]}>View current month, converter, & recommended fasting days.</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={themeColors.muted} />
            </PressableScale>
          </Link>
        </TabFadeInView>
      )}

      {/* 4. Remaining Quick Actions */}
      <TabFadeInView style={styles.section}>
        <QuickActions type="remaining" />
      </TabFadeInView>

      {/* 5. Favorite Verses */}
      <TabFadeInView style={styles.section}>
        <FavoriteVersesCard index={3} />
      </TabFadeInView>

      {/* 6. Verse of the Day */}
      <View style={styles.section}>
        <VerseCard
          index={4}
          arabic={data?.reminderArabic}
          translation={data?.reminder ?? 'Reminder unavailable'}
          reference={data?.verseReference}
        />
      </View>

      {/* 7. Hadith of the Day */}
      <View style={styles.section}>
        <HadithCard index={5} hadith={data?.hadith ?? 'Hadith unavailable'} />
      </View>

      {/* 8. Du'a & Azkar */}
      <AzkarRail index={6} items={data?.azkar ?? []} />

      {isError ? (
        <View style={[styles.section, styles.errorBanner, { backgroundColor: themeColors.dangerSoft }]}>
          <Ionicons name="cloud-offline-outline" size={18} color={themeColors.danger} style={{ marginRight: 8 }} />
          <Text style={[styles.errorText, { color: themeColors.danger }]}>Couldn't sync today's content. Pull down to retry.</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <GeometricDivider color={themeColors.goldBorder} />
        <Text style={[styles.footerText, { color: themeColors.muted }]}>{'بَارَكَ اللَّهُ فِيكُم'}</Text>
      </View>

      <View style={styles.adSection}>
        <BannerAdSpace />
      </View>
    </ScrollView>
    </TabSceneGuard>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 18, paddingBottom: 128 },
  section: { paddingHorizontal: 16 },
  adSection: { paddingHorizontal: 16 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#F0CFC8',
    borderWidth: 1,
    padding: 12,
    borderRadius: radius.md,
  },
  errorText: { fontSize: 13, fontWeight: '600', flex: 1 },
  footer: { paddingVertical: 10, alignItems: 'center', gap: 10 },
  footerText: {
    fontFamily: 'KFGQPCNastaleeq',
    fontSize: 18,
    lineHeight: 32,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    ...shadow.card,
  },
  eventIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FAF3E1',
    borderWidth: 1,
    borderColor: '#E9D9AE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBanner: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressBannerCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  progressBannerDivider: {
    width: 1,
    height: 32,
    marginHorizontal: 12,
    opacity: 0.2,
  },
  progressBannerLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  progressBannerValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  eventTitle: {
    fontSize: 14.5,
    fontWeight: 'bold',
    fontFamily: fonts.serif,
  },
  eventDayLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  eventDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
    fontWeight: '600',
  },
  compactEventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  compactEventTitle: {
    color: '#A8321F', // red
    fontSize: 12.5,
    fontWeight: '800',
    fontFamily: fonts.serif,
  },
  compactEventDay: {
    color: '#A8321F', // red
    fontSize: 12.5,
    fontWeight: '800',
  },
});

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useDailyIslamicData } from '@/hooks/useDailyIslamicData';
import { usePrayerSnapshot } from '@/hooks/usePrayerSnapshot';
import { useAuthStore } from '@/store/authStore';
import { getUiPreferences, uiPreferenceDefaults } from '@/utils/preferences';
import { radius } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { TabFadeInView } from '@/components/Anim';
import { TabSceneGuard } from '@/components/navigation/TabSceneGuard';
import { GeometricDivider } from '@/components/IslamicMotifs';

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

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top + 12, 22);
  const responsive = useResponsive();
  const themeColors = useThemeColors();

  const { data, isLoading, isError, refetch, isFetching } = useDailyIslamicData();
  const user = useAuthStore((s) => s.user);

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

      {/* Ramadan Dashboard Banner */}
      <TabFadeInView style={styles.section}>
        <RamadanBanner location={prayer.location} nowTick={nowTick} />
      </TabFadeInView>

      {/* Prayer hero */}
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

      {/* My Prayers Card (Logged In only) */}
      {user ? (
        <TabFadeInView style={styles.section}>
          <MyPrayersCard />
        </TabFadeInView>
      ) : null}

      {/* Quick actions */}
      <TabFadeInView style={styles.section}>
        <QuickActions />
      </TabFadeInView>

      {/* Favorite verses */}
      <TabFadeInView style={styles.section}>
        <FavoriteVersesCard index={3} />
      </TabFadeInView>

      {/* Verse of the day */}
      <View style={styles.section}>
        <VerseCard
          index={4}
          arabic={data?.reminderArabic}
          translation={data?.reminder ?? 'Reminder unavailable'}
          reference={data?.verseReference}
        />
      </View>

      {/* Hadith of the day */}
      <View style={styles.section}>
        <HadithCard index={5} hadith={data?.hadith ?? 'Hadith unavailable'} />
      </View>

      {/* Azkar rail (full-bleed horizontal scroll) */}
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
});

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useDailyIslamicData } from '@/hooks/useDailyIslamicData';
import { usePrayerSnapshot } from '@/hooks/usePrayerSnapshot';
import { useAuthStore } from '@/store/authStore';
import { getUiPreferences, uiPreferenceDefaults } from '@/utils/preferences';
import { colors, radius } from '@/theme/colors';
import { FadeInView } from '@/components/Anim';
import { GeometricDivider } from '@/components/IslamicMotifs';

import { GreetingHeader } from '@/components/home/GreetingHeader';
import { PrayerCard } from '@/components/home/PrayerCard';
import { QuickActions } from '@/components/home/QuickActions';
import { VerseCard } from '@/components/home/VerseCard';
import { HadithCard } from '@/components/home/HadithCard';
import { AzkarRail } from '@/components/home/AzkarRail';
import { HomeSkeleton } from '@/components/home/HomeSkeleton';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top + 12, 22);

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
      <View style={styles.screen}>
        <HomeSkeleton topPad={topPad} />
      </View>
    );
  }

  const onRefresh = () => {
    refetch();
    prayer.refetch();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: topPad }]}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={isFetching || prayer.isFetching}
          onRefresh={onRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
          progressViewOffset={topPad}
        />
      }
    >
      {/* Greeting */}
      <FadeInView index={0} style={styles.section}>
        <GreetingHeader name={user?.name} hour={greetingHour} />
      </FadeInView>

      {/* Prayer hero */}
      <FadeInView index={1} style={styles.section}>
        <PrayerCard
          entries={prayer.entries}
          schedule={prayer.schedule}
          use24HourTime={use24HourTime}
          hasLocation={prayer.hasLocation}
          isLoading={prayer.isLoading || !prayer.locationReady}
          permissionDenied={prayer.permissionDenied}
          onEnableLocation={prayer.enableLocation}
        />
      </FadeInView>

      {/* Quick actions */}
      <FadeInView index={2} style={styles.section}>
        <QuickActions />
      </FadeInView>

      {/* Verse of the day */}
      <View style={styles.section}>
        <VerseCard
          index={3}
          arabic={data?.reminderArabic}
          translation={data?.reminder ?? 'Reminder unavailable'}
          reference={data?.verseReference}
        />
      </View>

      {/* Hadith of the day */}
      <View style={styles.section}>
        <HadithCard index={4} hadith={data?.hadith ?? 'Hadith unavailable'} />
      </View>

      {/* Azkar rail (full-bleed horizontal scroll) */}
      <AzkarRail index={5} items={data?.azkar ?? []} />

      {isError ? (
        <View style={[styles.section, styles.errorBanner]}>
          <Ionicons name="cloud-offline-outline" size={18} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={styles.errorText}>Couldn't sync today's content. Pull down to retry.</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <GeometricDivider color={colors.goldBorder} />
        <Text style={styles.footerText}>{'بَارَكَ اللَّهُ فِيكُم'}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { gap: 18, paddingBottom: 120 },
  section: { paddingHorizontal: 16 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderColor: '#F0CFC8',
    borderWidth: 1,
    padding: 12,
    borderRadius: radius.md,
  },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '600', flex: 1 },
  footer: { paddingVertical: 10, alignItems: 'center', gap: 10 },
  footerText: {
    fontFamily: 'KFGQPCNastaleeq',
    color: colors.muted,
    fontSize: 18,
    lineHeight: 32,
  },
});

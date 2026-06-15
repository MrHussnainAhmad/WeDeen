import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';
import { EightPointStar, GeometricDivider } from '@/components/IslamicMotifs';
import { HadithPredownloadPrompt } from '@/components/HadithPredownloadPrompt';
import {
  markHadithPredownloadAsked,
  runBootPreloadOnce,
  shouldAskHadithPredownload,
  shouldRunBootPreload,
} from '@/services/bootPreloadService';
import { cacheAllBooksInBackground } from '@/services/hadithService';
import { handleAdhanAction, schedulePrayerAdhan } from '@/services/prayerNotificationService';
import { ringAdhan } from '@/services/adhanController';
import { maybeRefreshLocation } from '@/services/locationService';
import { ensureBackgroundLocationRegistered } from '@/services/backgroundLocation';
import { AdhanAlarmModal } from '@/components/AdhanAlarmModal';

const SAVED_LOCATION_KEY = 'timings_location_v1';

const queryClient = new QueryClient();

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const [bootDone, setBootDone] = useState(false);
  const [showHadithPrompt, setShowHadithPrompt] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [fontsLoaded] = useFonts({
    KFGQPCNastaleeq: require('@/assets/fonts/KFGQPCNastaleeq-Regular.ttf'),
    NotoNastaliqUrdu: require('@/assets/fonts/NotoNastaliqUrdu-Regular.ttf'),
    NotoSans: require('@/assets/fonts/NotoSans-Regular.ttf'),
    NotoSerif: require('@/assets/fonts/NotoSerif-Regular.ttf'),
    Lora: require('@/assets/fonts/Lora-Regular.ttf')
  });

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    // Scheduled notifications + custom sounds don't work in Expo Go.
    if (Constants.appOwnership === 'expo') return;

    let mounted = true;
    let responseSub: { remove: () => void } | undefined;

    // (Re)schedule the 7-day adhan alarms from the saved location. Runs on every
    // launch/resume so they stay ahead and survive day rollover, regardless of
    // which tab the user visits.
    const scheduleAdhans = async () => {
      try {
        const raw = await AsyncStorage.getItem(SAVED_LOCATION_KEY);
        if (!raw) return;
        await schedulePrayerAdhan(JSON.parse(raw));
      } catch {
        // non-fatal
      }
    };

    (async () => {
      const Notifications = await import('expo-notifications');
      if (!mounted) return;

      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          const data = notification.request.content.data;
          const isAdhan = data?.type === 'adhan';
          // In the foreground, show the alarm pop-up + full adhan instead of the
          // short notification clip.
          if (isAdhan) ringAdhan(String(data?.prayer ?? 'Prayer')).catch(() => undefined);
          return {
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: !isAdhan,
            shouldSetBadge: false,
          };
        },
      });

      // Snooze/Stop notification actions (and a plain tap) on an adhan
      // notification delivered while backgrounded/closed.
      responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (data?.type === 'adhan') {
          handleAdhanAction(response.actionIdentifier, String(data?.prayer ?? 'Prayer')).catch(
            () => undefined
          );
        }
      });
      const last = await Notifications.getLastNotificationResponseAsync();
      const lastData = last?.notification.request.content.data;
      if (last && lastData?.type === 'adhan') {
        handleAdhanAction(last.actionIdentifier, String(lastData?.prayer ?? 'Prayer')).catch(
          () => undefined
        );
      }

      await scheduleAdhans();
    })().catch(() => undefined);

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduleAdhans();
    });

    return () => {
      mounted = false;
      responseSub?.remove?.();
      appStateSub.remove();
    };
  }, []);

  // Keep the saved location (and therefore the adhan times) fresh: on launch and
  // whenever the app returns to the foreground, re-read GPS if already permitted
  // and reschedule if the user has moved. Throttled so a quick fix isn't taken on
  // every foreground. ensureBackgroundLocationRegistered re-arms the opt-in
  // background task (no-op in Expo Go / when not enabled).
  const lastLocRefresh = useRef(0);
  useEffect(() => {
    const refresh = () => {
      const now = Date.now();
      if (now - lastLocRefresh.current < 10 * 60 * 1000) return;
      lastLocRefresh.current = now;
      maybeRefreshLocation().catch(() => undefined);
      ensureBackgroundLocationRegistered().catch(() => undefined);
    };
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, []);

  const fadeToHome = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setBootDone(true));
  };

  const handleHadithYes = () => {
    setShowHadithPrompt(false);
    markHadithPredownloadAsked().catch(() => undefined);
    // Fire-and-forget: cache every book quietly in the background after we land
    // on the home screen.
    cacheAllBooksInBackground().catch(() => undefined);
    fadeToHome();
  };

  const handleHadithNo = () => {
    setShowHadithPrompt(false);
    markHadithPredownloadAsked().catch(() => undefined);
    fadeToHome();
  };

  useEffect(() => {
    if (!fontsLoaded) return;
    let mounted = true;
    const run = async () => {
      try {
        const shouldRun = await shouldRunBootPreload();
        if (shouldRun) {
          await runBootPreloadOnce();
        }
      } catch {
        // Non-blocking: let app continue even if a preload step fails.
      }

      // After the Quran has cached, offer to predownload the hadith books.
      let ask = false;
      try {
        ask = await shouldAskHadithPredownload();
      } catch {
        ask = false;
      }
      if (!mounted) return;
      if (ask) {
        setShowHadithPrompt(true); // keep the boot screen; wait for the user's choice
        return;
      }
      fadeToHome();
    };
    run();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  if (!bootDone) {
    return (
      <>
      <Animated.View style={[styles.bootScreen, { opacity: fadeAnim }]}>
        <View style={styles.bootStarTop}>
          <EightPointStar size={26} color={colors.goldBorder} filled={false} />
        </View>
        <Image source={require('@/assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.bootBismillah}>{'بِسْمِ اللَّهِ'}</Text>
        <GeometricDivider color={colors.gold} style={{ marginVertical: 14 }} />
        <Text style={styles.bootTitle}>
          {showHadithPrompt ? 'Almost ready' : 'Preparing your journey…'}
        </Text>
        {showHadithPrompt ? null : (
          <ActivityIndicator size="small" color={colors.gold} style={styles.loader} />
        )}
      </Animated.View>
      <HadithPredownloadPrompt
        visible={showHadithPrompt}
        onYes={handleHadithYes}
        onNo={handleHadithNo}
      />
      </>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primaryDeep },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontFamily: 'NotoSerif', fontWeight: '700', fontSize: 18 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          // Smooth horizontal slide on both platforms (iOS keeps its native parallax),
          // which pairs naturally with the swipe-back gesture below.
          animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right',
          animationDuration: 280,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="quran/index" options={{ title: 'Quran Surahs' }} />
        <Stack.Screen name="quran/[surah]" options={{ headerShown: false }} />
        <Stack.Screen name="hadith/index" options={{ title: 'Hadith Books' }} />
        <Stack.Screen name="hadith/[book]/index" options={{ title: 'Hadith' }} />
        <Stack.Screen name="hadith/[book]/[section]" options={{ title: 'Hadith' }} />
        <Stack.Screen name="qibla" options={{ title: 'Qibla Compass' }} />
        <Stack.Screen name="names/[type]" options={{ title: '99 Names' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
      <AdhanAlarmModal />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  bootScreen: {
    flex: 1,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bootStarTop: {
    position: 'absolute',
    top: 90,
  },
  logo: {
    width: 124,
    height: 124,
  },
  bootBismillah: {
    fontFamily: 'KFGQPCNastaleeq',
    color: colors.gold,
    fontSize: 30,
    lineHeight: 50,
    marginTop: 18,
  },
  bootTitle: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  loader: {
    marginTop: 14,
  },
});

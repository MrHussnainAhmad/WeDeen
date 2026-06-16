import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';
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
import type { QuranDownloadProgress } from '@/services/quranService';
import { handleAdhanAction, schedulePrayerAdhan } from '@/services/prayerNotificationService';
import { ringAdhan } from '@/services/adhanController';
import { maybeRefreshLocation } from '@/services/locationService';
import { ensureBackgroundLocationRegistered } from '@/services/backgroundLocation';
import { AdhanAlarmModal } from '@/components/AdhanAlarmModal';

const SAVED_LOCATION_KEY = 'timings_location_v1';

const queryClient = new QueryClient();

// Hold the native splash (ivory) on screen until we've decided whether this is a
// first launch (show the "Preparing your journey" boot screen) or a repeat launch
// (go straight to home). This prevents the brief green flash that used to appear
// when the boot screen mounted and immediately faded out on every launch.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

// --- Boot-screen download readout helpers ---------------------------------
function formatBytes(bytes: number) {
  if (!bytes || bytes < 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${Math.max(1, Math.round(kb))} KB`;
}

// "1.8 / 4.5 MB" while downloading; bytes-only if the total isn't known yet.
function formatProgressMeta(p: QuranDownloadProgress | null) {
  if (!p || (!p.bytesWritten && !p.totalBytes)) return '';
  if (p.totalBytes) return `${formatBytes(p.bytesWritten)} / ${formatBytes(p.totalBytes)}`;
  return formatBytes(p.bytesWritten);
}

// Live download speed, e.g. "1.2 MB/s" or "340 KB/s".
function formatSpeed(bytesPerSecond?: number) {
  if (!bytesPerSecond || bytesPerSecond <= 0) return 'Downloading the Holy Quran…';
  const mbs = bytesPerSecond / (1024 * 1024);
  if (mbs >= 1) return `${mbs.toFixed(1)} MB/s`;
  const kbs = bytesPerSecond / 1024;
  return `${Math.max(1, Math.round(kbs))} KB/s`;
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const [bootDone, setBootDone] = useState(false);
  // null = still deciding; true = first launch (show boot screen); false = repeat
  // launch (skip boot screen entirely).
  const [needsBoot, setNeedsBoot] = useState<boolean | null>(null);
  const [showHadithPrompt, setShowHadithPrompt] = useState(false);
  // Live Quran download progress shown on the first-launch boot screen.
  const [quranProgress, setQuranProgress] = useState<QuranDownloadProgress | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const barAnim = useRef(new Animated.Value(0)).current;
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
          if (isAdhan) {
            // App is in the foreground: show ONLY the full-screen in-app alarm
            // (with Stop/Snooze) and play the full adhan. Suppress the OS
            // banner/list/sound so the user gets a single alert, not a duplicate
            // notification in the bar alongside the modal.
            ringAdhan(String(data?.prayer ?? 'Prayer')).catch(() => undefined);
            return {
              shouldShowBanner: false,
              shouldShowList: false,
              shouldPlaySound: false,
              shouldSetBadge: false,
            };
          }
          // Non-adhan notifications behave normally.
          return {
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
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
      // Decide up front (fast AsyncStorage reads) whether this launch has any
      // work to show the boot screen for. Until this resolves we render nothing
      // and the native splash stays up — so a repeat launch never flashes the
      // green boot screen.
      let shouldRun = false;
      try {
        shouldRun = await shouldRunBootPreload();
      } catch {
        shouldRun = false;
      }
      let ask = false;
      try {
        ask = await shouldAskHadithPredownload();
      } catch {
        ask = false;
      }
      if (!mounted) return;

      if (!shouldRun && !ask) {
        // Repeat launch: nothing to prepare. Hand the native splash straight to
        // home — no green boot screen, no fade.
        setNeedsBoot(false);
        setBootDone(true);
        return;
      }

      // First launch (or a pending hadith prompt): reveal the boot screen, then
      // do the heavy work behind it.
      setNeedsBoot(true);

      if (shouldRun) {
        try {
          await runBootPreloadOnce((p) => {
            if (mounted) setQuranProgress(p);
          });
        } catch {
          // Non-blocking: let app continue even if a preload step fails.
        }
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

  // Animate the progress bar toward the latest fraction so it glides instead of
  // jumping between byte-progress callbacks. While the total size is still unknown
  // (fraction null) we leave the bar where it is and rely on the text readout.
  useEffect(() => {
    const fraction = quranProgress?.fraction;
    if (fraction == null) return;
    Animated.timing(barAnim, {
      toValue: fraction,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [quranProgress?.fraction, barAnim]);

  // Hide the native splash only once the first real screen (boot screen on a
  // first launch, or home on a repeat launch) has laid out — eliminating any
  // blank/green frame between the splash and the app.
  const onLayoutRootView = useCallback(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  // Still deciding (or fonts loading): keep the native splash up by rendering
  // nothing.
  if (!fontsLoaded || needsBoot === null) {
    return null;
  }

  if (needsBoot && !bootDone) {
    return (
      <>
      <Animated.View
        style={[styles.bootScreen, { opacity: fadeAnim }]}
        onLayout={onLayoutRootView}
      >
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
          <View style={styles.progressBlock}>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: barAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <View style={styles.progressMetaRow}>
              <Text style={styles.progressPercent}>
                {quranProgress?.fraction != null
                  ? `${Math.round(quranProgress.fraction * 100)}%`
                  : 'Connecting…'}
              </Text>
              <Text style={styles.progressMeta}>
                {formatProgressMeta(quranProgress)}
              </Text>
            </View>
            <Text style={styles.progressHint}>
              {formatSpeed(quranProgress?.bytesPerSecond)}
            </Text>
          </View>
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
    <View style={styles.flex} onLayout={onLayoutRootView}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  progressBlock: {
    width: '78%',
    maxWidth: 320,
    marginTop: 22,
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.gold,
  },
  progressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  progressPercent: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  progressMeta: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  progressHint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 0.2,
  },
});

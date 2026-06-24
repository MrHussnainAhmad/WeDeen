import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Asset } from 'expo-asset';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { getColors, colors } from '@/theme/colors';
import { useNightBrightness } from '@/hooks/useNightBrightness';
import { isQuranFocusActive } from '@/services/focusModeService';
import { EightPointStar, GeometricDivider } from '@/components/IslamicMotifs';
import { HadithPredownloadPrompt } from '@/components/HadithPredownloadPrompt';
import {
  markHadithPredownloadAsked,
  runBootPreloadOnce,
  shouldAskHadithPredownload,
  shouldRunBootPreload,
  continueBootPreloadInBackground,
} from '@/services/bootPreloadService';
import { cacheAllBooksInBackground } from '@/services/hadithService';
import type { QuranDownloadProgress } from '@/services/quranService';
import { warmQuranCacheInBackground } from '@/services/quranService';
import {
  dismissStaleAdhanAlerts,
  handleAdhanAction,
  isAdhanNotificationStale,
  schedulePrayerAdhan,
  shouldProcessAdhanAlert,
} from '@/services/prayerNotificationService';
import { ringAdhan } from '@/services/adhanController';
import { maybeRefreshLocation } from '@/services/locationService';
import { ensureBackgroundLocationRegistered } from '@/services/backgroundLocation';
import { AdhanAlarmModal } from '@/components/AdhanAlarmModal';
import { AchievementUnlockModal } from '@/components/achievements/AchievementUnlockModal';
import { AppLogo } from '@/components/AppLogo';
import { subscribePrayerFocus, refreshPrayerFocusNow } from '@/services/prayerFocusCoordinator';
import { syncMemorizationQueueThrottled } from '@/services/memorizationService';
import { useAchievementStore, AchievementManager } from '@/store/achievementStore';
import { ACHIEVEMENT_IMAGES } from '@/utils/achievementImages';
import * as FileSystem from 'expo-file-system/legacy';
import { markPrayerAsPrayed } from '@/services/prayerTrackerService';
import { scheduleUpcomingIslamicEventReminders } from '@/services/hijriCalendarService';

function openPrayerLockTab() {
  router.push('/prayer-lock' as any);
}

const SAVED_LOCATION_KEY = 'timings_location_v1';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

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
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const colorScheme = useThemeStore((s) => s.colorScheme);
  const themeColors = useMemo(() => getColors(colorScheme), [colorScheme]);
  useNightBrightness();
  const [bootDone, setBootDone] = useState(false);
  // null = still deciding; true = first launch (show boot screen); false = repeat
  // launch (skip boot screen entirely).
  const [needsBoot, setNeedsBoot] = useState<boolean | null>(null);
  /** Resolved in parallel with font loading so splash isn't blocked sequentially. */
  const [bootFlags, setBootFlags] = useState<{ shouldRun: boolean; ask: boolean; needsOnboarding: boolean } | null>(null);
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
    Lora: require('@/assets/fonts/Lora-Regular.ttf'),
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });

  useEffect(() => {
    hydrate();
    hydrateTheme().catch(() => undefined);
  }, [hydrate, hydrateTheme]);

  // Decide boot work up front — in parallel with font loading — so repeat launches
  // don't wait: fonts → then AsyncStorage → then home.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [shouldRun, ask, onboardingRaw] = await Promise.all([
        shouldRunBootPreload().catch(() => false),
        shouldAskHadithPredownload().catch(() => false),
        AsyncStorage.getItem('wedeen_has_seen_onboarding_v1').catch(() => null),
        Asset.loadAsync(Object.values(ACHIEVEMENT_IMAGES)).catch(() => undefined),
      ]);
      if (mounted) setBootFlags({ shouldRun, ask, needsOnboarding: onboardingRaw !== 'true' });
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Prayer-focus coordinator runs in the background; do not auto-open the tab.
  useEffect(() => {
    return subscribePrayerFocus(() => undefined);
  }, []);

  // Sync widget offline actions
  useEffect(() => {
    const checkWidgetActions = async () => {
      try {
        const path = `${FileSystem.documentDirectory}pending_widget_actions.json`;
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
          const content = await FileSystem.readAsStringAsync(path);
          const actions = JSON.parse(content);
          if (Array.isArray(actions) && actions.length > 0) {
            for (const action of actions) {
              if (action.prayer && action.date) {
                await markPrayerAsPrayed(
                  action.prayer as any,
                  action.date,
                  useAuthStore.getState().token,
                  useAuthStore.getState().user?.id
                );
                AchievementManager.trackEvent('dev_widget', 1).catch(() => undefined);
              }
            }
          }
          await FileSystem.deleteAsync(path, { idempotent: true });
        }
      } catch (err) {
        // silently fail
      }
    };

    checkWidgetActions();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkWidgetActions();
    });
    return () => sub.remove();
  }, []);

  // Sync offline memorization marks when the app returns to the foreground (throttled).
  useEffect(() => {
    if (!token || !userId) return;
    syncMemorizationQueueThrottled(token, userId, { force: true }).catch(() => undefined);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncMemorizationQueueThrottled(token, userId).catch(() => undefined);
    });
    return () => sub.remove();
  }, [token, userId]);
  
  const achievementsHydrated = useAchievementStore((s) => s.hydrated);
  const achievementsList = useAchievementStore((s) => s.achievements);

  // Hydrate and sync achievements
  useEffect(() => {
    const store = useAchievementStore.getState();
    store.hydrateAchievements(userId || null).catch(() => undefined);
    if (token && userId) {
      store.syncWithBackend(token, userId).catch(() => undefined);
    }
  }, [userId, token]);

  // Trigger "Welcome" achievement after 5 minutes of active session
  useEffect(() => {
    if (!achievementsHydrated) return;

    // Check if the "Welcome" achievement (dev_1) is already unlocked
    const welcomeUnlocked = achievementsList.find((a) => a.id === 'dev_1')?.isUnlocked;
    if (welcomeUnlocked) return;

    // 5 minutes delay (300,000 ms)
    const timer = setTimeout(() => {
      AchievementManager.trackEvent('dev_open', 1).catch(() => undefined);
    }, 300000);

    return () => clearTimeout(timer);
  }, [achievementsHydrated, achievementsList]);

  // Finish Quran download quietly if a prior launch sent the user home early.
  useEffect(() => {
    if (!bootDone) return;
    warmQuranCacheInBackground().catch(() => undefined);
    continueBootPreloadInBackground().catch(() => undefined);
    
    // Redirect to Onboarding if needed
    if (bootFlags?.needsOnboarding && !showHadithPrompt) {
      setBootFlags((prev) => prev ? { ...prev, needsOnboarding: false } : null);
      setTimeout(() => router.replace('/onboarding' as any), 50);
    }
  }, [bootDone, bootFlags?.needsOnboarding, showHadithPrompt]);

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
        await dismissStaleAdhanAlerts();
        await scheduleUpcomingIslamicEventReminders();
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

      // Purge backlog before handlers run so opening the app after days away
      // doesn't replay every missed adhan at once.
      await dismissStaleAdhanAlerts();
      await scheduleAdhans();

      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          if (isQuranFocusActive()) {
            return {
              shouldShowBanner: false,
              shouldShowList: false,
              shouldPlaySound: false,
              shouldSetBadge: false,
            };
          }
          const data = notification.request.content.data as Record<string, unknown>;
          const isAdhan = data?.type === 'adhan';
          if (isAdhan) {
            const ok = await shouldProcessAdhanAlert(data, notification.date);
            if (!ok) {
              await Notifications.dismissNotificationAsync(notification.request.identifier).catch(
                () => undefined
              );
              return {
                shouldShowBanner: false,
                shouldShowList: false,
                shouldPlaySound: false,
                shouldSetBadge: false,
              };
            }
            ringAdhan(String(data?.prayer ?? 'Prayer')).catch(() => undefined);
            refreshPrayerFocusNow(false)
              .then((focus) => {
                if (focus?.isLockActive) openPrayerLockTab();
              })
              .catch(() => undefined);
            return {
              shouldShowBanner: false,
              shouldShowList: false,
              shouldPlaySound: false,
              shouldSetBadge: false,
            };
          }
          return {
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          };
        },
      });

      Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data as Record<string, unknown>;
        if (data?.type !== 'adhan') return;
        if (!isAdhanNotificationStale(data, Date.now(), notification.date)) return;
        Notifications.dismissNotificationAsync(notification.request.identifier).catch(
          () => undefined
        );
      });

      responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, unknown>;
        if (data?.type === 'adhan') {
          handleAdhanAction(
            response.actionIdentifier,
            String(data?.prayer ?? 'Prayer'),
            data
          ).catch(() => undefined);
        }
      });

      const last = await Notifications.getLastNotificationResponseAsync();
      const lastData = last?.notification.request.content.data as Record<string, unknown> | undefined;
      if (last && lastData?.type === 'adhan') {
        handleAdhanAction(
          last.actionIdentifier,
          String(lastData?.prayer ?? 'Prayer'),
          lastData
        ).catch(() => undefined);
      }
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
    if (!fontsLoaded || bootFlags === null) return;
    if (!bootFlags.shouldRun) return;

    let mounted = true;
    const { ask } = bootFlags;

    const run = async () => {
      try {
        const result = await runBootPreloadOnce((p) => {
          if (mounted) setQuranProgress(p);
        });
        if (!mounted) return;

        if (result === 'continued_in_background') {
          if (ask) {
            setShowHadithPrompt(true);
            setNeedsBoot(false);
            setBootDone(true);
            return;
          }
          fadeToHome();
          return;
        }
      } catch {
        // Non-blocking: let app continue even if a preload step fails.
      }

      if (!mounted) return;
      if (ask) {
        setShowHadithPrompt(true);
        return;
      }
      fadeToHome();
    };
    run();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsLoaded, bootFlags]);

  // Decide home vs boot screen synchronously before paint — avoids a one-frame
  // flash and keeps needsBoot accurate for the render gate.
  useLayoutEffect(() => {
    if (!fontsLoaded || bootFlags === null) return;
    const { shouldRun, ask } = bootFlags;

    if (!shouldRun) {
      setNeedsBoot(false);
      setBootDone(true);
      if (ask) setShowHadithPrompt(true);
      return;
    }

    setNeedsBoot(true);
  }, [fontsLoaded, bootFlags]);

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
  // nothing. Boot flags resolve in parallel with fonts so we don't wait twice.
  if (!fontsLoaded || bootFlags === null || needsBoot === null) {
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
          <EightPointStar size={26} color={themeColors.goldBorder} filled={false} />
        </View>
        <AppLogo height={140} />
        <Text style={styles.bootBismillah}>{'بِسْمِ اللَّهِ'}</Text>
        <GeometricDivider color={themeColors.gold} style={{ marginVertical: 14 }} />
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
    <View style={[styles.flex, { backgroundColor: themeColors.bg }]} onLayout={onLayoutRootView}>
    <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: themeColors.primaryDeep },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontFamily: 'NotoSerif', fontWeight: '700', fontSize: 18 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: themeColors.bg },
          animation: 'slide_from_right',
          animationDuration: 320,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          animationMatchesGesture: true,
          fullScreenGestureEnabled: true,
          freezeOnBlur: true,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="hub" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="quran/index" options={{ headerShown: false, title: 'Quran Surahs' }} />
        <Stack.Screen name="quran/[surah]" options={{ headerShown: false, animation: 'slide_from_right', animationDuration: 320 }} />
        <Stack.Screen name="hadith/index" options={{ headerShown: false, title: 'Hadith Books' }} />
        <Stack.Screen name="hadith/[book]/index" options={{ title: 'Hadith' }} />
        <Stack.Screen name="hadith/[book]/[section]" options={{ title: 'Hadith' }} />
        <Stack.Screen name="qibla" options={{ title: 'Qibla Compass' }} />
        <Stack.Screen name="names/[type]" options={{ title: '99 Names' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="reset-password" options={{ title: 'Reset Password' }} />
        <Stack.Screen name="salah-focus" options={{ title: 'Prayer Lock Setup' }} />
        <Stack.Screen name="blocked" options={{ headerShown: false, animation: 'fade', animationDuration: 200 }} />
        <Stack.Screen name="tasbih" options={{ headerShown: false, title: 'Tasbih Counter' }} />
        <Stack.Screen name="zakat" options={{ headerShown: false, title: 'Zakat Calculator' }} />
        <Stack.Screen name="places" options={{ headerShown: false, title: 'Halal & Mosque Finder' }} />
        <Stack.Screen name="ramadan" options={{ headerShown: false, title: 'Ramadan & Fasting' }} />
        <Stack.Screen name="duas" options={{ headerShown: false, title: 'Duas & Azkar' }} />
        <Stack.Screen name="prayer-tracker" options={{ title: 'My Prayers' }} />
        <Stack.Screen name="achievements" options={{ headerShown: false, title: 'Achievements' }} />
        <Stack.Screen name="favorite-ayahs" options={{ headerShown: false, title: 'Favorite Ayahs' }} />
        <Stack.Screen name="insights" options={{ headerShown: false, title: 'Worship Insights' }} />
        <Stack.Screen name="reflections" options={{ headerShown: false, title: 'Daily Reflections' }} />
        <Stack.Screen name="guide" options={{ headerShown: false }} />
        <Stack.Screen name="guide/[id]" options={{ headerShown: false }} />
      </Stack>
      <AdhanAlarmModal />
      <AchievementUnlockModal />
    </QueryClientProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
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

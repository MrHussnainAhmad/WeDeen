import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import {
  EightPointStar,
  GeometricDivider,
  StarFieldWatermark,
} from '@/components/IslamicMotifs';
import { TabFadeInView, PressableScale, useBreathing } from '@/components/Anim';
import { TabSceneGuard } from '@/components/navigation/TabSceneGuard';
import { OrnateCard } from '@/components/ui';
import {
  getSalahFocusConfig,
  getSalahFocusExpoGoMessage,
  getSalahFocusLocationRequiredMessage,
  isSalahFocusSupported,
  markSalahFocusPrayerComplete,
  stopTestPrayerLock,
  type SalahFocusRuntimeState,
} from '@/services/salahFocusService';
import { refreshPrayerFocusNow } from '@/services/prayerFocusCoordinator';
import { usePrayerFocus } from '@/hooks/usePrayerFocus';
import { getSavedLocation, hasPrayerLocationConfigured } from '@/services/locationService';
import {
  getPrayerWindowsForDay,
  type PrayerLabel,
  type PrayerWindow,
} from '@/services/prayerTimingUtils';
import { pickRandomPrayerLockDialogue } from '@/services/prayerLockDialogues';
import { useResponsive } from '@/theme/responsive';

function formatCountdown(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PrayerLockScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top + 12, 22);
  const responsive = useResponsive();
  const glow = useBreathing(0.35, 1, 1400);

  const focusState = usePrayerFocus();
  const [state, setState] = useState<SalahFocusRuntimeState | null>(focusState);
  const [nextPrayer, setNextPrayer] = useState<PrayerWindow | null>(null);
  const [blockedCount, setBlockedCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [lockDialogue, setLockDialogue] = useState(() => pickRandomPrayerLockDialogue());
  const [hasLocation, setHasLocation] = useState(true);

  useEffect(() => {
    if (focusState) setState(focusState);
  }, [focusState]);

  const loadNextPrayer = useCallback(async () => {
    const [config, location, locationReady] = await Promise.all([
      getSalahFocusConfig(),
      getSavedLocation(),
      hasPrayerLocationConfigured(),
    ]);
    setBlockedCount(config.androidBlockedPackages.length);
    setHasLocation(locationReady);

    if (location) {
      const windows = await getPrayerWindowsForDay(
        location,
        new Date(),
        config.windowMinutes
      );
      const now = Date.now();
      const upcoming = windows.find((w) => w.start.getTime() > now) ?? null;
      setNextPrayer(upcoming);
    } else {
      setNextPrayer(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNextPrayer();
      refreshPrayerFocusNow(false).catch(() => undefined);
      if (state?.isLockActive) {
        setLockDialogue(pickRandomPrayerLockDialogue());
      }
    }, [loadNextPrayer, state?.isLockActive])
  );

  useEffect(() => {
    if (!state?.isLockActive) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state?.isLockActive]);

  const supported = isSalahFocusSupported();
  const isTestLock = !!state?.isTestLock;
  const isLocked = !!state?.isLockActive && (!!state.activePrayer || isTestLock);
  const needsSetup = !state?.setupComplete || !state?.enabled;

  const countdown = useMemo(() => {
    if (!state?.windowEndsAt || !isLocked) return null;
    const remaining = state.windowEndsAt - nowTick;
    if (remaining <= 0) return '0:00';
    return formatCountdown(remaining);
  }, [state?.windowEndsAt, isLocked, nowTick]);

  useEffect(() => {
    if (focusState?.activePrayer) loadNextPrayer();
  }, [focusState?.activePrayer, loadNextPrayer]);

  const onPrayed = async () => {
    if (submitting) return;
    if (!state?.isTestLock && !state?.activePrayer) return;
    setSubmitting(true);
    try {
      if (state.isTestLock) {
        const next = await stopTestPrayerLock();
        setState(next);
      } else {
        const next = await markSalahFocusPrayerComplete(state.activePrayer as PrayerLabel);
        setState(next);
      }
      await refreshPrayerFocusNow(false);
      await loadNextPrayer();
    } finally {
      setSubmitting(false);
    }
  };

  if (!supported) {
    return (
      <TabSceneGuard>
      <View style={[styles.screen, styles.centered, { paddingTop: topPad }]}>
        <Ionicons name="lock-closed-outline" size={44} color={colors.primary} />
        <Text style={styles.heroTitle}>Prayer Lock</Text>
        <Text style={styles.mutedCenter}>{getSalahFocusExpoGoMessage()}</Text>
      </View>
      </TabSceneGuard>
    );
  }

  return (
    <TabSceneGuard>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: insets.bottom + 110 }, responsive.centerContent]}
      showsVerticalScrollIndicator={false}
    >
      <TabFadeInView>
        <View style={styles.header}>
          <StarFieldWatermark rows={2} cols={5} starSize={18} color="rgba(15,61,46,0.04)" />
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons
              name={isLocked ? 'lock' : 'lock-open-variant-outline'}
              size={26}
              color={isLocked ? colors.gold : colors.primary}
            />
          </View>
          <Text style={styles.headerTitle}>Prayer Lock</Text>
          <Text style={styles.headerSub}>
            {isLocked
              ? 'Distracting apps are paused — focus on your salah.'
              : 'Stay present when the adhan calls.'}
          </Text>
        </View>
      </TabFadeInView>

      {!hasLocation ? (
        <TabFadeInView>
          <OrnateCard index={0}>
            <View style={styles.locationWarn}>
              <Ionicons name="location-outline" size={22} color={colors.primary} />
              <Text style={styles.locationWarnText}>{getSalahFocusLocationRequiredMessage()}</Text>
              <PressableScale
                onPress={() => router.push('/hijri' as any)}
                style={styles.locationWarnBtn}
              >
                <Text style={styles.locationWarnBtnText}>Set location on Timings</Text>
              </PressableScale>
            </View>
          </OrnateCard>
        </TabFadeInView>
      ) : null}

      <TabFadeInView>
        <View style={[styles.heroCard, isLocked ? styles.heroCardLocked : styles.heroCardIdle]}>
          {isLocked ? (
            <>
              <Animated.View style={[styles.lockRing, { opacity: glow }]}>
                <EightPointStar size={54} color={colors.gold} filled={false} />
              </Animated.View>
              <Text style={styles.lockPrayerLabel}>
                {isTestLock ? 'Test Prayer Lock' : `${state?.activePrayer} prayer`}
              </Text>
              <GeometricDivider color="rgba(197,155,39,0.45)" style={{ marginVertical: 14, width: '70%' }} />
              <Text style={styles.lockHint}>{lockDialogue}</Text>
              {countdown ? (
                <View style={styles.countdownPill}>
                  <Ionicons name="hourglass-outline" size={14} color={colors.gold} />
                  <Text style={styles.countdownText}>
                    {isTestLock
                      ? `Test ends in ${countdown}`
                      : nowTick < (state?.windowEndsAt ?? 0)
                        ? `Window ends in ${countdown}`
                        : 'Confirm salah to unlock your apps'}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.idleArabic}>الصَّلَاةُ خَيْرٌ مِنَ الدُّنْيَا وَمَا فِيهَا</Text>
              <Text style={styles.idleHeadline}>Salah is better than Duniya!</Text>
              <GeometricDivider color={colors.goldBorder} style={{ marginVertical: 16, width: '76%' }} />
              <Text style={styles.idleBody}>
                No apps are locked right now. When prayer time arrives, distractions pause so you
                can worship with a clear heart.
              </Text>
              {nextPrayer ? (
                <View style={styles.nextPill}>
                  <Ionicons name="time-outline" size={15} color={colors.primary} />
                  <Text style={styles.nextText}>
                    Next: {nextPrayer.label} at{' '}
                    {nextPrayer.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      </TabFadeInView>

      {isLocked ? (
        <TabFadeInView>
          <PressableScale
            onPress={onPrayed}
            disabled={submitting}
            style={[styles.prayedButton, submitting && styles.disabled]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.primaryDeep} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color={colors.primaryDeep} />
                <Text style={styles.prayedButtonText}>I have prayed</Text>
              </>
            )}
          </PressableScale>
          <Text style={styles.prayedFootnote}>
            Apps unlock automatically when the prayer window ends, or tap above when you have prayed.
          </Text>
        </TabFadeInView>
      ) : null}

      <TabFadeInView>
        <OrnateCard index={0}>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{blockedCount}</Text>
              <Text style={styles.statLabel}>Apps paused</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{state?.completedToday?.length ?? 0}</Text>
              <Text style={styles.statLabel}>Prayed today</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{state?.enabled ? 'On' : 'Off'}</Text>
              <Text style={styles.statLabel}>Lock status</Text>
            </View>
          </View>

          {needsSetup ? (
            <PressableScale
              onPress={() => router.push('/salah-focus' as any)}
              style={styles.setupBtn}
            >
              <Ionicons name="settings-outline" size={16} color={colors.primary} />
              <Text style={styles.setupBtnText}>
                {state?.enabled ? 'Manage blocked apps' : 'Set up Prayer Lock'}
              </Text>
            </PressableScale>
          ) : (
            <PressableScale
              onPress={() => router.push('/salah-focus' as any)}
              style={styles.setupBtnGhost}
            >
              <Text style={styles.setupBtnGhostText}>Manage apps & permissions</Text>
            </PressableScale>
          )}
        </OrnateCard>
      </TabFadeInView>
    </ScrollView>
    </TabSceneGuard>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, gap: 16 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    alignItems: 'center',
    paddingVertical: 8,
    overflow: 'hidden',
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryTint,
  },
  headerTitle: {
    marginTop: 12,
    fontFamily: fonts.serif,
    fontSize: 26,
    fontWeight: '800',
    color: colors.primaryDeep,
  },
  headerSub: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  heroCard: {
    borderRadius: radius.xl,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    borderWidth: 1,
    ...shadow.soft,
  },
  heroCardIdle: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.goldBorder,
  },
  heroCardLocked: {
    backgroundColor: colors.primaryDeep,
    borderColor: 'rgba(197,155,39,0.35)',
  },
  idleArabic: {
    fontFamily: fonts.arabic,
    fontSize: 22,
    lineHeight: 38,
    color: colors.primaryDark,
    textAlign: 'center',
  },
  idleHeadline: {
    marginTop: 8,
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '800',
    color: colors.primaryDeep,
    textAlign: 'center',
  },
  idleBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  nextPill: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.primaryTint,
  },
  nextText: { color: colors.primary, fontWeight: '700', fontSize: 12.5 },
  lockRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: 'rgba(197,155,39,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  lockPrayerLabel: {
    marginTop: 16,
    color: colors.gold,
    fontFamily: fonts.serif,
    fontSize: 28,
    fontWeight: '800',
  },
  lockHint: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  countdownPill: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  countdownText: {
    color: colors.gold,
    fontWeight: '700',
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
  },
  prayedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.goldSoft,
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 16,
    ...shadow.soft,
  },
  prayedButtonText: {
    color: colors.primaryDeep,
    fontWeight: '900',
    fontSize: 17,
    letterSpacing: 0.2,
  },
  prayedFootnote: {
    marginTop: 10,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
  },
  disabled: { opacity: 0.7 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: {
    color: colors.primaryDeep,
    fontWeight: '900',
    fontSize: 20,
  },
  statLabel: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.borderSoft,
  },
  setupBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    paddingVertical: 12,
  },
  setupBtnText: { color: colors.primary, fontWeight: '800', fontSize: 13.5 },
  locationWarn: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  locationWarnText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  locationWarnBtn: {
    marginTop: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  locationWarnBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  setupBtnGhost: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 8,
  },
  setupBtnGhostText: { color: colors.muted, fontWeight: '700', fontSize: 12.5 },
  heroTitle: {
    marginTop: 14,
    fontFamily: fonts.serif,
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDeep,
  },
  mutedCenter: {
    marginTop: 10,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    paddingHorizontal: 20,
  },
});

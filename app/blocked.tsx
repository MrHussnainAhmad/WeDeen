import { useEffect } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { colors } from '@/theme/colors';
import { PrayerLockBlockScreen } from '@/components/PrayerLockBlockScreen';
import { isEmergencyUnlockExcluded } from '@/constants/salahFocusEmergency';
import {
  emergencyUnlockSalahFocus,
  evaluateSalahFocus,
  markSalahFocusPrayerComplete,
} from '@/services/salahFocusService';
import { refreshPrayerFocusNow } from '@/services/prayerFocusCoordinator';
import {
  formatPrayerLockDialogue,
  pickRandomPrayerLockDialogueTemplate,
  resolveBlockedAppDisplayName,
} from '@/services/prayerLockDialogues';
import {
  configureSalahFocusOverlay,
  launchAndroidPackage,
  relockSalahFocusApps,
} from '@/services/salahFocusNative';
import type { PrayerLabel } from '@/services/prayerTimingUtils';

/** Deep link: wedeen://blocked?app=Instagram&package=... — random roast + unlock flow. */
export default function BlockedDeepLinkScreen() {
  const params = useLocalSearchParams<{ app?: string; package?: string }>();
  const appFromLink = typeof params.app === 'string' ? params.app : undefined;
  const packageFromLink = typeof params.package === 'string' ? params.package : undefined;

  const [blockedAppName, setBlockedAppName] = useState<string | undefined>(appFromLink);
  const [dialogue, setDialogue] = useState('');
  const [activePrayer, setActivePrayer] = useState<PrayerLabel | null>(null);
  const [lockActive, setLockActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [emergencySubmitting, setEmergencySubmitting] = useState(false);

  const emergencyAllowed = useMemo(
    () => !isEmergencyUnlockExcluded(packageFromLink, blockedAppName),
    [packageFromLink, blockedAppName]
  );

  const refreshLockState = useCallback(async () => {
    await relockSalahFocusApps().catch(() => undefined);
    const state = await evaluateSalahFocus();
    setActivePrayer(state.activePrayer);
    setLockActive(state.isLockActive);
    return state;
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const resolvedName = await resolveBlockedAppDisplayName(appFromLink, packageFromLink);
      if (!mounted) return;

      setBlockedAppName(resolvedName);
      const template = pickRandomPrayerLockDialogueTemplate();
      setDialogue(formatPrayerLockDialogue(template, resolvedName));
      configureSalahFocusOverlay(template);

      const state = await refreshLockState();
      if (!mounted) return;

      if (!state.isLockActive) {
        router.replace('/(tabs)/prayer-lock' as any);
        return;
      }

      setLoading(false);
    })().catch(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [appFromLink, packageFromLink, refreshLockState]);

  useEffect(() => {
    if (!lockActive) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [lockActive]);

  const onPrayed = useCallback(async () => {
    if (!activePrayer || submitting || !lockActive) return;
    setSubmitting(true);
    try {
      const next = await markSalahFocusPrayerComplete(activePrayer);
      if (!next.isLockActive) {
        await refreshPrayerFocusNow(false);
        router.replace('/(tabs)/prayer-lock' as any);
      }
    } finally {
      setSubmitting(false);
    }
  }, [activePrayer, submitting, lockActive]);

  const onEmergencyUnlock = useCallback(async () => {
    if (!packageFromLink || !emergencyAllowed || emergencySubmitting || submitting || !lockActive) {
      return;
    }

    setEmergencySubmitting(true);
    try {
      const result = await emergencyUnlockSalahFocus(packageFromLink, blockedAppName);
      if (!result.ok) return;

      await refreshPrayerFocusNow(false);
      launchAndroidPackage(packageFromLink);
      router.back();
    } finally {
      setEmergencySubmitting(false);
    }
  }, [
    packageFromLink,
    blockedAppName,
    emergencyAllowed,
    emergencySubmitting,
    submitting,
    lockActive,
  ]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryDeep }}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (!lockActive) {
    return null;
  }

  return (
    <PrayerLockBlockScreen
      dialogue={dialogue}
      activePrayer={activePrayer}
      blockedAppName={blockedAppName}
      emergencyAllowed={emergencyAllowed}
      submitting={submitting}
      emergencySubmitting={emergencySubmitting}
      onPrayed={onPrayed}
      onEmergencyUnlock={packageFromLink ? onEmergencyUnlock : undefined}
    />
  );
}

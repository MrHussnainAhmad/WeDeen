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
  stopTestPrayerLock,
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
} from '@/services/salahFocusNative';
import type { PrayerLabel } from '@/services/prayerTimingUtils';

/** Deep link from native overlay buttons: wedeen://blocked?action=prayed|emergency */
export default function BlockedDeepLinkScreen() {
  const params = useLocalSearchParams<{
    app?: string;
    package?: string;
    action?: string;
  }>();
  const appFromLink = typeof params.app === 'string' ? params.app : undefined;
  const packageFromLink = typeof params.package === 'string' ? params.package : undefined;
  const actionFromLink = typeof params.action === 'string' ? params.action : undefined;

  const [blockedAppName, setBlockedAppName] = useState<string | undefined>(appFromLink);
  const [dialogue, setDialogue] = useState('');
  const [activePrayer, setActivePrayer] = useState<PrayerLabel | null>(null);
  const [lockActive, setLockActive] = useState(false);
  const [loading, setLoading] = useState(!actionFromLink);
  const [submitting, setSubmitting] = useState(false);
  const [emergencySubmitting, setEmergencySubmitting] = useState(false);

  const emergencyAllowed = useMemo(
    () => !isEmergencyUnlockExcluded(packageFromLink, blockedAppName),
    [packageFromLink, blockedAppName]
  );

  const finishAndLeave = useCallback(() => {
    if (packageFromLink && actionFromLink === 'emergency') {
      launchAndroidPackage(packageFromLink);
    }
    BackHandler.exitApp();
  }, [packageFromLink, actionFromLink]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const resolvedName = await resolveBlockedAppDisplayName(appFromLink, packageFromLink);
      if (!mounted) return;

      setBlockedAppName(resolvedName);
      const template = pickRandomPrayerLockDialogueTemplate();
      setDialogue(formatPrayerLockDialogue(template, resolvedName));
      configureSalahFocusOverlay(template);

      const state = await evaluateSalahFocus();
      if (!mounted) return;

      setActivePrayer(state.activePrayer);
      setLockActive(state.isLockActive || state.isTestLock);

      if (actionFromLink === 'prayed') {
        setSubmitting(true);
        try {
          if (state.activePrayer) {
            await markSalahFocusPrayerComplete(state.activePrayer);
          } else if (state.isTestLock) {
            await stopTestPrayerLock();
          }
          await refreshPrayerFocusNow(false);
        } finally {
          if (mounted) finishAndLeave();
        }
        return;
      }

      if (actionFromLink === 'emergency' && packageFromLink) {
        setEmergencySubmitting(true);
        try {
          const result = await emergencyUnlockSalahFocus(packageFromLink, resolvedName);
          if (result.ok) {
            await refreshPrayerFocusNow(false);
            if (mounted) finishAndLeave();
            return;
          }
        } finally {
          if (mounted) setEmergencySubmitting(false);
        }
      }

      if (!state.isLockActive && !state.isTestLock) {
        router.replace('/prayer-lock' as any);
        return;
      }

      setLoading(false);
    })().catch(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [appFromLink, packageFromLink, actionFromLink, finishAndLeave]);

  useEffect(() => {
    if (!lockActive) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [lockActive]);

  const onPrayed = useCallback(async () => {
    if (!activePrayer || submitting || !lockActive) return;
    setSubmitting(true);
    try {
      await markSalahFocusPrayerComplete(activePrayer);
      await refreshPrayerFocusNow(false);
      finishAndLeave();
    } finally {
      setSubmitting(false);
    }
  }, [activePrayer, submitting, lockActive, finishAndLeave]);

  const onEmergencyUnlock = useCallback(async () => {
    if (!packageFromLink || !emergencyAllowed || emergencySubmitting || submitting || !lockActive) {
      return;
    }

    setEmergencySubmitting(true);
    try {
      const result = await emergencyUnlockSalahFocus(packageFromLink, blockedAppName);
      if (!result.ok) return;
      await refreshPrayerFocusNow(false);
      finishAndLeave();
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
    finishAndLeave,
  ]);

  if (loading || actionFromLink) {
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

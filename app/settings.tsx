import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useMutation } from '@tanstack/react-query';
import { useFocusEffect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { deleteAccount, updatePassword } from '@/services/authService';
import { schedulePrayerAdhan, scheduleTestAdhan } from '@/services/prayerNotificationService';
import { refreshPrayerFocusNow } from '@/services/prayerFocusCoordinator';
import {
  getSalahFocusConfig,
  getSalahFocusExpoGoMessage,
  getSalahFocusPermissionsRequiredMessage,
  getTestPrayerLockStatus,
  isSalahFocusSupported,
  startTestPrayerLock,
  stopTestPrayerLock,
} from '@/services/salahFocusService';
import { useAdhanAlarm } from '@/services/adhanController';
import { setActiveAudioVolume } from '@/services/audioManager';
import { getAlarmVolume, setAlarmVolume } from '@/services/alarmVolume';
import { disableBackgroundLocation, enableBackgroundLocation } from '@/services/backgroundLocation';
import { useAuthStore } from '@/store/authStore';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { GeometricDivider } from '@/components/IslamicMotifs';
import { FadeInView, PressableScale } from '@/components/Anim';
import { OrnateCard, SectionHeader } from '@/components/ui';
import {
  getUiPreferences,
  saveUiPreferences,
  uiPreferenceDefaults,
  type UiPreferences,
} from '@/utils/preferences';

const MIN_AYAH_FONT = 18;
const MAX_AYAH_FONT = 42;

const APP_VERSION =
  Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';
const ANDROID_PACKAGE =
  (Constants.expoConfig as any)?.android?.package ?? 'com.hussnainahmadsahi.wedeen';
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
const PLAY_STORE_MARKET = `market://details?id=${ANDROID_PACKAGE}`;

async function openStoreListing() {
  // Prefer the native Play Store app, fall back to the web listing.
  try {
    const canOpenMarket = await Linking.canOpenURL(PLAY_STORE_MARKET);
    await Linking.openURL(canOpenMarket ? PLAY_STORE_MARKET : PLAY_STORE_URL);
  } catch {
    Linking.openURL(PLAY_STORE_URL).catch(() => undefined);
  }
}
const BISMILLAH = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

export default function SettingsScreen() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  const [arabicAyahFontSize, setArabicAyahFontSize] = useState(
    uiPreferenceDefaults.arabicAyahFontSize
  );
  const [use24HourTime, setUse24HourTime] = useState(
    uiPreferenceDefaults.use24HourTime
  );
  const [adhanAlertsEnabled, setAdhanAlertsEnabled] = useState(
    uiPreferenceDefaults.adhanAlertsEnabled
  );
  const [adhanVolume, setAdhanVolume] = useState(uiPreferenceDefaults.adhanVolume);
  const [backgroundLocationEnabled, setBackgroundLocationEnabled] = useState(
    uiPreferenceDefaults.backgroundLocationEnabled
  );
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [testLockSecondsLeft, setTestLockSecondsLeft] = useState(0);
  const [blockedAppCount, setBlockedAppCount] = useState(0);
  const prayerLockSupported = isSalahFocusSupported();

  const refreshPrayerLockTest = useCallback(async () => {
    const [test, config] = await Promise.all([
      getTestPrayerLockStatus(),
      getSalahFocusConfig(),
    ]);
    setTestLockSecondsLeft(test.secondsLeft);
    setBlockedAppCount(config.androidBlockedPackages.length);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshPrayerLockTest().catch(() => undefined);
    }, [refreshPrayerLockTest])
  );

  useEffect(() => {
    if (testLockSecondsLeft <= 0) return;
    const id = setInterval(() => {
      getTestPrayerLockStatus()
        .then((test) => {
          setTestLockSecondsLeft(test.secondsLeft);
          if (!test.active) {
            refreshPrayerFocusNow(false).catch(() => undefined);
          }
        })
        .catch(() => undefined);
    }, 1000);
    return () => clearInterval(id);
  }, [testLockSecondsLeft > 0]);

  const formatTestLockCountdown = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const runTestPrayerLock = async () => {
    if (testLockSecondsLeft > 0) return;
    const result = await startTestPrayerLock(5);
    if (!result.ok) {
      if (result.reason === 'unsupported') {
        Alert.alert('Not available', getSalahFocusExpoGoMessage());
        return;
      }
      if (result.reason === 'no_apps') {
        Alert.alert(
          'Choose apps first',
          'Set up Prayer Lock and select at least one app to pause.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open setup', onPress: () => router.push('/salah-focus' as any) },
          ]
        );
        return;
      }
      Alert.alert('Permissions needed', getSalahFocusPermissionsRequiredMessage(), [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open setup', onPress: () => router.push('/salah-focus' as any) },
      ]);
      return;
    }
    await refreshPrayerFocusNow(false);
    await refreshPrayerLockTest();
    Alert.alert(
      'Test Prayer Lock started',
      'Your selected apps are paused for 5 minutes. Open one to see the block screen, or end the test anytime below.'
    );
  };

  const endTestPrayerLock = async () => {
    await stopTestPrayerLock();
    await refreshPrayerFocusNow(false);
    await refreshPrayerLockTest();
  };

  // The pending test-adhan countdown is held in the global store, so it keeps
  // counting (and the adhan still fires) even after leaving this screen.
  const pendingFireAt = useAdhanAlarm((s) => s.pendingFireAt);
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    if (!pendingFireAt) return;
    const id = setInterval(() => setNowTs(Date.now()), 500);
    return () => clearInterval(id);
  }, [pendingFireAt]);
  const testSecondsLeft = pendingFireAt ? Math.max(0, Math.ceil((pendingFireAt - nowTs) / 1000)) : 0;

  const runTestAdhan = () => {
    if (testSecondsLeft > 0) return;
    scheduleTestAdhan(60_000).catch(() => undefined);
    Alert.alert(
      'Test adhan scheduled',
      Constants.appOwnership === 'expo'
        ? 'The adhan will play in about 1 minute. Keep the app open — Expo Go can’t play it once the app is closed.'
        : 'A test adhan alert will fire in about 1 minute. You can background the app to test it.'
    );
  };

  // Persist immediately on release so the next adhan/test uses the new volume
  // without needing the Save button.
  const persistVolume = (v: number) => {
    setAdhanVolume(v);
    setAlarmVolume(v); // device alarm-stream volume (real build only)
    persistPrefs({ adhanVolume: v });
  };

  // Persist the full prefs object with an override, so a single setting can be
  // saved immediately (without the Save button) using the latest state.
  const persistPrefs = (override: Partial<UiPreferences>) => {
    saveUiPreferences({
      arabicAyahFontSize,
      use24HourTime,
      adhanAlertsEnabled,
      adhanVolume,
      backgroundLocationEnabled,
      ...override,
    }).catch(() => undefined);
  };

  const onToggleBackgroundLocation = (value: boolean) => {
    if (!value) {
      setBackgroundLocationEnabled(false);
      persistPrefs({ backgroundLocationEnabled: false });
      disableBackgroundLocation().catch(() => undefined);
      return;
    }
    // Prominent disclosure before requesting background location (Play policy).
    Alert.alert(
      'Auto-update location',
      'WeDeen will check your location in the background — even when the app is closed — only to keep prayer times and the adhan accurate while you travel. Your location stays on your device and is never shared.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enable',
          onPress: async () => {
            const result = await enableBackgroundLocation();
            if (result === 'enabled') {
              setBackgroundLocationEnabled(true);
              persistPrefs({ backgroundLocationEnabled: true });
            } else {
              setBackgroundLocationEnabled(false);
              persistPrefs({ backgroundLocationEnabled: false });
              Alert.alert(
                result === 'unsupported' ? 'Not available' : 'Permission needed',
                result === 'unsupported'
                  ? 'Background updates need the installed app — they don’t work in Expo Go.'
                  : 'Please allow location access “All the time” so prayer times can update while you travel.'
              );
            }
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      getUiPreferences()
        .then((prefs) => {
          setArabicAyahFontSize(prefs.arabicAyahFontSize);
          setUse24HourTime(prefs.use24HourTime);
          setAdhanAlertsEnabled(prefs.adhanAlertsEnabled);
          setAdhanVolume(prefs.adhanVolume);
          setBackgroundLocationEnabled(prefs.backgroundLocationEnabled);
        })
        .catch(() => undefined);
      // On a real build, show the actual device alarm volume on the slider.
      getAlarmVolume()
        .then((v) => {
          if (v != null) setAdhanVolume(v);
        })
        .catch(() => undefined);
    }, [])
  );

  const savePrefsMutation = useMutation({
    mutationFn: () =>
      saveUiPreferences({
        arabicAyahFontSize,
        use24HourTime,
        adhanAlertsEnabled,
        adhanVolume,
        backgroundLocationEnabled,
      }),
    onSuccess: async () => {
      // Apply the adhan-alerts toggle: schedule (or cancel) based on the saved
      // preference + location. schedulePrayerAdhan reads the freshly-saved flag.
      try {
        const raw = await AsyncStorage.getItem('timings_location_v1');
        await schedulePrayerAdhan(raw ? JSON.parse(raw) : null);
      } catch {
        // non-fatal
      }
      Alert.alert('Saved', 'Settings updated successfully.');
    },
    onError: () => Alert.alert('Error', 'Could not save settings right now.'),
  });

  const changePasswordMutation = useMutation({
    mutationFn: () =>
      updatePassword(token as string, {
        currentPassword,
        newPassword,
        confirmPassword: confirmNewPassword,
      }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      Alert.alert('Success', 'Password updated successfully.');
    },
    onError: (error: any) => {
      Alert.alert(
        'Update Failed',
        error?.response?.data?.message || 'Could not update password'
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAccount(token as string),
    onSuccess: async () => {
      await logout();
      Alert.alert('Account Deleted', 'Your account has been deleted.');
    },
    onError: (error: any) => {
      Alert.alert(
        'Delete Failed',
        error?.response?.data?.message || 'Could not delete account'
      );
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
      >
        <OrnateCard index={0}>
          <View style={styles.cardTitleRow}>
            <SectionHeader
              title="Reading Preferences"
              icon={<MaterialCommunityIcons name="format-size" size={18} color={colors.primary} />}
              style={{ marginBottom: 0, flex: 1 }}
            />
            <PressableScale
              onPress={() => setArabicAyahFontSize(uiPreferenceDefaults.arabicAyahFontSize)}
              style={styles.resetPill}
            >
              <Text style={styles.resetPillText}>Reset</Text>
            </PressableScale>
          </View>
          <GeometricDivider color={colors.goldBorder} style={{ marginVertical: 14 }} />
          <Text style={styles.label}>Arabic Ayah Font Size</Text>
          <View style={styles.fontRow}>
            <Text style={styles.fontSizeText}>A-</Text>
            <Slider
              style={styles.slider}
              minimumValue={MIN_AYAH_FONT}
              maximumValue={MAX_AYAH_FONT}
              step={1}
              value={arabicAyahFontSize}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.primaryTint}
              thumbTintColor={colors.gold}
              onValueChange={setArabicAyahFontSize}
            />
            <Text style={styles.fontSizeTextLarge}>A+</Text>
          </View>
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>PREVIEW · {Math.round(arabicAyahFontSize)} px</Text>
            <Text style={[styles.previewArabic, { fontSize: arabicAyahFontSize, lineHeight: arabicAyahFontSize * 1.7 }]}>
              {BISMILLAH}
            </Text>
          </View>
        </OrnateCard>

        <OrnateCard index={1}>
          <SectionHeader
            title="Prayer Time Format"
            icon={<Ionicons name="time-outline" size={18} color={colors.primary} />}
          />
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {use24HourTime ? '24-hour format (default)' : '12-hour format'}
            </Text>
            <Switch
              value={use24HourTime}
              onValueChange={setUse24HourTime}
              trackColor={{ false: '#C9D7D1', true: colors.primary }}
              thumbColor={use24HourTime ? colors.gold : '#FFFFFF'}
            />
          </View>
        </OrnateCard>

        <OrnateCard index={2}>
          <SectionHeader
            title="Adhan Alerts"
            icon={<Ionicons name="notifications-outline" size={18} color={colors.primary} />}
          />
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {adhanAlertsEnabled ? 'Adhan plays at each prayer time' : 'Adhan alerts off'}
            </Text>
            <Switch
              value={adhanAlertsEnabled}
              onValueChange={setAdhanAlertsEnabled}
              trackColor={{ false: '#C9D7D1', true: colors.primary }}
              thumbColor={adhanAlertsEnabled ? colors.gold : '#FFFFFF'}
            />
          </View>

          <View style={styles.volumeHeaderRow}>
            <Text style={styles.label}>Adhan Volume</Text>
            <Text style={styles.volumePercent}>{Math.round(adhanVolume * 100)}%</Text>
          </View>
          <View style={styles.fontRow}>
            <Ionicons name="volume-low" size={18} color={colors.primary} />
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              step={0.05}
              value={adhanVolume}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.primaryTint}
              thumbTintColor={colors.gold}
              onValueChange={(v) => {
                setAdhanVolume(v);
                setActiveAudioVolume(v); // live while an adhan is ringing (in-app)
              }}
              onSlidingComplete={persistVolume}
            />
            <Ionicons name="volume-high" size={20} color={colors.primary} />
          </View>

          <Text style={styles.adhanHint}>
            A prayer-time alarm with the adhan for all 5 daily prayers, based on your location. The
            slider sets your phone’s alarm volume.
          </Text>
          <PressableScale
            onPress={runTestAdhan}
            disabled={testSecondsLeft > 0}
            style={[styles.testButton, testSecondsLeft > 0 && styles.disabledButton]}
          >
            <Ionicons name="volume-high-outline" size={16} color={colors.primary} />
            <Text style={styles.testButtonText}>
              {testSecondsLeft > 0
                ? `Adhan in 0:${String(testSecondsLeft).padStart(2, '0')}`
                : 'Test adhan in 1 min'}
            </Text>
          </PressableScale>
        </OrnateCard>

        <OrnateCard index={3}>
          <SectionHeader
            title="Prayer Lock"
            icon={<Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />}
          />
          <Text style={styles.adhanHint}>
            Pause Instagram, YouTube, WhatsApp and other distracting apps during each prayer.
            Open WeDeen and confirm your salah to unlock them again.
          </Text>

          {prayerLockSupported ? (
            <View style={styles.testLockMeta}>
              <Text style={styles.testLockMetaText}>
                {blockedAppCount > 0
                  ? `${blockedAppCount} app${blockedAppCount === 1 ? '' : 's'} configured to pause`
                  : 'No apps selected yet — set up Prayer Lock first'}
              </Text>
            </View>
          ) : null}

          <PressableScale
            onPress={() => router.push('/salah-focus' as any)}
            style={styles.testButton}
          >
            <Ionicons name="settings-outline" size={16} color={colors.primary} />
            <Text style={styles.testButtonText}>Manage Prayer Lock & apps</Text>
          </PressableScale>

          {prayerLockSupported ? (
            <>
              <PressableScale
                onPress={runTestPrayerLock}
                disabled={testLockSecondsLeft > 0 || blockedAppCount === 0}
                style={[
                  styles.testButton,
                  (testLockSecondsLeft > 0 || blockedAppCount === 0) && styles.disabledButton,
                ]}
              >
                <Ionicons name="lock-closed-outline" size={16} color={colors.primary} />
                <Text style={styles.testButtonText}>
                  {testLockSecondsLeft > 0
                    ? `Test lock active · ${formatTestLockCountdown(testLockSecondsLeft)}`
                    : 'Test Prayer Lock (5 min)'}
                </Text>
              </PressableScale>

              {testLockSecondsLeft > 0 ? (
                <PressableScale onPress={endTestPrayerLock} style={styles.endTestButton}>
                  <Ionicons name="lock-open-outline" size={16} color={colors.danger} />
                  <Text style={styles.endTestButtonText}>End test lock now</Text>
                </PressableScale>
              ) : null}
            </>
          ) : (
            <Text style={styles.adhanHint}>{getSalahFocusExpoGoMessage()}</Text>
          )}
        </OrnateCard>

        <OrnateCard index={4}>
          <SectionHeader
            title="Location Updates"
            icon={<Ionicons name="navigate-outline" size={18} color={colors.primary} />}
          />
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {backgroundLocationEnabled ? 'Auto-updates while traveling' : 'Auto-update off'}
            </Text>
            <Switch
              value={backgroundLocationEnabled}
              onValueChange={onToggleBackgroundLocation}
              trackColor={{ false: '#C9D7D1', true: colors.primary }}
              thumbColor={backgroundLocationEnabled ? colors.gold : '#FFFFFF'}
            />
          </View>
          <Text style={styles.adhanHint}>
            Keeps prayer times and the adhan correct when you travel by updating your location in the
            background. Your location stays on your device.
          </Text>
        </OrnateCard>

        <FadeInView index={5}>
          <PressableScale
            onPress={() => savePrefsMutation.mutate()}
            disabled={savePrefsMutation.isPending}
            style={[styles.saveButton, savePrefsMutation.isPending && styles.disabledButton]}
          >
            {savePrefsMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 7 }} />
                <Text style={styles.saveButtonText}>Save Settings</Text>
              </>
            )}
          </PressableScale>
        </FadeInView>

        {token ? (
          <>
            <OrnateCard index={5}>
              <SectionHeader
                title="Update Password"
                icon={<Ionicons name="lock-closed-outline" size={18} color={colors.primary} />}
              />
              <TextInput
                placeholder="Current Password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                placeholderTextColor={colors.faint}
                style={styles.input}
              />
              <TextInput
                placeholder="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholderTextColor={colors.faint}
                style={styles.input}
              />
              <TextInput
                placeholder="Confirm New Password"
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                secureTextEntry
                placeholderTextColor={colors.faint}
                style={styles.input}
              />
              <PressableScale
                onPress={() => changePasswordMutation.mutate()}
                disabled={changePasswordMutation.isPending}
                style={[styles.inlineButton, changePasswordMutation.isPending && styles.disabledButton]}
              >
                {changePasswordMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.inlineButtonText}>Update Password</Text>
                )}
              </PressableScale>
            </OrnateCard>

            <FadeInView index={6}>
              <PressableScale
                onPress={() =>
                  Alert.alert('Delete Account', 'This action is permanent. Continue?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => deleteMutation.mutate(),
                    },
                  ])
                }
                style={[styles.dangerButton, deleteMutation.isPending && styles.disabledButton]}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={17} color="#fff" style={{ marginRight: 7 }} />
                    <Text style={styles.saveButtonText}>Delete Account</Text>
                  </>
                )}
              </PressableScale>
            </FadeInView>
          </>
        ) : (
          <OrnateCard index={5}>
            <SectionHeader
              title="Account Security"
              icon={<Ionicons name="shield-outline" size={18} color={colors.primary} />}
            />
            <Text style={styles.infoText}>Login to access Update Password and Delete Account.</Text>
          </OrnateCard>
        )}

        <OrnateCard index={7}>
          <SectionHeader
            title="About"
            icon={<Ionicons name="information-circle-outline" size={18} color={colors.primary} />}
          />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>{APP_VERSION}</Text>
          </View>
          <View style={[styles.aboutRow, styles.aboutRowLast]}>
            <Text style={styles.aboutLabel}>Developer</Text>
            <Text style={styles.aboutValue}>Apps by Hussnain</Text>
          </View>
          <PressableScale onPress={openStoreListing} style={styles.rateButton}>
            <Ionicons name="star" size={16} color={colors.goldDeep} style={{ marginRight: 8 }} />
            <Text style={styles.rateButtonText}>Rate on Play Store</Text>
          </PressableScale>
        </OrnateCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16, gap: 16, paddingBottom: 40, flexGrow: 1 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  resetPill: {
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  resetPillText: {
    color: colors.goldDeep,
    fontWeight: '800',
    fontSize: 12,
  },
  label: { color: colors.text, fontWeight: '700', fontSize: 13.5 },
  fontRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  slider: { flex: 1, height: 34 },
  fontSizeText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  fontSizeTextLarge: { color: colors.primary, fontWeight: '800', fontSize: 18 },
  previewBox: {
    marginTop: 12,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    padding: 16,
    alignItems: 'center',
  },
  previewLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  previewArabic: {
    color: colors.primaryDark,
    textAlign: 'center',
    fontFamily: fonts.arabic,
    marginTop: 10,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchText: { color: colors.text, fontWeight: '600', fontSize: 14, flex: 1, paddingRight: 10 },
  adhanHint: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  volumeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  volumePercent: { color: colors.primary, fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] },
  testButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    borderRadius: radius.sm,
    paddingVertical: 11,
  },
  testButtonText: { color: colors.primary, fontWeight: '800', fontSize: 13.5 },
  testLockMeta: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  testLockMetaText: { color: colors.muted, fontSize: 12.5, fontWeight: '600' },
  endTestButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#E8B4AB',
    borderRadius: radius.sm,
    paddingVertical: 11,
  },
  endTestButtonText: { color: colors.danger, fontWeight: '800', fontSize: 13.5 },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    ...shadow.soft,
  },
  saveButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  input: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14.5,
    marginBottom: 10,
  },
  inlineButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 13,
    alignItems: 'center',
    ...shadow.soft,
  },
  inlineButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  dangerButton: {
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  disabledButton: { opacity: 0.7 },
  infoText: { color: colors.muted, fontWeight: '600', fontSize: 13, lineHeight: 19 },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  aboutRowLast: { borderBottomWidth: 0 },
  aboutLabel: { color: colors.muted, fontSize: 13.5, fontWeight: '600' },
  aboutValue: { color: colors.text, fontSize: 14, fontWeight: '800' },
  rateButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: radius.sm,
    paddingVertical: 12,
  },
  rateButtonText: { color: colors.goldDeep, fontWeight: '800', fontSize: 14 },
});

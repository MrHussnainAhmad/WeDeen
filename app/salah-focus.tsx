import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { GeometricDivider } from '@/components/IslamicMotifs';
import { FadeInView, PressableScale } from '@/components/Anim';
import { AppListIcon } from '@/components/AppListIcon';
import { SalahFocusPermissionsCard } from '@/components/SalahFocusPermissionsCard';
import { OrnateCard, SectionHeader } from '@/components/ui';
import { useResponsive } from '@/theme/responsive';
import {
  getSalahFocusConfig,
  getSalahFocusExpoGoMessage,
  getSalahFocusLocationRequiredMessage,
  getSalahFocusPermissionsRequiredMessage,
  isSalahFocusSupported,
  saveSalahFocusConfig,
  syncSalahFocusAfterSave,
} from '@/services/salahFocusService';
import { refreshPrayerFocusNow } from '@/services/prayerFocusCoordinator';
import { hasPrayerLocationConfigured } from '@/services/locationService';
import {
  getSalahFocusPermissionStatus,
  listBlockableAndroidApps,
  type AndroidBlockableApp,
} from '@/services/salahFocusNative';
import { expandBlockedPackages } from '@/constants/blockedAppAliases';

const OWN_PACKAGE = Constants.expoConfig?.android?.package ?? 'com.hussnainahmadsahi.wedeen';

const POPULAR_PACKAGES = [
  'com.instagram.android',
  'com.google.android.youtube',
  'com.whatsapp',
  'com.facebook.katana',
  'com.zhiliaoapp.musically',
  'com.snapchat.android',
  'com.twitter.android',
  'com.reddit.frontpage',
];

export default function SalahFocusScreen() {
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();
  const supported = isSalahFocusSupported();

  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [windowMinutes, setWindowMinutes] = useState(30);
  const [androidApps, setAndroidApps] = useState<AndroidBlockableApp[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const config = await getSalahFocusConfig();
      setEnabled(config.enabled);
      setConsent(config.consentAccepted);
      setWindowMinutes(config.windowMinutes);
      setSelectedPackages(config.androidBlockedPackages);
      setHasLocation(await hasPrayerLocationConfigured());

      if (supported) {
        const apps = await listBlockableAndroidApps();
        const filtered = apps
          .filter((a) => a.packageName !== OWN_PACKAGE)
          .sort((a, b) => a.name.localeCompare(b.name));
        setAndroidApps(filtered);
      }
    } finally {
      setLoading(false);
    }
  }, [supported]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      hasPrayerLocationConfigured().then(setHasLocation);
    }, [])
  );

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return androidApps;
    return androidApps.filter(
      (a) => a.name.toLowerCase().includes(q) || a.packageName.toLowerCase().includes(q)
    );
  }, [androidApps, search]);

  const togglePackage = (pkg: string) => {
    setSelectedPackages((prev) =>
      prev.includes(pkg) ? prev.filter((p) => p !== pkg) : [...prev, pkg]
    );
  };

  const onAcceptConsent = () => {
    Alert.alert(
      'Prayer Lock',
      'WeDeen will pause the apps you choose during each prayer window. You stay in control — turn this off anytime. We never read your messages or screen content.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'I agree', onPress: () => setConsent(true) },
      ]
    );
  };

  const onToggleEnabled = (value: boolean) => {
    if (value && !hasLocation) {
      Alert.alert(
        'Location required',
        getSalahFocusLocationRequiredMessage(),
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Timings', onPress: () => router.push('/(tabs)/hijri' as any) },
        ]
      );
      return;
    }
    setEnabled(value);
  };

  const onSave = async () => {
    if (!supported) {
      Alert.alert('Not available', getSalahFocusExpoGoMessage());
      return;
    }
    if (!consent) {
      Alert.alert('Consent required', 'Please accept Prayer Lock before enabling.');
      return;
    }
    if (enabled && !hasLocation) {
      Alert.alert(
        'Location required',
        getSalahFocusLocationRequiredMessage(),
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Timings', onPress: () => router.push('/(tabs)/hijri' as any) },
        ]
      );
      return;
    }
    if (enabled && selectedPackages.length === 0) {
      Alert.alert('Choose apps', 'Select at least one app to pause during prayer.');
      return;
    }
    const perms = await getSalahFocusPermissionStatus();
    if (enabled && !perms.allGranted) {
      Alert.alert('Permissions needed', getSalahFocusPermissionsRequiredMessage());
      return;
    }

    setSaving(true);
    try {
      await saveSalahFocusConfig({
        enabled,
        consentAccepted: consent,
        setupComplete: selectedPackages.length > 0,
        windowMinutes,
        androidBlockedPackages: expandBlockedPackages(selectedPackages),
      });
      await syncSalahFocusAfterSave();
      await refreshPrayerFocusNow(false);

      Alert.alert('Saved', 'Prayer Lock is configured.', [
        {
          text: 'OK',
          onPress: () => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/prayer-lock' as any);
          },
        },
      ]);
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : '';
      const message =
        code === 'PRAYER_LOCATION_REQUIRED'
          ? getSalahFocusLocationRequiredMessage()
          : code === 'PRAYER_PERMISSIONS_REQUIRED'
            ? getSalahFocusPermissionsRequiredMessage()
            : 'Could not save Prayer Lock right now.';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  if (!supported) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 40 }]}>
        <Ionicons name="lock-closed-outline" size={42} color={colors.primary} />
        <Text style={styles.unsupportedTitle}>Prayer Lock Setup</Text>
        <Text style={styles.unsupportedBody}>{getSalahFocusExpoGoMessage()}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }, responsive.centerContent]}
      keyboardShouldPersistTaps="handled"
    >
      <OrnateCard index={0}>
        <SectionHeader
          title="Prayer Lock"
          icon={<Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />}
        />
        <Text style={styles.lead}>
          Pause distracting apps during prayer time. Open WeDeen and tap “I have prayed” to unlock
          them again.
        </Text>
        <GeometricDivider color={colors.goldBorder} style={{ marginVertical: 14 }} />

        {!hasLocation ? (
          <View style={styles.locationBanner}>
            <Ionicons name="location-outline" size={18} color={colors.primaryDeep} />
            <Text style={styles.locationBannerText}>
              {getSalahFocusLocationRequiredMessage()}
            </Text>
            <PressableScale
              onPress={() => router.push('/(tabs)/hijri' as any)}
              style={styles.locationBannerBtn}
            >
              <Text style={styles.locationBannerBtnText}>Open Timings</Text>
            </PressableScale>
          </View>
        ) : null}

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Enable Prayer Lock</Text>
          <Switch
            value={enabled}
            onValueChange={onToggleEnabled}
            disabled={!hasLocation && !enabled}
            trackColor={{ false: '#C9D7D1', true: colors.primary }}
            thumbColor={enabled ? colors.gold : '#FFFFFF'}
          />
        </View>

        <PressableScale
          onPress={onAcceptConsent}
          style={[styles.consentPill, consent && styles.consentPillActive]}
        >
          <Ionicons
            name={consent ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={consent ? colors.primaryDeep : colors.muted}
          />
          <Text style={[styles.consentText, consent && styles.consentTextActive]}>
            {consent ? 'Consent accepted' : 'Tap to read & accept'}
          </Text>
        </PressableScale>
      </OrnateCard>

      <OrnateCard index={1}>
        <SectionHeader
          title="Prayer window"
          icon={<Ionicons name="time-outline" size={18} color={colors.primary} />}
        />
        <Text style={styles.hint}>
          Apps stay paused for {windowMinutes} minutes after each adhan (or until you confirm).
        </Text>
        <View style={styles.minuteRow}>
          {[15, 30, 45, 60].map((m) => (
            <PressableScale
              key={m}
              onPress={() => setWindowMinutes(m)}
              style={[styles.minuteChip, windowMinutes === m && styles.minuteChipActive]}
            >
              <Text style={[styles.minuteChipText, windowMinutes === m && styles.minuteChipTextActive]}>
                {m}m
              </Text>
            </PressableScale>
          ))}
        </View>
      </OrnateCard>

      <OrnateCard index={2}>
        <SectionHeader
          title="Permissions"
          icon={<Ionicons name="key-outline" size={18} color={colors.primary} />}
        />
        <SalahFocusPermissionsCard />
      </OrnateCard>

      <OrnateCard index={3}>
        <SectionHeader
          title="Apps to pause"
          icon={<Ionicons name="apps-outline" size={18} color={colors.primary} />}
        />
        <TextInput
          placeholder="Search apps…"
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={colors.faint}
          style={styles.search}
        />
        <View style={styles.quickRow}>
          {POPULAR_PACKAGES.map((pkg) => {
            const app = androidApps.find((a) => a.packageName === pkg);
            if (!app) return null;
            const selected = selectedPackages.includes(pkg);
            return (
              <PressableScale
                key={pkg}
                onPress={() => togglePackage(pkg)}
                style={[styles.quickChip, selected && styles.quickChipActive]}
              >
                <AppListIcon iconBase64={app.iconBase64} size={18} />
                <Text style={[styles.quickChipText, selected && styles.quickChipTextActive]}>
                  {app.name}
                </Text>
              </PressableScale>
            );
          })}
        </View>
        {filteredApps.length === 0 ? (
          <Text style={styles.hint}>No apps found.</Text>
        ) : (
          filteredApps.slice(0, 80).map((item) => {
            const selected = selectedPackages.includes(item.packageName);
            return (
              <PressableScale
                key={item.packageName}
                onPress={() => togglePackage(item.packageName)}
                style={[styles.appRow, selected && styles.appRowSelected]}
              >
                <View style={styles.appRowLeft}>
                  <AppListIcon iconBase64={item.iconBase64} size={32} />
                  <Text style={styles.appName}>{item.name}</Text>
                </View>
                <Ionicons
                  name={selected ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={selected ? colors.primary : colors.muted}
                />
              </PressableScale>
            );
          })
        )}
        <Text style={styles.selectedCount}>
          {selectedPackages.length} app{selectedPackages.length === 1 ? '' : 's'} selected
        </Text>
      </OrnateCard>

      <FadeInView index={4}>
        <PressableScale
          onPress={onSave}
          disabled={saving}
          style={[styles.saveBtn, saving && styles.disabled]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save Prayer Lock</Text>
          )}
        </PressableScale>
      </FadeInView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  lead: { color: colors.muted, fontSize: 13.5, lineHeight: 20 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { color: colors.text, fontWeight: '700', fontSize: 14, flex: 1, paddingRight: 10 },
  consentPill: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
  },
  consentPillActive: {
    borderColor: colors.goldBorder,
    backgroundColor: colors.goldSoft,
  },
  consentText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  consentTextActive: { color: colors.primaryDeep },
  locationBanner: {
    marginBottom: 14,
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: colors.goldSoft,
    gap: 8,
  },
  locationBannerText: {
    color: colors.primaryDeep,
    fontSize: 12.5,
    lineHeight: 18,
  },
  locationBannerBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  locationBannerBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12.5,
  },
  hint: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginBottom: 10 },
  minuteRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  minuteChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
  },
  minuteChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  minuteChipText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  minuteChipTextActive: { color: colors.primaryDeep },
  actionBtn: {
    marginTop: 4,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnText: { color: colors.primary, fontWeight: '800', fontSize: 13.5 },
  search: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    marginBottom: 10,
  },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  quickChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  quickChipText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  quickChipTextActive: { color: colors.primaryDeep },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  appRowSelected: { backgroundColor: colors.primarySoft },
  appRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  appName: { color: colors.text, fontWeight: '600', fontSize: 14, flexShrink: 1 },
  selectedCount: { marginTop: 8, color: colors.primary, fontWeight: '800', fontSize: 12.5 },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    ...shadow.soft,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  disabled: { opacity: 0.7 },
  unsupportedTitle: {
    marginTop: 14,
    fontFamily: fonts.serif,
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDeep,
  },
  unsupportedBody: {
    marginTop: 10,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
});

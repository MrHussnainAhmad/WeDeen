import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { OrnateCard, SectionHeader } from '@/components/ui';
import PrayerLock from '@/services/prayerLock';
import { usePrayerLockStore } from '@/store/prayerLockStore';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { useResponsive } from '@/theme/responsive';

// ── Permission Gate ──────────────────────────────────────────────────────────

function PermissionRow({
  label,
  granted,
  onRequest,
}: {
  label: string;
  granted: boolean;
  onRequest: () => void;
}) {
  return (
    <View style={pStyles.permRow}>
      <View style={pStyles.permLeft}>
        <Ionicons
          name={granted ? 'checkmark-circle' : 'alert-circle-outline'}
          size={20}
          color={granted ? colors.success : colors.danger}
        />
        <Text style={[pStyles.permLabel, !granted && { color: colors.danger }]}>{label}</Text>
      </View>
      {!granted && (
        <TouchableOpacity style={pStyles.grantBtn} onPress={onRequest}>
          <Text style={pStyles.grantBtnText}>Grant</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── App Row ──────────────────────────────────────────────────────────────────

function AppRow({
  app,
  locked,
  onToggle,
}: {
  app: { name: string; packageName: string; icon: string | null };
  locked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable style={[pStyles.appRow, locked && pStyles.appRowLocked]} onPress={onToggle}>
      {app.icon ? (
        <Image source={{ uri: app.icon }} style={pStyles.appIcon} />
      ) : (
        <View style={[pStyles.appIcon, pStyles.appIconFallback]}>
          <Ionicons name="apps-outline" size={18} color={colors.muted} />
        </View>
      )}
      <View style={pStyles.appInfo}>
        <Text style={pStyles.appName} numberOfLines={1}>
          {app.name}
        </Text>
        <Text style={pStyles.appPkg} numberOfLines={1}>
          {app.packageName}
        </Text>
      </View>
      <Ionicons
        name={locked ? 'lock-closed' : 'lock-open-outline'}
        size={20}
        color={locked ? colors.gold : colors.muted}
      />
    </Pressable>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function LockTab() {
  const responsive = useResponsive();
  const {
    lockedPackages,
    isMonitoringActive,
    unlockHistory,
    installedApps,
    permissions,
    permissionsChecked,
    appsLoading,
    hydrate,
    toggleAppLock,
    setMonitoringActive,
    loadInstalledApps,
    checkAllPermissions,
    startTestMode,
    stopTestMode,
    testSecondsLeft,
  } = usePrayerLockStore();

  const isTestMode = testSecondsLeft !== null;

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const [search, setSearch] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [tab, setTab] = useState<'apps' | 'history'>('apps');

  const allPermsGranted =
    permissions.usageStats && permissions.overlay && permissions.batteryExemption;

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (allPermsGranted && installedApps.length === 0) {
      loadInstalledApps();
    }
  }, [allPermsGranted]);

  const filteredApps = useMemo(() => {
    if (!search.trim()) return installedApps;
    const q = search.toLowerCase();
    return installedApps.filter(
      (a) => a.name.toLowerCase().includes(q) || a.packageName.toLowerCase().includes(q)
    );
  }, [installedApps, search]);

  const handleMonitoringToggle = async (value: boolean) => {
    if (value && !allPermsGranted) {
      await checkAllPermissions();
      return;
    }
    await setMonitoringActive(value);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={pStyles.screen}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[pStyles.content, responsive.centerContent]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={pStyles.hero}>
          <View style={pStyles.heroIcon}>
            <Ionicons
              name={isMonitoringActive ? 'lock-closed' : 'lock-open-outline'}
              size={24}
              color={isMonitoringActive ? colors.gold : colors.onDarkMuted}
            />
          </View>
          <View style={pStyles.heroText}>
            <Text style={pStyles.title}>Prayer Lock</Text>
            <Text style={pStyles.subtitle}>
              {isMonitoringActive
                ? `${lockedPackages.length} app${lockedPackages.length !== 1 ? 's' : ''} monitored`
                : 'Monitoring paused'}
            </Text>
          </View>
          <Switch
            value={isMonitoringActive}
            onValueChange={handleMonitoringToggle}
            trackColor={{ false: 'rgba(255,255,255,0.1)', true: colors.gold }}
            thumbColor={isMonitoringActive ? '#fff' : 'rgba(255,255,255,0.5)'}
            disabled={!allPermsGranted && !isMonitoringActive}
          />
        </View>

        {/* Test Mode banner / button */}
        {allPermsGranted && (
          isTestMode ? (
            <View style={pStyles.testBanner}>
              <Ionicons name="timer-outline" size={18} color={colors.gold} />
              <Text style={pStyles.testCountdown}>
                Test ends in {formatCountdown(testSecondsLeft!)}
              </Text>
              <TouchableOpacity style={pStyles.stopTestBtn} onPress={stopTestMode}>
                <Text style={pStyles.stopTestText}>Stop</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[pStyles.testBtn, !lockedPackages.length && pStyles.testBtnDisabled]}
              disabled={!lockedPackages.length}
              onPress={startTestMode}
            >
              <Ionicons name="flask-outline" size={16} color={lockedPackages.length ? colors.gold : colors.muted} />
              <Text style={[pStyles.testBtnText, !lockedPackages.length && { color: colors.muted }]}>
                Test Lock (5 min)
              </Text>
            </TouchableOpacity>
          )
        )}

        {/* Permission Gate */}
        {permissionsChecked && !allPermsGranted && (
          <OrnateCard index={0} style={pStyles.permCard}>
            <SectionHeader
              title="Permissions Required"
              subtitle="All three needed before monitoring can start"
              icon={<Ionicons name="shield-outline" size={18} color={colors.danger} />}
            />
            <PermissionRow
              label="Usage Access"
              granted={permissions.usageStats}
              onRequest={PrayerLock.requestUsageStatsPermission}
            />
            <PermissionRow
              label="Display Over Other Apps"
              granted={permissions.overlay}
              onRequest={PrayerLock.requestOverlayPermission}
            />
            <PermissionRow
              label="Battery Optimization Exempt"
              granted={permissions.batteryExemption}
              onRequest={PrayerLock.requestBatteryOptimizationExemption}
            />
            <TouchableOpacity
              style={pStyles.recheckBtn}
              onPress={() => checkAllPermissions()}
            >
              <Ionicons name="refresh" size={14} color={colors.primary} />
              <Text style={pStyles.recheckText}>Re-check permissions</Text>
            </TouchableOpacity>
          </OrnateCard>
        )}

        {/* Tab selector */}
        <View style={pStyles.tabBar}>
          <TouchableOpacity
            style={[pStyles.tabBtn, tab === 'apps' && pStyles.tabBtnActive]}
            onPress={() => setTab('apps')}
          >
            <Text style={[pStyles.tabText, tab === 'apps' && pStyles.tabTextActive]}>
              Apps ({lockedPackages.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[pStyles.tabBtn, tab === 'history' && pStyles.tabBtnActive]}
            onPress={() => setTab('history')}
          >
            <Text style={[pStyles.tabText, tab === 'history' && pStyles.tabTextActive]}>
              History ({unlockHistory.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* App picker */}
        {tab === 'apps' && (
          <OrnateCard index={1} padded={false}>
            <View style={pStyles.searchRow}>
              <Ionicons name="search" size={16} color={colors.muted} />
              <Text
                style={pStyles.searchHint}
                // No TextInput — use a placeholder until search state wired up
                // in a real implementation, swap this for <TextInput>.
              >
                {search || 'Type to filter…'}
              </Text>
            </View>

            {appsLoading ? (
              <View style={pStyles.loader}>
                <ActivityIndicator color={colors.primary} />
                <Text style={pStyles.loaderText}>Loading apps…</Text>
              </View>
            ) : !allPermsGranted ? (
              <View style={pStyles.emptyPanel}>
                <Ionicons name="lock-open-outline" size={22} color={colors.primary} />
                <View style={pStyles.emptyTextWrap}>
                  <Text style={pStyles.emptyTitle}>Permissions needed</Text>
                  <Text style={pStyles.emptySubtitle}>Grant all three above, then app list loads.</Text>
                </View>
              </View>
            ) : filteredApps.length === 0 ? (
              <View style={pStyles.emptyPanel}>
                <Ionicons name="apps-outline" size={22} color={colors.muted} />
                <View style={pStyles.emptyTextWrap}>
                  <Text style={pStyles.emptyTitle}>No apps found</Text>
                  <Text style={pStyles.emptySubtitle}>Try a different search term.</Text>
                </View>
              </View>
            ) : (
              filteredApps.map((app) => (
                <AppRow
                  key={app.packageName}
                  app={app}
                  locked={lockedPackages.includes(app.packageName)}
                  onToggle={() => toggleAppLock(app.packageName)}
                />
              ))
            )}
          </OrnateCard>
        )}

        {/* History */}
        {tab === 'history' && (
          <OrnateCard index={1} padded={false}>
            {unlockHistory.length === 0 ? (
              <View style={pStyles.emptyPanel}>
                <Ionicons name="time-outline" size={22} color={colors.muted} />
                <View style={pStyles.emptyTextWrap}>
                  <Text style={pStyles.emptyTitle}>No events yet</Text>
                  <Text style={pStyles.emptySubtitle}>Events appear when overlay is dismissed.</Text>
                </View>
              </View>
            ) : (
              unlockHistory.slice(0, 50).map((event, i) => {
                const icon =
                  event.method === 'prayed'
                    ? 'checkmark-circle'
                    : event.method === 'emergency'
                    ? 'alert-circle'
                    : 'close-circle-outline';
                const tint =
                  event.method === 'prayed'
                    ? colors.success
                    : event.method === 'emergency'
                    ? colors.gold
                    : colors.muted;
                return (
                  <View key={i} style={pStyles.historyRow}>
                    <Ionicons name={icon as any} size={18} color={tint} />
                    <View style={pStyles.historyText}>
                      <Text style={pStyles.historyPkg} numberOfLines={1}>
                        {event.packageName}
                      </Text>
                      <Text style={pStyles.historyMeta}>
                        {event.method} · {new Date(event.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </OrnateCard>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const pStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 110,
    paddingTop: 52,
  },
  // Hero
  hero: {
    minHeight: 116,
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...shadow.raised,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, minWidth: 0 },
  title: {
    color: '#FFFFFF',
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.onDarkMuted,
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  // Permissions
  permCard: { gap: 4 },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  permLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  permLabel: { color: colors.text, fontSize: 13.5, fontWeight: '700', flex: 1 },
  grantBtn: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  grantBtnText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  recheckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  recheckText: { color: colors.primary, fontSize: 12.5, fontWeight: '700' },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.soft,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: colors.primarySoft },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: colors.primary, fontWeight: '900' },
  // App rows
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchHint: { color: colors.faint, fontSize: 13, flex: 1 },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  appRowLocked: { backgroundColor: colors.goldSoft },
  appIcon: { width: 40, height: 40, borderRadius: 10 },
  appIconFallback: {
    backgroundColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appInfo: { flex: 1, minWidth: 0 },
  appName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  appPkg: { color: colors.faint, fontSize: 11, marginTop: 2 },
  // Empty/loader
  loader: {
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  loaderText: { color: colors.muted, fontSize: 13 },
  emptyPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
  },
  emptyTextWrap: { flex: 1, minWidth: 0 },
  emptyTitle: { color: colors.text, fontSize: 14.5, fontWeight: '900' },
  emptySubtitle: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 3 },
  // History
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  historyText: { flex: 1, minWidth: 0 },
  historyPkg: { color: colors.text, fontSize: 13, fontWeight: '700' },
  historyMeta: { color: colors.muted, fontSize: 11.5, marginTop: 2 },
  // Test mode
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primaryDeep,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: radius.md,
    paddingVertical: 13,
  },
  testBtnDisabled: { borderColor: colors.border, opacity: 0.5 },
  testBtnText: { color: colors.gold, fontSize: 14, fontWeight: '800' },
  testBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primaryDeep,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  testCountdown: {
    flex: 1,
    color: colors.gold,
    fontSize: 16,
    fontWeight: '900',
    fontFamily: fonts.serif,
  },
  stopTestBtn: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  stopTestText: { color: colors.danger, fontSize: 12, fontWeight: '800' },
});

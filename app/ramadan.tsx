import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/Anim';
import { GeometricDivider, OrnateCard, SectionHeader } from '@/components/ui';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { useResponsive } from '@/theme/responsive';
import { useAuthStore } from '@/store/authStore';
import { getSavedLocation } from '@/services/locationService';
import {
  calculateFastingStats,
  getFastingLogs,
  getRamadanMode,
  getSuhoorIftarTimes,
  restoreFastingLogs,
  saveFastingLog,
  setRamadanMode,
  type FastingLog,
  type FastingStatus,
} from '@/services/ramadanService';
import { getTodayStr } from '@/services/prayerTrackerService';
import { DUAS } from '@/services/duaLibraryService';

function formatCountdown(target?: Date | null) {
  if (!target) return '--';
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return 'Now';
  const mins = Math.ceil(diff / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function RamadanScreen() {
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();
  const token = useAuthStore((s) => s.token);
  const [logs, setLogs] = useState<Record<string, FastingLog>>({});
  const [mode, setMode] = useState(false);
  const [suhoor, setSuhoor] = useState<Date | null>(null);
  const [iftar, setIftar] = useState<Date | null>(null);
  const [tick, setTick] = useState(Date.now());
  const today = getTodayStr();
  const todayLog = logs[today] ?? { date: today, status: 'pending', taraweehRakats: 0 };
  const stats = useMemo(() => calculateFastingStats(logs), [logs]);
  const ramadanDuas = DUAS.filter((dua) => dua.categoryId === 'ramadan');

  useEffect(() => {
    getFastingLogs().then(setLogs).catch(() => undefined);
    getRamadanMode().then(setMode).catch(() => undefined);
    if (token) restoreFastingLogs(token).then(setLogs).catch(() => undefined);
    const id = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [token]);

  useEffect(() => {
    getSavedLocation()
      .then((loc) => (loc ? getSuhoorIftarTimes(loc) : null))
      .then((times) => {
        setSuhoor(times?.suhoorEndsAt ?? null);
        setIftar(times?.iftarAt ?? null);
      })
      .catch(() => undefined);
  }, [tick]);

  const updateFast = async (status: FastingStatus) => {
    const next = { ...todayLog, status };
    const updated = await saveFastingLog(next, token);
    setLogs(updated);
  };

  const updateTaraweeh = async (amount: number) => {
    const nextRakats = Math.max(0, todayLog.taraweehRakats + amount);
    const updated = await saveFastingLog({ ...todayLog, taraweehRakats: nextRakats }, token);
    setLogs(updated);
  };

  const toggleMode = async (value: boolean) => {
    setMode(value);
    await setRamadanMode(value);
  };

  return (
    <ScrollView
      style={[styles.screen, mode && styles.ramadanScreen]}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 14, 24) }, responsive.centerContent]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Ramadan & Fasting</Text>
          <Text style={styles.headerText}>Suhoor, iftar, fast tracking, Taraweeh, and Ramadan reminders.</Text>
        </View>
      </View>

      <View style={styles.countdownCard}>
        <View style={styles.countdownCol}>
          <Text style={styles.countdownLabel}>SUHOOR ENDS</Text>
          <Text style={styles.countdownValue}>{formatCountdown(suhoor)}</Text>
          <Text style={styles.countdownTime}>{suhoor ? suhoor.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Set location'}</Text>
        </View>
        <View style={styles.countdownDivider} />
        <View style={styles.countdownCol}>
          <Text style={styles.countdownLabel}>IFTAR</Text>
          <Text style={styles.countdownValue}>{formatCountdown(iftar)}</Text>
          <Text style={styles.countdownTime}>{iftar ? iftar.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Set location'}</Text>
        </View>
      </View>

      <OrnateCard>
        <SectionHeader
          title="Today's Fast"
          subtitle={today}
          icon={<MaterialCommunityIcons name="food-croissant" size={18} color={colors.primary} />}
        />
        <View style={styles.statusRow}>
          {(['completed', 'missed', 'pending'] as FastingStatus[]).map((status) => {
            const active = todayLog.status === status;
            return (
              <PressableScale
                key={status}
                onPress={() => updateFast(status)}
                style={[styles.statusButton, active && styles.statusButtonActive]}
              >
                <Text style={[styles.statusText, active && styles.statusTextActive]}>{status}</Text>
              </PressableScale>
            );
          })}
        </View>
      </OrnateCard>

      <OrnateCard>
        <SectionHeader
          title="Taraweeh"
          subtitle="Track rakats for tonight"
          icon={<MaterialCommunityIcons name="mosque" size={18} color={colors.primary} />}
        />
        <View style={styles.taraweehRow}>
          <PressableScale onPress={() => updateTaraweeh(-2)} style={styles.stepButton}>
            <Ionicons name="remove" size={18} color={colors.primary} />
          </PressableScale>
          <Text style={styles.taraweehCount}>{todayLog.taraweehRakats}</Text>
          <PressableScale onPress={() => updateTaraweeh(2)} style={styles.stepButton}>
            <Ionicons name="add" size={18} color={colors.primary} />
          </PressableScale>
        </View>
      </OrnateCard>

      <OrnateCard>
        <SectionHeader
          title="Progress"
          icon={<Ionicons name="stats-chart-outline" size={18} color={colors.primary} />}
        />
        <View style={styles.statGrid}>
          <Stat label="Completed" value={stats.completed} />
          <Stat label="Missed" value={stats.missed} />
          <Stat label="Streak" value={stats.streak} />
        </View>
      </OrnateCard>

      <OrnateCard>
        <SectionHeader
          title="Ramadan Mode"
          subtitle="A warmer app mood for the month"
          icon={<MaterialCommunityIcons name="star-crescent" size={18} color={colors.primary} />}
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>{mode ? 'Ramadan mode on' : 'Ramadan mode off'}</Text>
          <Switch
            value={mode}
            onValueChange={toggleMode}
            trackColor={{ false: '#C9D7D1', true: colors.primary }}
            thumbColor={mode ? colors.gold : '#fff'}
          />
        </View>
      </OrnateCard>

      <OrnateCard>
        <SectionHeader
          title="Ramadan Duas"
          icon={<MaterialCommunityIcons name="hands-pray" size={18} color={colors.primary} />}
        />
        {ramadanDuas.map((dua) => (
          <View key={dua.id} style={styles.duaCard}>
            <Text style={styles.duaTitle}>{dua.title}</Text>
            <Text style={styles.duaArabic}>{dua.arabic}</Text>
            <Text style={styles.duaTranslation}>{dua.translation}</Text>
          </View>
        ))}
        <PressableScale onPress={() => router.push('/duas' as any)} style={styles.duaButton}>
          <Text style={styles.duaButtonText}>Open full Duas library</Text>
        </PressableScale>
      </OrnateCard>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  ramadanScreen: { backgroundColor: '#F8F0DC' },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  header: {
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.xl,
    padding: 18,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    ...shadow.raised,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', fontFamily: fonts.serif },
  headerText: { color: colors.onDarkMuted, marginTop: 4, fontSize: 12.5, lineHeight: 18 },
  countdownCard: {
    flexDirection: 'row',
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    ...shadow.raised,
  },
  countdownCol: { flex: 1, alignItems: 'center' },
  countdownDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 12 },
  countdownLabel: { color: colors.gold, fontSize: 10.5, fontWeight: '900', letterSpacing: 1 },
  countdownValue: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 4 },
  countdownTime: { color: colors.onDarkMuted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusButton: {
    flex: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statusButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusText: { color: colors.text, fontWeight: '900', textTransform: 'capitalize' },
  statusTextActive: { color: '#fff' },
  taraweehRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22 },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taraweehCount: { color: colors.text, fontSize: 36, fontWeight: '900', minWidth: 70, textAlign: 'center' },
  statGrid: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
    alignItems: 'center',
  },
  statValue: { color: colors.primary, fontSize: 24, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 11.5, fontWeight: '800', marginTop: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  duaCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
    marginBottom: 10,
  },
  duaTitle: { color: colors.text, fontWeight: '900', fontSize: 14 },
  duaArabic: { color: colors.primaryDark, fontFamily: fonts.arabic, fontSize: 22, lineHeight: 40, textAlign: 'right' },
  duaTranslation: { color: colors.muted, fontSize: 12.5, lineHeight: 18 },
  duaButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  duaButtonText: { color: '#fff', fontWeight: '900' },
});

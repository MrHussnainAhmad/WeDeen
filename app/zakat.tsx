import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/Anim';
import { GeometricDivider, OrnateCard, SectionHeader } from '@/components/ui';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { useResponsive } from '@/theme/responsive';
import { useAuthStore } from '@/store/authStore';
import {
  buildZakatReport,
  calculateZakat,
  getZakatHistory,
  restoreZakatHistory,
  saveZakatCalculation,
  type ZakatCalculation,
  type ZakatInput,
} from '@/services/zakatService';

const DEFAULT_INPUT: ZakatInput = {
  currency: 'USD',
  cashSavings: 0,
  goldValue: 0,
  silverValue: 0,
  investments: 0,
  businessAssets: 0,
  liabilities: 0,
  nisabThreshold: 5500,
};

function money(currency: string, value: number) {
  return `${currency} ${value.toFixed(2)}`;
}

export default function ZakatScreen() {
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();
  const token = useAuthStore((s) => s.token);
  const [form, setForm] = useState<Record<keyof ZakatInput, string>>({
    currency: DEFAULT_INPUT.currency,
    cashSavings: '',
    goldValue: '',
    silverValue: '',
    investments: '',
    businessAssets: '',
    liabilities: '',
    nisabThreshold: String(DEFAULT_INPUT.nisabThreshold),
  });
  const [history, setHistory] = useState<ZakatCalculation[]>([]);

  useEffect(() => {
    getZakatHistory().then(setHistory).catch(() => undefined);
    if (token) restoreZakatHistory(token).then(setHistory).catch(() => undefined);
  }, [token]);

  const input = useMemo<ZakatInput>(
    () => ({
      currency: form.currency || 'USD',
      cashSavings: Number(form.cashSavings) || 0,
      goldValue: Number(form.goldValue) || 0,
      silverValue: Number(form.silverValue) || 0,
      investments: Number(form.investments) || 0,
      businessAssets: Number(form.businessAssets) || 0,
      liabilities: Number(form.liabilities) || 0,
      nisabThreshold: Number(form.nisabThreshold) || 0,
    }),
    [form]
  );
  const calculation = useMemo(() => calculateZakat(input), [input]);
  const eligible = calculation.zakatableTotal >= calculation.nisabThreshold;

  const update = (key: keyof ZakatInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    const item = calculateZakat(input);
    const next = await saveZakatCalculation(item, token);
    setHistory(next);
    Alert.alert('Saved', 'Your Zakat calculation was saved locally.');
  };

  const share = async (item = calculation) => {
    await Share.share({ message: buildZakatReport(item), title: 'WeDeen Zakat Report' });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 14, 24) }, responsive.centerContent]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Zakat Calculator</Text>
          <Text style={styles.headerText}>Clean estimate with Nisab awareness and a shareable breakdown.</Text>
        </View>
      </View>

      <OrnateCard>
        <SectionHeader
          title="Assets"
          subtitle="Enter values in your preferred currency"
          icon={<MaterialCommunityIcons name="scale-balance" size={18} color={colors.primary} />}
        />
        <TextInput
          value={form.currency}
          onChangeText={(value) => update('currency', value.toUpperCase().slice(0, 4))}
          style={styles.input}
          placeholder="Currency, e.g. USD"
          placeholderTextColor={colors.faint}
        />
        <View style={styles.grid}>
          <Field label="Cash & Savings" value={form.cashSavings} onChange={(v) => update('cashSavings', v)} />
          <Field label="Gold Value" value={form.goldValue} onChange={(v) => update('goldValue', v)} />
          <Field label="Silver Value" value={form.silverValue} onChange={(v) => update('silverValue', v)} />
          <Field label="Stocks & Investments" value={form.investments} onChange={(v) => update('investments', v)} />
          <Field label="Business Assets" value={form.businessAssets} onChange={(v) => update('businessAssets', v)} />
          <Field label="Liabilities" value={form.liabilities} onChange={(v) => update('liabilities', v)} />
        </View>
      </OrnateCard>

      <OrnateCard>
        <SectionHeader
          title="Nisab"
          subtitle="Use local gold or silver threshold guidance"
          icon={<MaterialCommunityIcons name="gold" size={18} color={colors.primary} />}
        />
        <Field label="Nisab Threshold" value={form.nisabThreshold} onChange={(v) => update('nisabThreshold', v)} />
        <Text style={styles.helpText}>
          WeDeen does not guess live commodity prices. Enter the threshold recommended by your local scholar,
          mosque, or trusted Zakat authority.
        </Text>
      </OrnateCard>

      <View style={styles.resultCard}>
        <Text style={styles.resultLabel}>{eligible ? 'Zakat Due' : 'Below Nisab'}</Text>
        <Text style={styles.resultAmount}>{money(calculation.currency, calculation.zakatDue)}</Text>
        <GeometricDivider color="rgba(197,155,39,0.5)" style={{ marginVertical: 14 }} />
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Zakatable total</Text>
          <Text style={styles.breakdownValue}>{money(calculation.currency, calculation.zakatableTotal)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Rate</Text>
          <Text style={styles.breakdownValue}>2.5%</Text>
        </View>
        <Text style={styles.disclaimer}>Estimate only. Ask a qualified scholar for complex assets, debts, or business inventory.</Text>
        <View style={styles.actions}>
          <PressableScale onPress={save} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Save Calculation</Text>
          </PressableScale>
          <PressableScale onPress={() => share()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Share Report</Text>
          </PressableScale>
        </View>
      </View>

      <OrnateCard>
        <SectionHeader
          title="History"
          subtitle="Local first, synced when logged in"
          icon={<Ionicons name="time-outline" size={18} color={colors.primary} />}
        />
        {history.length ? (
          <View style={styles.historyList}>
            {history.slice(0, 6).map((item) => (
              <PressableScale key={item.calculationId} onPress={() => share(item)} style={styles.historyItem}>
                <View>
                  <Text style={styles.historyAmount}>{money(item.currency, item.zakatDue)}</Text>
                  <Text style={styles.historyDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                </View>
                <Ionicons name="share-outline" size={18} color={colors.primary} />
              </PressableScale>
            ))}
          </View>
        ) : (
          <Text style={styles.helpText}>No saved calculations yet.</Text>
        )}
      </OrnateCard>
    </ScrollView>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.faint}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
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
  grid: { gap: 10 },
  field: { gap: 6 },
  fieldLabel: { color: colors.text, fontWeight: '800', fontSize: 12.5 },
  input: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
  },
  helpText: { color: colors.muted, fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  resultCard: {
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    ...shadow.raised,
  },
  resultLabel: { color: colors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  resultAmount: { color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 4 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  breakdownLabel: { color: colors.onDarkMuted, fontWeight: '700' },
  breakdownValue: { color: '#fff', fontWeight: '900' },
  disclaimer: { color: colors.onDarkMuted, fontSize: 12, lineHeight: 18, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.primaryDeep, fontWeight: '900' },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  secondaryButtonText: { color: '#fff', fontWeight: '900' },
  historyList: { gap: 8 },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
  },
  historyAmount: { color: colors.text, fontWeight: '900', fontSize: 15 },
  historyDate: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 2 },
});

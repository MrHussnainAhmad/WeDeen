import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, TextInput, View, Pressable, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  nisabChoice: 'manual',
  goldPrice: 0,
  silverPrice: 0,
};

function money(currency: string, value: number) {
  return `${currency} ${value.toFixed(2)}`;
}

export default function ZakatScreen() {
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();
  const token = useAuthStore((s) => s.token);

  const [form, setForm] = useState<Record<string, string>>({
    currency: DEFAULT_INPUT.currency,
    cashSavings: '',
    goldValue: '',
    silverValue: '',
    investments: '',
    businessAssets: '',
    liabilities: '',
    nisabThreshold: String(DEFAULT_INPUT.nisabThreshold),
  });

  const [nisabChoice, setNisabChoice] = useState<'manual' | 'gold' | 'silver'>('manual');
  const [goldPrice, setGoldPrice] = useState('');
  const [silverPrice, setSilverPrice] = useState('');
  const [history, setHistory] = useState<ZakatCalculation[]>([]);

  // Calculation report modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeReport, setActiveReport] = useState<ZakatCalculation | null>(null);

  const calculatedNisabThreshold = useMemo(() => {
    if (nisabChoice === 'gold') {
      return 85 * (Number(goldPrice) || 0);
    }
    if (nisabChoice === 'silver') {
      return 595 * (Number(silverPrice) || 0);
    }
    return Number(form.nisabThreshold) || 0;
  }, [nisabChoice, goldPrice, silverPrice, form.nisabThreshold]);

  const handleHistoryPress = (item: ZakatCalculation) => {
    setActiveReport(item);
    setShowReportModal(true);
  };

  const deleteHistoryItem = async (calculationId: string) => {
    const next = history.filter((x) => x.calculationId !== calculationId);
    setHistory(next);
    await AsyncStorage.setItem('wedeen_zakat_history_v1', JSON.stringify(next));
    if (token) {
      try {
        const { api } = require('@/services/http');
        await api.post('/sync/zakat', { items: next }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
      } catch {
        // non-fatal
      }
    }
    Alert.alert('Deleted', 'Calculation removed.');
  };

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
      nisabThreshold: calculatedNisabThreshold,
      nisabChoice,
      goldPrice: Number(goldPrice) || undefined,
      silverPrice: Number(silverPrice) || undefined,
    }),
    [form, calculatedNisabThreshold, nisabChoice, goldPrice, silverPrice]
  );

  const calculation = useMemo(() => calculateZakat(input), [input]);
  const eligible = calculation.zakatableTotal >= calculation.nisabThreshold;

  const update = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    const item = calculateZakat(input);
    const next = await saveZakatCalculation(item, token);
    setHistory(next);
    Alert.alert('Saved', 'Your Zakat calculation was saved.');
  };

  const share = async (item = calculation) => {
    await Share.share({ message: buildZakatReport(item), title: 'Muslim Deen: Quran & Prayer Zakat Report' });
  };

  const loadReportIntoForm = (item: ZakatCalculation) => {
    setForm({
      currency: item.currency,
      cashSavings: item.cashSavings ? String(item.cashSavings) : '',
      goldValue: item.goldValue ? String(item.goldValue) : '',
      silverValue: item.silverValue ? String(item.silverValue) : '',
      investments: item.investments ? String(item.investments) : '',
      businessAssets: item.businessAssets ? String(item.businessAssets) : '',
      liabilities: item.liabilities ? String(item.liabilities) : '',
      nisabThreshold: String(item.nisabThreshold),
    });
    setNisabChoice(item.nisabChoice || 'manual');
    setGoldPrice(item.goldPrice ? String(item.goldPrice) : '');
    setSilverPrice(item.silverPrice ? String(item.silverPrice) : '');
    Alert.alert('Loaded', 'Calculation inputs loaded into the active form.');
  };

  return (
    <View style={{ flex: 1 }}>
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
          
          <View style={{ gap: 6, marginBottom: 12 }}>
            <Text style={styles.fieldLabel}>Currency</Text>
            <TextInput
              value={form.currency}
              onChangeText={(value) => update('currency', value.toUpperCase().slice(0, 4))}
              style={styles.input}
              placeholder="Currency, e.g. USD"
              placeholderTextColor={colors.faint}
            />
          </View>

          <View style={[styles.grid, responsive.isTablet && styles.gridTablet]}>
            <Field
              label="Cash & Savings"
              value={form.cashSavings}
              onChange={(v) => update('cashSavings', v)}
              tooltip="All cash on hand, bank account balances, and general savings."
              isTablet={responsive.isTablet}
            />
            <Field
              label="Gold Value"
              value={form.goldValue}
              onChange={(v) => update('goldValue', v)}
              tooltip="Current market value of gold owned (threshold is 85 grams)."
              isTablet={responsive.isTablet}
            />
            <Field
              label="Silver Value"
              value={form.silverValue}
              onChange={(v) => update('silverValue', v)}
              tooltip="Current market value of silver owned (threshold is 595 grams)."
              isTablet={responsive.isTablet}
            />
            <Field
              label="Stocks & Investments"
              value={form.investments}
              onChange={(v) => update('investments', v)}
              tooltip="Value of shares, mutual funds, cryptocurrency, or retirement accounts."
              isTablet={responsive.isTablet}
            />
            <Field
              label="Business Assets"
              value={form.businessAssets}
              onChange={(v) => update('businessAssets', v)}
              tooltip="Value of business inventory, liquid cash assets, or business receivables."
              isTablet={responsive.isTablet}
            />
            <Field
              label="Liabilities"
              value={form.liabilities}
              onChange={(v) => update('liabilities', v)}
              tooltip="Outstanding short-term debts, bills, and business expenses due now."
              isTablet={responsive.isTablet}
            />
          </View>
        </OrnateCard>

        <OrnateCard>
          <SectionHeader
            title="Nisab Standard"
            subtitle="Choose a threshold calculation standard"
            icon={<MaterialCommunityIcons name="gold" size={18} color={colors.primary} />}
          />

          <View style={styles.nisabSelector}>
            {(['manual', 'gold', 'silver'] as const).map((choice) => (
              <PressableScale
                key={choice}
                onPress={() => setNisabChoice(choice)}
                style={[
                  styles.nisabOption,
                  nisabChoice === choice && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
              >
                <Text style={[
                  styles.nisabOptionText,
                  nisabChoice === choice && { color: '#fff' }
                ]}>
                  {choice === 'manual' ? 'Manual' : choice === 'gold' ? 'Gold (85g)' : 'Silver (595g)'}
                </Text>
              </PressableScale>
            ))}
          </View>

          {nisabChoice === 'gold' && (
            <View style={{ marginTop: 12, gap: 6 }}>
              <Text style={styles.fieldLabel}>Gold Price per Gram</Text>
              <Text style={styles.fieldDesc}>Enter local price per gram of pure gold in {form.currency || 'USD'}. Standard Nisab limit is 85 grams.</Text>
              <TextInput
                value={goldPrice}
                onChangeText={setGoldPrice}
                keyboardType="decimal-pad"
                placeholder="e.g. 75.50"
                placeholderTextColor={colors.faint}
                style={styles.input}
              />
              <Text style={styles.calculatedText}>
                Calculated Nisab: 85g × {form.currency} {Number(goldPrice || 0).toFixed(2)} = {money(form.currency || 'USD', calculatedNisabThreshold)}
              </Text>
            </View>
          )}

          {nisabChoice === 'silver' && (
            <View style={{ marginTop: 12, gap: 6 }}>
              <Text style={styles.fieldLabel}>Silver Price per Gram</Text>
              <Text style={styles.fieldDesc}>Enter local price per gram of silver in {form.currency || 'USD'}. Standard Nisab limit is 595 grams.</Text>
              <TextInput
                value={silverPrice}
                onChangeText={setSilverPrice}
                keyboardType="decimal-pad"
                placeholder="e.g. 1.10"
                placeholderTextColor={colors.faint}
                style={styles.input}
              />
              <Text style={styles.calculatedText}>
                Calculated Nisab: 595g × {form.currency} {Number(silverPrice || 0).toFixed(2)} = {money(form.currency || 'USD', calculatedNisabThreshold)}
              </Text>
            </View>
          )}

          {nisabChoice === 'manual' && (
            <View style={{ marginTop: 12 }}>
              <Field
                label="Nisab Limit"
                value={form.nisabThreshold}
                onChange={(v) => update('nisabThreshold', v)}
                tooltip="Custom threshold value in your chosen currency."
              />
            </View>
          )}
        </OrnateCard>

        <View style={[styles.alertCard, eligible ? styles.alertCardGreen : styles.alertCardGold]}>
          <Ionicons
            name={eligible ? 'checkmark-circle-outline' : 'warning-outline'}
            size={18}
            color={eligible ? '#0B6B4F' : '#A8811F'}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.alertTitle, { color: eligible ? '#063528' : '#6A4A00' }]}>
              {eligible ? 'Zakat Obligatory' : 'Below Nisab Limit'}
            </Text>
            <Text style={[styles.alertText, { color: eligible ? '#3B584E' : '#7D5A0F' }]}>
              {eligible
                ? `Your net wealth exceeds the Nisab limit of ${money(calculation.currency, calculation.nisabThreshold)}. Zakat is due at 2.5%.`
                : `Your net wealth of ${money(calculation.currency, calculation.zakatableTotal)} is below the Nisab limit of ${money(calculation.currency, calculation.nisabThreshold)}. Zakat is not obligatory.`}
            </Text>
          </View>
        </View>

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
            <PressableScale onPress={() => handleHistoryPress(calculation)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>View Summary</Text>
            </PressableScale>
          </View>
        </View>

        <OrnateCard>
          <SectionHeader
            title="History"
            subtitle="View your past Zakat calculations"
            icon={<Ionicons name="time-outline" size={18} color={colors.primary} />}
          />
          {!token ? (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Ionicons name="cloud-offline-outline" size={32} color={colors.muted} style={{ marginBottom: 8 }} />
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 4 }}>Sign In Required</Text>
              <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 13, marginBottom: 12 }}>
                Sign in to save and review your Zakat history across all your devices.
              </Text>
              <PressableScale
                style={[styles.primaryButton, { width: '100%' }]}
                onPress={() => router.push('/settings')}
              >
                <Text style={styles.primaryButtonText}>Sign In / Create Account</Text>
              </PressableScale>
            </View>
          ) : history.length ? (
            <View style={[styles.historyList, responsive.isTablet && styles.historyListTablet]}>
              {history.slice(0, 12).map((item) => (
                <PressableScale key={item.calculationId} onPress={() => handleHistoryPress(item)} style={[styles.historyItem, responsive.isTablet && { width: '48.5%' }]}>
                  <View>
                    <Text style={styles.historyAmount}>{money(item.currency, item.zakatDue)}</Text>
                    <Text style={styles.historyDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <Ionicons name="ellipsis-horizontal-circle-outline" size={20} color={colors.primary} />
                </PressableScale>
              ))}
            </View>
          ) : (
            <Text style={styles.helpText}>No saved calculations yet.</Text>
          )}
        </OrnateCard>
      </ScrollView>

      {/* Premium Calculation Report Modal */}
      <Modal visible={showReportModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContainer, responsive.isTablet && { maxWidth: 600, maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Calculation Summary</Text>
              <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                {activeReport && (
                  <PressableScale
                    onPress={() => {
                      Alert.alert('Delete Calculation', 'Are you sure you want to delete this calculation?', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => {
                            if (activeReport) deleteHistoryItem(activeReport.calculationId);
                            setShowReportModal(false);
                          },
                        },
                      ]);
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </PressableScale>
                )}
                <PressableScale onPress={() => setShowReportModal(false)}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </PressableScale>
              </View>
            </View>

            {activeReport && (
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
                <View style={styles.reportSummaryCard}>
                  <Text style={styles.reportLabel}>NET ZAKATABLE ASSETS</Text>
                  <Text style={styles.reportAmount}>{money(activeReport.currency, activeReport.zakatableTotal)}</Text>
                  <View style={[
                    styles.reportStatusBadge,
                    activeReport.zakatableTotal >= activeReport.nisabThreshold ? styles.badgeGreen : styles.badgeGold
                  ]}>
                    <Text style={[
                      styles.reportStatusBadgeText,
                      activeReport.zakatableTotal >= activeReport.nisabThreshold ? { color: '#0B6B4F' } : { color: '#A8811F' }
                    ]}>
                      {activeReport.zakatableTotal >= activeReport.nisabThreshold ? 'Zakat Obligatory' : 'Below Nisab'}
                    </Text>
                  </View>
                </View>

                <View style={styles.reportSection}>
                  <Text style={styles.reportSectionTitle}>Asset Breakdown</Text>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportRowLabel}>Cash & Savings</Text>
                    <Text style={styles.reportRowValue}>{money(activeReport.currency, activeReport.cashSavings)}</Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportRowLabel}>Gold Value</Text>
                    <Text style={styles.reportRowValue}>{money(activeReport.currency, activeReport.goldValue)}</Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportRowLabel}>Silver Value</Text>
                    <Text style={styles.reportRowValue}>{money(activeReport.currency, activeReport.silverValue)}</Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportRowLabel}>Stocks & Investments</Text>
                    <Text style={styles.reportRowValue}>{money(activeReport.currency, activeReport.investments)}</Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportRowLabel}>Business Assets</Text>
                    <Text style={styles.reportRowValue}>{money(activeReport.currency, activeReport.businessAssets)}</Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportRowLabel}>Liabilities (Deducted)</Text>
                    <Text style={[styles.reportRowValue, { color: colors.danger }]}>-{money(activeReport.currency, activeReport.liabilities)}</Text>
                  </View>
                </View>

                <View style={styles.reportSection}>
                  <Text style={styles.reportSectionTitle}>Threshold & Rates</Text>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportRowLabel}>Nisab Standard</Text>
                    <Text style={styles.reportRowValue}>
                      {activeReport.nisabChoice === 'gold' ? 'Gold (85g)' : activeReport.nisabChoice === 'silver' ? 'Silver (595g)' : 'Manual'}
                    </Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportRowLabel}>Nisab Limit</Text>
                    <Text style={styles.reportRowValue}>{money(activeReport.currency, activeReport.nisabThreshold)}</Text>
                  </View>
                  <View style={styles.reportRow}>
                    <Text style={styles.reportRowLabel}>Calculation Date</Text>
                    <Text style={styles.reportRowValue}>{new Date(activeReport.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <GeometricDivider color={colors.borderSoft} style={{ marginVertical: 10 }} />
                  <View style={styles.reportRow}>
                    <Text style={[styles.reportRowLabel, { fontWeight: 'bold' }]}>Zakat Due (2.5%)</Text>
                    <Text style={[styles.reportRowValue, { fontWeight: '900', color: colors.primaryDeep, fontSize: 16 }]}>
                      {money(activeReport.currency, activeReport.zakatDue)}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <PressableScale
                    style={styles.modalActionBtnLoad}
                    onPress={() => {
                      loadReportIntoForm(activeReport);
                      setShowReportModal(false);
                    }}
                  >
                    <Text style={styles.modalActionBtnLoadText}>Load into Form</Text>
                  </PressableScale>
                  <PressableScale style={styles.modalActionBtnShare} onPress={() => share(activeReport)}>
                    <Text style={styles.modalActionBtnShareText}>Share Report</Text>
                  </PressableScale>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  tooltip,
  isTablet = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  tooltip?: string;
  isTablet?: boolean;
}) {
  return (
    <View style={[styles.field, isTablet && { width: '48.5%' }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {tooltip ? (
        <Text style={styles.fieldDesc}>{tooltip}</Text>
      ) : null}
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
  gridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  field: { gap: 4 },
  fieldLabel: { color: colors.text, fontWeight: '800', fontSize: 12.5 },
  fieldDesc: { color: colors.muted, fontSize: 11, lineHeight: 14, fontWeight: '600' },
  input: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    width: '100%',
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
  historyListTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
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
  alertCard: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  alertCardGreen: {
    backgroundColor: '#E8F5F1',
    borderColor: '#BCE5DA',
  },
  alertCardGold: {
    backgroundColor: '#FDF7E7',
    borderColor: '#F6E4BA',
  },
  alertTitle: {
    fontSize: 13.5,
    fontWeight: 'bold',
  },
  alertText: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    fontWeight: '600',
  },
  nisabSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  nisabOption: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    paddingVertical: 8,
    alignItems: 'center',
  },
  nisabOptionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  calculatedText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: colors.bg,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.raised,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    paddingBottom: 12,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: fonts.serif,
    color: colors.text,
  },
  reportSummaryCard: {
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.lg,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  reportLabel: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  reportAmount: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  reportStatusBadge: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  reportStatusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  badgeGreen: {
    backgroundColor: '#E8F5F1',
    borderColor: '#BCE5DA',
  },
  badgeGold: {
    backgroundColor: '#FDF7E7',
    borderColor: '#F6E4BA',
  },
  reportSection: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
    marginBottom: 14,
  },
  reportSectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  reportRowLabel: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12.5,
  },
  reportRowValue: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 12.5,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalActionBtnLoad: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalActionBtnLoadText: {
    color: '#fff',
    fontWeight: '900',
  },
  modalActionBtnShare: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalActionBtnShareText: {
    color: colors.primaryDeep,
    fontWeight: '900',
  },
});

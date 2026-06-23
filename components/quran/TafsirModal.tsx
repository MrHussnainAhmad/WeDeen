import React, { useState, useEffect } from 'react';
import { Modal, StyleSheet, Text, View, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, radius, shadow, type ThemeColors } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { PressableScale } from '@/components/Anim';
import { GeometricDivider } from '@/components/IslamicMotifs';
import { fetchTafsir } from '@/services/tafsirService';
import { useThemeStore } from '@/store/themeStore';

interface TafsirModalProps {
  visible: boolean;
  onClose: () => void;
  surahNumber: number;
  ayahNumber: number;
  surahName: string;
}

const TAFSIR_OPTIONS = [
  { key: 'ibn_kathir', name: 'Ibn Kathir', lang: 'English' },
  { key: 'maarif', name: 'Ma\'arif ul Quran', lang: 'English' },
  { key: 'muyassar', name: 'Al-Muyassar', lang: 'Arabic' },
  { key: 'ibn_kathir_ar', name: 'Ibn Kathir', lang: 'Arabic' },
];

const LANG_LABELS: Record<string, string> = {
  en: 'English',
  ar: 'عربي',
  ur: 'اردو',
  tr: 'Türkçe',
  fr: 'Français',
};

export function TafsirModal({
  visible,
  onClose,
  surahNumber,
  ayahNumber,
  surahName,
}: TafsirModalProps) {
  const themeColors = useThemeColors();
  const isDarkMode = useThemeStore((s) => s.colorScheme === 'dark');
  const styles = React.useMemo(() => createStyles(themeColors), [themeColors]);

  const [activeTafsirKey, setActiveTafsirKey] = useState('ibn_kathir');
  const [selectedLang, setSelectedLang] = useState<'en' | 'ar' | 'ur' | 'tr' | 'fr'>('en');
  const [loading, setLoading] = useState(false);
  const [tafsirText, setTafsirText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-switch default Tafsir based on chosen language
  useEffect(() => {
    if (selectedLang === 'ar') {
      setActiveTafsirKey('muyassar');
    } else {
      setActiveTafsirKey('ibn_kathir');
    }
  }, [selectedLang]);

  useEffect(() => {
    if (!visible) return;

    let active = true;
    const loadTafsir = async () => {
      setLoading(true);
      setError(null);
      setTafsirText(null);

      try {
        const text = await fetchTafsir(activeTafsirKey, surahNumber, ayahNumber);
        if (active) {
          setTafsirText(text);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Could not load Tafsir.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadTafsir();
    return () => {
      active = false;
    };
  }, [visible, activeTafsirKey, surahNumber, ayahNumber]);

  const isFallbackLang = selectedLang === 'ur' || selectedLang === 'tr' || selectedLang === 'fr';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Tafsir Commentary</Text>
              <Text style={styles.headerSubtitle}>
                {surahName} · Verse {surahNumber}:{ayahNumber}
              </Text>
            </View>
            <PressableScale onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={themeColors.text} />
            </PressableScale>
          </View>

          <GeometricDivider color={themeColors.goldBorder} style={{ marginVertical: 8 }} />

          {/* Language Selector */}
          <View style={styles.langSelectorRow}>
            <Text style={styles.selectorLabel}>Language:</Text>
            <View style={styles.langPills}>
              {(['en', 'ar', 'ur', 'tr', 'fr'] as const).map((lang) => (
                <PressableScale
                  key={lang}
                  onPress={() => setSelectedLang(lang)}
                  style={[
                    styles.langPill,
                    selectedLang === lang && styles.langPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.langPillText,
                      selectedLang === lang && styles.langPillTextActive,
                    ]}
                  >
                    {lang.toUpperCase()}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </View>

          {/* Fallback Warning */}
          {isFallbackLang && (
            <View style={styles.fallbackBanner}>
              <Ionicons name="information-circle" size={16} color={themeColors.goldDeep} />
              <Text style={styles.fallbackBannerText}>
                Tafsir is not available in {LANG_LABELS[selectedLang]}. Displaying English/Arabic commentaries below.
              </Text>
            </View>
          )}

          {/* Tafsir Tabs */}
          <View style={styles.tabsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
              {TAFSIR_OPTIONS.filter(opt => {
                // If user selected Arabic language, prioritize showing Arabic options or allow all
                return true;
              }).map((opt) => {
                const isActive = activeTafsirKey === opt.key;
                return (
                  <PressableScale
                    key={opt.key}
                    onPress={() => setActiveTafsirKey(opt.key)}
                    style={[styles.tab, isActive && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                      {opt.name}
                    </Text>
                    <Text style={[styles.tabLangText, isActive && styles.tabLangTextActive]}>
                      ({opt.lang})
                    </Text>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </View>

          {/* Content Area */}
          <View style={styles.contentWrap}>
            {loading && (
              <View style={styles.skeletonContainer}>
                <View style={[styles.skeletonLine, { width: '40%', height: 18 }]} />
                <View style={[styles.skeletonLine, { width: '90%', marginTop: 24 }]} />
                <View style={[styles.skeletonLine, { width: '85%' }]} />
                <View style={[styles.skeletonLine, { width: '95%' }]} />
                <View style={[styles.skeletonLine, { width: '70%' }]} />
                <View style={[styles.skeletonLine, { width: '90%', marginTop: 16 }]} />
                <View style={[styles.skeletonLine, { width: '80%' }]} />
                <View style={[styles.skeletonLine, { width: '60%' }]} />
              </View>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="wifi-outline" size={42} color={themeColors.muted} />
                <Text style={styles.errorTitle}>Offline or Loading Failed</Text>
                <Text style={styles.errorSubtitle}>
                  Connect to the internet to load this Tafsir for the first time.
                </Text>
                <PressableScale
                  onPress={() => {
                    // Force refresh
                    setActiveTafsirKey(activeTafsirKey => `${activeTafsirKey}`);
                  }}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </PressableScale>
              </View>
            )}

            {tafsirText && !loading && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.textScroll}>
                <Text
                  style={[
                    styles.tafsirText,
                    (activeTafsirKey === 'muyassar' || activeTafsirKey === 'ibn_kathir_ar')
                      ? styles.tafsirTextArabic
                      : styles.tafsirTextEnglish,
                  ]}
                >
                  {tafsirText}
                </Text>
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(6,53,40,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      height: '75%',
      paddingBottom: 24,
      borderWidth: 1,
      borderColor: colors.goldBorder,
      ...shadow.raised,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 10,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      fontFamily: fonts.serif,
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.muted,
      marginTop: 2,
      fontWeight: '600',
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.cardAlt,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    langSelectorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginVertical: 6,
      gap: 10,
    },
    selectorLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    langPills: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
    },
    langPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    langPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    langPillText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
    },
    langPillTextActive: {
      color: '#fff',
    },
    fallbackBanner: {
      flexDirection: 'row',
      backgroundColor: colors.goldSoft,
      borderColor: colors.goldBorder,
      borderWidth: 1,
      borderRadius: radius.sm,
      padding: 10,
      marginHorizontal: 20,
      marginTop: 4,
      gap: 8,
      alignItems: 'flex-start',
    },
    fallbackBannerText: {
      fontSize: 11.5,
      color: colors.goldDeep,
      fontWeight: '600',
      flex: 1,
    },
    tabsContainer: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginVertical: 10,
    },
    tabsScroll: {
      paddingHorizontal: 20,
      paddingBottom: 8,
      gap: 8,
    },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.sm,
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    tabActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.muted,
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: '800',
    },
    tabLangText: {
      fontSize: 9.5,
      color: colors.faint,
      marginTop: 1,
    },
    tabLangTextActive: {
      color: colors.primary,
    },
    contentWrap: {
      flex: 1,
      paddingHorizontal: 20,
      marginTop: 8,
    },
    textScroll: {
      paddingBottom: 20,
    },
    tafsirText: {
      fontSize: 15.5,
      lineHeight: 25,
      color: colors.text,
    },
    tafsirTextEnglish: {
      fontFamily: fonts.sans,
      textAlign: 'left',
    },
    tafsirTextArabic: {
      fontFamily: fonts.arabic,
      fontSize: 20,
      lineHeight: 38,
      textAlign: 'right',
    },
    skeletonContainer: {
      flex: 1,
      paddingTop: 10,
      gap: 10,
    },
    skeletonLine: {
      height: 12,
      backgroundColor: colors.bgDeep,
      borderRadius: 6,
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    errorTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      marginTop: 14,
      fontFamily: fonts.serif,
    },
    errorSubtitle: {
      fontSize: 13,
      color: colors.muted,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 19,
    },
    retryButton: {
      marginTop: 18,
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: radius.pill,
      ...shadow.soft,
    },
    retryButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
  });

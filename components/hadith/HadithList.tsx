import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, Text, View, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getHadithSection, type HadithItem } from '@/services/hadithService';
import { fonts, radius, shadow, type ThemeColors } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { useThemeStore } from '@/store/themeStore';
import { EightPointStar, GeometricDivider, StarFieldWatermark } from '@/components/IslamicMotifs';
import { ListRowSkeleton } from '@/components/loading/ListRowSkeleton';
import { PressableScale } from '@/components/Anim';
import { useResponsive } from '@/theme/responsive';
import { shareAsText, shareAsImage } from '@/utils/shareHelper';
import { LinearGradient } from 'expo-linear-gradient';
import { AchievementManager } from '@/store/achievementStore';

const ENGLISH_NAMES: Record<string, string> = {
  bukhari: 'Sahih al-Bukhari',
  muslim: 'Sahih Muslim',
  abudawud: 'Sunan Abi Dawud',
  tirmidhi: 'Jami` at-Tirmidhi',
  nasai: 'Sunan an-Nasa\'i',
  ibnmajah: 'Sunan Ibn Majah',
  malik: 'Muwatta Malik',
  nawawi: '40 Hadith Nawawi',
  qudsi: '40 Hadith Qudsi',
  dehlawi: '40 Hadith Shah Waliullah',
};

const getBookTitle = (slug: string) => {
  if (ENGLISH_NAMES[slug]) return ENGLISH_NAMES[slug];
  return slug.charAt(0).toUpperCase() + slug.slice(1);
};

/**
 * Shared bilingual hadith reader. Used both by the dedicated section screen and
 * inline by single-section books (e.g. the 40-hadith collections).
 */
export function HadithList({ slug, section }: { slug: string; section: string }) {
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();
  const themeColors = useThemeColors();
  const colorScheme = useThemeStore((s) => s.colorScheme);
  const isDarkMode = colorScheme === 'dark';
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [selectedHadith, setSelectedHadith] = useState<HadithItem | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [shareHadithData, setShareHadithData] = useState<{
    number: number;
    arabic?: string;
    english: string;
    grade?: string;
    referenceText: string;
  } | null>(null);
  const shareCardRef = useRef<any>(null);
  const trackedHadithReadsRef = useRef<Set<number>>(new Set());

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['hadith-section', slug, section],
    queryFn: () => getHadithSection(slug, section),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    enabled: !!slug && !!section,
  });

  useEffect(() => {
    const hadiths = data?.hadiths ?? [];
    let tracked = 0;
    for (const item of hadiths) {
      if (trackedHadithReadsRef.current.has(item.number)) continue;
      trackedHadithReadsRef.current.add(item.number);
      tracked += 1;
    }
    if (tracked > 0) {
      AchievementManager.trackEvent('hadith_read', tracked).catch(() => undefined);
    }
  }, [data?.hadiths]);

  const buildHadithReference = (item: HadithItem) => {
    const gradeText = item.grades?.[0] ? `\nGrade: ${item.grades[0].grade} (${item.grades[0].name})` : '';
    const bookTitle = getBookTitle(slug);
    const refText = `Reference: ${bookTitle} - Hadith ${item.number}`;
    return `${gradeText}\n\n- ${refText}\nShared via WeDeen`;
  };

  const handleShareArabicText = async (item: HadithItem) => {
    if (!item.arabic) {
      setStatusMessage('Arabic text is not available for this hadith.');
      return;
    }
    const message = `${item.arabic}${buildHadithReference(item)}`;
    await shareAsText(message, `Share Hadith ${item.number} in Arabic`);
    AchievementManager.trackEvent('dev_share', 1).catch(() => undefined);
  };

  const handleShareEnglishText = async (item: HadithItem) => {
    const englishText = item.english || '';
    const message = `${englishText}${buildHadithReference(item)}`;
    await shareAsText(message, `Share Hadith ${item.number} in English`);
    AchievementManager.trackEvent('dev_share', 1).catch(() => undefined);
  };

  const handleShareImage = async (item: HadithItem) => {
    setStatusMessage('Preparing shareable image...');
    try {
      const bookTitle = getBookTitle(slug);
      const referenceText = `${bookTitle} · Hadith ${item.number}`;
      const grade = item.grades?.[0] ? `Grade: ${item.grades[0].grade}` : undefined;
      
      setShareHadithData({
        number: item.number,
        arabic: item.arabic,
        english: item.english,
        grade,
        referenceText,
      });

      // Give React a frame to mount and layout the hidden card offscreen
      setTimeout(async () => {
        try {
          await shareAsImage(shareCardRef);
          AchievementManager.trackEvent('dev_share', 1).catch(() => undefined);
          setShareHadithData(null);
          setStatusMessage('');
        } catch (err) {
          console.warn(err);
          setShareHadithData(null);
          setStatusMessage('Failed to share image.');
        }
      }, 500);
    } catch (e) {
      setStatusMessage('Failed to prepare sharing.');
    }
  };

  if (!slug || !section) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>This hadith chapter is unavailable.</Text>
      </View>
    );
  }

  if (isLoading) {
    return <ListRowSkeleton rows={4} rowHeight={130} />;
  }

  if (isError) {
    const message = (error as any)?.message || 'Could not load this hadith chapter right now.';
    return (
      <View style={styles.center}>
        <View style={styles.errorIcon}>
          <Ionicons name="cloud-offline-outline" size={28} color={themeColors.danger} />
        </View>
        <Text style={styles.errorText}>{message}</Text>
        <PressableScale onPress={() => refetch()} style={styles.retryButton}>
          <Text style={styles.retryText}>Try Again</Text>
        </PressableScale>
      </View>
    );
  }

  const hadiths = data?.hadiths ?? [];
  if (!hadiths.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No hadiths available in this chapter.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {statusMessage ? (
        <View style={styles.infoMessage}>
          <Ionicons name="information-circle" size={18} color={themeColors.goldDeep} />
          <Text style={styles.infoText}>{statusMessage}</Text>
        </View>
      ) : null}

      <FlatList
        style={styles.screen}
        data={hadiths}
        keyExtractor={(item: HadithItem) => String(item.number)}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 28 }, responsive.centerContent]}
        renderItem={({ item }) => (
          <HadithCard
            item={item}
            themeColors={themeColors}
            styles={styles}
            onShare={setSelectedHadith}
          />
        )}
      />

      {/* Share Actions Modal */}
      <Modal
        visible={!!selectedHadith}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedHadith(null)}
      >
        <View style={styles.bottomSheetBackdrop}>
          <Pressable style={styles.backdropDismiss} onPress={() => setSelectedHadith(null)} />
          <View style={styles.bottomSheetContent}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Hadith {selectedHadith?.number} Options</Text>
              <PressableScale onPress={() => setSelectedHadith(null)} style={styles.closeButtonSmall}>
                <Ionicons name="close" size={18} color={themeColors.text} />
              </PressableScale>
            </View>
            <GeometricDivider color={themeColors.goldBorder} style={{ marginVertical: 8 }} />
            
            <View style={styles.bottomSheetActions}>
              <PressableScale
                onPress={() => {
                  if (selectedHadith) {
                    const item = selectedHadith;
                    setSelectedHadith(null);
                    handleShareArabicText(item);
                  }
                }}
                style={styles.actionRow}
              >
                <Ionicons name="document-text-outline" size={20} color={themeColors.primary} />
                <Text style={styles.actionRowText}>Share Arabic Text</Text>
              </PressableScale>

              <PressableScale
                onPress={() => {
                  if (selectedHadith) {
                    const item = selectedHadith;
                    setSelectedHadith(null);
                    handleShareEnglishText(item);
                  }
                }}
                style={styles.actionRow}
              >
                <Ionicons name="language-outline" size={20} color={themeColors.primary} />
                <Text style={styles.actionRowText}>Share English Text</Text>
              </PressableScale>

              <PressableScale
                onPress={() => {
                  if (selectedHadith) {
                    const item = selectedHadith;
                    setSelectedHadith(null);
                    handleShareImage(item);
                  }
                }}
                style={styles.actionRow}
              >
                <Ionicons name="image-outline" size={20} color={themeColors.primary} />
                <Text style={styles.actionRowText}>Share Image</Text>
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>

      {/* Offscreen styled card for view shot */}
      {shareHadithData && (
        <View style={styles.hiddenCardContainer}>
          <LinearGradient
            ref={shareCardRef}
            collapsable={false}
            colors={isDarkMode ? ['#05251C', '#0A3E31'] : ['#FFFFFF', '#FAF5EC', '#F4E9CE']}
            style={[
              styles.hiddenCard,
              {
                borderColor: themeColors.gold,
              },
            ]}
          >
            <StarFieldWatermark rows={4} cols={4} starSize={20} color="rgba(197,155,39,0.05)" />
            
            <View style={styles.hiddenCardWatermarkRow}>
              <Text style={styles.hiddenCardWatermarkText}>WeDeen</Text>
            </View>

            {shareHadithData.arabic ? (
              <Text style={styles.hiddenCardArabicText}>
                {shareHadithData.arabic}
              </Text>
            ) : null}
            
            {shareHadithData.arabic ? (
              <GeometricDivider color={themeColors.gold} style={{ marginVertical: 14 }} />
            ) : null}
            
            <Text style={styles.hiddenCardTranslationText}>
              {shareHadithData.english}
            </Text>

            {shareHadithData.grade ? (
              <Text style={styles.hiddenCardGradeText}>
                {shareHadithData.grade}
              </Text>
            ) : null}

            <View style={styles.hiddenCardFooter}>
              <Text style={styles.hiddenCardRefText}>
                {shareHadithData.referenceText}
              </Text>
            </View>
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

function HadithCard({
  item,
  themeColors,
  styles,
  onShare,
}: {
  item: HadithItem;
  themeColors: ThemeColors;
  styles: any;
  onShare: (item: HadithItem) => void;
}) {
  const grade = item.grades?.[0];
  return (
    <PressableScale
      onPress={() => onShare(item)}
      style={styles.card}
      accessibilityLabel={`Open sharing options for Hadith ${item.number}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.badge}>
          <EightPointStar size={36} color={themeColors.primarySoft} />
          <Text style={styles.badgeText}>{item.number}</Text>
        </View>
        <View style={styles.headerMeta}>
          <Text style={styles.headerLabel}>Hadith {item.number}</Text>
          {item.reference ? (
            <Text style={styles.headerRef}>
              Book {item.reference.book} · No. {item.reference.hadith}
            </Text>
          ) : null}
        </View>
        {grade?.grade ? (
          <View style={styles.gradeChip}>
            <Text style={styles.gradeText} numberOfLines={1}>
              {grade.grade}
            </Text>
          </View>
        ) : null}
      </View>

      {item.arabic ? <Text style={styles.arabic}>{item.arabic}</Text> : null}

      {item.arabic && item.english ? <View style={styles.divider} /> : null}

      {item.english ? <Text style={styles.english}>{item.english}</Text> : null}

      <View style={styles.cardFooter}>
        {grade?.grade && grade?.name ? (
          <Text style={styles.gradeSource}>Grade: {grade.grade} — {grade.name}</Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={styles.cardShareBtn}>
          <Ionicons name="share-social-outline" size={18} color={themeColors.primary} />
        </View>
      </View>
    </PressableScale>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    screen: { flex: 1, backgroundColor: colors.bg },
    listContent: { paddingHorizontal: 14, paddingTop: 14 },
    center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
    errorIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorText: { color: colors.text, textAlign: 'center', fontSize: 14, lineHeight: 20 },
    emptyText: { color: colors.muted, textAlign: 'center', fontSize: 14, lineHeight: 20 },
    retryButton: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: radius.sm },
    retryText: { color: '#fff', fontWeight: '800' },

    card: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRightWidth: 4,
      borderRightColor: colors.gold,
      ...shadow.soft,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    badge: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    badgeText: { position: 'absolute', fontSize: 12, fontWeight: '900', color: colors.primary },
    headerMeta: { flex: 1 },
    headerLabel: { color: colors.text, fontWeight: '800', fontSize: 13.5, fontFamily: fonts.serif },
    headerRef: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 1 },
    gradeChip: {
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryTint,
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
      maxWidth: 110,
    },
    gradeText: { color: colors.primary, fontSize: 11, fontWeight: '800' },

    arabic: {
      color: colors.text,
      fontFamily: fonts.arabic,
      fontSize: 20,
      lineHeight: 38,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: 12 },
    english: { color: colors.text, fontSize: 14.5, lineHeight: 23 },
    gradeSource: { color: colors.faint, fontSize: 11, fontStyle: 'italic', flex: 1, marginRight: 8 },

    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
    },
    cardShareBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Info Message Banner
    infoMessage: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 16,
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
      backgroundColor: colors.goldSoft,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.goldBorder,
    },
    infoText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.goldDeep,
    },

    // Bottom Sheet Modals
    bottomSheetBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    backdropDismiss: {
      ...StyleSheet.absoluteFillObject,
    },
    bottomSheetContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 32,
      ...shadow.raised,
    },
    bottomSheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    bottomSheetTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      fontFamily: fonts.serif,
    },
    closeButtonSmall: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.bgDeep,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bottomSheetActions: {
      gap: 12,
      marginTop: 10,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: radius.sm,
      backgroundColor: colors.cardAlt,
    },
    actionRowText: {
      fontSize: 14.5,
      fontWeight: '700',
      color: colors.text,
    },

    // Hidden Card Share Template
    hiddenCardContainer: {
      position: 'absolute',
      left: -9999,
      top: 0,
      opacity: 0,
    },
    hiddenCard: {
      width: 360,
      padding: 24,
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hiddenCardWatermarkRow: {
      alignSelf: 'stretch',
      alignItems: 'flex-end',
      marginBottom: 10,
    },
    hiddenCardWatermarkText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.gold,
      letterSpacing: 1,
    },
    hiddenCardArabicText: {
      fontFamily: fonts.arabic,
      fontSize: 22,
      lineHeight: 40,
      color: colors.primaryDark,
      textAlign: 'center',
      marginVertical: 10,
    },
    hiddenCardTranslationText: {
      fontSize: 14,
      lineHeight: 22,
      color: colors.text,
      textAlign: 'center',
      fontWeight: '600',
      marginVertical: 10,
    },
    hiddenCardGradeText: {
      fontSize: 12,
      color: colors.goldDeep,
      fontWeight: '700',
      marginTop: 6,
      textAlign: 'center',
    },
    hiddenCardFooter: {
      alignSelf: 'stretch',
      alignItems: 'flex-start',
      marginTop: 12,
    },
    hiddenCardRefText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.goldDeep,
    },
  });

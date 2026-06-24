import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { decryptString } from '@/services/contentCipher';
import { getHadithBooks, type HadithBook } from '@/services/hadithService';
import { colors, fonts, radius, shadow, type ThemeColors } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { PressableScale } from '@/components/Anim';
import { GeometricDivider } from '@/components/IslamicMotifs';
import { AchievementManager } from '@/store/achievementStore';
import { useResponsive } from '@/theme/responsive';

const HISTORY_KEY = 'hadith_search_history_v1';

interface SearchResult {
  bookSlug: string;
  bookName: string;
  sectionNo: string;
  sectionTitle: string;
  hadithNumber: number;
  snippet: string;
  arabicSnippet: string;
  isArabic: boolean;
}

export default function HadithSearchScreen() {
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const responsive = useResponsive();
  const router = useRouter();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [books, setBooks] = useState<HadithBook[]>([]);
  const [selectedBookSlug, setSelectedBookSlug] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Load books and history
  useEffect(() => {
    getHadithBooks()
      .then(setBooks)
      .catch(() => undefined);

    AsyncStorage.getItem(HISTORY_KEY)
      .then((val) => {
        if (val) setHistory(JSON.parse(val));
      })
      .catch(() => undefined);
  }, []);

  const handleSearch = async (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q) return;

    Keyboard.dismiss();
    setQuery(q);
    setLoading(true);
    setHasSearched(true);

    // Save to history
    const nextHistory = [q, ...history.filter((h) => h !== q)].slice(0, 10);
    setHistory(nextHistory);
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory)).catch(() => undefined);
    AchievementManager.trackEvent('hadith_search', 1).catch(() => undefined);

    const matches: SearchResult[] = [];
    const normalizedQuery = q.toLowerCase();
    const isArabicSearch = /[؀-ۿ]/.test(q);

    try {
      const targetBooks = selectedBookSlug
        ? books.filter((b) => b.slug === selectedBookSlug)
        : books;

      const infoRaw = await AsyncStorage.getItem('hadith_cat_info_v1');
      const info = infoRaw ? JSON.parse(infoRaw) : null;

      if (!info) {
        setLoading(false);
        return;
      }

      for (const book of targetBooks) {
        const meta = info[book.slug]?.metadata;
        if (!meta) continue;

        const sections = meta.sections || {};
        const sectionKeys = Object.keys(sections).filter((k) => sections[k] && sections[k].trim().length > 0);
        const activeKeys = sectionKeys.length ? sectionKeys : ['1'];

        for (const key of activeKeys) {
          const path = `${FileSystem.documentDirectory}hadith/${book.slug}/${key}.json`;
          const fileInfo = await FileSystem.getInfoAsync(path);
          if (!fileInfo.exists) continue; // Skip un-downloaded sections offline

          const raw = await FileSystem.readAsStringAsync(path);
          const decrypted = await decryptString(raw);
          if (!decrypted) continue;

          const sectionData = JSON.parse(decrypted);
          if (!sectionData || !Array.isArray(sectionData.hadiths)) continue;

          for (const hadith of sectionData.hadiths) {
            const english = hadith.english || '';
            const arabic = hadith.arabic || '';

            const isEngMatch = english.toLowerCase().includes(normalizedQuery);
            const isAraMatch = arabic.includes(q);

            if (isEngMatch || isAraMatch) {
              matches.push({
                bookSlug: book.slug,
                bookName: book.name,
                sectionNo: key,
                sectionTitle: sectionData.title,
                hadithNumber: hadith.number,
                snippet: isArabicSearch ? arabic : (isEngMatch ? english : arabic),
                arabicSnippet: arabic,
                isArabic: isArabicSearch || isAraMatch,
              });

              if (matches.length >= 50) break;
            }
          }
          if (matches.length >= 50) break;
        }
        if (matches.length >= 50) break;
      }
    } catch (err) {
      console.warn('Hadith search failed:', err);
    }

    setResults(matches);
    setLoading(false);
  };

  const deleteHistoryItem = (itemToDelete: string) => {
    const nextHistory = history.filter((h) => h !== itemToDelete);
    setHistory(nextHistory);
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory)).catch(() => undefined);
  };

  const highlightText = (text: string, highlight: string, isArabic: boolean) => {
    if (!highlight.trim()) return <Text>{text}</Text>;
    const regex = new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
      <Text style={isArabic ? styles.arabicResultText : styles.englishResultText}>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <Text key={i} style={styles.highlight}>
              {part}
            </Text>
          ) : (
            part
          )
        )}
      </Text>
    );
  };

  const selectedBookName = selectedBookSlug
    ? books.find((b) => b.slug === selectedBookSlug)?.name || 'Filtered'
    : 'All Books';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
      {/* Hadith Search Header */}
      <View style={[styles.header, responsive.centerContent]}>
        <PressableScale onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={themeColors.text} />
        </PressableScale>
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={18} color={themeColors.muted} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search Hadith text or collections..."
            placeholderTextColor={themeColors.faint}
            style={styles.searchInput}
            onSubmitEditing={() => handleSearch(query)}
            returnKeyType="search"
            autoFocus
          />
          {query.length > 0 && (
            <PressableScale onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={themeColors.muted} style={{ marginRight: 6 }} />
            </PressableScale>
          )}
          <PressableScale onPress={() => setShowFilterModal(true)} style={styles.filterButton}>
            <Ionicons name="filter-outline" size={18} color={themeColors.primary} />
            <Text style={styles.filterButtonText} numberOfLines={1}>{selectedBookName}</Text>
          </PressableScale>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={styles.loadingText}>Searching offline Hadith collections...</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, idx) => `${item.bookSlug}:${item.sectionNo}:${item.hadithNumber}:${idx}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[{ paddingBottom: insets.bottom + 24 }, responsive.centerContent]}
          ListHeaderComponent={
            <>
              {/* History Block */}
              {!hasSearched && history.length > 0 && (
                <View style={styles.historySection}>
                  <Text style={styles.sectionTitle}>Recent Searches</Text>
                  {history.map((h, i) => (
                    <View key={i} style={styles.historyRow}>
                      <PressableScale onPress={() => handleSearch(h)} style={styles.historyItemLink}>
                        <Ionicons name="time-outline" size={16} color={themeColors.muted} />
                        <Text style={styles.historyText}>{h}</Text>
                      </PressableScale>
                      <PressableScale onPress={() => deleteHistoryItem(h)} style={styles.historyDeleteBtn}>
                        <Ionicons name="close" size={16} color={themeColors.muted} />
                      </PressableScale>
                    </View>
                  ))}
                  <GeometricDivider color={themeColors.border} style={{ marginTop: 14 }} />
                </View>
              )}

              {/* Status Header */}
              {hasSearched && (
                <Text style={styles.resultsCount}>
                  {results.length} result{results.length === 1 ? '' : 's'} found for &quot;{query}&quot;
                </Text>
              )}
            </>
          }
          ListEmptyComponent={
            hasSearched ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color={themeColors.muted} />
                <Text style={styles.emptyTitle}>No results found</Text>
                <Text style={styles.emptySubtitle}>Try searching with different keywords or book filters.</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="library-outline" size={48} color={themeColors.muted} />
                <Text style={styles.emptyTitle}>Offline Hadith Search</Text>
                <Text style={styles.emptySubtitle}>
                  Search across Bukhari, Muslim, and other authentic collections offline.
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <PressableScale
              onPress={() =>
                router.replace({
                  pathname: '/hadith/[book]/[section]',
                  params: { book: item.bookSlug, section: item.sectionNo, title: item.sectionTitle },
                })
              }
              style={styles.resultCard}
            >
              <View style={styles.resultHeader}>
                <Ionicons name="library" size={16} color={themeColors.primary} />
                <Text style={styles.resultRefText}>
                  {item.bookName} · Hadith {item.hadithNumber}
                </Text>
              </View>
              
              {item.isArabic && item.arabicSnippet ? (
                <View style={styles.snippetWrap}>
                  {highlightText(item.snippet, query, true)}
                </View>
              ) : (
                <View style={styles.snippetWrap}>
                  {highlightText(item.snippet, query, false)}
                </View>
              )}
            </PressableScale>
          )}
        />
      )}

      {/* Book Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Hadith Book</Text>
            
            <FlatList
              data={[{ slug: null, name: 'All Collections' } as any, ...books]}
              keyExtractor={(item) => item.slug || 'all'}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setSelectedBookSlug(item.slug);
                    setShowFilterModal(false);
                  }}
                  style={[
                    styles.modalItem,
                    selectedBookSlug === item.slug && styles.modalItemActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      selectedBookSlug === item.slug && styles.modalItemTextActive,
                    ]}
                  >
                    {item.name}
                  </Text>
                  {selectedBookSlug === item.slug && (
                    <Ionicons name="checkmark-circle" size={18} color={themeColors.primary} />
                  )}
                </Pressable>
              )}
            />
            
            <PressableScale
              onPress={() => setShowFilterModal(false)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      gap: 12,
      marginBottom: 10,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchBarContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingLeft: 12,
      paddingRight: 6,
      height: 44,
      ...shadow.soft,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      fontWeight: '600',
      paddingVertical: 8,
    },
    filterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryTint,
      borderWidth: 1,
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 6,
      maxWidth: 100,
    },
    filterButtonText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primary,
    },
    centerContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 30,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.muted,
      fontWeight: '600',
    },
    historySection: {
      paddingHorizontal: 16,
      marginTop: 10,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    historyItemLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    historyText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    historyDeleteBtn: {
      padding: 4,
    },
    resultsCount: {
      paddingHorizontal: 16,
      marginVertical: 12,
      fontSize: 13,
      fontWeight: '700',
      color: colors.muted,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      paddingVertical: 80,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      marginTop: 14,
      fontFamily: fonts.serif,
    },
    emptySubtitle: {
      fontSize: 13.5,
      color: colors.muted,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 20,
    },
    resultCard: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.soft,
    },
    resultHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
    },
    resultRefText: {
      fontSize: 12.5,
      fontWeight: '800',
      color: colors.goldDeep,
    },
    snippetWrap: {
      marginTop: 4,
    },
    englishResultText: {
      fontSize: 14.5,
      lineHeight: 23,
      color: colors.text,
      fontWeight: '500',
    },
    arabicResultText: {
      fontFamily: fonts.arabic,
      fontSize: 22,
      lineHeight: 38,
      color: colors.primaryDark,
      textAlign: 'right',
    },
    highlight: {
      color: colors.gold,
      fontWeight: '800',
      backgroundColor: colors.goldSoft,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(6,53,40,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    modalContent: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.goldBorder,
      ...shadow.raised,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 14,
      fontFamily: fonts.serif,
      textAlign: 'center',
    },
    modalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: radius.sm,
      marginBottom: 6,
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    modalItemActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    modalItemText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '600',
    },
    modalItemTextActive: {
      color: colors.primary,
      fontWeight: '800',
    },
    modalCloseButton: {
      marginTop: 14,
      alignSelf: 'stretch',
      backgroundColor: colors.primarySoft,
      paddingVertical: 12,
      borderRadius: radius.sm,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.primaryTint,
    },
    modalCloseButtonText: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.primary,
    },
  });

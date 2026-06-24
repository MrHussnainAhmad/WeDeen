import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  FlatList,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrDownloadQuran, getOrDownloadTranslation } from '@/services/quranService';
import { stripTajweedTags } from '@/utils/tajweedParser';
import { colors, fonts, radius, shadow, type ThemeColors } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { PressableScale } from '@/components/Anim';
import { GeometricDivider } from '@/components/IslamicMotifs';
import { AchievementManager } from '@/store/achievementStore';
import { useResponsive } from '@/theme/responsive';

const HISTORY_KEY = 'quran_search_history_v1';

interface SearchResult {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  snippet: string;
  arabicSnippet: string;
  isArabicMatch: boolean;
}

export default function QuranSearchScreen() {
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const responsive = useResponsive();
  const router = useRouter();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [quranData, setQuranData] = useState<any>(null);
  const [transData, setTransData] = useState<any>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Load Quran and translations on mount
  useEffect(() => {
    const init = async () => {
      try {
        const quran = await getOrDownloadQuran();
        setQuranData(quran);
        const trans = await getOrDownloadTranslation('en');
        setTransData(trans);
      } catch (err) {
        console.warn('Failed to load search data:', err);
      }
    };
    init();

    // Load search history
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
    AchievementManager.trackEvent('quran_search', 1).catch(() => undefined);

    // Perform search
    if (!quranData) {
      setLoading(false);
      return;
    }

    const matches: SearchResult[] = [];
    const isArabicSearch = /[؀-ۿ]/.test(q);
    const normalizedQuery = q.toLowerCase();

    const surahs = quranData.surahs || [];
    const transSurahs = transData?.data?.surahs || [];

    for (let sIdx = 0; sIdx < surahs.length; sIdx += 1) {
      const surah = surahs[sIdx];
      const transSurah = transSurahs[sIdx];
      const ayahs = surah.ayahs || [];
      const transAyahs = transSurah?.ayahs || [];

      for (let aIdx = 0; aIdx < ayahs.length; aIdx += 1) {
        const ayah = ayahs[aIdx];
        const transAyah = transAyahs[aIdx];
        const strippedAr = stripTajweedTags(ayah.text);
        const translationText = transAyah?.text || '';

        if (isArabicSearch) {
          if (strippedAr.includes(q)) {
            matches.push({
              surahNumber: surah.number,
              surahName: surah.englishName,
              ayahNumber: ayah.numberInSurah,
              snippet: strippedAr,
              arabicSnippet: strippedAr,
              isArabicMatch: true,
            });
          }
        } else {
          if (translationText.toLowerCase().includes(normalizedQuery)) {
            matches.push({
              surahNumber: surah.number,
              surahName: surah.englishName,
              ayahNumber: ayah.numberInSurah,
              snippet: translationText,
              arabicSnippet: strippedAr,
              isArabicMatch: false,
            });
          }
        }
      }
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

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
      {/* Search Header */}
      <View style={[styles.header, responsive.centerContent]}>
        <PressableScale onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={themeColors.text} />
        </PressableScale>
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={18} color={themeColors.muted} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search Arabic word or English keyword..."
            placeholderTextColor={themeColors.faint}
            style={styles.searchInput}
            onSubmitEditing={() => handleSearch(query)}
            returnKeyType="search"
            autoFocus
          />
          {query.length > 0 && (
            <PressableScale onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={themeColors.muted} />
            </PressableScale>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={styles.loadingText}>Searching through Quran...</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, idx) => `${item.surahNumber}:${item.ayahNumber}:${idx}`}
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
                <Text style={styles.emptySubtitle}>Try searching with different spelling or keywords.</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="book-outline" size={48} color={themeColors.muted} />
                <Text style={styles.emptyTitle}>Offline Quran Search</Text>
                <Text style={styles.emptySubtitle}>
                  Enter an Arabic word (e.g. رحمن) or translation keyword to search offline.
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <PressableScale
              onPress={() =>
                router.replace(`/quran/${item.surahNumber}?scrollAyah=${item.ayahNumber}`)
              }
              style={styles.resultCard}
            >
              <View style={styles.resultHeader}>
                <Ionicons name="book-outline" size={16} color={themeColors.primary} />
                <Text style={styles.resultRefText}>
                  {item.surahName} · Ayah {item.ayahNumber}
                </Text>
              </View>
              
              {/* If translation match, show Arabic text too */}
              {!item.isArabicMatch && (
                <Text style={styles.arabicSnippetText}>{item.arabicSnippet}</Text>
              )}

              <View style={styles.snippetWrap}>
                {highlightText(item.snippet, query, item.isArabicMatch)}
              </View>
            </PressableScale>
          )}
        />
      )}
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
      paddingHorizontal: 12,
      height: 44,
      ...shadow.soft,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14.5,
      color: colors.text,
      fontWeight: '600',
      paddingVertical: 8,
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
    arabicSnippetText: {
      fontFamily: fonts.arabic,
      fontSize: 20,
      lineHeight: 34,
      color: colors.primaryDark,
      textAlign: 'right',
      marginBottom: 8,
    },
    snippetWrap: {
      marginTop: 4,
    },
    englishResultText: {
      fontSize: 14,
      lineHeight: 22,
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
  });

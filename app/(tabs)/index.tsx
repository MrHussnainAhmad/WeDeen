import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, RefreshControl, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDailyIslamicData } from '@/hooks/useDailyIslamicData';
import { colors } from '@/theme/colors';
import { Ionicons, FontAwesome6, MaterialCommunityIcons } from '@expo/vector-icons';

type LangOption = { code: string; label: string };

const LANG_OPTIONS: LangOption[] = [
  { code: 'en', label: 'EN' },
  { code: 'ur', label: 'UR' },
  { code: 'ar', label: 'AR' },
  { code: 'fr', label: 'FR' },
  { code: 'tr', label: 'TR' }
];

const THEME = {
  primary: '#0F7A5A',
  primaryDark: '#0A523D',
  primaryLight: '#EBF5F1',
  bg: '#F8F5EF',
  card: '#FFFFFF',
  text: '#1C2A23',
  muted: '#60706A',
  gold: '#C59B27',
  goldLight: '#FAF5EA',
  goldBorder: '#EEDCB9',
  border: '#E6E0D5',
  shadow: '#1C2A23',
  red: '#C0392B',
  redLight: '#FDEDEC',
};

function hasArabic(text?: string | null) {
  if (!text) return false;
  return /[\u0600-\u06FF]/.test(text);
}

function detectSourceLang(text: string) {
  return hasArabic(text) ? 'ar' : 'en';
}

async function translateText(text: string, targetLang: string) {
  const sourceLang = detectSourceLang(text);
  if (sourceLang === targetLang) return text;

  const MAX_CHARS = 450;

  const translateChunk = async (chunk: string) => {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${sourceLang}|${targetLang}`;
    const response = await fetch(url);
    const data = await response.json();
    return data?.responseData?.translatedText || chunk;
  };

  if (text.length <= MAX_CHARS) {
    return translateChunk(text);
  }

  const words = text.split(' ');
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > MAX_CHARS) {
      if (current) chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);

  const translatedChunks: string[] = [];
  for (const chunk of chunks) {
    const translated = await translateChunk(chunk);
    translatedChunks.push(translated);
  }

  return translatedChunks.join(' ');
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch, isFetching } = useDailyIslamicData();

  const [showReminderLangs, setShowReminderLangs] = useState(false);
  const [showHadithLangs, setShowHadithLangs] = useState(false);
  const [reminderTranslated, setReminderTranslated] = useState<string | null>(null);
  const [hadithTranslated, setHadithTranslated] = useState<string | null>(null);
  const [translatingReminder, setTranslatingReminder] = useState(false);
  const [translatingHadith, setTranslatingHadith] = useState(false);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Fetching today's blessings...</Text>
      </View>
    );
  }

  const reminderText = reminderTranslated ?? data?.reminder ?? 'Reminder unavailable';
  const hadithText = hadithTranslated ?? data?.hadith ?? 'Hadith unavailable';

  const onTranslateReminder = async (lang: string) => {
    if (!data?.reminder) return;
    setTranslatingReminder(true);
    try {
      const translated = await translateText(data.reminder, lang);
      setReminderTranslated(translated);
    } finally {
      setTranslatingReminder(false);
      setShowReminderLangs(false);
    }
  };

  const onTranslateHadith = async (lang: string) => {
    if (!data?.hadith) return;
    setTranslatingHadith(true);
    try {
      const translated = await translateText(data.hadith, lang);
      setHadithTranslated(translated);
    } finally {
      setTranslatingHadith(false);
      setShowHadithLangs(false);
    }
  };

  const getFormattedGregorianDate = () => {
    const today = new Date();
    return today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[styles.container, { paddingTop: Math.max(insets.top + 18, 24) }]}
      refreshControl={
        <RefreshControl
          refreshing={isFetching}
          onRefresh={refetch}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      {/* Quran Poster Banner */}
      <View style={styles.quranPoster}>
        <View style={styles.decorCircle} />
        <View style={styles.decorCircle2} />

        <View style={styles.quranPosterContent}>
          {/* Left: Text + Button */}
          <View style={styles.quranPosterLeft}>
            <Text style={styles.quranPosterArabic}>ٱلْقُرْءَانُ ٱلْكَرِيمُ</Text>
            <Text style={styles.quranPosterTitle}>The Noble Quran</Text>
            <Text style={styles.quranPosterSub}>"Guidance and light for mankind."</Text>

            {/* Read Now Button — below The Noble Quran */}
            <Link href="/quran" asChild>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.readButton, pressed && styles.readButtonPressed]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="book" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.readButtonText}>Read Now</Text>
                  <Ionicons name="chevron-forward" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                </View>
              </Pressable>
            </Link>
          </View>

          {/* Right: Icon */}
          <View style={styles.quranPosterRight}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="book-open-page-variant" size={48} color={THEME.gold} />
            </View>
          </View>
        </View>
      </View>

      {/* Hijri Calendar Card */}
      <View style={styles.hijriCard}>
        <View style={styles.hijriDecor} />
        <View style={styles.hijriHeader}>
          <View style={styles.hijriIconContainer}>
            <MaterialCommunityIcons name="star-crescent" size={24} color={THEME.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.hijriLabel}>Today in Hijri</Text>
            <Text style={styles.hijriDate}>{data?.hijriDate ?? 'Hijri date unavailable'}</Text>
          </View>
        </View>
        <View style={styles.hijriDivider} />
        <View style={styles.gregorianContainer}>
          <Ionicons name="calendar-outline" size={14} color={THEME.muted} style={{ marginRight: 6 }} />
          <Text style={styles.gregorianDate}>{getFormattedGregorianDate()}</Text>
        </View>
      </View>

      {/* Qibla + 99 Names Quick Section */}
      <View style={styles.quickGrid}>
        <View style={[styles.card, styles.quickCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardHeaderIconContainer, { backgroundColor: THEME.primaryLight }]}>
              <MaterialCommunityIcons name="compass-outline" size={20} color={THEME.primary} />
            </View>
            <Text style={styles.cardTitle}>Qibla Compass</Text>
          </View>
          <Text style={styles.gregorianDate}>Open live Qibla direction based on your selected location.</Text>
          <Link href="/qibla" asChild>
            <Pressable style={[styles.translateBadgeButton, { marginTop: 10, alignSelf: 'flex-start' }]}>
              <MaterialCommunityIcons name="compass" size={14} color={THEME.primary} style={{ marginRight: 4 }} />
              <Text style={styles.translateButtonText}>See Compass</Text>
            </Pressable>
          </Link>
        </View>

        <View style={[styles.card, styles.quickCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardHeaderIconContainer, { backgroundColor: THEME.goldLight }]}>
              <MaterialCommunityIcons name="text-box-multiple-outline" size={20} color={THEME.gold} />
            </View>
            <Text style={styles.cardTitle}>99 Names</Text>
          </View>
          <Text style={styles.gregorianDate}>Choose Name</Text>
          <View style={styles.namesActionRow}>
            <Link href={{ pathname: '/names/[type]', params: { type: 'allah' } }} asChild>
              <Pressable style={[styles.translateBadgeButton, styles.namesButton]}>
                <Text style={[styles.translateButtonText, styles.namesButtonText]}>Allah</Text>
              </Pressable>
            </Link>
            <Link href={{ pathname: '/names/[type]', params: { type: 'muhammad' } }} asChild>
              <Pressable style={[styles.translateBadgeButton, styles.namesButton, { backgroundColor: THEME.goldLight }]}>
                <Text style={[styles.translateButtonText, styles.namesButtonText, { color: THEME.gold }]}>Muhammad</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>

      {/* Daily Reminder (Ayah) Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardHeaderIconContainer, { backgroundColor: THEME.primaryLight }]}>
            <Ionicons name="sparkles-outline" size={20} color={THEME.primary} />
          </View>
          <Text style={styles.cardTitle}>Daily Quranic Verse</Text>
        </View>

        <View style={styles.reminderContent}>
          <FontAwesome6 name="quote-left" size={16} color="rgba(15, 122, 90, 0.12)" style={styles.quoteIcon} />
          <Text style={[
            styles.verseText,
            hasArabic(reminderText) && styles.arabicFont
          ]}>
            {reminderText}
          </Text>
        </View>

        <View style={styles.cardActionRow}>
          <Pressable
            onPress={() => {
              if (reminderTranslated) {
                setReminderTranslated(null);
                setShowReminderLangs(false);
                return;
              }
              setShowReminderLangs((v) => !v);
            }}
            style={({ pressed }) => [styles.translateBadgeButton, pressed && styles.badgePressed]}
          >
            <Ionicons name="language-outline" size={14} color={THEME.primary} style={{ marginRight: 4 }} />
            <Text style={styles.translateButtonText}>
              {translatingReminder ? 'Translating...' : reminderTranslated ? 'Original English' : 'Translate'}
            </Text>
          </Pressable>
        </View>

        {showReminderLangs && !translatingReminder ? (
          <View style={styles.languagesContainer}>
            <Text style={styles.languageSelectLabel}>Translate to:</Text>
            <View style={styles.languagesGrid}>
              {LANG_OPTIONS.map((lang) => (
                <Pressable
                  key={`r-${lang.code}`}
                  onPress={() => onTranslateReminder(lang.code)}
                  style={({ pressed }) => [styles.langPill, pressed && styles.badgePressed]}
                >
                  <Text style={styles.langPillText}>{lang.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      {/* Hadith of the Day Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardHeaderIconContainer, { backgroundColor: THEME.goldLight }]}>
            <MaterialCommunityIcons name="book-open-variant" size={18} color={THEME.gold} />
          </View>
          <Text style={styles.cardTitle}>Hadith of the Day</Text>
        </View>

        <View style={styles.reminderContent}>
          <FontAwesome6 name="quote-left" size={16} color="rgba(197, 155, 39, 0.12)" style={styles.quoteIcon} />
          <Text style={[
            styles.verseText,
            hasArabic(hadithText) && styles.arabicFont
          ]}>
            {hadithText}
          </Text>
        </View>

        <View style={styles.cardActionRow}>
          <Pressable
            onPress={() => {
              if (hadithTranslated) {
                setHadithTranslated(null);
                setShowHadithLangs(false);
                return;
              }
              setShowHadithLangs((v) => !v);
            }}
            style={({ pressed }) => [styles.translateBadgeButton, { backgroundColor: THEME.goldLight }, pressed && styles.badgePressed]}
          >
            <Ionicons name="language-outline" size={14} color={THEME.gold} style={{ marginRight: 4 }} />
            <Text style={[styles.translateButtonText, { color: THEME.gold }]}>
              {translatingHadith ? 'Translating...' : hadithTranslated ? 'Original Arabic/ID' : 'Translate'}
            </Text>
          </Pressable>
        </View>

        {showHadithLangs && !translatingHadith ? (
          <View style={[styles.languagesContainer, { borderColor: THEME.goldBorder }]}>
            <Text style={styles.languageSelectLabel}>Translate to:</Text>
            <View style={styles.languagesGrid}>
              {LANG_OPTIONS.map((lang) => (
                <Pressable
                  key={`h-${lang.code}`}
                  onPress={() => onTranslateHadith(lang.code)}
                  style={({ pressed }) => [styles.langPill, pressed && styles.badgePressed]}
                >
                  <Text style={styles.langPillText}>{lang.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      {/* Daily Duas & Azkar Card — Redesigned */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardHeaderIconContainer, { backgroundColor: THEME.primaryLight }]}>
            <MaterialCommunityIcons name="hands-pray" size={18} color={THEME.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Daily Duas & Azkar</Text>
            <Text style={styles.azkarSubtitle}>Remembrance of Allah</Text>
          </View>
        </View>

        <View style={{ gap: 12, marginTop: 4 }}>
          {(data?.azkar ?? []).map((item: any, idx: number) => {
            const category =
              typeof item === 'string'
                ? item
                : item?.categoryEn ?? item?.category ?? 'Daily Zikr';
            const text =
              typeof item === 'string'
                ? item
                : item?.textAr ?? item?.text ?? '';

            return (
              <View key={`azkar-${idx}`} style={styles.azkarCard}>
                {/* Top Row: index bubble + category tag */}
                <View style={styles.azkarTopRow}>
                  <View style={styles.azkarIndexBubble}>
                    <Text style={styles.azkarIndexText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.azkarCategoryTag}>
                    <MaterialCommunityIcons name="hands-pray" size={11} color={THEME.primary} style={{ marginRight: 4 }} />
                    <Text style={styles.azkarCategoryText}>{category}</Text>
                  </View>
                </View>

                {/* Divider */}
                <View style={styles.azkarInnerDivider} />

                {/* Arabic Text */}
                <Text style={styles.azkarArabicText}>{text}</Text>
              </View>
            );
          })}

          {!(data?.azkar ?? []).length ? (
            <View style={styles.emptyAzkar}>
              <View style={styles.emptyAzkarIcon}>
                <MaterialCommunityIcons name="hands-pray" size={28} color={THEME.primary} />
              </View>
              <Text style={styles.emptyAzkarTitle}>No Azkar Available</Text>
              <Text style={styles.emptyAzkarText}>Pull down to refresh and load today's duas.</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Error banner */}
      {isError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={20} color="#8A1F1F" style={{ marginRight: 8 }} />
          <Text style={styles.errorText}>Could not sync today's data. Pull down to try again.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: THEME.primary,
    fontWeight: '700',
    fontSize: 14,
    fontStyle: 'italic',
  },

  // ─── Quran Poster ───────────────────────────────────────────────────────────
  quranPoster: {
    backgroundColor: THEME.primary,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 20,
    position: 'relative',
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  decorCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    top: -30,
    right: -30,
  },
  decorCircle2: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: 'rgba(197, 155, 39, 0.12)',
    bottom: -40,
    left: -20,
  },
  quranPosterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quranPosterLeft: {
    flex: 1,
    paddingRight: 10,
  },
  quranPosterArabic: {
    fontFamily: 'KFGQPCNastaleeq',
    color: THEME.gold,
    fontSize: 22,
    lineHeight: 36,
    marginBottom: 2,
  },
  quranPosterTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 4,
  },
  quranPosterSub: {
    color: '#E1EBE7',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 14,
    lineHeight: 16,
  },
  readButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.red,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
    flexWrap: 'nowrap',   // ← prevent wrapping
    minWidth: 0,          // ← don't stretch
  },
  readButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.4,
  },
  readButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  quranPosterRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(197, 155, 39, 0.2)',
  },

  // ─── Hijri Card ─────────────────────────────────────────────────────────────
  hijriCard: {
    backgroundColor: THEME.goldLight,
    borderWidth: 1,
    borderColor: THEME.goldBorder,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  hijriDecor: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(197, 155, 39, 0.03)',
    right: -20,
    bottom: -20,
  },
  hijriHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hijriIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FAF2E4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(197, 155, 39, 0.2)',
  },
  hijriLabel: {
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  hijriDate: {
    color: THEME.gold,
    fontWeight: '800',
    fontSize: 18,
    marginTop: 1,
  },
  hijriDivider: {
    height: 1,
    backgroundColor: 'rgba(197, 155, 39, 0.15)',
    marginVertical: 12,
  },
  gregorianContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gregorianDate: {
    color: THEME.muted,
    fontSize: 12,
    fontWeight: '600',
  },

  // ─── Generic Card ───────────────────────────────────────────────────────────
  card: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickCard: {
    flex: 1,
    padding: 14,
  },
  namesActionRow: {
    marginTop: 10,
    flexDirection: 'column',
    gap: 8,
  },
  namesButton: {
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 12,
    borderRadius: 12,
  },
  namesButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  cardHeaderIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: THEME.text,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.3,
    flexShrink: 1,
  },

  // ─── Reminder / Hadith ──────────────────────────────────────────────────────
  reminderContent: {
    position: 'relative',
    paddingLeft: 16,
    paddingRight: 4,
    marginBottom: 12,
  },
  quoteIcon: {
    position: 'absolute',
    left: -4,
    top: -2,
  },
  verseText: {
    color: THEME.text,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  arabicFont: {
    fontFamily: 'KFGQPCNastaleeq',
    fontSize: 22,
    lineHeight: 38,
    textAlign: 'right',
    color: THEME.primaryDark,
  },
  cardActionRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(230, 224, 213, 0.6)',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  translateBadgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primaryLight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  translateButtonText: {
    color: THEME.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  badgePressed: {
    opacity: 0.75,
  },
  languagesContainer: {
    marginTop: 12,
    backgroundColor: '#FAF9F6',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(230, 224, 213, 0.8)',
  },
  languageSelectLabel: {
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  languagesGrid: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  langPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: THEME.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  langPillText: {
    color: THEME.text,
    fontSize: 11,
    fontWeight: '700',
  },

  // ─── Azkar Redesign ─────────────────────────────────────────────────────────
  azkarSubtitle: {
    color: THEME.muted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
    letterSpacing: 0.3,
  },
  azkarCard: {
    backgroundColor: THEME.primaryLight,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(15, 122, 90, 0.12)',
  },
  azkarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  azkarIndexBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  azkarIndexText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  azkarCategoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(15, 122, 90, 0.15)',
  },
  azkarCategoryText: {
    color: THEME.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  azkarInnerDivider: {
    height: 1,
    backgroundColor: 'rgba(15, 122, 90, 0.1)',
    marginBottom: 10,
  },
  azkarArabicText: {
    fontFamily: 'KFGQPCNastaleeq',
    color: THEME.primaryDark,
    fontSize: 22,
    lineHeight: 38,
    textAlign: 'right',
  },
  emptyAzkar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  emptyAzkarIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyAzkarTitle: {
    color: THEME.text,
    fontWeight: '700',
    fontSize: 14,
  },
  emptyAzkarText: {
    color: THEME.muted,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // ─── Error Banner ───────────────────────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF2F2',
    borderColor: '#F5D3D3',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginVertical: 4,
  },
  errorText: {
    color: '#8A1F1F',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { Link, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { EightPointStar, GeometricDivider, StarFieldWatermark } from '@/components/IslamicMotifs';
import { FadeInView, PressableScale } from '@/components/Anim';
import { OrnateCard, SectionHeader } from '@/components/ui';
import { getUiPreferences, uiPreferenceDefaults } from '@/utils/preferences';
import { playManagedAudio } from '@/services/audioManager';
import { schedulePrayerAdhan } from '@/services/prayerNotificationService';

type SavedLocation = {
  mode: 'coords' | 'city';
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  locked: boolean;
};

const LOCATION_KEY = 'timings_location_v1';
const ADHAN_KEY = 'adhan_file_path_v1';
const PLAYED_KEY = 'played_prayer_mark_v1';
const ADHAN_URL = 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Beautiful_adhan.ogg';
const TIMINGS_CACHE_PREFIX = 'timings_cache_v1_';

const PRAYER_KEYS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayApiDate(d = new Date()) {
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function normalizeTime(raw: string) {
  return (raw || '').slice(0, 5);
}

function parsePrayerDate(timeHHmm: string, day = new Date()) {
  const [h, m] = timeHHmm.split(':').map(Number);
  const d = new Date(day);
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function getCountdownText(target: Date, now = new Date()) {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return 'Now';
  const totalMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours <= 0) return `${mins}m left`;
  return `${hours}h ${mins}m left`;
}

function formatTimeDisplay(value: string, use24HourTime: boolean) {
  if (!value || value === '--:--') return '--:--';
  if (use24HourTime) return value;
  const [hRaw, mRaw] = value.split(':');
  const hours = Number(hRaw);
  const mins = Number(mRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return value;
  const period = hours >= 12 ? 'PM' : 'AM';
  const converted = hours % 12 || 12;
  return `${converted}:${String(mins).padStart(2, '0')} ${period}`;
}

function formatGregorianLabel(gregorian?: any) {
  if (!gregorian) return '';
  const day = gregorian.day ?? '';
  const month = gregorian.month?.en ?? '';
  const year = gregorian.year ?? '';
  return `${day} ${month} ${year}`.trim();
}

async function getSavedLocation() {
  const raw = await AsyncStorage.getItem(LOCATION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedLocation;
  } catch {
    return null;
  }
}

async function saveLocation(loc: SavedLocation) {
  await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
}

function getLocationCacheKey(loc: SavedLocation) {
  if (loc.mode === 'coords' && loc.latitude && loc.longitude) {
    return `coords_${loc.latitude.toFixed(4)}_${loc.longitude.toFixed(4)}`;
  }
  return `city_${(loc.city || '').toLowerCase()}_${(loc.country || '').toLowerCase()}`;
}

async function ensureAdhanFile() {
  const existing = await AsyncStorage.getItem(ADHAN_KEY);
  if (existing) {
    const info = await FileSystem.getInfoAsync(existing);
    if (info.exists) return existing;
  }

  const dir = `${FileSystem.documentDirectory}audio/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const target = `${dir}adhan.ogg`;
  const info = await FileSystem.getInfoAsync(target);
  if (!info.exists) {
    await FileSystem.downloadAsync(ADHAN_URL, target);
  }
  await AsyncStorage.setItem(ADHAN_KEY, target);
  return target;
}

async function playAdhan() {
  const uri = await ensureAdhanFile();
  await playManagedAudio({ uri });
}

export default function TimingsScreen() {
  const insets = useSafeAreaInsets();
  const [locationLoading, setLocationLoading] = useState(true);
  const [location, setLocation] = useState<SavedLocation | null>(null);
  const [manualCity, setManualCity] = useState('');
  const [manualCountry, setManualCountry] = useState('Pakistan');
  const [showLocationEditor, setShowLocationEditor] = useState(false);
  const [todayDateKey, setTodayDateKey] = useState(todayKey());
  const [use24HourTime, setUse24HourTime] = useState(uiPreferenceDefaults.use24HourTime);
  const [nowTick, setNowTick] = useState(Date.now());

  const [calendarMonth, setCalendarMonth] = useState(1);
  const [calendarYear, setCalendarYear] = useState(1447);
  const [calendarInitialized, setCalendarInitialized] = useState(false);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const tick = setInterval(() => {
      const next = todayKey();
      setTodayDateKey((prev) => (prev === next ? prev : next));
      setNowTick(Date.now());
    }, 60 * 1000);
    return () => clearInterval(tick);
  }, []);

  useFocusEffect(
    useCallback(() => {
      getUiPreferences()
        .then((prefs) => setUse24HourTime(prefs.use24HourTime))
        .catch(() => undefined);
      return () => undefined;
    }, [])
  );

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        await ensureAdhanFile();
      } catch {
        // non-fatal
      }

      const saved = await getSavedLocation();
      if (saved) {
        if (!mounted) return;
        setLocation(saved);
        setLocationLoading(false);
        return;
      }

      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          const geo = await Location.reverseGeocodeAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
          const city = geo?.[0]?.city || geo?.[0]?.subregion || 'Unknown City';
          const country = geo?.[0]?.country || 'Unknown Country';
          const autoLoc: SavedLocation = {
            mode: 'coords',
            city,
            country,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            locked: true
          };
          await saveLocation(autoLoc);
          if (!mounted) return;
          setLocation(autoLoc);
        } else if (saved) {
          if (!mounted) return;
          setLocation(saved);
        }
      } catch {
        if (saved && mounted) setLocation(saved);
      } finally {
        if (mounted) setLocationLoading(false);
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  const timingsQuery = useQuery({
    queryKey: ['prayer-timings', location?.mode, location?.city, location?.country, location?.latitude, location?.longitude, todayDateKey],
    enabled: !!location,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      if (!location) return null;
      const date = todayApiDate();
      const cacheKey = `${TIMINGS_CACHE_PREFIX}${todayKey()}_${getLocationCacheKey(location)}`;
      let url = '';

      if (location.mode === 'coords' && location.latitude && location.longitude) {
        url = `https://api.aladhan.com/v1/timings/${date}?latitude=${location.latitude}&longitude=${location.longitude}&method=2`;
      } else {
        url = `https://api.aladhan.com/v1/timingsByCity/${date}?city=${encodeURIComponent(location.city)}&country=${encodeURIComponent(location.country)}&method=2`;
      }
      try {
        const res = await fetch(url);
        const json = await res.json();
        const timings = json?.data?.timings || {};
        const payload = {
          fajr: normalizeTime(timings.Fajr),
          dhuhr: normalizeTime(timings.Dhuhr),
          asr: normalizeTime(timings.Asr),
          maghrib: normalizeTime(timings.Maghrib),
          isha: normalizeTime(timings.Isha),
          hijriReadable:
            `${json?.data?.date?.hijri?.day ?? ''} ${json?.data?.date?.hijri?.month?.en ?? ''} ${json?.data?.date?.hijri?.year ?? ''} AH`.trim(),
          gregorianReadable: formatGregorianLabel(json?.data?.date?.gregorian),
          hijriDay: json?.data?.date?.hijri?.day ?? null,
          hijriMonthName: json?.data?.date?.hijri?.month?.en ?? null,
          hijriMonthNumber: Number(json?.data?.date?.hijri?.month?.number),
          hijriYear: Number(json?.data?.date?.hijri?.year),
        };
        await AsyncStorage.setItem(cacheKey, JSON.stringify(payload));
        return payload;
      } catch {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          try {
            return JSON.parse(cached);
          } catch {
            await AsyncStorage.removeItem(cacheKey);
          }
        }
        throw new Error('Unable to load prayer timings.');
      }
    }
  });

  const todayHijriQuery = useQuery({
    queryKey: ['today-hijri-date', todayDateKey],
    queryFn: async () => {
      const res = await fetch(`https://api.aladhan.com/v1/gToH?date=${todayApiDate()}`);
      const json = await res.json();
      return json?.data ?? null;
    }
  });

  useEffect(() => {
    if (calendarInitialized) return;
    const hijri = timingsQuery.data?.hijriMonthNumber
      ? {
          month: timingsQuery.data.hijriMonthNumber,
          year: timingsQuery.data.hijriYear,
        }
      : todayHijriQuery.data?.hijri
        ? {
            month: Number(todayHijriQuery.data.hijri?.month?.number),
            year: Number(todayHijriQuery.data.hijri?.year),
          }
        : null;

    if (!hijri || !Number.isFinite(hijri.month) || !Number.isFinite(hijri.year)) return;
    setCalendarMonth(hijri.month);
    setCalendarYear(hijri.year);
    setCalendarInitialized(true);
  }, [
    calendarInitialized,
    timingsQuery.data?.hijriMonthNumber,
    timingsQuery.data?.hijriYear,
    todayHijriQuery.data,
  ]);

  const monthCalendarQuery = useQuery({
    queryKey: ['hijri-calendar', calendarMonth, calendarYear],
    enabled: calendarInitialized,
    queryFn: async () => {
      const res = await fetch(`https://api.aladhan.com/v1/hToGCalendar/${calendarMonth}/${calendarYear}`);
      const json = await res.json();
      return json?.data ?? [];
    }
  });

  useEffect(() => {
    if (!timingsQuery.data) return;
    const timings = timingsQuery.data;

    const runCheck = async () => {
      const nowDate = new Date();
      const dateK = todayKey(nowDate);
      const raw = await AsyncStorage.getItem(PLAYED_KEY);
      const playedMap = raw ? JSON.parse(raw) : {};
      playedMap[dateK] = playedMap[dateK] || {};

      const prayerMap: Record<string, string> = {
        Fajr: timings.fajr,
        Dhuhr: timings.dhuhr,
        Asr: timings.asr,
        Maghrib: timings.maghrib,
        Isha: timings.isha
      };

      for (const prayer of PRAYER_KEYS) {
        const t = prayerMap[prayer];
        if (!t) continue;
        const target = parsePrayerDate(t, nowDate);
        const diff = Math.abs(nowDate.getTime() - target.getTime());
        if (diff <= 20_000 && !playedMap[dateK][prayer]) {
          playedMap[dateK][prayer] = true;
          await AsyncStorage.setItem(PLAYED_KEY, JSON.stringify(playedMap));
          await playAdhan();
        }
      }
    };

    runCheck().catch(() => undefined);
    timerRef.current = setInterval(() => {
      runCheck().catch(() => undefined);
    }, 10_000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timingsQuery.data]);

  useEffect(() => {
    if (!timingsQuery.data || !location) return;
    const data = timingsQuery.data;
    schedulePrayerAdhan(location).catch(() => undefined);
  }, [timingsQuery.data, location?.city, location?.country, location?.latitude, location?.longitude, location?.mode]);

  const hijriCells = useMemo(() => {
    const rows = monthCalendarQuery.data || [];
    if (!rows.length) return [];

    const first = rows[0]?.gregorian?.weekday?.en || 'Monday';
    const weekOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const startIndex = Math.max(0, weekOrder.indexOf(first));

    const cells: any[] = [];
    for (let i = 0; i < startIndex; i += 1) cells.push(null);
    for (const d of rows) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthCalendarQuery.data]);

  const saveManualLocation = async () => {
    if (!manualCity.trim()) return;
    const loc: SavedLocation = {
      mode: 'city',
      city: manualCity.trim(),
      country: manualCountry.trim() || 'Pakistan',
      locked: true
    };
    await saveLocation(loc);
    setLocation(loc);
    setShowLocationEditor(false);
  };

  const useCurrentLocationAndLock = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({});
    const geo = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    const city = geo?.[0]?.city || geo?.[0]?.subregion || 'Unknown City';
    const country = geo?.[0]?.country || 'Unknown Country';
    const loc: SavedLocation = {
      mode: 'coords',
      city,
      country,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      locked: true
    };
    await saveLocation(loc);
    setLocation(loc);
    setShowLocationEditor(false);
  };

  const prayerRows = [
    { label: 'Fajr', value: formatTimeDisplay(timingsQuery.data?.fajr || '--:--', use24HourTime) },
    { label: 'Dhuhr', value: formatTimeDisplay(timingsQuery.data?.dhuhr || '--:--', use24HourTime) },
    { label: 'Asr', value: formatTimeDisplay(timingsQuery.data?.asr || '--:--', use24HourTime) },
    { label: 'Maghrib', value: formatTimeDisplay(timingsQuery.data?.maghrib || '--:--', use24HourTime) },
    { label: 'Isha', value: formatTimeDisplay(timingsQuery.data?.isha || '--:--', use24HourTime) }
  ];

  const nextPrayer = useMemo(() => {
    if (!timingsQuery.data) return null;
    const nowDate = new Date();
    const entries = [
      { label: 'Fajr', value: timingsQuery.data.fajr },
      { label: 'Dhuhr', value: timingsQuery.data.dhuhr },
      { label: 'Asr', value: timingsQuery.data.asr },
      { label: 'Maghrib', value: timingsQuery.data.maghrib },
      { label: 'Isha', value: timingsQuery.data.isha },
    ];

    for (const entry of entries) {
      if (!entry.value || entry.value === '--:--') continue;
      const prayerDate = parsePrayerDate(entry.value, nowDate);
      if (prayerDate.getTime() >= nowDate.getTime()) {
        return { ...entry, countdown: getCountdownText(prayerDate, nowDate) };
      }
    }

    const tomorrowFajr = parsePrayerDate(entries[0].value, new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + 1));
    return { ...entries[0], countdown: getCountdownText(tomorrowFajr, nowDate) };
  }, [timingsQuery.data, nowTick]);

  const todayGregorianDate = todayApiDate();
  const currentHijri = timingsQuery.data?.hijriReadable ?? (
    todayHijriQuery.data?.hijri
      ? `${todayHijriQuery.data.hijri.day ?? ''} ${todayHijriQuery.data.hijri.month?.en ?? ''} ${todayHijriQuery.data.hijri.year ?? ''} AH`.trim()
      : 'Hijri date'
  );
  const currentGregorian = timingsQuery.data?.gregorianReadable ?? formatGregorianLabel(todayHijriQuery.data?.gregorian);
  const calendarRows = monthCalendarQuery.data || [];
  const calendarMonthName =
    calendarRows.find((row: any) => row?.hijri?.month?.en)?.hijri?.month?.en ??
    timingsQuery.data?.hijriMonthName ??
    todayHijriQuery.data?.hijri?.month?.en ??
    'Islamic Month';
  const calendarGregorianSpan = calendarRows.length
    ? `${formatGregorianLabel(calendarRows[0]?.gregorian)} - ${formatGregorianLabel(calendarRows[calendarRows.length - 1]?.gregorian)}`
    : 'Loading Gregorian range';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.container, { paddingTop: Math.max(insets.top + 14, 22) }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ───── Next Prayer Hero ───── */}
      <FadeInView index={0}>
        <View style={styles.hero}>
          <StarFieldWatermark rows={3} cols={6} starSize={18} color="rgba(255,255,255,0.05)" />
          <View style={styles.heroGoldTop} />
          <View style={styles.heroTopRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="mosque" size={22} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Prayer Timings</Text>
              <Text style={styles.heroStatus}>
                {timingsQuery.isFetching ? 'Updating timings...' : currentHijri}
              </Text>
            </View>
            <Link href="/qibla" asChild>
              <PressableScale style={styles.qiblaLinkButton}>
                <MaterialCommunityIcons name="compass-outline" size={14} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.qiblaLinkText}>Qibla</Text>
              </PressableScale>
            </Link>
          </View>

          {nextPrayer ? (
            <View style={styles.nextPrayerPill}>
              <View style={styles.nextPrayerGlow} />
              <View>
                <Text style={styles.nextPrayerLabel}>NEXT PRAYER</Text>
                <Text style={styles.nextPrayerName}>
                  {nextPrayer.label} - {formatTimeDisplay(nextPrayer.value, use24HourTime)}
                </Text>
              </View>
              <View style={styles.countdownBadge}>
                <Text style={styles.countdownText}>{nextPrayer.countdown}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.dateChips}>
            <View style={styles.dateChip}>
              <Text style={styles.dateChipLabel}>ISLAMIC DATE</Text>
              <Text style={styles.dateChipValue} numberOfLines={1}>{currentHijri}</Text>
            </View>
            <View style={styles.dateChip}>
              <Text style={styles.dateChipLabel}>EARTH CALENDAR</Text>
              <Text style={styles.dateChipValue} numberOfLines={1}>{currentGregorian || todayDateKey}</Text>
            </View>
          </View>

        </View>
      </FadeInView>

      {/* ───── Location ───── */}
      <OrnateCard index={1}>
        <SectionHeader
          title="Location"
          icon={<Ionicons name="location" size={18} color={colors.primary} />}
        />
        <Text style={styles.locationText}>
          {locationLoading ? 'Detecting location...' : `${location?.city || 'Unknown'}, ${location?.country || ''}`}
        </Text>
        <Text style={styles.locationSubText}>
          {location?.locked ? 'Location is locked to your selection.' : 'Auto-location is active.'}
        </Text>

        <PressableScale onPress={() => setShowLocationEditor((v) => !v)} style={styles.linkButton}>
          <Ionicons name="create-outline" size={14} color={colors.primary} style={{ marginRight: 5 }} />
          <Text style={styles.linkButtonText}>{showLocationEditor ? 'Hide Options' : 'Change Location'}</Text>
        </PressableScale>

        {showLocationEditor ? (
          <View style={styles.editorWrap}>
            <TextInput
              value={manualCity}
              onChangeText={setManualCity}
              placeholder="City (e.g., Dunyapur)"
              placeholderTextColor={colors.faint}
              style={styles.input}
            />
            <TextInput
              value={manualCountry}
              onChangeText={setManualCountry}
              placeholder="Country (e.g., Pakistan)"
              placeholderTextColor={colors.faint}
              style={styles.input}
            />
            <View style={styles.editorActions}>
              <PressableScale onPress={saveManualLocation} style={[styles.actionButton, styles.primaryButton]}>
                <Text style={styles.actionButtonText}>Save Manual</Text>
              </PressableScale>
              <PressableScale onPress={useCurrentLocationAndLock} style={[styles.actionButton, styles.secondaryButton]}>
                <Text style={styles.actionButtonText}>Use Current</Text>
              </PressableScale>
            </View>
          </View>
        ) : null}
      </OrnateCard>

      {/* ───── Prayer Times ───── */}
      <OrnateCard index={2}>
        <SectionHeader
          title="Prayer Times"
          subtitle="Today's schedule"
          icon={<Ionicons name="time" size={18} color={colors.primary} />}
        />
        <View style={styles.prayerList}>
          {prayerRows.map((p) => {
            const active = nextPrayer?.label === p.label;
            return (
              <View key={p.label} style={[styles.prayerRow, active && styles.prayerRowActive]}>
                <View style={styles.prayerLeft}>
                  <EightPointStar size={14} color={active ? colors.gold : colors.primaryTint} filled={active} />
                  <Text style={[styles.prayerLabel, active && styles.prayerLabelActive]}>{p.label}</Text>
                </View>
                <Text style={[styles.prayerValue, active && styles.prayerValueActive]}>{p.value}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.adhanNoteWrap}>
          <Ionicons name="volume-medium-outline" size={14} color={colors.muted} style={{ marginRight: 6, marginTop: 1 }} />
          <Text style={styles.adhanNote}>
            Adhan plays at the exact prayer minute while the app is running. Audio is saved on first launch.
          </Text>
        </View>
      </OrnateCard>

      {/* ───── Hijri Calendar ───── */}
      <OrnateCard index={3}>
        <SectionHeader
          title="Hijri Calendar"
          icon={<MaterialCommunityIcons name="calendar-month" size={18} color={colors.primary} />}
        />
        <View style={styles.calendarHeaderBand}>
          <StarFieldWatermark rows={2} cols={5} starSize={14} color="rgba(11,107,79,0.055)" />
          <View style={styles.calendarTopRow}>
            <PressableScale
              onPress={() => {
                if (calendarMonth === 1) {
                  setCalendarMonth(12);
                  setCalendarYear((y) => y - 1);
                } else {
                  setCalendarMonth((m) => m - 1);
                }
              }}
              style={styles.calendarNavButton}
            >
              <Ionicons name="chevron-back" size={16} color={colors.primary} />
            </PressableScale>
            <View style={styles.calendarTitleWrap}>
              <Text style={styles.calendarEyebrow}>ISLAMIC MONTH</Text>
              <Text style={styles.calendarMonthText}>{calendarMonthName}</Text>
              <Text style={styles.calendarYearText}>{calendarYear} AH</Text>
            </View>
            <PressableScale
              onPress={() => {
                if (calendarMonth === 12) {
                  setCalendarMonth(1);
                  setCalendarYear((y) => y + 1);
                } else {
                  setCalendarMonth((m) => m + 1);
                }
              }}
              style={styles.calendarNavButton}
            >
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </PressableScale>
          </View>
          <View style={styles.calendarMetaRow}>
            <View style={styles.calendarMetaPill}>
              <MaterialCommunityIcons name="star-crescent" size={13} color={colors.goldDeep} />
              <Text style={styles.calendarMetaText} numberOfLines={1}>{currentHijri}</Text>
            </View>
            <View style={styles.calendarMetaPill}>
              <Ionicons name="calendar-outline" size={13} color={colors.primary} />
              <Text style={styles.calendarMetaText} numberOfLines={1}>{calendarGregorianSpan}</Text>
            </View>
          </View>
        </View>

        <View style={styles.calendarWeekdays}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <Text key={d} style={styles.weekdayText}>{d}</Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {hijriCells.map((cell, idx) => {
            const isToday = cell && cell.gregorian?.date === todayGregorianDate;
            return (
              <View key={`c-${idx}`} style={styles.calendarCellWrap}>
                <View style={[styles.calendarCell, isToday && styles.calendarCellToday]}>
                  {cell ? (
                    <>
                      {isToday ? <Text style={styles.todayBadge}>TODAY</Text> : null}
                      <Text style={[styles.hijriDay, isToday && styles.hijriDayToday]}>
                        {cell.hijri?.day}
                      </Text>
                      <Text style={[styles.gregorianDay, isToday && styles.gregorianDayToday]} numberOfLines={1}>
                        {cell.gregorian?.day} {cell.gregorian?.month?.en?.slice(0, 3)}
                      </Text>
                    </>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </OrnateCard>

      <View style={styles.bottomStar}>
        <GeometricDivider color={colors.goldBorder} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    padding: 16,
    gap: 16,
    paddingBottom: 110,
  },

  // Hero
  hero: {
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    overflow: 'hidden',
    ...shadow.raised,
  },
  heroGoldTop: {
    position: 'absolute', top: 0, left: '20%', right: '20%', height: 2,
    backgroundColor: colors.gold, opacity: 0.45,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(197,155,39,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 19,
    fontFamily: fonts.serif,
  },
  heroStatus: {
    color: colors.onDarkMuted,
    marginTop: 3,
    fontWeight: '600',
    fontSize: 12,
  },
  qiblaLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  qiblaLinkText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  nextPrayerPill: {
    marginTop: 16,
    backgroundColor: 'rgba(197,155,39,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(197,155,39,0.3)',
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  nextPrayerGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(197,155,39,0.12)',
    right: -30,
    top: -30,
  },
  nextPrayerLabel: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  nextPrayerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 3,
  },
  countdownBadge: {
    backgroundColor: colors.gold,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  countdownText: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: '800',
  },
  dateChips: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  dateChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dateChipLabel: {
    color: colors.gold,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  dateChipValue: {
    color: '#fff',
    fontSize: 12.5,
    fontWeight: '800',
    marginTop: 4,
  },

  // Location
  locationText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  locationSubText: {
    color: colors.muted,
    marginTop: 4,
    fontSize: 12.5,
  },
  linkButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  linkButtonText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12.5,
  },
  editorWrap: {
    marginTop: 12,
    gap: 10,
  },
  input: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
  },
  editorActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.gold,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },

  // Prayer list
  prayerList: {
    gap: 8,
  },
  prayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  prayerRowActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryTint,
  },
  prayerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prayerLabel: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  prayerLabelActive: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  prayerValue: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 15,
  },
  prayerValueActive: {
    color: colors.primaryDark,
  },
  adhanNoteWrap: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  adhanNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },

  // Calendar
  calendarHeaderBand: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    borderRadius: radius.lg,
    padding: 14,
    overflow: 'hidden',
  },
  calendarTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarNavButton: {
    backgroundColor: colors.card,
    borderRadius: 12,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryTint,
  },
  calendarEyebrow: {
    color: colors.goldDeep,
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1,
  },
  calendarMonthText: {
    color: colors.primaryDark,
    fontWeight: '900',
    fontSize: 20,
    fontFamily: fonts.serif,
    textAlign: 'center',
    marginTop: 2,
  },
  calendarTitleWrap: {
    flex: 1,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  calendarYearText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  calendarMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  calendarMetaPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  calendarMetaText: {
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: '800',
    flex: 1,
  },
  calendarWeekdays: {
    flexDirection: 'row',
    marginTop: 16,
    paddingHorizontal: 2,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    color: colors.goldDeep,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 7,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 4,
  },
  calendarCellWrap: {
    width: '14.2857%',
    padding: 2.5,
  },
  calendarCell: {
    backgroundColor: colors.card,
    borderRadius: 10,
    minHeight: 62,
    padding: 5,
    borderWidth: 1,
    borderColor: 'rgba(230,222,203,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCellToday: {
    backgroundColor: colors.primaryDeep,
    borderColor: colors.primaryDark,
    ...shadow.soft,
  },
  gregorianDay: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 9,
    marginTop: 3,
  },
  gregorianDayToday: {
    color: colors.onDarkMuted,
  },
  hijriDay: {
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  hijriDayToday: {
    color: colors.gold,
    fontWeight: '900',
  },
  todayBadge: {
    color: colors.gold,
    fontSize: 6.5,
    fontWeight: '900',
    letterSpacing: 0.2,
    marginBottom: 2,
    includeFontPadding: false,
    width: '100%',
    textAlign: 'center',
  },

  bottomStar: {
    paddingVertical: 8,
    alignItems: 'center',
  },
});

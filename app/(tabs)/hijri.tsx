import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { getUiPreferences, uiPreferenceDefaults } from '@/utils/preferences';
import { playManagedAudio } from '@/services/audioManager';
import { schedulePrayerNotificationsForToday } from '@/services/prayerNotificationService';

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
const KAABA_LAT = 21.4225;
const KAABA_LON = 39.8262;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number) {
  return (rad * 180) / Math.PI;
}

function calculateQiblaBearing(lat: number, lon: number) {
  const lat1 = toRadians(lat);
  const lon1 = toRadians(lon);
  const lat2 = toRadians(KAABA_LAT);
  const lon2 = toRadians(KAABA_LON);
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon);
  const x = Math.cos(lat1) * Math.tan(lat2) - Math.sin(lat1) * Math.cos(dLon);
  const brng = toDegrees(Math.atan2(y, x));
  return (brng + 360) % 360;
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
  const [showQibla, setShowQibla] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);
  const [qiblaCoords, setQiblaCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());

  const now = new Date();
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth() + 1);
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const tick = setInterval(() => {
      const next = todayKey();
      setTodayDateKey((prev) => (prev === next ? prev : next));
      setNowTick(Date.now());
    }, 60 * 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!showQibla) return;
    let sub: { remove: () => void } | null = null;
    Location.watchHeadingAsync((h) => {
      const value = typeof h.trueHeading === 'number' && h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
      setHeading(value);
    })
      .then((s) => {
        sub = s;
      })
      .catch(() => undefined);
    return () => {
      if (sub) sub.remove();
    };
  }, [showQibla]);

  useEffect(() => {
    let mounted = true;
    const resolveCoords = async () => {
      if (!location) return;
      if (location.mode === 'coords' && location.latitude && location.longitude) {
        if (mounted) setQiblaCoords({ lat: location.latitude, lon: location.longitude });
        return;
      }
      try {
        const results = await Location.geocodeAsync(`${location.city}, ${location.country}`);
        if (!results?.length) return;
        if (mounted) setQiblaCoords({ lat: results[0].latitude, lon: results[0].longitude });
      } catch {
        // ignore
      }
    };
    resolveCoords();
    return () => {
      mounted = false;
    };
  }, [location?.city, location?.country, location?.mode, location?.latitude, location?.longitude]);

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
      const date = `${pad(new Date().getDate())}-${pad(new Date().getMonth() + 1)}-${new Date().getFullYear()}`;
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
            `${json?.data?.date?.hijri?.day ?? ''} ${json?.data?.date?.hijri?.month?.en ?? ''} ${json?.data?.date?.hijri?.year ?? ''} AH`.trim()
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

  const monthCalendarQuery = useQuery({
    queryKey: ['hijri-calendar', calendarMonth, calendarYear],
    queryFn: async () => {
      const res = await fetch(`https://api.aladhan.com/v1/gToHCalendar/${calendarMonth}/${calendarYear}`);
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
    schedulePrayerNotificationsForToday([
      { label: 'Fajr', time: data.fajr },
      { label: 'Dhuhr', time: data.dhuhr },
      { label: 'Asr', time: data.asr },
      { label: 'Maghrib', time: data.maghrib },
      { label: 'Isha', time: data.isha },
    ]).catch(() => undefined);
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

  const todayGregorianDay = String(new Date().getDate());
  const qiblaBearing = qiblaCoords ? calculateQiblaBearing(qiblaCoords.lat, qiblaCoords.lon) : null;
  const qiblaNeedleRotation = qiblaBearing !== null && heading !== null ? qiblaBearing - heading : 0;
  const qiblaDelta =
    qiblaBearing !== null && heading !== null ? ((qiblaBearing - heading + 540) % 360) - 180 : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.container, { paddingTop: Math.max(insets.top + 18, 24) }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <View style={styles.heroDecorOne} />
        <View style={styles.heroDecorTwo} />
        <View style={styles.heroTopRow}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="clock-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Prayer Timings</Text>
            <Text style={styles.heroStatus}>
              {timingsQuery.isFetching ? 'Updating timings...' : `Hijri: ${timingsQuery.data?.hijriReadable || '--'}`}
            </Text>
            <Pressable onPress={() => setShowQibla((v) => !v)} style={styles.qiblaLinkButton}>
              <Text style={styles.qiblaLinkText}>{showQibla ? 'Hide Qibla' : 'See Qibla'}</Text>
            </Pressable>
          </View>
        </View>
        {showQibla ? (
          <View style={styles.qiblaCard}>
            <Text style={styles.qiblaTitle}>Qibla Compass</Text>
            <Text style={styles.qiblaSubText}>
              {qiblaBearing === null ? 'Qibla needs a valid location.' : `Qibla: ${Math.round(qiblaBearing)}°`}
            </Text>
            <Text style={styles.qiblaSubText}>
              {heading === null ? 'Calibrating compass...' : `Heading: ${Math.round(heading)}°`}
            </Text>
            <View style={styles.qiblaDial}>
              <Text style={styles.qiblaNorth}>N</Text>
              <View style={styles.qiblaBaseNeedle} />
              <View style={[styles.qiblaNeedle, { transform: [{ rotate: `${qiblaNeedleRotation}deg` }] }]} />
            </View>
            <Text style={styles.qiblaHint}>
              {qiblaDelta === null
                ? 'Move phone in 8-shape for compass lock.'
                : Math.abs(qiblaDelta) <= 5
                  ? 'Facing Qibla'
                  : qiblaDelta > 0
                    ? `Turn right ${Math.round(Math.abs(qiblaDelta))}°`
                    : `Turn left ${Math.round(Math.abs(qiblaDelta))}°`}
            </Text>
          </View>
        ) : null}
        {nextPrayer ? (
          <View style={styles.nextPrayerPill}>
            <View>
              <Text style={styles.nextPrayerLabel}>Next Prayer</Text>
              <Text style={styles.nextPrayerName}>
                {nextPrayer.label} | {formatTimeDisplay(nextPrayer.value, use24HourTime)}
              </Text>
            </View>
            <Text style={styles.nextPrayerCountdown}>{nextPrayer.countdown}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="location-outline" size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Location</Text>
        </View>
        <Text style={styles.locationText}>
          {locationLoading ? 'Detecting location...' : `Location: ${location?.city || 'Unknown'}, ${location?.country || ''}`}
        </Text>
        <Text style={styles.locationSubText}>
          {location?.locked ? 'Location is locked to your selection.' : 'Auto-location is active.'}
        </Text>

        <Pressable onPress={() => setShowLocationEditor((v) => !v)} style={styles.linkButton}>
          <Text style={styles.linkButtonText}>{showLocationEditor ? 'Hide Location Options' : 'Change Location'}</Text>
        </Pressable>

        {showLocationEditor ? (
          <View style={styles.editorWrap}>
            <TextInput
              value={manualCity}
              onChangeText={setManualCity}
              placeholder="City (e.g., Dunyapur)"
              placeholderTextColor="#8C9A94"
              style={styles.input}
            />
            <TextInput
              value={manualCountry}
              onChangeText={setManualCountry}
              placeholder="Country (e.g., Pakistan)"
              placeholderTextColor="#8C9A94"
              style={styles.input}
            />
            <View style={styles.editorActions}>
              <Pressable onPress={saveManualLocation} style={[styles.actionButton, styles.primaryButton]}>
                <Text style={styles.actionButtonText}>Save Manual</Text>
              </Pressable>
              <Pressable onPress={useCurrentLocationAndLock} style={[styles.actionButton, styles.secondaryButton]}>
                <Text style={styles.actionButtonText}>Use Current</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="time-outline" size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Prayer Times</Text>
        </View>
        <View style={styles.prayerList}>
          {prayerRows.map((p) => (
            <View
              key={p.label}
              style={[
                styles.prayerRow,
                nextPrayer?.label === p.label && styles.prayerRowActive,
              ]}
            >
              <Text style={styles.prayerLabel}>{p.label}</Text>
              <Text
                style={[
                  styles.prayerValue,
                  nextPrayer?.label === p.label && styles.prayerValueActive,
                ]}
              >
                {p.value}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.adhanNote}>
          Adhan plays at exact prayer minute while app is running. Adhan audio is downloaded and saved on first launch.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="calendar-month-outline" size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Hijri Calendar</Text>
        </View>
        <View style={styles.calendarTopRow}>
          <Pressable
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
            <Text style={styles.calendarNavText}>Prev</Text>
          </Pressable>
          <Text style={styles.calendarMonthText}>{pad(calendarMonth)}/{calendarYear}</Text>
          <Pressable
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
            <Text style={styles.calendarNavText}>Next</Text>
          </Pressable>
        </View>

        <View style={styles.calendarWeekdays}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <Text key={d} style={styles.weekdayText}>{d}</Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {hijriCells.map((cell, idx) => (
            <View key={`c-${idx}`} style={styles.calendarCellWrap}>
              <View
                style={[
                  styles.calendarCell,
                  cell &&
                  calendarMonth === new Date().getMonth() + 1 &&
                  calendarYear === new Date().getFullYear() &&
                  String(cell.gregorian?.day) === todayGregorianDay
                    ? styles.calendarCellToday
                    : null,
                ]}
              >
                {cell ? (
                  <>
                    <Text
                      style={[
                        styles.gregorianDay,
                        calendarMonth === new Date().getMonth() + 1 &&
                        calendarYear === new Date().getFullYear() &&
                        String(cell.gregorian?.day) === todayGregorianDay
                          ? styles.gregorianDayToday
                          : null,
                      ]}
                    >
                      {cell.gregorian?.day}
                    </Text>
                    <Text
                      style={[
                        styles.hijriDay,
                        calendarMonth === new Date().getMonth() + 1 &&
                        calendarYear === new Date().getFullYear() &&
                        String(cell.gregorian?.day) === todayGregorianDay
                          ? styles.hijriDayToday
                          : null,
                      ]}
                    >
                      {cell.hijri?.day}
                    </Text>
                  </>
                ) : null}
              </View>
            </View>
          ))}
        </View>
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
    gap: 12,
    paddingBottom: 24,
  },
  heroCard: {
    backgroundColor: '#0F7A5A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#0B5F46',
    overflow: 'hidden',
  },
  heroDecorOne: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -45,
    right: -25,
  },
  heroDecorTwo: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -30,
    left: -20,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  heroStatus: {
    color: 'rgba(255,255,255,0.88)',
    marginTop: 2,
    fontWeight: '600',
    fontSize: 12,
  },
  qiblaLinkButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  qiblaLinkText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  qiblaCard: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 10,
  },
  qiblaTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  qiblaSubText: {
    color: 'rgba(255,255,255,0.85)',
    marginTop: 3,
    fontSize: 12,
  },
  qiblaDial: {
    marginTop: 8,
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  qiblaNorth: {
    position: 'absolute',
    top: 6,
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  qiblaBaseNeedle: {
    position: 'absolute',
    width: 3,
    height: 62,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 2,
  },
  qiblaNeedle: {
    position: 'absolute',
    width: 4,
    height: 70,
    backgroundColor: '#8DF2C8',
    borderRadius: 2,
  },
  qiblaHint: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 12,
  },
  nextPrayerPill: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextPrayerLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  nextPrayerName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  nextPrayerCountdown: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  locationText: {
    color: colors.text,
    marginTop: 8,
    fontWeight: '600',
  },
  locationSubText: {
    color: colors.muted,
    marginTop: 4,
  },
  linkButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#ECF6F2',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  linkButtonText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  editorWrap: {
    marginTop: 10,
    gap: 8,
  },
  input: {
    backgroundColor: '#F7FAF9',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E1ECE8',
    color: colors.text,
  },
  editorActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: '#2D9D7A',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  prayerList: {
    marginTop: 10,
    gap: 8,
  },
  prayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FAFCFB',
    borderWidth: 1,
    borderColor: '#E8EFEC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  prayerRowActive: {
    backgroundColor: '#EAF6F1',
    borderColor: '#BFE2D4',
  },
  prayerLabel: {
    color: colors.text,
    fontWeight: '700',
  },
  prayerValue: {
    color: colors.primary,
    fontWeight: '800',
  },
  prayerValueActive: {
    color: '#0A5A42',
  },
  adhanNote: {
    color: colors.muted,
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
  },
  calendarTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  calendarNavButton: {
    backgroundColor: '#ECF6F2',
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  calendarNavText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  calendarMonthText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 14,
  },
  calendarWeekdays: {
    flexDirection: 'row',
    marginTop: 12,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  calendarCellWrap: {
    width: '14.2857%',
    padding: 3,
  },
  calendarCell: {
    backgroundColor: '#FAFCFB',
    borderRadius: 7,
    minHeight: 54,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E8EFEC',
  },
  calendarCellToday: {
    backgroundColor: '#0F7A5A',
    borderColor: '#0B5F46',
  },
  gregorianDay: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12,
  },
  gregorianDayToday: {
    color: '#fff',
  },
  hijriDay: {
    color: colors.muted,
    fontSize: 11,
  },
  hijriDayToday: {
    color: 'rgba(255,255,255,0.85)',
  },
});

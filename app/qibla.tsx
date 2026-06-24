import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  IOSReferenceFrame,
  SensorType,
  runOnJS,
  useAnimatedSensor,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { BannerAdSpace } from '@/components/BannerAdSpace';
import { getSavedLocation } from '@/services/locationService';
import { useResponsive } from '@/theme/responsive';

// Ka'bah coordinates (Masjid al-Haram, Makkah).
const KAABA_LAT = 21.4225;
const KAABA_LON = 39.8262;

const PHONE_COMPASS_SIZE = 260;
const TABLET_COMPASS_SIZE = 320;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/**
 * Great-circle initial bearing from (lat,lon) to the Ka'bah, measured clockwise
 * from TRUE north (0–360). This is exactly the Qibla direction.
 */
function computeQiblaBearing(lat: number, lon: number) {
  const phi1 = toRad(lat);
  const phi2 = toRad(KAABA_LAT);
  const dLon = toRad(KAABA_LON - lon);
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Estimate magnetic declination using a tilted-dipole model. The geomagnetic
 * north pole position is from the IGRF-13 / WMM-2025 epoch (~2025).
 * Accuracy: ±2–3° for most inhabited locations — sufficient for a compass UI.
 *
 * Only used on Android where the rotation sensor references magnetic north.
 * On iOS with XTrueNorthZVertical, the sensor already reports true-north yaw.
 */
function estimateMagneticDeclination(latDeg: number, lonDeg: number): number {
  // Geomagnetic North Pole (dipole model, ~2025 epoch)
  const pLat = toRad(80.65);
  const pLon = toRad(-72.68);
  const lat = toRad(latDeg);
  const lon = toRad(lonDeg);

  return toDeg(
    Math.atan2(
      Math.cos(pLat) * Math.sin(pLon - lon),
      Math.cos(lat) * Math.sin(pLat) -
        Math.sin(lat) * Math.cos(pLat) * Math.cos(pLon - lon)
    )
  );
}

export default function QiblaScreen() {
  const responsive = useResponsive();
  const styles = useMemo(
    () => createStyles(responsive.isTablet ? TABLET_COMPASS_SIZE : PHONE_COMPASS_SIZE),
    [responsive.isTablet]
  );
  // ---- React state (display-only — NEVER used in the animation loop) --------
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [qiblaBearing, setQiblaBearing] = useState<number | null>(null);
  const [headingDisplay, setHeadingDisplay] = useState<number | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  // ---- SharedValues (worklet-accessible, zero React re-renders) -------------
  const magneticDeclination = useSharedValue(0);
  const qiblaSV = useSharedValue(-1);
  const disp = useSharedValue(0);
  const hasDisp = useSharedValue(false);
  const lastTextStamp = useSharedValue(0);
  const locationReady = useSharedValue(false);

  // ---- UI-thread rotation sensor --------------------------------------------
  // Maps to Android TYPE_ROTATION_VECTOR / iOS CMDeviceMotion with true-north
  // reference. Provides tilt-compensated quaternion output on every native frame
  // entirely on the UI thread — zero JS bridge involvement.
  const rotationSensor = useAnimatedSensor(SensorType.ROTATION, {
    iosReferenceFrame: IOSReferenceFrame.XTrueNorthZVertical,
  });

  // ---- One-time location resolve + SharedValue setup -------------------------
  // Strategy: read the cached location first (instant, written on every app
  // launch by maybeRefreshLocation). Only fall back to a live GPS fetch if the
  // cache is empty — this eliminates the ~20-second wait on screen open.
  useEffect(() => {
    let mounted = true;

    const applyLocation = (lat: number, lon: number) => {
      setCoords({ lat, lon });

      const qb = computeQiblaBearing(lat, lon);
      qiblaSV.value = qb;
      setQiblaBearing(qb);

      // On Android the rotation sensor references magnetic north; correct to
      // true north using a dipole-model declination estimate. On iOS with
      // XTrueNorthZVertical the yaw is already true-north-referenced, so
      // declination stays at its default (0).
      if (Platform.OS === 'android') {
        magneticDeclination.value = estimateMagneticDeclination(lat, lon);
      }

      locationReady.value = true;
    };

    const init = async () => {
      try {
        setError(null);
        setLoading(true);
        // Reset motion state for a clean (re)start.
        hasDisp.value = false;
        locationReady.value = false;

        // 1. Try cached location first — instant (~5 ms from AsyncStorage).
        //    Written on every launch by maybeRefreshLocation() in _layout.tsx.
        const saved = await getSavedLocation();
        if (
          mounted &&
          saved?.latitude != null &&
          saved?.longitude != null
        ) {
          applyLocation(saved.latitude, saved.longitude);
          if (mounted) setLoading(false);
          return;
        }

        // 2. No cache — fall back to live GPS (asks permission if needed).
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          throw new Error(
            'Location permission is required for the Qibla compass.'
          );
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!mounted) return;

        applyLocation(pos.coords.latitude, pos.coords.longitude);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Unable to start the Qibla compass.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryTick]);

  // ---- UI-thread frame loop -------------------------------------------------
  // Every native frame: read quaternion → compute yaw → add declination →
  // smooth via adaptive shortest-arc easing. Zero JS bridge involvement.
  useFrameCallback((info) => {
    'worklet';
    if (!locationReady.value) return;

    const { qw, qx, qy, qz } = rotationSensor.sensor.value;

    // Guard: skip until the sensor has produced a valid quaternion.
    // An all-zero quaternion is not a valid rotation (identity is qw=1).
    if (qw === 0 && qx === 0 && qy === 0 && qz === 0) return;

    // Step 1 — Quaternion → yaw (azimuth from north).
    // Standard extraction for the Z-axis rotation component.
    const yaw = Math.atan2(
      2 * (qw * qz + qx * qy),
      1 - 2 * (qy * qy + qz * qz)
    );
    // Negate: sensor yaw uses math convention (CCW+) but compass heading
    // uses navigational convention (CW+ from North, 0°–360°).
    const deviceHeading = ((-yaw * (180 / Math.PI)) + 360) % 360;

    // Step 2 — Magnetic declination correction (0 on iOS, estimated on Android).
    const correctedHeading =
      (deviceHeading + magneticDeclination.value + 360) % 360;

    // Step 3 — Adaptive shortest-arc smoothing: gentle when essentially still
    // (kills sensor jitter), ramps to near-instant the moment the phone
    // actually turns — no perceptible lag.
    if (!hasDisp.value) {
      disp.value = correctedHeading;
      hasDisp.value = true;
    }

    const cur = disp.value;
    const norm = ((cur % 360) + 360) % 360;
    const d = ((correctedHeading - norm + 540) % 360) - 180; // shortest signed arc

    const dt = (info.timeSincePreviousFrame ?? 16.7) / 16.7; // in 60-fps-frame units
    const base = 0.2 + Math.min(1, Math.abs(d) / 8) * 0.75; // 0.2 (still) → 0.95 (moving)
    const k = 1 - Math.pow(1 - base, dt); // framerate-independent factor
    disp.value = cur + d * k;

    // Feed the heading text at ~8 Hz — enough for the numeric readout, cheap
    // for React. This is the ONLY runOnJS call in the entire compass pipeline.
    if (info.timestamp - lastTextStamp.value > 120) {
      lastTextStamp.value = info.timestamp;
      runOnJS(setHeadingDisplay)(((disp.value % 360) + 360) % 360);
    }
  });

  // Angle of the Qibla relative to where the phone is pointing (signed, -180..180).
  const delta = useMemo(() => {
    if (qiblaBearing === null || headingDisplay === null) return null;
    return ((qiblaBearing - headingDisplay + 540) % 360) - 180;
  }, [qiblaBearing, headingDisplay]);

  // UI-thread rotations — read straight from SharedValues, no bridge hop.
  const dialStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-disp.value}deg` }],
  }));
  const qiblaStyle = useAnimatedStyle(() => {
    const qb = qiblaSV.value;
    return {
      transform: [{ rotate: `${qb < 0 ? 0 : qb - disp.value}deg` }],
    };
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.muted }}>Preparing Qibla compass…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { padding: 16 }]}>
        <Text style={{ color: colors.danger, textAlign: 'center' }}>
          {error}
        </Text>
        <Pressable
          onPress={() => setRetryTick((t) => t + 1)}
          style={styles.retry}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const aligned = delta !== null && Math.abs(delta) <= 4;

  // Cardinal letters placed around the dial layer (orbit with it).
  const cardinals = [
    { label: 'N', color: colors.danger, style: { top: 8 } },
    { label: 'E', color: colors.muted, style: { right: 8 } },
    { label: 'S', color: colors.muted, style: { bottom: 8 } },
    { label: 'W', color: colors.muted, style: { left: 8 } },
  ] as const;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, responsive.centerContent]}>
      <View style={styles.card}>
        <Text style={styles.title}>Qibla Compass</Text>
        <Text style={styles.sub}>
          Point the top of your phone until the Ka'bah reaches the marker.
        </Text>

        <View style={[styles.dialWrap, aligned && styles.dialWrapAligned]}>
          {/* Fixed reference marker (12 o'clock = where the phone points) */}
          <View style={styles.refTriangle} />

          {/* Rotating dial: cardinal directions + ticks */}
          <Animated.View
            style={[styles.layer, dialStyle]}
            pointerEvents="none"
          >
            {Array.from({ length: 24 }).map((_, i) => (
              <View
                key={`t-${i}`}
                style={[
                  styles.tickWrap,
                  { transform: [{ rotate: `${i * 15}deg` }] },
                ]}
              >
                <View
                  style={[styles.tick, i % 6 === 0 && styles.tickMajor]}
                />
              </View>
            ))}
            {cardinals.map((c) => (
              <View
                key={c.label}
                style={[styles.cardinal, c.style as any]}
              >
                <Text style={[styles.cardinalText, { color: c.color }]}>
                  {c.label}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* Rotating Qibla needle with the Ka'bah at its tip */}
          <Animated.View
            style={[styles.layer, qiblaStyle]}
            pointerEvents="none"
          >
            <View
              style={[
                styles.needle,
                aligned && { backgroundColor: colors.gold },
              ]}
            />
            <View
              style={[
                styles.kaabaWrap,
                aligned && styles.kaabaWrapAligned,
              ]}
            >
              <Image
                source={require('@/assets/images/kaaba.png')}
                style={{ width: 30, height: 30 }}
                resizeMode="contain"
              />
            </View>
          </Animated.View>

          {/* Center hub */}
          <View style={styles.hub} />
        </View>

        {/* Status */}
        <View style={styles.statusRow}>
          <Text
            style={[styles.statusBig, aligned && { color: colors.primary }]}
          >
            {delta === null
              ? 'Calibrating…'
              : aligned
                ? '✓ Facing the Qibla'
                : delta > 0
                  ? `Turn right ${Math.round(Math.abs(delta))}°`
                  : `Turn left ${Math.round(Math.abs(delta))}°`}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            Qibla{' '}
            {qiblaBearing !== null ? `${Math.round(qiblaBearing)}°` : '--'}
          </Text>
          <Text style={styles.meta}>
            Heading{' '}
            {headingDisplay !== null
              ? `${Math.round(headingDisplay)}°`
              : '--'}
          </Text>
          <Text style={styles.meta}>
            {coords
              ? `${coords.lat.toFixed(3)}, ${coords.lon.toFixed(3)}`
              : '--'}
          </Text>
        </View>

        <Text style={styles.hint}>
          For best accuracy, hold the phone flat. If it drifts, wave it in a
          figure-8 once.
        </Text>
      </View>
      <BannerAdSpace />
    </ScrollView>
  );
}

const createStyles = (SIZE: number) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16 },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  retry: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 4,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  title: { color: colors.text, fontWeight: '800', fontSize: 18 },
  sub: { color: colors.muted, marginTop: 4, fontSize: 12.5, lineHeight: 18 },

  dialWrap: {
    marginTop: 18,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#FAFCFB',
  },
  dialWrapAligned: { borderColor: colors.gold, backgroundColor: '#FBF7EA' },

  // Fixed reference at 12 o'clock — the direction the phone is pointing.
  refTriangle: {
    position: 'absolute',
    top: -2,
    zIndex: 5,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.primary,
  },

  // Full-size layer; rotating it spins children around the compass centre.
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardinal: { position: 'absolute', width: 20, alignItems: 'center' },
  cardinalText: { fontWeight: '900', fontSize: 13 },

  tickWrap: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
  },
  tick: {
    position: 'absolute',
    top: 2,
    width: 2,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 1,
  },
  tickMajor: { height: 12, width: 3, backgroundColor: colors.faint },

  // Needle: a bar from the centre up to the rim (its bottom sits at centre).
  needle: {
    position: 'absolute',
    top: SIZE / 2 - 96,
    width: 6,
    height: 96,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  kaabaWrap: {
    position: 'absolute',
    top: 14,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  kaabaWrapAligned: { borderColor: colors.gold, backgroundColor: '#FBF7EA' },

  hub: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#fff',
  },

  statusRow: { marginTop: 16, alignItems: 'center' },
  statusBig: { color: colors.text, fontWeight: '800', fontSize: 16 },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  meta: { color: colors.muted, fontSize: 12, fontWeight: '600' },

  hint: {
    color: colors.faint,
    marginTop: 8,
    fontSize: 11.5,
    lineHeight: 16,
  },
  });

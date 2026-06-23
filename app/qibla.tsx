import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { BannerAdSpace } from '@/components/BannerAdSpace';

// Ka'bah coordinates (Masjid al-Haram, Makkah).
const KAABA_LAT = 21.4225;
const KAABA_LON = 39.8262;

const SIZE = 260; // compass diameter
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
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Shortest signed angle to rotate from `from` to `to`, range (-180, 180].
function shortestDelta(to: number, from: number) {
  return ((to - from + 540) % 360) - 180;
}

export default function QiblaScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [qiblaBearing, setQiblaBearing] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [headingMode, setHeadingMode] = useState<'true' | 'magnetic' | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  // All motion lives on the UI thread (reanimated), so the needle tracks the phone
  // at native frame rate and never trails behind a busy JS thread.
  //   target  – latest sensor heading (continuous degrees); -1 until first reading
  //   disp    – eased heading actually shown; chases `target` each frame
  //   qiblaSV – Qibla bearing (true north); -1 until location resolved
  const target = useSharedValue(-1);
  const disp = useSharedValue(0);
  const hasDisp = useSharedValue(false);
  const qiblaSV = useSharedValue(-1);
  const lastTextStamp = useSharedValue(0);

  // JS-side EMA state so a single sensor spike can't snap the target.
  const prevTarget = useRef<number | null>(null);

  // UI-thread easing loop: every frame, chase the latest sensor target along the
  // shortest arc. Framerate-aware so it behaves the same at 60 and 120 Hz.
  const frame = useFrameCallback((info) => {
    'worklet';
    const t = target.value;
    if (t < 0) return; // no sensor reading yet
    if (!hasDisp.value) {
      disp.value = t;
      hasDisp.value = true;
    }
    const cur = disp.value;
    const norm = ((cur % 360) + 360) % 360;
    const d = ((t - norm + 540) % 360) - 180; // shortest signed arc to target

    // Adaptive smoothing: gentle when essentially still (kills sensor jitter),
    // ramps to near-instant the moment the phone actually turns — no perceptible lag.
    const dt = (info.timeSincePreviousFrame ?? 16.7) / 16.7; // in 60fps-frame units
    const base = 0.2 + Math.min(1, Math.abs(d) / 8) * 0.75; // 0.2 (still) → 0.95 (moving)
    const k = 1 - Math.pow(1 - base, dt); // framerate-independent factor
    disp.value = cur + d * k;

    // Feed the heading text/status at ~8 Hz — enough for the readout, cheap for React.
    if (info.timestamp - lastTextStamp.value > 120) {
      lastTextStamp.value = info.timestamp;
      runOnJS(setHeading)(((disp.value % 360) + 360) % 360);
    }
  }, false);

  useEffect(() => {
    let mounted = true;
    let headingSub: { remove: () => void } | null = null;

    const init = async () => {
      try {
        setError(null);
        setLoading(true);
        // Reset motion state for a clean (re)start.
        target.value = -1;
        hasDisp.value = false;
        prevTarget.current = null;

        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          throw new Error('Location permission is required for the Qibla compass.');
        }

        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        if (!mounted) return;
        setCoords({ lat, lon });
        const qb = computeQiblaBearing(lat, lon);
        qiblaSV.value = qb;
        setQiblaBearing(qb);

        // Sensor callback ONLY writes the target (+ light spike rejection). The
        // UI-thread frame loop does all smoothing/rendering, so sensor rate is irrelevant.
        headingSub = await Location.watchHeadingAsync((h) => {
          if (!mounted) return;
          let raw: number | null = null;
          if (typeof h.trueHeading === 'number' && h.trueHeading >= 0) {
            raw = h.trueHeading;
            setHeadingMode('true');
          } else if (typeof h.magHeading === 'number' && h.magHeading >= 0) {
            raw = h.magHeading;
            setHeadingMode('magnetic');
          }
          if (raw === null) return;

          const prev = prevTarget.current;
          if (prev === null) {
            prevTarget.current = raw;
          } else {
            // Very light EMA — clips single-sample spikes only. Kept close to raw so
            // the target barely lags the phone; the frame loop handles the rest.
            const d = shortestDelta(raw, prev);
            prevTarget.current = ((prev + 0.9 * d) % 360 + 360) % 360;
          }
          target.value = prevTarget.current;
        });

        frame.setActive(true);
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
      frame.setActive(false);
      if (headingSub) headingSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryTick]);

  // Angle of the Qibla relative to where the phone is pointing (signed, -180..180).
  const delta = useMemo(() => {
    if (qiblaBearing === null || heading === null) return null;
    return shortestDelta(qiblaBearing, heading);
  }, [qiblaBearing, heading]);

  // UI-thread rotations — read straight from the shared values, no bridge hop.
  const dialStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-disp.value}deg` }],
  }));
  const qiblaStyle = useAnimatedStyle(() => {
    const qb = qiblaSV.value;
    return { transform: [{ rotate: `${qb < 0 ? 0 : qb - disp.value}deg` }] };
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
        <Text style={{ color: colors.danger, textAlign: 'center' }}>{error}</Text>
        <Pressable onPress={() => setRetryTick((t) => t + 1)} style={styles.retry}>
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Qibla Compass</Text>
        <Text style={styles.sub}>Point the top of your phone until the Ka'bah reaches the marker.</Text>

        <View style={[styles.dialWrap, aligned && styles.dialWrapAligned]}>
          {/* Fixed reference marker (12 o'clock = where the phone points) */}
          <View style={styles.refTriangle} />

          {/* Rotating dial: cardinal directions + ticks */}
          <Animated.View style={[styles.layer, dialStyle]} pointerEvents="none">
            {Array.from({ length: 24 }).map((_, i) => (
              <View key={`t-${i}`} style={[styles.tickWrap, { transform: [{ rotate: `${i * 15}deg` }] }]}>
                <View style={[styles.tick, i % 6 === 0 && styles.tickMajor]} />
              </View>
            ))}
            {cardinals.map((c) => (
              <View key={c.label} style={[styles.cardinal, c.style as any]}>
                <Text style={[styles.cardinalText, { color: c.color }]}>{c.label}</Text>
              </View>
            ))}
          </Animated.View>

          {/* Rotating Qibla needle with the Ka'bah at its tip */}
          <Animated.View style={[styles.layer, qiblaStyle]} pointerEvents="none">
            <View style={[styles.needle, aligned && { backgroundColor: colors.gold }]} />
            <View style={[styles.kaabaWrap, aligned && styles.kaabaWrapAligned]}>
              <Image source={require('@/assets/images/kaaba.png')} style={{ width: 30, height: 30 }} resizeMode="contain" />
            </View>
          </Animated.View>

          {/* Center hub */}
          <View style={styles.hub} />
        </View>

        {/* Status */}
        <View style={styles.statusRow}>
          <Text style={[styles.statusBig, aligned && { color: colors.primary }]}>
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
          <Text style={styles.meta}>Qibla {qiblaBearing !== null ? `${Math.round(qiblaBearing)}°` : '--'}</Text>
          <Text style={styles.meta}>Heading {heading !== null ? `${Math.round(heading)}°` : '--'}</Text>
          <Text style={styles.meta}>{coords ? `${coords.lat.toFixed(3)}, ${coords.lon.toFixed(3)}` : '--'}</Text>
        </View>

        {headingMode === 'magnetic' ? (
          <Text style={styles.warn}>Using magnetic north (true heading unavailable) — may be a few degrees off.</Text>
        ) : null}
        <Text style={styles.hint}>For best accuracy, hold the phone flat. If it drifts, wave it in a figure-8 once.</Text>
      </View>
      <BannerAdSpace />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 10 },
  retry: { backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, marginTop: 4 },

  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
  title: { color: colors.text, fontWeight: '800', fontSize: 18 },
  sub: { color: colors.muted, marginTop: 4, fontSize: 12.5, lineHeight: 18 },

  dialWrap: {
    marginTop: 18, width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', backgroundColor: '#FAFCFB',
  },
  dialWrapAligned: { borderColor: colors.gold, backgroundColor: '#FBF7EA' },

  // Fixed reference at 12 o'clock — the direction the phone is pointing.
  refTriangle: {
    position: 'absolute', top: -2, zIndex: 5,
    width: 0, height: 0, backgroundColor: 'transparent',
    borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 14,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: colors.primary,
  },

  // Full-size layer; rotating it spins children around the compass centre.
  layer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

  cardinal: { position: 'absolute', width: 20, alignItems: 'center' },
  cardinalText: { fontWeight: '900', fontSize: 13 },

  tickWrap: { position: 'absolute', width: SIZE, height: SIZE, alignItems: 'center' },
  tick: { position: 'absolute', top: 2, width: 2, height: 8, backgroundColor: colors.border, borderRadius: 1 },
  tickMajor: { height: 12, width: 3, backgroundColor: colors.faint },

  // Needle: a bar from the centre up to the rim (its bottom sits at centre).
  needle: {
    position: 'absolute', top: SIZE / 2 - 96, width: 6, height: 96, borderRadius: 3,
    backgroundColor: colors.primary,
  },
  kaabaWrap: {
    position: 'absolute', top: 14, width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
    borderWidth: 2, borderColor: colors.primary,
  },
  kaabaWrapAligned: { borderColor: colors.gold, backgroundColor: '#FBF7EA' },

  hub: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, borderWidth: 2, borderColor: '#fff' },

  statusRow: { marginTop: 16, alignItems: 'center' },
  statusBig: { color: colors.text, fontWeight: '800', fontSize: 16 },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  meta: { color: colors.muted, fontSize: 12, fontWeight: '600' },

  warn: { color: colors.danger, marginTop: 8, fontSize: 11.5, lineHeight: 16 },
  hint: { color: colors.faint, marginTop: 8, fontSize: 11.5, lineHeight: 16 },
});

import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Pressable, Text, View } from 'react-native';
import { colors } from '@/theme/colors';

function normalizeDelta(target: number, heading: number) {
  return ((target - heading + 540) % 360) - 180;
}

export default function QiblaScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [qiblaBearing, setQiblaBearing] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [compassReady, setCompassReady] = useState(false);

  const needleAnim = useRef(new Animated.Value(0)).current;
  const currentNeedleDeg = useRef(0);

  useEffect(() => {
    let mounted = true;
    let headingSub: { remove: () => void } | null = null;

    const init = async () => {
      try {
        setError(null);
        setLoading(true);

        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          throw new Error('Location permission is required for Qibla compass.');
        }

        const pos = await Location.getCurrentPositionAsync({});
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        if (!mounted) return;
        setCoords({ lat, lon });

        const res = await fetch(`https://api.aladhan.com/v1/qibla/${lat}/${lon}`);
        const json = await res.json();
        const bearing = Number(json?.data?.direction);
        if (!Number.isFinite(bearing)) {
          throw new Error('Unable to resolve Qibla direction from API.');
        }
        if (!mounted) return;
        setQiblaBearing((bearing + 360) % 360);

        headingSub = await Location.watchHeadingAsync((h) => {
          // Qibla bearing is calculated against true north, so use trueHeading only.
          if (typeof h.trueHeading === 'number' && h.trueHeading >= 0) {
            setHeading(h.trueHeading);
            setCompassReady(true);
          } else {
            setHeading(null);
            setCompassReady(false);
          }
        });
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Unable to start Qibla compass.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
      if (headingSub) headingSub.remove();
    };
  }, []);

  const delta = useMemo(() => {
    if (qiblaBearing === null || heading === null) return null;
    return normalizeDelta(qiblaBearing, heading);
  }, [qiblaBearing, heading]);

  const pointerRotation = useMemo(() => {
    if (qiblaBearing === null || heading === null) return 0;
    return normalizeDelta(qiblaBearing, heading);
  }, [qiblaBearing, heading]);
  const northMarkerRotation = useMemo(() => {
    if (heading === null) return 0;
    return -heading;
  }, [heading]);

  useEffect(() => {
    const current = currentNeedleDeg.current;
    const shortest = normalizeDelta(pointerRotation, current);
    const next = current + shortest;
    currentNeedleDeg.current = next;

    Animated.timing(needleAnim, {
      toValue: next,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [pointerRotation, needleAnim]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.muted }}>Preparing Qibla compass...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 12 }}>
        <Text style={{ color: '#A02929', textAlign: 'center' }}>{error}</Text>
        <Pressable onPress={() => { setLoading(true); setError(null); }} style={{ backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E6E0D5', padding: 14 }}>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>Qibla Compass</Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>Powered by Islamic API (AlAdhan Qibla).</Text>

        <View
          style={{
            marginTop: 14,
            width: 240,
            height: 240,
            borderRadius: 120,
            borderWidth: 2,
            borderColor: '#D9D9D9',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
            backgroundColor: '#FAFCFB'
          }}
        >
          <Animated.View
            style={{
              position: 'absolute',
              top: 8,
              alignItems: 'center',
              transform: [{ rotate: `${northMarkerRotation}deg` }]
            }}
          >
            <Image source={require('@/assets/images/kaaba.png')} style={{ width: 22, height: 22 }} resizeMode="contain" />
            <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 10, marginTop: 1 }}>N</Text>
          </Animated.View>

          <View
            style={{
              position: 'absolute',
              width: 4,
              height: 90,
              backgroundColor: '#BCC7C2',
              borderRadius: 2
            }}
          />
          <Animated.View
            style={{
              position: 'absolute',
              width: 5,
              height: 104,
              backgroundColor: colors.primary,
              borderRadius: 3,
              transform: [
                {
                  rotate: needleAnim.interpolate({
                    inputRange: [-3600, 3600],
                    outputRange: ['-3600deg', '3600deg']
                  })
                }
              ]
            }}
          />
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary }} />
        </View>

        <Text style={{ color: colors.text, marginTop: 12, fontWeight: '700' }}>
          Qibla Bearing: {qiblaBearing !== null ? `${Math.round(qiblaBearing)}°` : '--'}
        </Text>
        <Text style={{ color: colors.muted, marginTop: 2 }}>
          Heading: {heading !== null ? `${Math.round(heading)}° (true north)` : 'Calibrating true heading...'}
        </Text>
        <Text style={{ color: colors.muted, marginTop: 2 }}>
          Location: {coords ? `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}` : '--'}
        </Text>

        <Text style={{ color: colors.text, marginTop: 10, fontWeight: '800' }}>
          {delta === null
            ? 'Move phone in 8-shape in open sky for true heading lock.'
            : Math.abs(delta) <= 5
              ? 'Facing Qibla'
              : delta > 0
                ? `Turn right ${Math.round(Math.abs(delta))}°`
                : `Turn left ${Math.round(Math.abs(delta))}°`}
        </Text>
        {!compassReady ? (
          <Text style={{ color: '#A02929', marginTop: 6, fontSize: 12 }}>
            True heading unavailable right now. Keep device away from metal objects.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

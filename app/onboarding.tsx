import React, { useEffect, useState, useRef } from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, Animated, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/theme/useThemeColors';
import { colors, fonts, radius } from '@/theme/colors';
import { PressableScale } from '@/components/Anim';
import { saveLocation } from '@/services/locationService';
import { ensurePrayerNotificationPermission } from '@/services/prayerNotificationService';
import { preloadHomePrayerTimings } from '@/hooks/usePrayerSnapshot';

export const ONBOARDING_KEY = 'wedeen_has_seen_onboarding_v1';

const SLIDES = [
  {
    key: 'welcome',
    title: 'Welcome to WeDeen',
    description: 'A calm, distraction-free companion to build lasting habits of worship.',
    icon: 'moon-outline' as const,
  },
  {
    key: 'prayer-lock',
    title: 'Prayer Focus',
    description: 'Use the Prayer Lock feature to temporarily block distracting apps during Salah times.',
    icon: 'lock-closed-outline' as const,
  },
  {
    key: 'progress',
    title: 'Track Your Journey',
    description: 'Sign in to sync your progress across devices, unlock achievements, and see detailed worship insights.',
    icon: 'bar-chart-outline' as const,
  },
  {
    key: 'ready',
    title: 'You are ready!',
    description: 'Set your location to get accurate prayer times, and start building your habits today.',
    icon: 'compass-outline' as const,
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const { width } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [locationReady, setLocationReady] = useState(false);
  const [notificationReady, setNotificationReady] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [locationPerm, notificationGranted] = await Promise.all([
        Location.getForegroundPermissionsAsync().catch(() => null),
        ensurePrayerNotificationPermissionStatus().catch(() => false),
      ]);
      if (!mounted) return;
      setLocationReady(Boolean(locationPerm?.granted));
      setNotificationReady(notificationGranted);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false, listener: (event: any) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / width);
      setCurrentIndex(index);
    }}
  );

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      scrollViewRef.current?.scrollTo({ x: (currentIndex + 1) * width, animated: true });
    } else {
      completeOnboarding();
    }
  };

  const completeOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/');
  };

  const requestLocation = async () => {
    if (locationLoading) return;
    setLocationLoading(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setLocationReady(false);
        Alert.alert('Location not enabled', 'You can still set your city manually from Timings later.');
        return;
      }

      const pos = await Location.getCurrentPositionAsync({});
      let city = 'Unknown City';
      let country = 'Unknown Country';
      try {
        const geo = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        city = geo?.[0]?.city || geo?.[0]?.subregion || city;
        country = geo?.[0]?.country || country;
      } catch {
        // Coordinates are enough for accurate timings; names are only display text.
      }

      const loc = {
        mode: 'coords',
        city,
        country,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        locked: false,
      } as const;
      await saveLocation(loc);
      await preloadHomePrayerTimings(loc).catch(() => undefined);
      setLocationReady(true);
    } catch {
      Alert.alert('Location failed', 'We could not read your location right now. You can try again from Timings.');
    } finally {
      setLocationLoading(false);
    }
  };

  const requestNotifications = async () => {
    if (notificationLoading) return;
    setNotificationLoading(true);
    try {
      const granted = await ensurePrayerNotificationPermission();
      setNotificationReady(granted);
      if (!granted) {
        Alert.alert('Notifications not enabled', 'You can turn on adhan alerts later from Settings.');
      }
    } catch {
      Alert.alert('Notifications failed', 'We could not request notifications right now. You can try again from Settings.');
    } finally {
      setNotificationLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      >
        {SLIDES.map((slide, i) => (
          <View key={slide.key} style={[styles.slide, { width, paddingTop: insets.top }]}>
            <View style={styles.slideInner}>
              <View style={[styles.iconContainer, { backgroundColor: themeColors.primarySoft }]}>
                <Ionicons name={slide.icon} size={80} color={themeColors.primary} />
              </View>
              <Text style={[styles.title, { color: themeColors.text }]}>{slide.title}</Text>
              <Text style={[styles.description, { color: themeColors.muted }]}>{slide.description}</Text>
              {slide.key === 'ready' ? (
                <View style={styles.permissions}>
                  <PermissionRow
                    title="Location"
                    description="Accurate prayer times and Qibla direction"
                    icon="location-outline"
                    ready={locationReady}
                    loading={locationLoading}
                    onPress={requestLocation}
                  />
                  <PermissionRow
                    title="Notifications"
                    description="Adhan alerts and Islamic reminders"
                    icon="notifications-outline"
                    ready={notificationReady}
                    loading={notificationLoading}
                    onPress={requestNotifications}
                  />
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.pagination}>
          {SLIDES.map((_, i) => {
            const opacity = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { backgroundColor: themeColors.primary, opacity }]}
              />
            );
          })}
        </View>

        <PressableScale
          style={[styles.button, { backgroundColor: themeColors.primary }]}
          onPress={handleNext}
        >
          <Text style={styles.buttonText}>
            {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

async function ensurePrayerNotificationPermissionStatus() {
  try {
    const Notifications = await import('expo-notifications');
    const settings = await Notifications.getPermissionsAsync();
    return Boolean(
      settings.granted ||
        settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  } catch {
    return false;
  }
}

function PermissionRow({
  title,
  description,
  icon,
  ready,
  loading,
  onPress,
}: {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  ready: boolean;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.permissionRow}>
      <View style={styles.permissionIcon}>
        <Ionicons name={ready ? 'checkmark-circle' : icon} size={22} color={ready ? colors.primary : colors.goldDeep} />
      </View>
      <View style={styles.permissionText}>
        <Text style={styles.permissionTitle}>{title}</Text>
        <Text style={styles.permissionDescription}>{description}</Text>
      </View>
      <PressableScale
        style={[styles.permissionButton, ready && styles.permissionButtonDone]}
        onPress={onPress}
        disabled={ready || loading}
      >
        <Text style={[styles.permissionButtonText, ready && styles.permissionButtonTextDone]}>
          {ready ? 'Done' : loading ? '...' : 'Allow'}
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  slideInner: {
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
  },
  iconContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: fonts.serif,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  permissions: {
    width: '100%',
    gap: 10,
    marginTop: 28,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    gap: 10,
  },
  permissionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionText: {
    flex: 1,
  },
  permissionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  permissionDescription: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
  permissionButton: {
    minWidth: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  permissionButtonDone: {
    backgroundColor: colors.primarySoft,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  permissionButtonTextDone: {
    color: colors.primary,
  },
  footer: {
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  pagination: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  button: {
    width: '100%',
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

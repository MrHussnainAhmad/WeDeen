import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';
import { runBootPreloadOnce, shouldRunBootPreload } from '@/services/bootPreloadService';

const queryClient = new QueryClient();

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const [bootDone, setBootDone] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [fontsLoaded] = useFonts({
    KFGQPCNastaleeq: require('@/assets/fonts/KFGQPCNastaleeq-Regular.ttf'),
    NotoNastaliqUrdu: require('@/assets/fonts/NotoNastaliqUrdu-Regular.ttf'),
    NotoSans: require('@/assets/fonts/NotoSans-Regular.ttf')
  });

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    // Skip notification setup in Expo Go; boot preload will run separately
    if (Constants.appOwnership !== 'expo') {
      let mounted = true;
      (async () => {
        const Notifications = await import('expo-notifications');
        if (!mounted) return;
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
      })().catch(() => undefined);
      return () => {
        mounted = false;
      };
    }
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;
    let mounted = true;
    const run = async () => {
      try {
        const shouldRun = await shouldRunBootPreload();
        if (shouldRun) {
          await runBootPreloadOnce();
        }
      } catch {
        // Non-blocking: let app continue even if a preload step fails.
      } finally {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          if (mounted) setBootDone(true);
        });
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [fadeAnim, fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  if (!bootDone) {
    return (
      <Animated.View style={[styles.bootScreen, { opacity: fadeAnim }]}>
        <Image source={require('@/assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.bootTitle}>Downloading Features...</Text>
        <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
      </Animated.View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="quran/index" options={{ title: 'Quran Surahs' }} />
        <Stack.Screen name="quran/[surah]" options={{ title: 'Surah Detail' }} />
        <Stack.Screen name="qibla" options={{ title: 'Qibla Compass' }} />
        <Stack.Screen name="names/[type]" options={{ title: '99 Names' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  bootScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    width: 132,
    height: 132,
  },
  bootTitle: {
    marginTop: 16,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  loader: {
    marginTop: 12,
  },
});

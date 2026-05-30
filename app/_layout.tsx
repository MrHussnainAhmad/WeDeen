import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

const queryClient = new QueryClient();

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const [fontsLoaded] = useFonts({
    KFGQPCNastaleeq: require('@/assets/fonts/KFGQPCNastaleeq-Regular.ttf')
  });

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!fontsLoaded) {
    return null;
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

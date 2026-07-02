import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { CustomTabBar } from '@/components/navigation/CustomTabBar';
import { AudioMiniPlayer } from '@/components/audio/AudioMiniPlayer';
import { colors } from '@/theme/colors';

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Tabs
        initialRouteName="index"
        backBehavior="none"
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          lazy: true,
          // No cross-fade/shift — both caused the previous tab to bleed through.
          animation: 'none',
          freezeOnBlur: true,
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
      <Tabs.Screen name="hijri" options={{ title: 'Timings' }} />
      <Tabs.Screen name="lock" options={{ title: 'Lock' }} />
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="memorization" options={{ title: 'Memorize' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
      <AudioMiniPlayer />
    </View>
  );
}

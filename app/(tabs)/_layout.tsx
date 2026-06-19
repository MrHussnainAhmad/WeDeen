import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { CustomTabBar } from '@/components/navigation/CustomTabBar';
import { colors } from '@/theme/colors';

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Tabs
        initialRouteName="index"
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          // Mount tabs on first visit — Home loads first; others stay idle until opened.
          lazy: true,
          // No cross-fade/shift — overlapping scenes showed the previous tab as a
          // dark ghost over Android's default black window background.
          animation: 'none',
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
      <Tabs.Screen name="hijri" options={{ title: 'Timings' }} />
      <Tabs.Screen name="prayer-lock" options={{ title: 'Prayer Lock' }} />
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="memorization" options={{ title: 'Memorize' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
    </View>
  );
}

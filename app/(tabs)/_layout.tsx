import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View } from 'react-native';
import { colors, shadow } from '@/theme/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#93A39B',
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarStyle: {
          position: 'absolute',
          height: Platform.OS === 'ios' ? 86 : 68,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: colors.border,
          ...shadow.raised,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="hijri"
        options={{
          title: 'Timings',
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'time' : 'time-outline'} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="memorization"
        options={{
          title: 'Memorize',
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'book' : 'book-outline'} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'person' : 'person-outline'} color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, color, focused }: { name: any; color: string; focused: boolean }) {
  return (
    <View
      style={{
        width: 46,
        height: 32,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? colors.primarySoft : 'transparent',
      }}
    >
      <Ionicons name={name} color={color} size={22} />
    </View>
  );
}

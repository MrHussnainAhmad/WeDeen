import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0F7A5A',
        tabBarInactiveTintColor: '#60706A'
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="hijri"
        options={{
          title: 'Timings',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="time" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="memorization"
        options={{
          title: 'Quran Memorization',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="book" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />
        }}
      />
    </Tabs>
  );
}

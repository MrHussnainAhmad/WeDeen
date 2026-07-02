import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, BackHandler, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/Anim';
import { colors, shadow } from '@/theme/colors';
import { TAB_BAR_MAX_WIDTH } from '@/theme/responsive';

type TabSpec = {
  routeName: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  center?: boolean;
};

const TAB_SPECS: TabSpec[] = [
  { routeName: 'hijri', label: 'Timings', icon: 'time-outline', iconFocused: 'time' },
  { routeName: 'lock', label: 'Lock', icon: 'lock-closed-outline', iconFocused: 'lock-closed' },
  { routeName: 'index', label: 'Home', icon: 'home-outline', iconFocused: 'home', center: true },
  {
    routeName: 'memorization',
    label: 'Memorize',
    icon: 'book-outline',
    iconFocused: 'book',
  },
  { routeName: 'profile', label: 'Profile', icon: 'person-outline', iconFocused: 'person' },
];

const HOME_TAB = 'index';

/** Root stack groups — when open, that screen owns the hardware back button. */
const STACK_ROOTS = new Set([
  'quran',
  'hadith',
  'settings',
  'qibla',
  'names',
]);

function SideTabButton({
  focused,
  icon,
  iconFocused,
  label,
  onPress,
}: {
  focused: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const focusAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: focused ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [focused, focusAnim]);

  const bg = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', colors.primarySoft],
  });
  const color = focused ? colors.primary : '#93A39B';

  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.92}
      style={styles.sideSlot}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.sideIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={focused ? iconFocused : icon} size={20} color={color} />
      </Animated.View>
      <Text style={[styles.sideLabel, focused && styles.labelFocused]} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

function CenterTabButton({
  focused,
  icon,
  iconFocused,
  label,
  onPress,
}: {
  focused: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(focused ? 1.04 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.04 : 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 6,
    }).start();
  }, [focused, scale]);

  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.94}
      style={styles.centerSlot}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.centerButton, focused && styles.centerButtonFocused, { transform: [{ scale }] }]}>
        <Ionicons
          name={focused ? iconFocused : icon}
          size={28}
          color={focused ? '#FFFFFF' : colors.primaryDeep}
        />
      </Animated.View>
      <Text style={[styles.centerLabel, focused && styles.labelFocused]}>{label}</Text>
    </PressableScale>
  );
}

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);
  const segments = useSegments();

  // Hardware back on non-home tabs -> Home tab.
  useEffect(() => {
    const onBack = () => {
      const root = segments[0];
      if (root && STACK_ROOTS.has(root)) return false;

      const currentRoute = state.routes[state.index]?.name;
      if (!currentRoute || currentRoute === HOME_TAB) return false;

      const homeRoute = state.routes.find((r) => r.name === HOME_TAB);
      if (!homeRoute) return false;

      const event = navigation.emit({
        type: 'tabPress',
        target: homeRoute.key,
        canPreventDefault: true,
      });
      if (!event.defaultPrevented) {
        navigation.navigate(HOME_TAB);
      }
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [navigation, segments, state.index, state.routes]);

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
      <View style={[styles.bar, { maxWidth: TAB_BAR_MAX_WIDTH, alignSelf: 'center', width: '100%' }]}>
        {TAB_SPECS.map((spec) => {
          const routeIndex = state.routes.findIndex((r) => r.name === spec.routeName);
          if (routeIndex < 0) return null;

          const route = state.routes[routeIndex];
          const focused = state.index === routeIndex;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (spec.center) {
            return (
              <CenterTabButton
                key={spec.routeName}
                focused={focused}
                icon={spec.icon}
                iconFocused={spec.iconFocused}
                label={spec.label}
                onPress={onPress}
              />
            );
          }

          return (
            <SideTabButton
              key={spec.routeName}
              focused={focused}
              icon={spec.icon}
              iconFocused={spec.iconFocused}
              label={spec.label}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    backgroundColor: 'transparent',
  },
  bar: {
    height: 64,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 8,
    ...shadow.raised,
  },
  sideSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 0,
    paddingBottom: 2,
  },
  sideIconWrap: {
    width: 32,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideIconWrapFocused: {
    backgroundColor: 'transparent',
  },
  sideLabel: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '700',
    color: '#93A39B',
    textAlign: 'center',
  },
  centerSlot: {
    flex: 1.15,
    alignItems: 'center',
    marginTop: -26,
  },
  centerButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.goldSoft,
    borderWidth: 2,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  centerButtonFocused: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  centerLabel: {
    marginTop: 5,
    fontSize: 10,
    fontWeight: '800',
    color: '#93A39B',
  },
  labelFocused: {
    color: colors.primary,
  },
});

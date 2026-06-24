import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, Animated } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/theme/useThemeColors';
import { colors, fonts, radius } from '@/theme/colors';
import { PressableScale } from '@/components/Anim';

const { width } = Dimensions.get('window');
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

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
            <View style={[styles.iconContainer, { backgroundColor: themeColors.primarySoft }]}>
              <Ionicons name={slide.icon} size={80} color={themeColors.primary} />
            </View>
            <Text style={[styles.title, { color: themeColors.text }]}>{slide.title}</Text>
            <Text style={[styles.description, { color: themeColors.muted }]}>{slide.description}</Text>
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
  footer: {
    paddingHorizontal: 24,
    alignItems: 'center',
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

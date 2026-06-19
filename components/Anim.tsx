import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, PressableProps, ViewStyle, StyleProp } from 'react-native';

/**
 * Entrance animation: fade + slide up. Use `index` to stagger a list of cards.
 * Pure RN Animated (native driver) — no reanimated/babel changes required.
 */
export function FadeInView({
  children,
  index = 0,
  delay = 0,
  offset = 16,
  duration = 460,
  style,
}: {
  children: React.ReactNode;
  index?: number;
  delay?: number;
  offset?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const didAnimate = useRef(false);

  useEffect(() => {
    if (didAnimate.current) {
      progress.setValue(1);
      return;
    }
    didAnimate.current = true;

    const t = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay: delay + index * 90,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    t.start();
    return () => t.stop();
  }, [progress, delay, index, duration]);

  return (
    <Animated.View
      style={[
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [offset, 0],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Pressable that springs down slightly on press — tactile feedback used app-wide.
 */
export function PressableScale({
  children,
  style,
  pressedScale = 0.96,
  onPress,
  ...rest
}: Omit<PressableProps, 'children' | 'style'> & {
  children?: React.ReactNode;
  pressedScale?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Pressable
      onPressIn={() => animate(pressedScale)}
      onPressOut={() => animate(1)}
      onPress={onPress}
      {...rest}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * Subtle continuous breathing/pulse — for highlight glows and "current" markers.
 */
export function useBreathing(min = 0.4, max = 1, duration = 1600) {
  const value = useRef(new Animated.Value(min)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: max, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(value, { toValue: min, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [value, min, max, duration]);
  return value;
}

/**
 * Animated count-up number (e.g. progress, day counters).
 */
export function useCountUp(target: number, duration = 900) {
  const value = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = React.useState(0);

  useEffect(() => {
    const id = value.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(value, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => value.removeListener(id);
  }, [target, duration, value]);

  return display;
}

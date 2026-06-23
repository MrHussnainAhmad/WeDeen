import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { radius } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { useThemeStore } from '@/store/themeStore';

/**
 * Borderless shimmer block — soft highlight only, no box outline.
 * Uses bgDeep so it blends with the screen during tab fade transitions.
 */
export function Shimmer({
  width,
  height = 16,
  radius: r = radius.sm,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  const colorScheme = useThemeStore((s) => s.colorScheme);
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-160, 220],
  });
  const opacity = sweep.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.45, 0],
  });

  const highlightColor =
    colorScheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.55)';

  return (
    <View
      style={[
        styles.base,
        {
          height,
          borderRadius: r,
          backgroundColor: colors.bgDeep,
          borderWidth: 0,
          borderColor: 'transparent',
        },
        width !== undefined ? { width } : { alignSelf: 'stretch' },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.highlight,
          {
            backgroundColor: highlightColor,
            opacity,
            transform: [{ translateX }, { skewX: '-18deg' }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 90,
  },
});

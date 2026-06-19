import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius } from '@/theme/colors';

/**
 * A single shimmering placeholder block. A soft highlight bar sweeps left→right
 * over a warm "paper" base — the loading language used across the Home screen.
 *
 * Pure RN Animated (native driver), no extra deps. All Shimmers on screen share
 * the same cheap looping value, so a full skeleton costs one animation.
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
    outputRange: [0, 0.55, 0],
  });

  return (
    <View
      style={[
        styles.base,
        { height, borderRadius: r },
        width !== undefined ? { width } : { alignSelf: 'stretch' },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.highlight,
          { opacity, transform: [{ translateX }, { skewX: '-18deg' }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.cardAlt,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 90,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
});

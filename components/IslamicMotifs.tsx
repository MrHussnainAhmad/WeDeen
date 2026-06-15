import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';

/**
 * Islamic geometric motifs built from pure React Native Views — no SVG dependency.
 * Two overlapping squares rotated 45° create the classic 8-point star (najmah).
 */

type StarProps = {
  size?: number;
  color?: string;
  filled?: boolean;
  style?: ViewStyle;
};

// 8-point star (Khatam) — two overlapping squares.
export function EightPointStar({ size = 18, color = colors.gold, filled = true, style }: StarProps) {
  const s = size;
  const squareStyle: ViewStyle = filled
    ? { backgroundColor: color }
    : { borderWidth: Math.max(1, size * 0.08), borderColor: color };
  return (
    <View style={[{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: size * 0.08 }, squareStyle]} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: size * 0.08, transform: [{ rotate: '45deg' }] },
          squareStyle,
        ]}
      />
    </View>
  );
}

// Small diamond used to punctuate dividers.
function Diamond({ size = 7, color = colors.gold }: { size?: number; color?: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        transform: [{ rotate: '45deg' }],
        borderRadius: 1.5,
      }}
    />
  );
}

/**
 * Ornamental horizontal divider: thin gold line — diamond — star — diamond — line.
 * The signature "manuscript" separator.
 */
export function GeometricDivider({
  color = colors.gold,
  width,
  style,
}: {
  color?: string;
  width?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.dividerRow, width ? { width } : { alignSelf: 'stretch' }, style]}>
      <View style={[styles.dividerLine, { backgroundColor: color }]} />
      <Diamond size={6} color={color} />
      <EightPointStar size={13} color={color} filled={false} />
      <Diamond size={6} color={color} />
      <View style={[styles.dividerLine, { backgroundColor: color }]} />
    </View>
  );
}

/**
 * Mihrab arch frame — a pointed-arch silhouette used to crown headers/heroes.
 * Built with border-radius on a View; sits behind content.
 */
export function MihrabArch({
  width,
  height = 60,
  color = colors.goldBorder,
  borderWidth = 1.5,
  style,
}: {
  width?: number | string;
  height?: number;
  color?: string;
  borderWidth?: number;
  style?: ViewStyle;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          width: (width as any) ?? '70%',
          height,
          borderColor: color,
          borderWidth,
          borderTopLeftRadius: height,
          borderTopRightRadius: height,
          borderBottomWidth: 0,
        },
        style,
      ]}
    />
  );
}

/**
 * A faint repeating star-grid watermark to lay inside dark heroes.
 * Adds texture without an image asset.
 */
export function StarFieldWatermark({
  rows = 3,
  cols = 6,
  starSize = 12,
  color = 'rgba(255,255,255,0.06)',
  style,
}: {
  rows?: number;
  cols?: number;
  starSize?: number;
  color?: string;
  style?: ViewStyle;
}) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.watermarkWrap, style]}>
      {Array.from({ length: rows }).map((_, r) => (
        <View key={`row-${r}`} style={styles.watermarkRow}>
          {Array.from({ length: cols }).map((_, c) => (
            <EightPointStar key={`s-${r}-${c}`} size={starSize} color={color} filled={false} />
          ))}
        </View>
      ))}
    </View>
  );
}

// Corner flourish — a small quarter ornament for card corners.
export function CornerFlourish({
  size = 26,
  color = colors.goldBorder,
  corner = 'tl',
  style,
}: {
  size?: number;
  color?: string;
  corner?: 'tl' | 'tr' | 'bl' | 'br';
  style?: ViewStyle;
}) {
  const base: ViewStyle = {
    position: 'absolute',
    width: size,
    height: size,
    borderColor: color,
  };
  const map: Record<string, ViewStyle> = {
    tl: { top: 8, left: 8, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderTopLeftRadius: 8 },
    tr: { top: 8, right: 8, borderTopWidth: 1.5, borderRightWidth: 1.5, borderTopRightRadius: 8 },
    bl: { bottom: 8, left: 8, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderBottomLeftRadius: 8 },
    br: { bottom: 8, right: 8, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderBottomRightRadius: 8 },
  };
  return <View pointerEvents="none" style={[base, map[corner], style]} />;
}

const styles = StyleSheet.create({
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.55,
    maxWidth: 90,
  },
  watermarkWrap: {
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
  },
  watermarkRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignSelf: 'stretch',
    paddingHorizontal: 8,
  },
});

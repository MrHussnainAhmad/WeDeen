import { Dimensions, useWindowDimensions } from 'react-native';
import type { ViewStyle } from 'react-native';

/**
 * Breakpoints in dp, matching Android's smallestScreenWidthDp buckets:
 *  - `tablet` (sw600dp) = 7" tablets / large foldables
 *  - `large`  (sw720dp) = 10" tablets
 *
 * Device class is derived from the SMALLEST screen dimension so it stays stable
 * across rotation (the RN equivalent of `smallestScreenWidthDp`). React Native
 * dimensions are already density-independent (dp), so no DPI math is needed.
 */
export const BREAKPOINTS = {
  tablet: 600,
  large: 720,
};

/** Max width a single content column should occupy, by device class. */
export const CONTENT_MAX_WIDTH = {
  phone: undefined as number | undefined,
  tablet: 640,
  large: 760,
};

/** Max width for the floating bottom tab bar so it doesn't stretch on tablets. */
export const TAB_BAR_MAX_WIDTH = 480;

/**
 * Synchronous, non-hook tablet check based on the physical screen's smallest
 * width in dp. Use outside React components; inside components prefer
 * `useResponsive()` so layout reacts to multi-window / rotation.
 */
export function isTabletDevice(): boolean {
  const { width, height } = Dimensions.get('screen');
  return Math.min(width, height) >= BREAKPOINTS.tablet;
}

export type Responsive = {
  width: number;
  height: number;
  /** smallestScreenWidthDp of the current window. */
  smallestWidth: number;
  isTablet: boolean;
  isLarge: boolean;
  isLandscape: boolean;
  contentMaxWidth: number | undefined;
  /** Spread onto a ScrollView/FlatList contentContainerStyle to center content. */
  centerContent: ViewStyle | null;
};

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const smallestWidth = Math.min(width, height);
  const isTablet = smallestWidth >= BREAKPOINTS.tablet;
  const isLarge = smallestWidth >= BREAKPOINTS.large;
  const contentMaxWidth = isLarge
    ? CONTENT_MAX_WIDTH.large
    : isTablet
      ? CONTENT_MAX_WIDTH.tablet
      : CONTENT_MAX_WIDTH.phone;

  return {
    width,
    height,
    smallestWidth,
    isTablet,
    isLarge,
    isLandscape: width > height,
    contentMaxWidth,
    centerContent: contentMaxWidth
      ? { width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }
      : null,
  };
}

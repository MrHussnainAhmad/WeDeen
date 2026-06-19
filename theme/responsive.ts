import { useWindowDimensions } from 'react-native';
import type { ViewStyle } from 'react-native';

/**
 * Width breakpoints. Phones sit below `tablet`; 7"+ tablets and foldables land
 * in `tablet`/`large`. Driven by useWindowDimensions so it reacts live to
 * rotation and Android split-screen / multi-window.
 */
export const BREAKPOINTS = {
  tablet: 600,
  large: 900,
};

/** Max width a single content column should occupy, by device class. */
export const CONTENT_MAX_WIDTH = {
  phone: undefined as number | undefined,
  tablet: 640,
  large: 760,
};

/** Max width for the floating bottom tab bar so it doesn't stretch on tablets. */
export const TAB_BAR_MAX_WIDTH = 480;

export type Responsive = {
  width: number;
  height: number;
  isTablet: boolean;
  isLarge: boolean;
  isLandscape: boolean;
  contentMaxWidth: number | undefined;
  /** Spread onto a ScrollView/FlatList contentContainerStyle to center content. */
  centerContent: ViewStyle | null;
};

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= BREAKPOINTS.tablet;
  const isLarge = width >= BREAKPOINTS.large;
  const contentMaxWidth = isLarge
    ? CONTENT_MAX_WIDTH.large
    : isTablet
      ? CONTENT_MAX_WIDTH.tablet
      : CONTENT_MAX_WIDTH.phone;

  return {
    width,
    height,
    isTablet,
    isLarge,
    isLandscape: width > height,
    contentMaxWidth,
    centerContent: contentMaxWidth
      ? { width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }
      : null,
  };
}

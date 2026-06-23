import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { radius, type ThemeColors } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { useResponsive } from '@/theme/responsive';

type BannerAdSpaceProps = {
  style?: StyleProp<ViewStyle>;
  /** Set true only after the ad network reports that a banner loaded. */
  isAvailable?: boolean;
};

export function BannerAdSpace({ style, isAvailable = false }: BannerAdSpaceProps) {
  const colors = useThemeColors();
  const { isTablet, isLarge } = useResponsive();
  const styles = useMemo(
    () => createStyles(colors, isTablet, isLarge),
    [colors, isTablet, isLarge]
  );

  // No loaded ad means no placeholder, reserved height, or surrounding gap.
  if (!isAvailable) return null;

  return (
    <View
      style={[styles.container, style]}
      accessibilityLabel="Banner advertisement space"
      testID="banner-ad-space"
    >
      <Ionicons
        name="megaphone-outline"
        size={isLarge ? 26 : isTablet ? 22 : 17}
        color={colors.muted}
      />
      <View style={styles.copy}>
        <Text style={styles.label}>ADVERTISEMENT</Text>
        <Text style={styles.hint}>Banner ad space</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors, isTablet: boolean, isLarge: boolean) =>
  StyleSheet.create({
    container: {
      width: '100%',
      maxWidth: isLarge ? 728 : isTablet ? 640 : undefined,
      minHeight: isLarge ? 100 : isTablet ? 90 : 64,
      paddingHorizontal: isTablet ? 24 : 16,
      paddingVertical: isTablet ? 14 : 10,
      alignSelf: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: colors.cardAlt,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: isTablet ? 14 : 10,
    },
    copy: { alignItems: 'flex-start' },
    label: {
      color: colors.muted,
      fontSize: isTablet ? 10.5 : 9,
      fontWeight: '900',
      letterSpacing: 1.4,
    },
    hint: { color: colors.faint, fontSize: isTablet ? 14 : 11.5, marginTop: 2 },
  });

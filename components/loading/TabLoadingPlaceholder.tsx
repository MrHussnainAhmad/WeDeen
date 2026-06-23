import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useThemeColors } from '@/theme/useThemeColors';

/** Borderless tab/screen loading — plain background, optional spinner. No placeholder boxes. */
export function TabLoadingPlaceholder({ spinner = false }: { spinner?: boolean }) {
  const colors = useThemeColors();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.bg }]}>
      {spinner ? <ActivityIndicator color={colors.primary} size="small" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

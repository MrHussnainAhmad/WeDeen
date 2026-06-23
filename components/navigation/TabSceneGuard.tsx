import { useIsFocused } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import { useThemeColors } from '@/theme/useThemeColors';

/**
 * Only paint tab content while focused. Inactive tabs render a solid background
 * so bordered cards / skeletons never bleed into the next tab during switches.
 */
export function TabSceneGuard({ children }: { children: React.ReactNode }) {
  const isFocused = useIsFocused();
  const colors = useThemeColors();

  if (!isFocused) {
    return <View style={[styles.blank, { backgroundColor: colors.bg }]} />;
  }

  return <View style={[styles.live, { backgroundColor: colors.bg }]}>{children}</View>;
}

const styles = StyleSheet.create({
  blank: { flex: 1 },
  live: { flex: 1 },
});

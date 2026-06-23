import { useThemeStore } from '@/store/themeStore';
import { getColors, type ThemeColors } from '@/theme/colors';

export function useThemeColors(): ThemeColors {
  const colorScheme = useThemeStore((s) => s.colorScheme);
  return getColors(colorScheme);
}

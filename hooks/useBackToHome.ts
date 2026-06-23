import { useNavigation, useSegments } from 'expo-router';
import { useCallback } from 'react';
import { useHardwareBack } from '@/hooks/useHardwareBack';

const HOME_TAB = 'index';

const STACK_ROOTS = new Set([
  'quran',
  'hadith',
  'settings',
  'qibla',
  'names',
  'salah-focus',
  'blocked',
]);

/** Android back on a non-home tab → Home. Prefer CustomTabBar handler when tabs are visible. */
export function useBackToHome() {
  const navigation = useNavigation<any>();
  const segments = useSegments();

  const handler = useCallback(() => {
    const root = segments[0];
    if (root && STACK_ROOTS.has(root)) return false;

    const state = navigation.getState?.();
    const routeName = state?.routes?.[state.index ?? 0]?.name as string | undefined;
    if (!routeName || routeName === HOME_TAB) return false;

    // Jump to the tab navigator when this hook runs from inside a tab screen.
    const tabNav = navigation.getParent?.() ?? navigation;
    tabNav.navigate(HOME_TAB);
    return true;
  }, [navigation, segments]);

  useHardwareBack(handler);
}

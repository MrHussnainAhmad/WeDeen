import { Platform, Linking, Alert } from 'react-native';
import Constants from 'expo-constants';

let focusActive = false;
let savedIosVolume: number | null = null;

type VolumeManagerModule = {
  getVolume: () => Promise<{ volume: number }>;
  setVolume: (volume: number, config?: { showUI?: boolean }) => Promise<void>;
  setRingerMode: (mode: number) => Promise<number | undefined>;
};

type VolumeManagerExtras = {
  RINGER_MODE: { silent: number; normal: number };
};

/** Lazy-load so Expo Go / unlinked native builds don't crash at import time. */
function getVolumeManager(): (VolumeManagerModule & VolumeManagerExtras) | null {
  if (Constants.appOwnership === 'expo') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-volume-manager');
  } catch {
    return null;
  }
}

export function isQuranFocusActive(): boolean {
  return focusActive;
}

export async function checkDndPermission(): Promise<boolean> {
  if (Platform.OS === 'android') return false;
  // iOS has no programmatic DND toggle — user manages Focus in Settings.
  return true;
}

export function openDndSettings(): void {
  Linking.openSettings().catch(() => undefined);
}

export async function enableQuranFocus(): Promise<{ ok: boolean; reason?: 'permission' | 'unsupported' }> {
  if (Constants.appOwnership === 'expo') {
    focusActive = true;
    return { ok: true };
  }

  if (Platform.OS === 'android') {
    focusActive = true;
    return { ok: true, reason: 'unsupported' };
  }

  if (Platform.OS === 'ios') {
    const vm = getVolumeManager();
    if (vm) {
      try {
        const { volume } = await vm.getVolume();
        savedIosVolume = volume;
        await vm.setVolume(0, { showUI: false });
      } catch {
        // Non-fatal — still mark focus active for in-app suppression.
      }
    }
    focusActive = true;
    return { ok: true };
  }

  focusActive = true;
  return { ok: true };
}

export async function disableQuranFocus(): Promise<void> {
  if (Constants.appOwnership === 'expo') {
    focusActive = false;
    return;
  }

  if (Platform.OS === 'ios' && savedIosVolume != null) {
    const vm = getVolumeManager();
    if (vm) {
      try {
        await vm.setVolume(savedIosVolume, { showUI: false });
      } catch {
        // Ignore restore failures.
      }
    }
    savedIosVolume = null;
  }

  focusActive = false;
}

export function showFocusPermissionAlert(onOpenSettings: () => void): void {
  Alert.alert(
    'Do Not Disturb access',
    'Focus Mode silences your phone for uninterrupted Quran reading. Allow Do Not Disturb access in system settings, then try again.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open settings', onPress: onOpenSettings },
    ]
  );
}

/** Fallback silent ringer when DND permission is denied on Android. */
export async function enableSilentRingerFallback(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const vm = getVolumeManager();
  if (!vm) {
    focusActive = true;
    return;
  }
  try {
    await vm.setRingerMode(vm.RINGER_MODE.silent);
    focusActive = true;
  } catch {
    focusActive = true;
  }
}

export async function restoreRingerFallback(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const vm = getVolumeManager();
  if (!vm) {
    focusActive = false;
    return;
  }
  try {
    await vm.setRingerMode(vm.RINGER_MODE.normal);
  } catch {
    // Ignore.
  }
  focusActive = false;
}

import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Thin, defensive wrapper around react-native-volume-manager to read/set the
 * device's ALARM-stream volume. It's a native module, so it only works in a
 * dev/EAS build — in Expo Go (or if the module is missing) every call is a
 * safe no-op and the in-app playback gain is used instead.
 */

let VolumeManager: any = null;
let resolved = false;

function getVolumeManager(): any | null {
  if (resolved) return VolumeManager;
  resolved = true;
  if (Constants.appOwnership === 'expo') return (VolumeManager = null); // not in Expo Go
  try {
    VolumeManager = require('react-native-volume-manager').VolumeManager ?? null;
  } catch {
    VolumeManager = null;
  }
  return VolumeManager;
}

export function isAlarmVolumeSupported() {
  return getVolumeManager() != null;
}

/** Current alarm volume as 0..1, or null if unavailable. */
export async function getAlarmVolume(): Promise<number | null> {
  const vm = getVolumeManager();
  if (!vm) return null;
  try {
    const res = Platform.OS === 'android' ? await vm.getVolume('alarm') : await vm.getVolume();
    const v = typeof res === 'number' ? res : res?.volume;
    return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : null;
  } catch {
    return null;
  }
}

/** Set the device alarm-stream volume (0..1). No-op when unsupported. */
export async function setAlarmVolume(value: number): Promise<void> {
  const vm = getVolumeManager();
  if (!vm) return;
  const v = Math.max(0, Math.min(1, value));
  try {
    if (Platform.OS === 'android') {
      await vm.setVolume(v, { type: 'alarm', showUI: false, playSound: false });
    } else {
      await vm.setVolume(v, { showUI: false });
    }
  } catch {
    // ignore — best effort
  }
}

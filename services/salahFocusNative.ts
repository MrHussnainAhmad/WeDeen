import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform, Linking } from 'react-native';
import { getPrayerLockOverlayPool } from './prayerLockDialogues';
import { expandBlockedPackages } from '@/constants/blockedAppAliases';

type AndroidBlockableApp = {
  packageName: string;
  name: string;
  iconBase64?: string | null;
};

export type { AndroidBlockableApp };

type ExpoAppBlockerNative = {
  checkOverlayPermission(): Promise<boolean>;
  checkUsageStatsPermission(): Promise<boolean>;
  checkNotificationPermission(): Promise<boolean>;
  openOverlaySettings(): void;
  openUsageStatsSettings(): void;
  getInstalledApps(): Promise<AndroidBlockableApp[]>;
  setBlockedApps(packageNames: string[]): void;
  setAndroidConfig(config: Record<string, unknown>): void;
  startMonitoring(): void;
  stopMonitoring(): void;
  temporaryUnlockAndroid(minutes: number): void;
  relockAndroid(): void;
};

let native: ExpoAppBlockerNative | null | undefined;

function getNative(): ExpoAppBlockerNative | null {
  if (native !== undefined) return native;
  if (Platform.OS !== 'android' || Constants.appOwnership === 'expo') {
    native = null;
    return native;
  }
  native = requireOptionalNativeModule<ExpoAppBlockerNative>('ExpoAppBlocker');
  return native;
}

export function isSalahFocusNativeSupported() {
  return getNative() != null;
}

export async function getSalahFocusPermissionStatus() {
  const mod = getNative();
  if (!mod) return { allGranted: false, supported: false };
  const [overlay, usageStats, notifications] = await Promise.all([
    mod.checkOverlayPermission(),
    mod.checkUsageStatsPermission(),
    mod.checkNotificationPermission(),
  ]);
  return {
    allGranted: overlay && usageStats && notifications,
    supported: true,
    overlay,
    usageStats,
    notifications,
  };
}

export async function requestSalahFocusPermissions() {
  return getSalahFocusPermissionStatus();
}

export function openSalahFocusOverlaySettings() {
  getNative()?.openOverlaySettings();
}

export function openSalahFocusUsageStatsSettings() {
  getNative()?.openUsageStatsSettings();
}

export async function listBlockableAndroidApps(): Promise<AndroidBlockableApp[]> {
  const mod = getNative();
  if (!mod) return [];
  try {
    const apps = await mod.getInstalledApps();
    return Array.isArray(apps) ? apps : [];
  } catch {
    return [];
  }
}

export function configureSalahFocusOverlay(message?: string) {
  const mod = getNative();
  if (!mod) return;
  try {
    const dialogue = message ?? getPrayerLockOverlayPool();
    mod.setAndroidConfig({
      overlayTitle: 'WeDeen',
      overlayText: dialogue,
      overlayBackgroundColor: '#0F3D2E',
      overlayTitleColor: '#FFFFFF',
      overlayTextColor: 'rgba(255,255,255,0.88)',
      overlayTitleFontSize: 22,
      overlayTextFontSize: 15,
      overlayShowSpinner: false,
      overlaySpinnerColor: '#C59B27',
      notificationTitle: '',
      notificationText: '',
    });
  } catch {
    // non-fatal
  }
}

export function applyAndroidBlocking(packageNames: string[]) {
  try {
    const expanded = expandBlockedPackages(packageNames);
    getNative()?.setBlockedApps(expanded);
  } catch {
    // non-fatal
  }
}

export function startAndroidMonitoring() {
  try {
    getNative()?.startMonitoring();
  } catch {
    // non-fatal
  }
}

export function stopAndroidMonitoring() {
  try {
    getNative()?.stopMonitoring();
  } catch {
    // non-fatal
  }
}

export async function emergencyUnlockMinutes(minutes: number) {
  try {
    getNative()?.temporaryUnlockAndroid(Math.max(1, Math.round(minutes)));
  } catch {
    // non-fatal
  }
}

export async function relockSalahFocusApps() {
  try {
    getNative()?.relockAndroid();
  } catch {
    // non-fatal
  }
}

/** Open a blocked app after emergency unlock (Android only). */
export function launchAndroidPackage(packageName: string) {
  if (Platform.OS !== 'android') return;
  const pkg = packageName.trim();
  if (!pkg) return;
  Linking.openURL(
    `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${pkg};end`
  ).catch(() => undefined);
}

import { NativeModules, NativeEventEmitter, EmitterSubscription, Platform } from 'react-native';

// ── Types ─────────────────────────────────────────────────────────────────────

export type InstalledApp = {
  name: string;
  packageName: string;
  icon: string | null; // data:image/png;base64,... or null
};

export type LockResolvedEvent = {
  packageName: string;
  method: 'prayed' | 'emergency' | 'declined';
  timestamp: number;
};

// ── Native Module ─────────────────────────────────────────────────────────────

const { PrayerLockModule: NativeModule } = NativeModules;

if (!NativeModule && Platform.OS === 'android') {
  console.warn('[PrayerLock] Native module not found. Ensure PrayerLockPackage is registered in MainApplication.kt');
}

// ── Event Emitter ─────────────────────────────────────────────────────────────

let emitter: NativeEventEmitter | null = null;

function getEmitter(): NativeEventEmitter {
  if (!emitter && NativeModule) {
    emitter = new NativeEventEmitter(NativeModule);
  }
  return emitter!;
}

// ── Monitoring ────────────────────────────────────────────────────────────────

/** Start foreground polling service with given locked package list. */
export function startMonitoring(packages: string[]): void {
  if (!NativeModule) return;
  NativeModule.startMonitoring(packages);
}

/** Stop foreground polling service. */
export function stopMonitoring(): void {
  if (!NativeModule) return;
  NativeModule.stopMonitoring();
}

/** Update locked packages while service is running (no restart needed). */
export function updateLockedPackages(packages: string[]): void {
  if (!NativeModule) return;
  NativeModule.updateLockedPackages(packages);
}

/** Get all user-visible installed apps (sorted by name, with base64 icons). */
export async function getInstalledApps(): Promise<InstalledApp[]> {
  if (!NativeModule) return [];
  return NativeModule.getInstalledApps();
}

// ── Permission: Usage Access (PACKAGE_USAGE_STATS) ────────────────────────────

/** Returns true if Usage Access is granted (required for queryEvents polling). */
export async function checkUsageAccessPermission(): Promise<boolean> {
  if (!NativeModule) return false;
  return NativeModule.checkUsageAccessPermission();
}

/** Opens ACTION_USAGE_ACCESS_SETTINGS so user can grant usage access. */
export function requestUsageAccessPermission(): void {
  if (!NativeModule) return;
  NativeModule.requestUsageAccessPermission();
}

// ── Permission: Overlay (SYSTEM_ALERT_WINDOW) ─────────────────────────────────

/** Returns true if Display Over Other Apps is granted (required to launch overlay from bg). */
export async function checkOverlayPermission(): Promise<boolean> {
  if (!NativeModule) return false;
  return NativeModule.checkOverlayPermission();
}

/** Opens ACTION_MANAGE_OVERLAY_PERMISSION for this package. */
export function requestOverlayPermission(): void {
  if (!NativeModule) return;
  NativeModule.requestOverlayPermission();
}

// ── Permission: Battery ───────────────────────────────────────────────────────

/** Returns true if app is exempt from battery optimization. */
export async function checkBatteryOptimizationExempt(): Promise<boolean> {
  if (!NativeModule) return false;
  return NativeModule.checkBatteryOptimizationExempt();
}

/** OEM-aware: requests battery exemption or opens app details as fallback. */
export function requestBatteryOptimizationExempt(): void {
  if (!NativeModule) return;
  NativeModule.requestBatteryOptimizationExempt();
}

// ── Events ────────────────────────────────────────────────────────────────────

/**
 * Listen for overlay resolution events.
 * Fires when user taps "I Have Prayed", "Emergency", or back-dismisses.
 * @returns EmitterSubscription — call .remove() on component unmount.
 */
export function addLockResolvedListener(
  callback: (event: LockResolvedEvent) => void
): EmitterSubscription {
  return getEmitter().addListener('onLockResolved', callback);
}

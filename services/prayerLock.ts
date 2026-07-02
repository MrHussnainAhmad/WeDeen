import { NativeEventEmitter, NativeModules } from 'react-native';

const { PrayerLockModule } = NativeModules;

if (!PrayerLockModule) {
  console.warn(
    '[PrayerLock] Native module not found. Run `expo prebuild` and rebuild the native app.'
  );
}

export interface InstalledApp {
  name: string;
  packageName: string;
  /** data:image/png;base64,... — may be null if icon encoding failed */
  icon: string | null;
}

export type LockMethod = 'prayed' | 'emergency' | 'declined';

export interface LockResolvedEvent {
  packageName: string;
  method: LockMethod;
  /** epoch ms */
  timestamp: number;
}

const emitter = PrayerLockModule ? new NativeEventEmitter(PrayerLockModule) : null;

const PrayerLock = {
  /**
   * Start the foreground monitor service with the given locked package names.
   * Writes packages to SharedPrefs ("locked_packages" JSON array) then starts
   * PrayerLockMonitorService via startForegroundService.
   */
  startMonitoring(lockedPackages: string[]): void {
    PrayerLockModule?.startMonitoring(lockedPackages);
  },

  /** Stop PrayerLockMonitorService. */
  stopMonitoring(): void {
    PrayerLockModule?.stopMonitoring();
  },

  /**
   * Hot-update the locked-package list without restarting the service.
   * Service reads SharedPrefs on next 1 s poll tick.
   */
  updateLockedPackages(packages: string[]): void {
    PrayerLockModule?.updateLockedPackages(packages);
  },

  /** Returns all user-launchable apps (CATEGORY_LAUNCHER), excluding WeDeen itself. */
  getInstalledApps(): Promise<InstalledApp[]> {
    return PrayerLockModule?.getInstalledApps() ?? Promise.resolve([]);
  },

  checkUsageStatsPermission(): Promise<boolean> {
    return PrayerLockModule?.checkUsageStatsPermission() ?? Promise.resolve(false);
  },

  /** Opens ACTION_USAGE_ACCESS_SETTINGS. */
  requestUsageStatsPermission(): void {
    PrayerLockModule?.requestUsageStatsPermission();
  },

  checkOverlayPermission(): Promise<boolean> {
    return PrayerLockModule?.checkOverlayPermission() ?? Promise.resolve(false);
  },

  /** Opens ACTION_MANAGE_OVERLAY_PERMISSION for this package. */
  requestOverlayPermission(): void {
    PrayerLockModule?.requestOverlayPermission();
  },

  checkBatteryOptimizationExemption(): Promise<boolean> {
    return PrayerLockModule?.checkBatteryOptimizationExemption() ?? Promise.resolve(false);
  },

  /** Opens ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS for this package. */
  requestBatteryOptimizationExemption(): void {
    PrayerLockModule?.requestBatteryOptimizationExemption();
  },

  /**
   * Subscribe to overlay dismiss events.
   * method: 'prayed' | 'emergency' | 'declined' (back-button)
   * Returns an unsubscribe function.
   */
  onLockResolved(listener: (event: LockResolvedEvent) => void): () => void {
    if (!emitter) return () => {};
    const subscription = emitter.addListener('onLockResolved', listener);
    return () => subscription.remove();
  },
};

export default PrayerLock;

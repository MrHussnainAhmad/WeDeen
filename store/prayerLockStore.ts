import { create } from 'zustand';
import { EmitterSubscription } from 'react-native';
import {
  InstalledApp,
  LockResolvedEvent,
  startMonitoring,
  stopMonitoring,
  updateLockedPackages,
  getInstalledApps,
  checkUsageAccessPermission,
  checkOverlayPermission,
  checkBatteryOptimizationExempt,
  addLockResolvedListener,
} from '@/services/prayerLock';

// ── State Shape ───────────────────────────────────────────────────────────────

type UnlockEvent = {
  packageName: string;
  method: 'prayed' | 'emergency' | 'declined';
  timestamp: number;
};

type Permissions = {
  usageAccess: boolean;     // PACKAGE_USAGE_STATS — needed for queryEvents polling
  overlay: boolean;         // SYSTEM_ALERT_WINDOW — needed to launch overlay from service
  batteryExemption: boolean;// Battery optimization exempt — keeps service alive
};

type PrayerLockState = {
  lockedPackages: string[];
  isMonitoringActive: boolean;
  permissions: Permissions;
  permissionsChecked: boolean;
  installedApps: InstalledApp[];
  appsLoading: boolean;
  unlockHistory: UnlockEvent[];
  testSecondsLeft: number | null;
  testTimerRef: ReturnType<typeof setInterval> | null;
  _subscription: EmitterSubscription | null;
};

type PrayerLockActions = {
  refreshPermissions: () => Promise<void>;
  loadInstalledApps: () => Promise<void>;
  toggleApp: (packageName: string) => void;
  toggleMonitoring: () => Promise<void>;
  addHistoryEvent: (event: LockResolvedEvent) => void;
  clearHistory: () => void;
  startTestMode: (durationSeconds?: number) => void;
  stopTestMode: () => void;
  _startListening: () => void;
  _stopListening: () => void;
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const usePrayerLockStore = create<PrayerLockState & PrayerLockActions>((set, get) => ({
  lockedPackages: [],
  isMonitoringActive: false,
  permissions: { usageAccess: false, overlay: false, batteryExemption: false },
  permissionsChecked: false,
  installedApps: [],
  appsLoading: false,
  unlockHistory: [],
  testSecondsLeft: null,
  testTimerRef: null,
  _subscription: null,

  // ── Permissions ────────────────────────────────────────────────────────────

  refreshPermissions: async () => {
    const [usageAccess, overlay, batteryExemption] = await Promise.all([
      checkUsageAccessPermission(),
      checkOverlayPermission(),
      checkBatteryOptimizationExempt(),
    ]);
    set({
      permissions: { usageAccess, overlay, batteryExemption },
      permissionsChecked: true,
    });

    // If critical perms revoked, force monitoring off
    if ((!usageAccess || !overlay) && get().isMonitoringActive) {
      stopMonitoring();
      get()._stopListening();
      set({ isMonitoringActive: false });
    }
  },

  // ── App list ───────────────────────────────────────────────────────────────

  loadInstalledApps: async () => {
    set({ appsLoading: true });
    try {
      const apps = await getInstalledApps();
      set({ installedApps: apps });
    } catch (e) {
      console.error('[PrayerLockStore] loadInstalledApps error:', e);
    } finally {
      set({ appsLoading: false });
    }
  },

  // ── Lock toggle ────────────────────────────────────────────────────────────

  toggleApp: (packageName: string) => {
    const { lockedPackages, isMonitoringActive } = get();
    const next = lockedPackages.includes(packageName)
      ? lockedPackages.filter((p) => p !== packageName)
      : [...lockedPackages, packageName];
    set({ lockedPackages: next });
    if (isMonitoringActive) updateLockedPackages(next);
  },

  // ── Monitoring ─────────────────────────────────────────────────────────────

  toggleMonitoring: async () => {
    const { isMonitoringActive, lockedPackages, permissions } = get();

    if (isMonitoringActive) {
      stopMonitoring();
      get()._stopListening();
      set({ isMonitoringActive: false });
    } else {
      // Both usage access AND overlay required to function
      if (!permissions.usageAccess || !permissions.overlay) {
        console.warn('[PrayerLockStore] Missing required permissions — cannot start monitoring');
        return;
      }
      startMonitoring(lockedPackages);
      get()._startListening();
      set({ isMonitoringActive: true });
    }
  },

  // ── History ────────────────────────────────────────────────────────────────

  addHistoryEvent: (event: LockResolvedEvent) => {
    set((s) => ({
      unlockHistory: [event, ...s.unlockHistory].slice(0, 100),
    }));
  },

  clearHistory: () => set({ unlockHistory: [] }),

  // ── Test mode ──────────────────────────────────────────────────────────────

  startTestMode: (durationSeconds = 300) => {
    const { lockedPackages, permissions } = get();
    if (!permissions.usageAccess || !permissions.overlay || lockedPackages.length === 0) return;

    startMonitoring(lockedPackages);
    get()._startListening();
    set({ isMonitoringActive: true, testSecondsLeft: durationSeconds });

    const ref = setInterval(() => {
      const left = get().testSecondsLeft;
      if (left === null || left <= 1) {
        get().stopTestMode();
      } else {
        set({ testSecondsLeft: left - 1 });
      }
    }, 1000);

    set({ testTimerRef: ref });
  },

  stopTestMode: () => {
    const { testTimerRef } = get();
    if (testTimerRef) clearInterval(testTimerRef);
    stopMonitoring();
    get()._stopListening();
    set({ isMonitoringActive: false, testSecondsLeft: null, testTimerRef: null });
  },

  // ── Event listener ─────────────────────────────────────────────────────────

  _startListening: () => {
    get()._stopListening();
    const sub = addLockResolvedListener((event) => {
      get().addHistoryEvent(event);
      
      // Handle unlock logic based on resolution method
      if (event.method === 'emergency') {
        // Unlock only the specific app
        const { lockedPackages, isMonitoringActive } = get();
        const next = lockedPackages.filter((p) => p !== event.packageName);
        set({ lockedPackages: next });
        if (isMonitoringActive) updateLockedPackages(next);
      } else if (event.method === 'prayed') {
        // Unlock all apps
        set({ lockedPackages: [] });
        const { isMonitoringActive } = get();
        if (isMonitoringActive) updateLockedPackages([]);
      }
    });
    set({ _subscription: sub });
  },

  _stopListening: () => {
    get()._subscription?.remove();
    set({ _subscription: null });
  },
}));

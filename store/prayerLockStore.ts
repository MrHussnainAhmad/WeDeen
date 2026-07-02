import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { create } from 'zustand';
import PrayerLock, { InstalledApp, LockResolvedEvent } from '@/services/prayerLock';

const STORAGE_KEY = 'prayer_lock_state';

export interface UnlockEvent {
  packageName: string;
  method: 'prayed' | 'emergency' | 'declined';
  timestamp: number;
}

interface PermissionFlags {
  usageStats: boolean;
  overlay: boolean;
  batteryExemption: boolean;
}

interface PrayerLockState {
  // Persisted
  lockedPackages: string[];
  isMonitoringActive: boolean;
  unlockHistory: UnlockEvent[];

  // Volatile
  installedApps: InstalledApp[];
  permissions: PermissionFlags;
  appsLoading: boolean;
  permissionsChecked: boolean;
  testTimerId: ReturnType<typeof setTimeout> | null;
  testSecondsLeft: number | null; // null = not in test mode

  // Actions
  hydrate: () => Promise<void>;
  toggleAppLock: (packageName: string) => Promise<void>;
  setMonitoringActive: (active: boolean) => Promise<void>;
  recordUnlockEvent: (event: LockResolvedEvent) => Promise<void>;
  loadInstalledApps: () => Promise<void>;
  checkAllPermissions: () => Promise<PermissionFlags>;
  startTestMode: () => void;
  stopTestMode: () => void;
}

// ── Persistence helpers ──────────────────────────────────────────────────────

type PersistedSlice = {
  lockedPackages: string[];
  isMonitoringActive: boolean;
  unlockHistory: UnlockEvent[];
};

async function loadPersistedState(): Promise<Partial<PersistedSlice>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedSlice) : {};
  } catch {
    return {};
  }
}

async function persistState(state: PersistedSlice) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Non-fatal — in-memory state still works.
  }
}

// ── Store ────────────────────────────────────────────────────────────────────

let unsubscribeLockResolved: (() => void) | null = null;

export const usePrayerLockStore = create<PrayerLockState>((set, get) => ({
  lockedPackages: [],
  isMonitoringActive: false,
  unlockHistory: [],
  installedApps: [],
  permissions: { usageStats: false, overlay: false, batteryExemption: false },
  appsLoading: false,
  permissionsChecked: false,
  testTimerId: null,
  testSecondsLeft: null,

  hydrate: async () => {
    const saved = await loadPersistedState();
    set({
      lockedPackages: saved.lockedPackages ?? [],
      isMonitoringActive: saved.isMonitoringActive ?? false,
      unlockHistory: saved.unlockHistory ?? [],
    });

    // Re-subscribe to events on hydrate (handles cold-start).
    if (unsubscribeLockResolved) unsubscribeLockResolved();
    unsubscribeLockResolved = PrayerLock.onLockResolved((event) => {
      get().recordUnlockEvent(event);
    });

    // If monitoring was active before app was killed, restart service.
    if (saved.isMonitoringActive && saved.lockedPackages?.length) {
      PrayerLock.startMonitoring(saved.lockedPackages);
    }

    // Check permissions on hydrate so UI gate works immediately.
    await get().checkAllPermissions();
  },

  toggleAppLock: async (packageName) => {
    const { lockedPackages, isMonitoringActive } = get();
    const isLocked = lockedPackages.includes(packageName);
    const next = isLocked
      ? lockedPackages.filter((p) => p !== packageName)
      : [...lockedPackages, packageName];

    set({ lockedPackages: next });
    await persistState({ lockedPackages: next, isMonitoringActive, unlockHistory: get().unlockHistory });

    // Hot-update the service if running.
    if (isMonitoringActive) {
      PrayerLock.updateLockedPackages(next);
    }
  },

  setMonitoringActive: async (active) => {
    const { lockedPackages, unlockHistory } = get();
    set({ isMonitoringActive: active });
    await persistState({ lockedPackages, isMonitoringActive: active, unlockHistory });

    if (active) {
      PrayerLock.startMonitoring(lockedPackages);
    } else {
      PrayerLock.stopMonitoring();
    }
  },

  recordUnlockEvent: async (event) => {
    const { lockedPackages, isMonitoringActive, unlockHistory } = get();
    const entry: UnlockEvent = {
      packageName: event.packageName,
      method: event.method,
      timestamp: event.timestamp,
    };
    // Keep latest 200 events.
    const next = [entry, ...unlockHistory].slice(0, 200);
    set({ unlockHistory: next });
    await persistState({ lockedPackages, isMonitoringActive, unlockHistory: next });
  },

  loadInstalledApps: async () => {
    set({ appsLoading: true });
    try {
      const apps = await PrayerLock.getInstalledApps();
      // Sort alphabetically by name.
      apps.sort((a, b) => a.name.localeCompare(b.name));
      set({ installedApps: apps });
    } catch (e) {
      console.warn('[PrayerLock] getInstalledApps failed:', e);
    } finally {
      set({ appsLoading: false });
    }
  },

  checkAllPermissions: async () => {
    const [usageStats, overlay, batteryExemption] = await Promise.all([
      PrayerLock.checkUsageStatsPermission(),
      PrayerLock.checkOverlayPermission(),
      PrayerLock.checkBatteryOptimizationExemption(),
    ]);
    const flags: PermissionFlags = { usageStats, overlay, batteryExemption };
    set({ permissions: flags, permissionsChecked: true });
    return flags;
  },

  startTestMode: () => {
    const { testTimerId, setMonitoringActive } = get();
    // Clear any existing test timer.
    if (testTimerId) clearTimeout(testTimerId);

    const TEST_DURATION = 5 * 60; // 300 seconds
    setMonitoringActive(true);
    set({ testSecondsLeft: TEST_DURATION });

    // Countdown tick every second.
    let remaining = TEST_DURATION;
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) {
        get().stopTestMode();
        return;
      }
      set({ testSecondsLeft: remaining });
      const id = setTimeout(tick, 1000);
      set({ testTimerId: id });
    };
    const id = setTimeout(tick, 1000);
    set({ testTimerId: id });
  },

  stopTestMode: () => {
    const { testTimerId } = get();
    if (testTimerId) clearTimeout(testTimerId);
    set({ testTimerId: null, testSecondsLeft: null });
    get().setMonitoringActive(false);
  },
}));

// Re-check permissions on app foreground (user may have just granted them).
AppState.addEventListener('change', (nextState) => {
  if (nextState === 'active') {
    usePrayerLockStore.getState().checkAllPermissions().catch(() => undefined);
  }
});

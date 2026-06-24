import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useAuthStore } from '@/store/authStore';
import { markPrayerAsPrayed, getTodayStr } from './prayerTrackerService';
import {
  getActivePrayerWindow,
  gregorianKey,
  isPrayerLocationConfigured,
  type PrayerLabel,
  type PrayerLocation,
} from './prayerTimingUtils';
import { isEmergencyUnlockExcluded } from '@/constants/salahFocusEmergency';
import {
  applyAndroidBlocking,
  configureSalahFocusOverlay,
  getSalahFocusPermissionStatus,
  isSalahFocusNativeSupported,
  relockSalahFocusApps,
  startAndroidMonitoring,
  stopAndroidMonitoring,
} from './salahFocusNative';

const CONFIG_KEY = 'salah_focus_config_v1';
const LOCATION_KEY = 'timings_location_v1';
const EMERGENCY_UNLOCK_KEY = 'salah_focus_emergency_v1';
const TEST_LOCK_KEY = 'salah_focus_test_v1';
const DEFAULT_WINDOW_MINUTES = 30;
const DEFAULT_EMERGENCY_MINUTES = 15;
const TEST_LOCK_MINUTES = 5;

export type SalahFocusConfig = {
  enabled: boolean;
  setupComplete: boolean;
  consentAccepted: boolean;
  windowMinutes: number;
  androidBlockedPackages: string[];
  /** dateKey (DD-MM-YYYY) → completed prayer labels */
  completedByDate: Record<string, PrayerLabel[]>;
};

const DEFAULT_CONFIG: SalahFocusConfig = {
  enabled: false,
  setupComplete: false,
  consentAccepted: false,
  windowMinutes: DEFAULT_WINDOW_MINUTES,
  androidBlockedPackages: [],
  completedByDate: {},
};

export type SalahFocusRuntimeState = {
  supported: boolean;
  enabled: boolean;
  setupComplete: boolean;
  isLockActive: boolean;
  isTestLock: boolean;
  activePrayer: PrayerLabel | null;
  windowEndsAt: number | null;
  completedToday: PrayerLabel[];
};

let tickPromise: Promise<SalahFocusRuntimeState> | null = null;
let monitoringActive = false;
let pendingUnlockPrompt = false;

export function requestSalahUnlockPrompt() {
  pendingUnlockPrompt = true;
}

export function consumeSalahUnlockPrompt() {
  const value = pendingUnlockPrompt;
  pendingUnlockPrompt = false;
  return value;
}

export function isSalahFocusSupported() {
  return isSalahFocusNativeSupported();
}

export async function getSalahFocusConfig(): Promise<SalahFocusConfig> {
  const raw = await AsyncStorage.getItem(CONFIG_KEY);
  if (!raw) return { ...DEFAULT_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Partial<SalahFocusConfig> & {
      iosBlockedItems?: unknown;
      iosSelectionData?: unknown;
    };
    return {
      enabled: !!parsed.enabled,
      setupComplete: !!parsed.setupComplete,
      consentAccepted: !!parsed.consentAccepted,
      windowMinutes:
        typeof parsed.windowMinutes === 'number' && parsed.windowMinutes >= 5
          ? Math.min(120, parsed.windowMinutes)
          : DEFAULT_WINDOW_MINUTES,
      androidBlockedPackages: Array.isArray(parsed.androidBlockedPackages)
        ? parsed.androidBlockedPackages
        : [],
      completedByDate:
        parsed.completedByDate && typeof parsed.completedByDate === 'object'
          ? (parsed.completedByDate as Record<string, PrayerLabel[]>)
          : {},
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveSalahFocusConfig(patch: Partial<SalahFocusConfig>) {
  const current = await getSalahFocusConfig();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  return next;
}

export async function getSalahFocusTotalCompleted(): Promise<number> {
  const config = await getSalahFocusConfig();
  let count = 0;
  for (const dateKey in config.completedByDate) {
    count += config.completedByDate[dateKey].length;
  }
  return count;
}

async function getSavedPrayerLocation(): Promise<PrayerLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_KEY);
    return raw ? (JSON.parse(raw) as PrayerLocation) : null;
  } catch {
    return null;
  }
}

function hasBlockedTargets(config: SalahFocusConfig) {
  return config.androidBlockedPackages.length > 0;
}

function isPrayerCompleted(config: SalahFocusConfig, dateKey: string, prayer: PrayerLabel) {
  return (config.completedByDate[dateKey] ?? []).includes(prayer);
}

type EmergencyUnlockState = {
  expiresAt: number;
  unlockedPackage: string;
};

type TestLockState = {
  expiresAt: number;
};

export type TestPrayerLockStatus = {
  active: boolean;
  expiresAt: number | null;
  secondsLeft: number;
};

export type StartTestPrayerLockResult =
  | { ok: true; expiresAt: number }
  | { ok: false; reason: 'unsupported' | 'no_apps' | 'permissions' };

async function readTestLockState(): Promise<TestLockState | null> {
  const raw = await AsyncStorage.getItem(TEST_LOCK_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TestLockState;
    if (typeof parsed.expiresAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function clearTestLockState() {
  await AsyncStorage.removeItem(TEST_LOCK_KEY);
}

export async function getTestPrayerLockStatus(now = Date.now()): Promise<TestPrayerLockStatus> {
  const testLock = await readTestLockState();
  if (!testLock || testLock.expiresAt <= now) {
    if (testLock) await clearTestLockState();
    return { active: false, expiresAt: null, secondsLeft: 0 };
  }
  return {
    active: true,
    expiresAt: testLock.expiresAt,
    secondsLeft: Math.max(0, Math.ceil((testLock.expiresAt - now) / 1000)),
  };
}

export async function startTestPrayerLock(
  minutes = TEST_LOCK_MINUTES
): Promise<StartTestPrayerLockResult> {
  if (!isSalahFocusSupported()) {
    return { ok: false, reason: 'unsupported' };
  }

  const config = await getSalahFocusConfig();
  if (!config.androidBlockedPackages.length) {
    return { ok: false, reason: 'no_apps' };
  }

  const perms = await getSalahFocusPermissionStatus();
  if (!perms.allGranted) {
    return { ok: false, reason: 'permissions' };
  }

  const expiresAt = Date.now() + minutes * 60_000;
  await AsyncStorage.setItem(TEST_LOCK_KEY, JSON.stringify({ expiresAt } satisfies TestLockState));
  await activateBlocking(config);
  return { ok: true, expiresAt };
}

export async function stopTestPrayerLock() {
  await clearTestLockState();
  return tickSalahFocus();
}

export type EmergencyUnlockResult =
  | { ok: true; expiresAt: number; appName?: string }
  | { ok: false; reason: 'excluded' | 'not_blocked' | 'not_locked' | 'missing_package' };

async function readEmergencyUnlockState(): Promise<EmergencyUnlockState | null> {
  const raw = await AsyncStorage.getItem(EMERGENCY_UNLOCK_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as EmergencyUnlockState;
    if (typeof parsed.expiresAt !== 'number' || typeof parsed.unlockedPackage !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function clearEmergencyUnlockState() {
  await AsyncStorage.removeItem(EMERGENCY_UNLOCK_KEY);
}

function packagesWhileEmergencyActive(
  allPackages: string[],
  emergency: EmergencyUnlockState,
  now = Date.now()
) {
  if (emergency.expiresAt <= now) return allPackages;
  return allPackages.filter((pkg) => {
    if (isEmergencyUnlockExcluded(pkg)) return true;
    return pkg !== emergency.unlockedPackage;
  });
}

async function resolveActiveBlockPackages(config: SalahFocusConfig, now = Date.now()) {
  const emergency = await readEmergencyUnlockState();
  if (!emergency) return config.androidBlockedPackages;
  if (emergency.expiresAt <= now) {
    await clearEmergencyUnlockState();
    return config.androidBlockedPackages;
  }
  return packagesWhileEmergencyActive(config.androidBlockedPackages, emergency, now);
}

async function activateBlocking(config: SalahFocusConfig, now = new Date()) {
  try {
    const activePackages = await resolveActiveBlockPackages(config, now.getTime());
    if (!activePackages.length) {
      // Emergency may have cleared every block target; keep monitoring for re-lock.
      if (!hasBlockedTargets(config)) return;
      applyAndroidBlocking([]);
      if (!monitoringActive) {
        startAndroidMonitoring();
        monitoringActive = true;
      }
      return;
    }

    await relockSalahFocusApps().catch(() => undefined);
    configureSalahFocusOverlay();
    applyAndroidBlocking(activePackages);
    if (!monitoringActive) {
      startAndroidMonitoring();
      monitoringActive = true;
    }
  } catch {
    // Native blocking is best-effort; config stays saved in AsyncStorage.
  }
}

async function deactivateBlocking() {
  try {
    await clearEmergencyUnlockState().catch(() => undefined);
    if (monitoringActive) {
      stopAndroidMonitoring();
      monitoringActive = false;
    }
    applyAndroidBlocking([]);
  } catch {
    monitoringActive = false;
  }
}

export async function evaluateSalahFocus(now = new Date()): Promise<SalahFocusRuntimeState> {
  const config = await getSalahFocusConfig();
  const supported = isSalahFocusSupported();
  const dateKey = gregorianKey(now);
  const completedToday = config.completedByDate[dateKey] ?? [];

  const base: SalahFocusRuntimeState = {
    supported,
    enabled: config.enabled,
    setupComplete: config.setupComplete,
    isLockActive: false,
    isTestLock: false,
    activePrayer: null,
    windowEndsAt: null,
    completedToday,
  };

  const nowMs = now.getTime();
  const testLock = await readTestLockState();
  if (testLock) {
    if (testLock.expiresAt <= nowMs) {
      await clearTestLockState();
    } else if (config.androidBlockedPackages.length > 0) {
      await activateBlocking(config, now);
      return {
        ...base,
        isLockActive: true,
        isTestLock: true,
        windowEndsAt: testLock.expiresAt,
        setupComplete: config.setupComplete || config.androidBlockedPackages.length > 0,
      };
    }
  }

  if (!supported || !config.enabled || !config.setupComplete || !config.consentAccepted) {
    await deactivateBlocking();
    return base;
  }

  const location = await getSavedPrayerLocation();
  if (!isPrayerLocationConfigured(location)) {
    await deactivateBlocking();
    return {
      ...base,
      enabled: config.enabled,
      setupComplete: config.setupComplete,
    };
  }

  const outstanding = await getActivePrayerWindow(
    location,
    now,
    config.windowMinutes
  );
  if (!outstanding) {
    await deactivateBlocking();
    return base;
  }

  await activateBlocking(config, now);
  return {
    ...base,
    isLockActive: true,
    isTestLock: false,
    activePrayer: outstanding.label,
    windowEndsAt: outstanding.end.getTime(),
  };
}

export function tickSalahFocus(now = new Date()) {
  const run = (tickPromise ?? Promise.resolve()).then(() => evaluateSalahFocus(now));
  tickPromise = run.catch(() => evaluateSalahFocus(now));
  return tickPromise;
}

export async function markSalahFocusPrayerComplete(prayer: PrayerLabel) {
  const now = new Date();
  const testLock = await readTestLockState();
  if (testLock && testLock.expiresAt > now.getTime()) {
    return stopTestPrayerLock();
  }

  const config = await getSalahFocusConfig();
  const dateKey = gregorianKey(now);
  const completedToday = config.completedByDate[dateKey] ?? [];
  const location = await getSavedPrayerLocation();

  if (!location) {
    return evaluateSalahFocus(now);
  }

  const active = await getActivePrayerWindow(location, now, config.windowMinutes);

  if (!active || active.label !== prayer) {
    return evaluateSalahFocus(now);
  }

  const existing = [...completedToday];
  if (!existing.includes(prayer)) {
    existing.push(prayer);
  }
  await saveSalahFocusConfig({
    completedByDate: { ...config.completedByDate, [dateKey]: existing },
  });

  try {
    const { token, user } = useAuthStore.getState();
    const todayYMD = getTodayStr(now);
    await markPrayerAsPrayed(prayer, todayYMD, token, user?.id);
  } catch (err) {
    console.error('Failed to log prayer in tracker:', err);
  }

  await clearEmergencyUnlockState();
  await deactivateBlocking();
  return evaluateSalahFocus(now);
}

/**
 * Temporarily allow one blocked app (e.g. Phone, WhatsApp) during salah.
 * Instagram, Facebook, YouTube, and TikTok are never eligible.
 * Does not mark the prayer complete — full lock resumes when emergency expires.
 */
export async function emergencyUnlockSalahFocus(
  packageName: string,
  appName?: string,
  minutes = DEFAULT_EMERGENCY_MINUTES
): Promise<EmergencyUnlockResult> {
  const pkg = packageName?.trim();
  if (!pkg) return { ok: false, reason: 'missing_package' };

  if (isEmergencyUnlockExcluded(pkg, appName)) {
    return { ok: false, reason: 'excluded' };
  }

  const config = await getSalahFocusConfig();
  if (!config.androidBlockedPackages.includes(pkg)) {
    return { ok: false, reason: 'not_blocked' };
  }

  const state = await evaluateSalahFocus();
  if (!state.isLockActive) {
    return { ok: false, reason: 'not_locked' };
  }

  const expiresAt = Date.now() + minutes * 60_000;
  await AsyncStorage.setItem(
    EMERGENCY_UNLOCK_KEY,
    JSON.stringify({ expiresAt, unlockedPackage: pkg } satisfies EmergencyUnlockState)
  );

  await relockSalahFocusApps().catch(() => undefined);
  await activateBlocking(config);

  return { ok: true, expiresAt, appName };
}

export async function disableSalahFocus() {
  await saveSalahFocusConfig({ enabled: false });
  await deactivateBlocking();
  return evaluateSalahFocus();
}

/** Validate + push native config after Prayer Lock setup is saved. */
export async function syncSalahFocusAfterSave() {
  const config = await getSalahFocusConfig();
  if (!config.enabled) {
    await deactivateBlocking();
    return;
  }

  const location = await getSavedPrayerLocation();
  if (!isPrayerLocationConfigured(location)) {
    throw new Error('PRAYER_LOCATION_REQUIRED');
  }

  const perms = await getSalahFocusPermissionStatus();
  if (!perms.allGranted) {
    throw new Error('PRAYER_PERMISSIONS_REQUIRED');
  }

  if (config.androidBlockedPackages.length > 0) {
    configureSalahFocusOverlay();
    applyAndroidBlocking(config.androidBlockedPackages);
  }
}

export async function enableSalahFocus() {
  const location = await getSavedPrayerLocation();
  if (!isPrayerLocationConfigured(location)) {
    throw new Error('PRAYER_LOCATION_REQUIRED');
  }
  return tickSalahFocus();
}

export function getSalahFocusLocationRequiredMessage() {
  return 'Set your prayer location on the Timings tab before enabling Prayer Lock.';
}

export function getSalahFocusPermissionsRequiredMessage() {
  return 'Grant overlay, usage access, and notification permissions for WeDeen, then try again.';
}

export function getSalahFocusExpoGoMessage() {
  if (Constants.appOwnership === 'expo') {
    return 'Prayer Lock needs a native Android build. Install the app with “expo run:android” — it does not work in Expo Go.';
  }
  return 'Prayer Lock is only available on Android.';
}

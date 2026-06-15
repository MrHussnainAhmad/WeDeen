import Constants from 'expo-constants';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { getUiPreferences } from '@/utils/preferences';
import { maybeRefreshLocation } from './locationService';

const LOCATION_TASK = 'wedeen-location-refresh';
// Suggested cadence; the OS (WorkManager / BGTaskScheduler) throttles as it sees fit.
const MIN_INTERVAL_MINUTES = 360; // ~6h

const isExpoGo = Constants.appOwnership === 'expo';

// Task definitions must run at module load. Guarded so Expo Go (no native task
// runner) never trips over it.
if (!isExpoGo) {
  try {
    if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
      TaskManager.defineTask(LOCATION_TASK, async () => {
        try {
          await maybeRefreshLocation();
        } catch {
          // non-fatal
        }
        return BackgroundTask.BackgroundTaskResult.Success;
      });
    }
  } catch {
    // ignore — feature simply stays unavailable
  }
}

/** Whether the OS currently allows background tasks (and we're not in Expo Go). */
export async function isBackgroundLocationSupported(): Promise<boolean> {
  if (isExpoGo) return false;
  try {
    return (await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Available;
  } catch {
    return false;
  }
}

/**
 * Opt-in: ensure foreground + background location permission, then register the
 * periodic task. Returns the outcome so Settings can react (e.g. revert the
 * switch and explain on denial).
 */
export async function enableBackgroundLocation(): Promise<'enabled' | 'denied' | 'unsupported'> {
  if (isExpoGo) return 'unsupported';
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (!fg.granted) {
      const reqFg = await Location.requestForegroundPermissionsAsync();
      if (!reqFg.granted) return 'denied';
    }
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) return 'denied';

    await BackgroundTask.registerTaskAsync(LOCATION_TASK, {
      minimumInterval: MIN_INTERVAL_MINUTES,
    });
    return 'enabled';
  } catch {
    return 'unsupported';
  }
}

export async function disableBackgroundLocation() {
  if (isExpoGo) return;
  try {
    await BackgroundTask.unregisterTaskAsync(LOCATION_TASK);
  } catch {
    // ignore
  }
}

/** On launch: if opted-in and still permitted, make sure the task is registered. */
export async function ensureBackgroundLocationRegistered() {
  if (isExpoGo) return;
  try {
    const prefs = await getUiPreferences();
    if (!prefs.backgroundLocationEnabled) return;
    const bg = await Location.getBackgroundPermissionsAsync();
    if (!bg.granted) return;
    const already = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK).catch(() => false);
    if (!already) {
      await BackgroundTask.registerTaskAsync(LOCATION_TASK, {
        minimumInterval: MIN_INTERVAL_MINUTES,
      });
    }
  } catch {
    // ignore
  }
}

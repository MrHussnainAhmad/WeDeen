import { create } from 'zustand';
import { playManagedAudio, stopAllAudio } from './audioManager';
import { getUiPreferences } from '@/utils/preferences';

// Bundled full adhan (AAC/M4A — plays on iOS and Android, no download).
const ADHAN_ASSET = require('@/assets/audio/adhan.m4a');

type AdhanAlarmState = {
  visible: boolean;
  prayer: string | null;
  /** Epoch ms when a pending (Expo Go) test/snooze adhan will ring, else null. */
  pendingFireAt: number | null;
  show: (prayer: string) => void;
  hide: () => void;
  setPending: (fireAt: number | null) => void;
};

/** Drives the in-app alarm modal (rendered once at the app root). */
export const useAdhanAlarm = create<AdhanAlarmState>((set) => ({
  visible: false,
  prayer: null,
  pendingFireAt: null,
  show: (prayer) => set({ visible: true, prayer }),
  hide: () => set({ visible: false }),
  setPending: (pendingFireAt) => set({ pendingFireAt }),
}));

/** Ring the adhan: show the alarm pop-up and play the full adhan. */
export async function ringAdhan(prayer = 'Prayer') {
  useAdhanAlarm.getState().show(prayer);
  let volume = 1;
  try {
    volume = (await getUiPreferences()).adhanVolume;
  } catch {
    // use default
  }
  try {
    await playManagedAudio(ADHAN_ASSET, {
      volume,
      // Auto-dismiss the pop-up when the adhan finishes (if not already
      // stopped/snoozed by the user).
      onDidFinish: () => useAdhanAlarm.getState().hide(),
    });
  } catch {
    // best-effort
  }
}

/** Stop the adhan: silence audio and dismiss the pop-up. */
export async function stopAdhan() {
  useAdhanAlarm.getState().hide();
  await stopAllAudio().catch(() => undefined);
}

// ---- Foreground one-off scheduling (Expo Go) -----------------------------
// A module-level ticker (not tied to any screen) checks an absolute fire time
// every second, so the test/snooze adhan rings on time even after the user
// navigates away. Robust against single-timer throttling.

let pendingTimer: ReturnType<typeof setInterval> | null = null;
let pendingFireAt: number | null = null;
let pendingPrayer = 'Prayer';

function clearPendingTimer() {
  pendingFireAt = null;
  if (pendingTimer) {
    clearInterval(pendingTimer);
    pendingTimer = null;
  }
  useAdhanAlarm.getState().setPending(null);
}

/** Ring the adhan after `delayMs`, independent of the current screen. */
export function armForegroundAdhan(delayMs: number, prayer = 'Prayer') {
  pendingFireAt = Date.now() + delayMs;
  pendingPrayer = prayer;
  useAdhanAlarm.getState().setPending(pendingFireAt);

  if (pendingTimer) return;
  pendingTimer = setInterval(() => {
    if (pendingFireAt == null) return;
    if (Date.now() >= pendingFireAt) {
      const prayerToRing = pendingPrayer;
      clearPendingTimer();
      ringAdhan(prayerToRing).catch(() => undefined);
    }
  }, 1000);
}

export function cancelForegroundAdhan() {
  clearPendingTimer();
}

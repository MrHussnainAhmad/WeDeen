import Constants from 'expo-constants';
import { AppState } from 'react-native';
import {
  tickSalahFocus,
  consumeSalahUnlockPrompt,
  type SalahFocusRuntimeState,
} from './salahFocusService';

const TICK_MS = 30_000;

type FocusListener = (
  state: SalahFocusRuntimeState,
  meta: { navigateToLock: boolean }
) => void;

let lastState: SalahFocusRuntimeState | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let subscriberCount = 0;
const listeners = new Set<FocusListener>();
let ticking = false;

function notify(state: SalahFocusRuntimeState, navigateToLock: boolean) {
  lastState = state;
  for (const listener of listeners) {
    listener(state, { navigateToLock });
  }
}

async function runTick(navigateToLock = false) {
  if (ticking) return lastState;
  ticking = true;
  const shouldNavigate = navigateToLock || consumeSalahUnlockPrompt();
  try {
    const state = await tickSalahFocus();
    notify(state, shouldNavigate && state.isLockActive);
    return state;
  } catch {
    if (lastState) notify(lastState, false);
    return lastState;
  } finally {
    ticking = false;
  }
}

function startCoordinator() {
  if (Constants.appOwnership === 'expo') return;
  if (intervalId) return;

  runTick(false).catch(() => undefined);
  intervalId = setInterval(() => {
    runTick(false).catch(() => undefined);
  }, TICK_MS);

  appStateSub = AppState.addEventListener('change', (next) => {
    if (next === 'active') runTick(true).catch(() => undefined);
  });
}

function stopCoordinator() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  appStateSub?.remove();
  appStateSub = null;
}

export function getLastPrayerFocusState() {
  return lastState;
}

export function subscribePrayerFocus(listener: FocusListener) {
  listeners.add(listener);
  subscriberCount += 1;
  if (subscriberCount === 1) startCoordinator();

  if (lastState) {
    listener(lastState, { navigateToLock: false });
  } else {
    runTick(false)
      .then((state) => {
        if (state) listener(state, { navigateToLock: false });
      })
      .catch(() => undefined);
  }

  return () => {
    listeners.delete(listener);
    subscriberCount = Math.max(0, subscriberCount - 1);
    if (subscriberCount === 0) stopCoordinator();
  };
}

export function refreshPrayerFocusNow(navigateToLock = false) {
  return runTick(navigateToLock);
}

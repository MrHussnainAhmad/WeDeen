import { Audio, AVPlaybackSource } from 'expo-av';

let activeSound: Audio.Sound | null = null;
let activeToken = 0;
let audioModeReady = false;

// Make playback audible even when the iOS ringer is on silent, and behave well
// with other audio on Android. Runs once before the first sound plays.
async function ensureAudioMode() {
  if (audioModeReady) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
    });
    audioModeReady = true;
  } catch {
    // best-effort — don't block playback if this fails
  }
}

async function clearActiveSound() {
  if (!activeSound) return;
  const current = activeSound;
  activeSound = null;
  await current.stopAsync().catch(() => undefined);
  await current.unloadAsync().catch(() => undefined);
}

export async function stopAllAudio() {
  activeToken += 1;
  await clearActiveSound();
}

/** Adjust the volume of whatever is currently playing (0..1), live. */
export async function setActiveAudioVolume(volume: number) {
  if (!activeSound) return;
  await activeSound.setVolumeAsync(Math.max(0, Math.min(1, volume))).catch(() => undefined);
}

export async function playManagedAudio(
  source: AVPlaybackSource,
  options?: { onDidFinish?: () => void; volume?: number }
) {
  await ensureAudioMode();
  activeToken += 1;
  const token = activeToken;
  await clearActiveSound();

  const initial: Record<string, unknown> = { shouldPlay: true };
  if (typeof options?.volume === 'number') initial.volume = Math.max(0, Math.min(1, options.volume));
  const { sound } = await Audio.Sound.createAsync(source, initial);
  activeSound = sound;
  sound.setOnPlaybackStatusUpdate((status) => {
    if (!status.isLoaded) return;
    if (status.didJustFinish && token === activeToken) {
      options?.onDidFinish?.();
    }
  });
  return sound;
}

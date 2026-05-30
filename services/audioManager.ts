import { Audio, AVPlaybackSource } from 'expo-av';

let activeSound: Audio.Sound | null = null;
let activeToken = 0;

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

export async function playManagedAudio(
  source: AVPlaybackSource,
  options?: { onDidFinish?: () => void }
) {
  activeToken += 1;
  const token = activeToken;
  await clearActiveSound();

  const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true });
  activeSound = sound;
  sound.setOnPlaybackStatusUpdate((status) => {
    if (!status.isLoaded) return;
    if (status.didJustFinish && token === activeToken) {
      options?.onDidFinish?.();
    }
  });
  return sound;
}

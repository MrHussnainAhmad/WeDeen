import { PRAYER_LOCK_DIALOGUES } from '@/constants/prayerLockDialogues';
import { listBlockableAndroidApps } from './salahFocusNative';

const APP_NAME_PLACEHOLDER = /\{appName\}/gi;
const FALLBACK_APP_LABEL = 'this app';

/**
 * Separator used to pack the whole dialogue pool into the single native
 * overlay-text preference. The native overlay (OverlayManager.kt) splits on
 * this char and picks a fresh line every time it is shown — so reopening a
 * blocked app shows a different dialogue. Unit Separator (U+001F) never appears
 * in the dialogue text.
 */
export const OVERLAY_DIALOGUE_DELIMITER = '\u001F';

/** Every dialogue template packed into one string for the native overlay. */
export function getPrayerLockOverlayPool(): string {
  return PRAYER_LOCK_DIALOGUES.join(OVERLAY_DIALOGUE_DELIMITER);
}

let lastIndex = -1;

function dialogueUsesAppName(template: string) {
  return template.toLowerCase().includes('{appname}');
}

/** Replace every {appName} variant — never leave the raw placeholder visible. */
export function formatPrayerLockDialogue(template: string, appName?: string) {
  const name = appName?.trim() || FALLBACK_APP_LABEL;
  return template.replace(APP_NAME_PLACEHOLDER, name);
}

function pickIndex(pool: readonly string[]) {
  const count = pool.length;
  let index = Math.floor(Math.random() * count);
  if (count > 1 && index === lastIndex) {
    index = (index + 1 + Math.floor(Math.random() * (count - 1))) % count;
  }
  lastIndex = index;
  return index;
}

/**
 * Raw template for the native Android overlay — Kotlin replaces {appName}
 * with the blocked app's label when the overlay is shown.
 */
export function pickRandomPrayerLockDialogueTemplate(): string {
  const withApp = PRAYER_LOCK_DIALOGUES.filter(dialogueUsesAppName);
  const pool = withApp.length ? withApp : PRAYER_LOCK_DIALOGUES;
  return pool[pickIndex(pool)];
}

/**
 * Ready-to-show line for React Native screens. When no app name is known,
 * only picks lines that don't need one (or substitutes "this app").
 */
export function pickRandomPrayerLockDialogue(appName?: string): string {
  const trimmed = appName?.trim();
  const pool = trimmed
    ? PRAYER_LOCK_DIALOGUES
    : PRAYER_LOCK_DIALOGUES.filter((line) => !dialogueUsesAppName(line));

  const source = pool.length ? pool : PRAYER_LOCK_DIALOGUES;
  const template = source[pickIndex(source)];
  return formatPrayerLockDialogue(template, trimmed);
}

/** Resolve a human-readable app name from the deep-link params. */
export async function resolveBlockedAppDisplayName(
  appFromLink?: string,
  packageName?: string
): Promise<string | undefined> {
  const fromLink = appFromLink?.trim();
  if (fromLink) return fromLink;

  const pkg = packageName?.trim();
  if (!pkg) return undefined;

  try {
    const apps = await listBlockableAndroidApps();
    const match = apps.find((entry) => entry.packageName === pkg);
    return match?.name?.trim() || undefined;
  } catch {
    return undefined;
  }
}

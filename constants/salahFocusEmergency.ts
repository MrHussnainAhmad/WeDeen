/** Apps that cannot be emergency-unlocked — must use "I have prayed" instead. */
export const EMERGENCY_EXCLUDED_PACKAGES = new Set([
  'com.instagram.android',
  'com.instagram.lite',
  'com.facebook.katana',
  'com.facebook.lite',
  'com.google.android.youtube',
  'com.zhiliaoapp.musically',
  'com.ss.android.ugc.trill',
  'com.ss.android.ugc.aweme',
]);

const EMERGENCY_EXCLUDED_NAME_HINTS = ['instagram', 'facebook', 'youtube', 'tiktok'];

export function isEmergencyUnlockExcluded(packageName?: string, appName?: string) {
  const pkg = packageName?.trim().toLowerCase();
  if (pkg && EMERGENCY_EXCLUDED_PACKAGES.has(pkg)) return true;

  const name = appName?.trim().toLowerCase() ?? '';
  if (!name) return false;
  return EMERGENCY_EXCLUDED_NAME_HINTS.some((hint) => name.includes(hint));
}

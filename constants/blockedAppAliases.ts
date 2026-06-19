/**
 * Known Android package aliases for popular apps. When the user picks one
 * variant (e.g. Instagram), every sibling package is blocked too so Lite /
 * regional builds cannot slip through.
 */
export const BLOCKED_APP_PACKAGE_ALIASES: Record<string, readonly string[]> = {
  'com.instagram.android': ['com.instagram.lite', 'com.instagram.barcelona'],
  'com.facebook.katana': ['com.facebook.lite', 'com.facebook.orca', 'com.facebook.pages.app'],
  'com.zhiliaoapp.musically': ['com.ss.android.ugc.trill', 'com.ss.android.ugc.aweme'],
  'com.google.android.youtube': [
    'com.google.android.apps.youtube.music',
    'com.google.android.youtube.go',
  ],
  'com.whatsapp': ['com.whatsapp.w4b'],
  'com.twitter.android': ['com.twitter.android.lite'],
  'com.snapchat.android': ['com.snapchat.android.lite'],
};

/** Expand user-selected packages to every known alias / regional variant. */
export function expandBlockedPackages(selected: string[]): string[] {
  const out = new Set<string>();
  for (const pkg of selected) {
    const trimmed = pkg.trim();
    if (!trimmed) continue;
    out.add(trimmed);

    const directAliases = BLOCKED_APP_PACKAGE_ALIASES[trimmed];
    if (directAliases) directAliases.forEach((a) => out.add(a));

    for (const [canonical, aliases] of Object.entries(BLOCKED_APP_PACKAGE_ALIASES)) {
      if (aliases.includes(trimmed)) {
        out.add(canonical);
        aliases.forEach((a) => out.add(a));
      }
    }
  }
  return [...out];
}

const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin — registers PrayerLock service, activity, and permissions
 * into the Android manifest during `expo prebuild`.
 *
 * It is idempotent: all manifest mutations check before inserting so re-running
 * prebuild does not create duplicate entries.
 */
function withWedeenPrayerLock(config) {
  // 1. AndroidManifest.xml — permissions + components
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const root = manifest.manifest;
    const app = root.application?.[0];
    if (!app) return config;

    // ── Permissions ──────────────────────────────────────────────────────────
    if (!root['uses-permission']) root['uses-permission'] = [];
    const existingPerms = (root['uses-permission'] || []).map(
      (p) => p.$?.['android:name']
    );
    const requiredPerms = [
      'android.permission.PACKAGE_USAGE_STATS',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
      'android.permission.FOREGROUND_SERVICE',
    ];
    for (const perm of requiredPerms) {
      if (!existingPerms.includes(perm)) {
        const entry = { $: { 'android:name': perm } };
        if (perm === 'android.permission.PACKAGE_USAGE_STATS') {
          entry.$['tools:ignore'] = 'ProtectedPermissions';
        }
        root['uses-permission'].push(entry);
      }
    }

    // ── Service ──────────────────────────────────────────────────────────────
    if (!app.service) app.service = [];
    const serviceClass = '.prayerlock.PrayerLockMonitorService';
    const serviceExists = app.service.some(
      (s) => s.$?.['android:name'] === serviceClass
    );
    if (!serviceExists) {
      app.service.push({
        $: {
          'android:name': serviceClass,
          'android:exported': 'false',
          'android:foregroundServiceType': 'specialUse',
        },
      });
    }

    // ── Activity ─────────────────────────────────────────────────────────────
    if (!app.activity) app.activity = [];
    const activityClass = '.prayerlock.PrayerLockOverlayActivity';
    const activityExists = app.activity.some(
      (a) => a.$?.['android:name'] === activityClass
    );
    if (!activityExists) {
      app.activity.push({
        $: {
          'android:name': activityClass,
          'android:taskAffinity': '.PrayerLockOverlay',
          'android:excludeFromRecents': 'true',
          'android:theme': '@android:style/Theme.Translucent.NoTitleBar.Fullscreen',
          'android:exported': 'false',
        },
      });
    }

    return config;
  });

  // 2. Copy Kotlin source files into android directory on prebuild
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot;

      const patchDir = path.join(projectRoot, 'native-patches', 'prayer-lock');
      const destDir = path.join(
        platformRoot,
        'app', 'src', 'main', 'java',
        'com', 'hussnainahmadsahi', 'wedeen', 'prayerlock'
      );

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const files = [
        'PrayerLockMonitorService.kt',
        'PrayerLockOverlayActivity.kt',
        'PrayerLockModule.kt',
        'PrayerLockPackage.kt',
      ];

      for (const file of files) {
        const src = path.join(patchDir, file);
        const dest = path.join(destDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
          console.log(`[withWedeenPrayerLock] Copied ${file}`);
        } else {
          // Files may already live in the android folder (managed prebuild).
          // Only warn if neither location has the file.
          if (!fs.existsSync(dest)) {
            console.warn(`[withWedeenPrayerLock] ${file} not found at ${src} or ${dest}`);
          }
        }
      }

      return config;
    },
  ]);

  return config;
}

module.exports = withWedeenPrayerLock;

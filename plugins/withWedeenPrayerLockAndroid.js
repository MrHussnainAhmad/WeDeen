/**
 * Patches Android native config that expo-app-blocker does not fully apply:
 * - Android 14+ specialUse foreground-service subtype (required or FGS start crashes)
 * - Launcher package visibility for getInstalledApps()
 * - Overlay icon drawable (fallback if prebuild skipped the copy step)
 */
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SERVICE = 'expo.modules.appblocker.AppBlockerService';
const FGS_SUBTYPE =
  'Monitors foreground app usage to pause selected apps during prayer windows';

function withWedeenPrayerLockAndroid(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application?.[0];
    if (!app) return config;

    if (!manifest.manifest['uses-permission']) {
      manifest.manifest['uses-permission'] = [];
    }
    const perms = manifest.manifest['uses-permission'];
    if (!perms.some((p) => p.$?.['android:name'] === 'android.permission.QUERY_ALL_PACKAGES')) {
      perms.push({ $: { 'android:name': 'android.permission.QUERY_ALL_PACKAGES' } });
    }
    if (!perms.some((p) => p.$?.['android:name'] === 'android.permission.ACCESS_NOTIFICATION_POLICY')) {
      perms.push({ $: { 'android:name': 'android.permission.ACCESS_NOTIFICATION_POLICY' } });
    }

    if (!manifest.manifest.queries) {
      manifest.manifest.queries = [];
    }
    const queries = manifest.manifest.queries;
    const hasLauncherQuery = queries.some((q) =>
      (q.intent || []).some((intent) =>
        (intent.action || []).some(
          (action) => action.$?.['android:name'] === 'android.intent.action.MAIN'
        )
      )
    );
    if (!hasLauncherQuery) {
      queries.push({
        intent: [
          {
            action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
            category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
          },
        ],
      });
    }

    if (!app.service) app.service = [];
    let service = app.service.find((entry) => entry.$?.['android:name'] === SERVICE);
    if (!service) {
      service = {
        $: {
          'android:name': SERVICE,
          'android:enabled': 'true',
          'android:exported': 'false',
          'android:foregroundServiceType': 'specialUse',
        },
      };
      app.service.push(service);
    } else if (!service.$?.['android:foregroundServiceType']) {
      service.$['android:foregroundServiceType'] = 'specialUse';
    }

    service.property = [
      {
        $: {
          'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
          'android:value': FGS_SUBTYPE,
        },
      },
    ];

    return config;
  });

  config = withDangerousMod(config, [
    'android',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const drawableDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'drawable'
      );
      const iconSrc = path.join(projectRoot, 'assets', 'images', 'logo-mark.png');
      const iconDest = path.join(drawableDir, 'expo_app_blocker_overlay_icon.png');
      if (fs.existsSync(iconSrc)) {
        if (!fs.existsSync(drawableDir)) {
          fs.mkdirSync(drawableDir, { recursive: true });
        }
        fs.copyFileSync(iconSrc, iconDest);
      }

      try {
        execFileSync(process.execPath, [path.join(projectRoot, 'scripts', 'patch-prayer-lock-native.js')], {
          cwd: projectRoot,
          stdio: 'inherit',
        });
      } catch (e) {
        console.warn('[withWedeenPrayerLockAndroid] Native patch step failed:', e.message);
      }

      return config;
    },
  ]);

  return config;
}

module.exports = withWedeenPrayerLockAndroid;

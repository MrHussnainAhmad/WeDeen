/**
 * Copies WeDeen prayer-lock native patches into expo-app-blocker.
 * Run automatically after install and during Android prebuild.
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const patchDir = path.join(projectRoot, 'native-patches', 'expo-app-blocker');
const targetDir = path.join(
  projectRoot,
  'node_modules',
  'expo-app-blocker',
  'android',
  'src',
  'main'
);

const kotlinFiles = [
  'OverlayManager.kt',
  'AppBlockerService.kt',
  'BlockedPackageAliases.kt',
  'AppBlockerPrefs.kt',
  'FocusModeHelper.kt',
  'PrayerLockAlarmReceiver.kt',
];

const stalePatchFiles = [
  path.join('java', 'expo', 'modules', 'appblocker', 'AppBlockerAccessibilityService.kt'),
  path.join('res', 'xml', 'app_blocker_accessibility_config.xml'),
  path.join('res', 'values', 'app_blocker_strings.xml'),
];

const FOCUS_MODE_MARKER = 'AsyncFunction("enableFocusMode")';
const PRAYER_LOCK_MARKER = 'Function("schedulePrayerLock")';
const APP_BLOCKER_PLUGIN = path.join(
  projectRoot,
  'node_modules',
  'expo-app-blocker',
  'plugin',
  'src',
  'index.js'
);
const IOS_DISABLE_MARKER = 'pluginConfig?.ios?.enabled !== false';

const FOCUS_MODE_FUNCTIONS = `
    AsyncFunction("checkDndPermission") {
      FocusModeHelper.hasDndPermission(context)
    }

    Function("openDndSettings") {
      FocusModeHelper.openDndSettings(context)
    }

    AsyncFunction("enableFocusMode") {
      FocusModeHelper.enableFocus(context)
    }

    Function("disableFocusMode") {
      FocusModeHelper.disableFocus(context)
    }
`;

const PRAYER_LOCK_FUNCTIONS = `
    Function("schedulePrayerLock") { startMs: Double, endMs: Double, packages: List<String> ->
      PrayerLockAlarmReceiver.scheduleLock(context, startMs.toLong(), packages)
      PrayerLockAlarmReceiver.scheduleUnlock(context, endMs.toLong())
    }

    Function("cancelPrayerLock") {
      PrayerLockAlarmReceiver.cancelAll(context)
    }

    Function("setPrayerLockConfig") { packages: List<String>, windowMinutes: Double ->
      AppBlockerPrefs.setPrayerLockConfig(context, packages, windowMinutes.toInt())
    }
`;

function patchFocusModeModule(kotlinTarget) {
  const modulePath = path.join(kotlinTarget, 'ExpoAppBlockerModule.kt');
  if (!fs.existsSync(modulePath)) return;
  let src = fs.readFileSync(modulePath, 'utf8');

  const anchor = 'AsyncFunction("getInstalledApps")';
  const idx = src.indexOf(anchor);
  if (idx === -1) {
    console.warn('[patch-prayer-lock-native] Could not patch Focus Mode into ExpoAppBlockerModule.kt');
    return;
  }
  let insert = '';
  if (!src.includes(FOCUS_MODE_MARKER)) insert += FOCUS_MODE_FUNCTIONS;
  if (!src.includes(PRAYER_LOCK_MARKER)) insert += PRAYER_LOCK_FUNCTIONS;
  if (!insert) return;

  src = `${src.slice(0, idx)}${insert}\n\n    ${src.slice(idx)}`;
  fs.writeFileSync(modulePath, src, 'utf8');
  console.log('[patch-prayer-lock-native] Patched native Prayer Lock bridge functions into ExpoAppBlockerModule.kt');
}

function patchAndroidOnlyPlugin() {
  if (!fs.existsSync(APP_BLOCKER_PLUGIN)) return;
  let src = fs.readFileSync(APP_BLOCKER_PLUGIN, 'utf8');
  if (src.includes(IOS_DISABLE_MARKER)) return;

  const original = '  config = withAppBlockerIOS(config, pluginConfig);';
  if (!src.includes(original)) {
    console.warn('[patch-prayer-lock-native] Could not add the iOS-disable guard to expo-app-blocker');
    return;
  }
  src = src.replace(
    original,
    `  if (pluginConfig?.ios?.enabled !== false) {\n    config = withAppBlockerIOS(config, pluginConfig);\n  }`
  );
  fs.writeFileSync(APP_BLOCKER_PLUGIN, src, 'utf8');
  console.log('[patch-prayer-lock-native] Disabled expo-app-blocker Apple targets for Android-only builds');
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return 0;
  let copied = 0;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copied += copyDir(src, dest);
    } else {
      copyFile(src, dest);
      copied += 1;
    }
  }
  return copied;
}

function removeStalePatchFiles() {
  for (const relative of stalePatchFiles) {
    const target = path.join(targetDir, relative);
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { force: true });
    console.log(`[patch-prayer-lock-native] Removed stale ${relative}`);
  }
}

function patch() {
  if (!fs.existsSync(patchDir)) {
    console.warn('[patch-prayer-lock-native] No patch directory found, skipping.');
    return;
  }
  const kotlinTarget = path.join(targetDir, 'java', 'expo', 'modules', 'appblocker');
  if (!fs.existsSync(kotlinTarget)) {
    console.warn('[patch-prayer-lock-native] expo-app-blocker not installed, skipping.');
    return;
  }

  removeStalePatchFiles();

  for (const file of kotlinFiles) {
    const src = path.join(patchDir, file);
    const dest = path.join(kotlinTarget, file);
    if (!fs.existsSync(src)) continue;
    copyFile(src, dest);
    console.log(`[patch-prayer-lock-native] Patched ${file}`);
  }

  patchFocusModeModule(kotlinTarget);
  patchAndroidOnlyPlugin();

  const resSrc = path.join(patchDir, 'res');
  const resDest = path.join(targetDir, 'res');
  const copiedResFiles = copyDir(resSrc, resDest);
  if (copiedResFiles > 0) {
    console.log(`[patch-prayer-lock-native] Patched res/ (${copiedResFiles} file${copiedResFiles === 1 ? '' : 's'})`);
  }
}

patch();

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
];

const FOCUS_MODE_MARKER = 'AsyncFunction("enableFocusMode")';
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

function patchFocusModeModule(kotlinTarget) {
  const modulePath = path.join(kotlinTarget, 'ExpoAppBlockerModule.kt');
  if (!fs.existsSync(modulePath)) return;
  let src = fs.readFileSync(modulePath, 'utf8');
  if (src.includes(FOCUS_MODE_MARKER)) return;

  const anchor = 'AsyncFunction("getInstalledApps")';
  const idx = src.indexOf(anchor);
  if (idx === -1) {
    console.warn('[patch-prayer-lock-native] Could not patch Focus Mode into ExpoAppBlockerModule.kt');
    return;
  }
  src = `${src.slice(0, idx)}${FOCUS_MODE_FUNCTIONS}\n\n    ${src.slice(idx)}`;
  fs.writeFileSync(modulePath, src, 'utf8');
  console.log('[patch-prayer-lock-native] Patched Focus Mode into ExpoAppBlockerModule.kt');
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
  if (!fs.existsSync(srcDir)) return;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(src, dest);
    } else {
      copyFile(src, dest);
    }
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
  copyDir(resSrc, resDest);
  if (fs.existsSync(resSrc)) {
    console.log('[patch-prayer-lock-native] Patched res/ (accessibility config + strings)');
  }
}

patch();

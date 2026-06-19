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
  'main',
  'java',
  'expo',
  'modules',
  'appblocker'
);

const files = ['OverlayManager.kt', 'AppBlockerService.kt'];

function patch() {
  if (!fs.existsSync(patchDir)) {
    console.warn('[patch-prayer-lock-native] No patch directory found, skipping.');
    return;
  }
  if (!fs.existsSync(targetDir)) {
    console.warn('[patch-prayer-lock-native] expo-app-blocker not installed, skipping.');
    return;
  }

  for (const file of files) {
    const src = path.join(patchDir, file);
    const dest = path.join(targetDir, file);
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, dest);
    console.log(`[patch-prayer-lock-native] Patched ${file}`);
  }
}

patch();

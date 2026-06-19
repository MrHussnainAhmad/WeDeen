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
];

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

  const resSrc = path.join(patchDir, 'res');
  const resDest = path.join(targetDir, 'res');
  copyDir(resSrc, resDest);
  if (fs.existsSync(resSrc)) {
    console.log('[patch-prayer-lock-native] Patched res/ (accessibility config + strings)');
  }
}

patch();

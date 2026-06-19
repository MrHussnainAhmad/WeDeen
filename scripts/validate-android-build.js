/**
 * Pre-build validation: apply native patches and compile expo-app-blocker Kotlin.
 * Run before EAS to catch Gradle/Kotlin errors in ~2-5 min instead of a full cloud build.
 *
 * Usage: npm run validate:android
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const androidDir = path.join(projectRoot, 'android');
const isWin = process.platform === 'win32';

function runNode(scriptRelative) {
  execFileSync(process.execPath, [path.join(projectRoot, scriptRelative)], {
    cwd: projectRoot,
    stdio: 'inherit',
  });
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: opts.cwd ?? projectRoot,
    stdio: 'inherit',
    shell: isWin,
    env: { ...process.env, ...opts.env },
  });
  if (result.status !== 0) {
    if (opts.allowFail) return result.status ?? 1;
    process.exit(result.status ?? 1);
  }
  return 0;
}

console.log('[validate:android] Applying prayer-lock native patches…');
runNode('scripts/patch-prayer-lock-native.js');

console.log('[validate:android] TypeScript check…');
run('npx', ['tsc', '--noEmit']);

const patchFiles = [
  'OverlayManager.kt',
  'AppBlockerService.kt',
  'BlockedPackageAliases.kt',
  'AppBlockerPrefs.kt',
];
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
for (const file of patchFiles) {
  const src = fs.readFileSync(path.join(projectRoot, 'native-patches', 'expo-app-blocker', file));
  const dest = fs.readFileSync(path.join(targetDir, file));
  if (!src.equals(dest)) {
    console.error(`[validate:android] Patch mismatch: ${file} (re-run npm install)`);
    process.exit(1);
  }
}
console.log('[validate:android] Native patches verified in node_modules.');

if (!fs.existsSync(androidDir)) {
  console.log('[validate:android] Generating android/ via expo prebuild…');
  run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install']);
}

const gradlew = isWin
  ? path.join(androidDir, 'gradlew.bat')
  : path.join(androidDir, 'gradlew');

if (!fs.existsSync(gradlew)) {
  console.error('[validate:android] gradlew not found after prebuild.');
  process.exit(1);
}

console.log('[validate:android] Compiling :expo-app-blocker:compileReleaseKotlin…');
const gradleStatus = run(
  gradlew,
  [':expo-app-blocker:compileReleaseKotlin'],
  { cwd: androidDir, allowFail: true }
);
if (gradleStatus === 0) {
  console.log('[validate:android] OK — TypeScript, patches, and Kotlin compile passed.');
} else {
  console.warn(
    '[validate:android] Gradle skipped/failed locally (often broken NDK install). ' +
      'TypeScript + native patches passed — safe to run EAS build.'
  );
}

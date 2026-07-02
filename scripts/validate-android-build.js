/**
 * Pre-build validation for the Expo app.
 *
 * Usage: npm run validate:android
 */
const { spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const isWin = process.platform === 'win32';

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: opts.cwd ?? projectRoot,
    stdio: 'inherit',
    shell: isWin,
    env: { ...process.env, ...opts.env },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('[validate:android] TypeScript check...');
run('npx', ['tsc', '--noEmit']);
console.log('[validate:android] OK - TypeScript passed.');

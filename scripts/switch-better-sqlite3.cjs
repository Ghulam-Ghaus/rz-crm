const cp = require('child_process');
const path = require('path');

const runtime = process.argv[2] || 'electron'; // 'electron' or 'node'
const rootDir = path.resolve(__dirname, '..');
const targetDir = path.resolve(rootDir, 'node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3');
const bin = path.resolve(rootDir, 'node_modules/.pnpm/prebuild-install@7.1.3/node_modules/prebuild-install/bin.js');

const args = [bin, `--runtime=${runtime}`];
if (runtime === 'electron') {
  args.push('--target=35.0.0');
}

console.log(`[Native ABI] Configuring better-sqlite3 for ${runtime.toUpperCase()}...`);
cp.execFileSync(process.execPath, args, { cwd: targetDir, stdio: 'inherit' });
console.log(`[Native ABI] Finished setting better-sqlite3 for ${runtime.toUpperCase()}.`);

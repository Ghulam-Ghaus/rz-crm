const cp = require('child_process');
const path = require('path');
const fs = require('fs');

const runtime = process.argv[2] || 'electron'; // 'electron' or 'node'
const rootDir = path.resolve(__dirname, '..');
const targetDir = path.resolve(rootDir, 'node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3');
const bin = path.resolve(rootDir, 'node_modules/.pnpm/prebuild-install@7.1.3/node_modules/prebuild-install/bin.js');
const markerFile = path.resolve(targetDir, '.current-runtime');
const targetBinary = path.resolve(targetDir, 'build/Release/better_sqlite3.node');

const targetKey = runtime === 'electron' ? 'electron:35.0.0' : `node:${process.versions.modules}`;

if (fs.existsSync(markerFile) && fs.existsSync(targetBinary)) {
  try {
    const currentKey = fs.readFileSync(markerFile, 'utf8').trim();
    if (currentKey === targetKey) {
      console.log(`[Native ABI] better-sqlite3 is already configured for ${targetKey}. Skipping.`);
      process.exit(0);
    }
  } catch {
    // Ignore read errors
  }
}

const args = [bin, `--runtime=${runtime}`];
if (runtime === 'electron') {
  args.push('--target=35.0.0');
}

console.log(`[Native ABI] Configuring better-sqlite3 for ${runtime.toUpperCase()}...`);
try {
  cp.execFileSync(process.execPath, args, { cwd: targetDir, stdio: 'inherit' });
  try {
    fs.writeFileSync(markerFile, targetKey, 'utf8');
  } catch {
    // Ignore write error
  }
  console.log(`[Native ABI] Finished setting better-sqlite3 for ${runtime.toUpperCase()}.`);
} catch (err) {
  if (fs.existsSync(targetBinary)) {
    console.warn(`[Native ABI] Note: better-sqlite3 binary exists but was locked by a running process. Continuing with existing binary.`);
  } else {
    throw err;
  }
}


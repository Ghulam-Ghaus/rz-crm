import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

export interface AppPaths {
  readonly userDataDir: string;
  readonly databasePath: string;
  readonly backupsDir: string;
  readonly logsDir: string;
}

/**
 * Resolves safe application data directories.
 * Under Windows, client business data lives in %APPDATA%/BakeryStore.
 * Never stores business data inside the installed application directory.
 */
export function resolveAppPaths(overrideBaseDir?: string): AppPaths {
  let baseDir: string;

  if (overrideBaseDir) {
    baseDir = overrideBaseDir;
  } else if (process.env.BAKERY_DATA_DIR) {
    baseDir = process.env.BAKERY_DATA_DIR;
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    baseDir = path.join(appData, '@bakery', 'desktop');
  } else {
    // Linux/macOS fallback for cross-platform test environments
    baseDir = path.join(os.homedir(), '.bakery-store');
  }

  const databasePath = path.join(baseDir, 'data', 'bakery.db');
  const backupsDir = path.join(baseDir, 'backups');
  const logsDir = path.join(baseDir, 'logs');

  return {
    userDataDir: baseDir,
    databasePath,
    backupsDir,
    logsDir,
  };
}

/**
 * Ensures the required data subdirectories exist and are writable.
 */
export function ensureAppDirectories(paths: AppPaths): void {
  fs.mkdirSync(path.dirname(paths.databasePath), { recursive: true });
  fs.mkdirSync(paths.backupsDir, { recursive: true });
  fs.mkdirSync(paths.logsDir, { recursive: true });
}

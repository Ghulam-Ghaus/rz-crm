import { app, BrowserWindow, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrapBackend, ActiveBackend } from '@bakery/backend';
import { registerIpcHandlers } from './ipc-handlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Enforce single-instance application lock per docs/02-ARCHITECTURE.md
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.warn('Another instance is already running. Exiting.');
  app.quit();
}

// Enable crisp High-DPI scaling across different laptop screens
app.commandLine.appendSwitch('high-dpi-support', '1');


let mainWindow: BrowserWindow | null = null;
let activeBackend: ActiveBackend | null = null;

async function createWindow(): Promise<void> {
  const candidateIconPaths = [
    path.join(__dirname, '../../build/icon.png'),
    path.join(__dirname, '../renderer/icon.png'),
    path.join(app.getAppPath(), 'dist/renderer/icon.png'),
    path.join(process.resourcesPath, 'app/dist/renderer/icon.png'),
  ];
  const appIcon = candidateIconPaths.find((p) => fs.existsSync(p));

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'Mezaan Sweets & Bakers — میزان سویٹس اینڈ بیکرز',
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load Vite dev server if running, otherwise load static bundle
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    const candidatePaths = [
      path.join(__dirname, '../renderer/index.html'),
      path.join(app.getAppPath(), 'dist/renderer/index.html'),
      path.join(__dirname, '../../../renderer/dist/index.html'),
    ];

    let loaded = false;
    for (const candidate of candidatePaths) {
      try {
        await mainWindow.loadFile(candidate);
        loaded = true;
        break;
      } catch {
        // Try next candidate
      }
    }

    if (!loaded) {
      throw new Error(`Failed to load renderer UI. Tried: ${candidatePaths.join(', ')}`);
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  try {
    // 2. Set App User Model ID for Windows notifications & taskbar
    app.setAppUserModelId('com.bakerystore.app');

    // 3. Resolve Windows AppData directory
    const userDataDir = app.getPath('userData');
    console.log(`[Main] User Data directory: ${userDataDir}`);

    // 4. Bootstrap NestJS application context (NO HTTP SERVER)
    activeBackend = await bootstrapBackend({
      baseDir: userDataDir,
      runMigrations: true,
    });
    console.log(`[Main] NestJS Application Context active with DB at: ${activeBackend.dbPath}`);

    // 5. Register allow-listed IPC handlers
    registerIpcHandlers(activeBackend.appContext, activeBackend.dbPath);

    // 6. Create main BrowserWindow
    await createWindow();
  } catch (err) {
    console.error('[Main] Fatal bootstrap error:', err);
    dialog.showErrorBox(
      'Bakery Store - Startup Error',
      'The application could not start because the database file is unreadable or corrupted.\n\n' +
        'Details: ' + (err instanceof Error ? err.message : String(err)) + '\n\n' +
        'To recover, restore a recent snapshot from your backups folder:\n' +
        'AppData\\Roaming\\@bakery\\desktop\\data\\backups'
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (activeBackend) {
    console.log('[Main] Gracefully shutting down NestJS application context...');
    await activeBackend.appContext.close();
    activeBackend = null;
  }
});

import { app, BrowserWindow, protocol, net } from 'electron';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Register privileged custom protocol for local image assets
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
      bypassCSP: true,
    },
  },
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let trayService: TrayService | null = null;
let settingsRepo: SettingsRepository | null = null;
let isQuitting = false;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.png')
    : path.join(__dirname, '../assets/icon.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#09090b',
    title: 'GameHub',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    console.log('[GameHub] Window ready-to-show event fired successfully.');

    if (process.argv.includes('--test-launch')) {
      console.log('[GameHub] Test launch verified. Automatically closing for test verification.');
      setTimeout(() => {
        isQuitting = true;
        mainWindow?.close();
        app.quit();
      }, 1500);
    }
  });

  // Minimize to tray if enabled
  mainWindow.on('minimize', (event: Electron.Event) => {
    const minimizeToTray = settingsRepo?.get<boolean>('minimize_to_tray', true) ?? true;
    if (minimizeToTray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Close to tray if enabled and not explicitly quitting
  mainWindow.on('close', (event: Electron.Event) => {
    if (!isQuitting) {
      const minimizeToTray = settingsRepo?.get<boolean>('minimize_to_tray', true) ?? true;
      if (minimizeToTray) {
        event.preventDefault();
        mainWindow?.hide();
        return false;
      }
    }
  });

  // Intercept Ctrl+R to trigger rescan instead of reloading page
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && input.key.toLowerCase() === 'r' && input.type === 'keyDown') {
      event.preventDefault();
      mainWindow?.webContents.send('tray:rescan');
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

import { initDatabase, closeDatabase, GameRepository, SettingsRepository } from './database/index';
import { registerAllIpcHandlers } from './ipc/index';
import { enrichExistingSteamGames } from './services/SteamMetadataService';
import { TrayService } from './services/TrayService';
import { Logger } from './services/Logger';

app.on('before-quit', () => {
  isQuitting = true;
});

app.whenReady().then(() => {
  Logger.init();
  Logger.info('App', `Application ready. Packaged: ${app.isPackaged}`);

  // Handle local media loading without CORS/CSP restrictions
  protocol.handle('media', (request) => {
    try {
      let filePath = request.url.replace(/^media:\/\//, '');
      // Restore Windows drive letter if needed: 'c/...' or 'c:/...' -> 'C:/...'
      filePath = filePath.replace(/^([a-zA-Z])[:\/]/, '$1:/');
      filePath = decodeURIComponent(filePath);
      return net.fetch(pathToFileURL(filePath).toString());
    } catch (err: any) {
      Logger.error('MediaProtocol', `Error loading file: ${err.message}`);
      return new Response('Media load failed', { status: 404 });
    }
  });

  try {
    const db = initDatabase();
    Logger.info('Database', 'SQLite database connected and migrations verified.');
    registerAllIpcHandlers(db);
    settingsRepo = new SettingsRepository(db);

    // Non-blocking background enrichment of existing Steam games
    const gameRepo = new GameRepository(db);
    enrichExistingSteamGames(gameRepo).catch((err: any) => {
      Logger.warn('SteamMetadata', `Background Steam enrichment error: ${err.message}`);
    });
  } catch (err: any) {
    Logger.error('Database', `Fatal: Failed to initialize SQLite database or IPC: ${err.message}`);
  }

  createWindow();

  if (mainWindow) {
    trayService = new TrayService(mainWindow, () => {
      isQuitting = true;
      app.quit();
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      if (mainWindow) {
        trayService = new TrayService(mainWindow, () => {
          isQuitting = true;
          app.quit();
        });
      }
    } else if (mainWindow) {
      trayService?.restoreWindow();
    }
  });
});

app.on('will-quit', () => {
  Logger.info('App', 'Application will-quit event fired. Closing database and destroying tray.');
  trayService?.destroy();
  closeDatabase();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

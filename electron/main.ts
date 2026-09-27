import { app, BrowserWindow, protocol, net, Menu, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

process.on('uncaughtException', (err) => {
  try {
    const logPath = path.join(app.getPath('appData'), 'GameHub', 'logs', 'gamehub.log');
    fs.appendFileSync(logPath, `[FATAL] Uncaught exception: ${err?.stack || err}\n`);
  } catch {}
});

// Disable Windows native occlusion calculation and occluded window backgrounding
// Chromium bug: Windows DWM fails to signal occlusion updates for restored frameless windows, causing the UI to freeze
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

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

if (process.env.NODE_ENV === 'development') {
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
}

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

  const isMax = settingsRepo?.get<boolean>('window_is_maximized', false) ?? false;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#09090b',
    title: 'GameHub',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    frame: false,
    show: false,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      backgroundThrottling: false,
    },
  });

  if (isMax) {
    mainWindow.maximize();
  }

  mainWindow.removeMenu();
  mainWindow.setMenuBarVisibility(false);
  Menu.setApplicationMenu(null);

  // Guarantee security & trust: all external web links (e.g. Steam, Epic, docs) must open in the user's
  // default native browser (Chrome, Edge, etc.) and NEVER in an embedded frameless Electron popup.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer] [lvl:${level}] ${message} (${sourceId}:${line})`);
  });

  // Broadcast window maximize state changes to renderer and persist state
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximizeChange', true);
    settingsRepo?.set('window_is_maximized', true);
    trayService?.setWasMaximized(true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximizeChange', false);
    settingsRepo?.set('window_is_maximized', false);
    trayService?.setWasMaximized(false);
  });

  // Safety fallback: if ready-to-show somehow hasn't fired in 4 seconds, show window
  const fallbackShowTimer = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      Logger.warn('App', 'Window displayed via timeout fallback.');
      mainWindow.show();
    }
  }, 4000);

  mainWindow.once('ready-to-show', () => {
    clearTimeout(fallbackShowTimer);
    if (!mainWindow) return;
    if (isMax && !mainWindow.isMaximized()) {
      mainWindow.maximize();
    }
    mainWindow.show();
    mainWindow.focus();
    Logger.info('App', 'Window displayed smoothly via ready-to-show.');

    if (process.argv.includes('--test-launch')) {
      console.log('[GameHub] Test launch verified. Automatically closing for test verification.');
      setTimeout(() => {
        isQuitting = true;
        mainWindow?.close();
        app.quit();
      }, 1500);
    }
  });

  // Close to tray if enabled and not explicitly quitting (Minimize keeps app in taskbar)
  mainWindow.on('close', (event: Electron.Event) => {
    if (!isQuitting) {
      const minimizeToTray = settingsRepo?.get<boolean>('minimize_to_tray', true) ?? true;
      if (minimizeToTray) {
        event.preventDefault();
        trayService?.setWasMaximized(mainWindow?.isMaximized() ?? false);
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

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    Logger.error('App', `Failed to load ${validatedURL}: [${errorCode}] ${errorDescription}`);
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
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
import { LauncherAccountService } from './services/launchers/LauncherAccountService';
import { TrayService } from './services/TrayService';
import { Logger } from './services/Logger';

app.on('before-quit', () => {
  isQuitting = true;
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.focus();
      if (process.platform === 'win32') {
        mainWindow.webContents.invalidate();
      }
      mainWindow.webContents.send('window:restored');
    }
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

    // Light deferred tasks: only run if needed without locking the main thread
    setTimeout(() => {
      try {
        const gameRepo = new GameRepository(db);
        // Only run Steam enrichment if there are unenriched games needing it
        enrichExistingSteamGames(gameRepo).catch((err: any) => {
          Logger.warn('SteamMetadata', `Background Steam enrichment error: ${err.message}`);
        });
      } catch (err: any) {
        Logger.warn('BackgroundTasks', `Deferred background error: ${err.message}`);
      }
    }, 10000);
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
}

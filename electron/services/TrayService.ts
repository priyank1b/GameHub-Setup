import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TrayService {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow;
  private isDestroyed: boolean = false;
  private onQuitCallback?: () => void;
  private wasMaximizedOnHide: boolean = false;

  constructor(mainWindow: BrowserWindow, onQuit?: () => void) {
    this.mainWindow = mainWindow;
    this.onQuitCallback = onQuit;
    this.init();
  }

  public setWasMaximized(maximized: boolean): void {
    this.wasMaximizedOnHide = maximized;
  }

  public restoreWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore();
    }
    if (!this.mainWindow.isVisible()) {
      this.mainWindow.show();
    }
    if (this.wasMaximizedOnHide || this.mainWindow.isMaximized()) {
      this.mainWindow.maximize();
    }
    this.mainWindow.focus();
    this.mainWindow.webContents.focus();

    // Invalidate surface to force Chromium compositor repaint on Windows frameless window
    if (process.platform === 'win32') {
      this.mainWindow.webContents.invalidate();
    }

    // Broadcast restore to renderer
    this.mainWindow.webContents.send('window:restored');
  }

  public toggleWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    if (this.mainWindow.isVisible() && !this.mainWindow.isMinimized() && this.mainWindow.isFocused()) {
      this.wasMaximizedOnHide = this.mainWindow.isMaximized();
      this.mainWindow.hide();
    } else {
      this.restoreWindow();
    }
  }

  private resolveIconPath(): string {
    const candidates = [
      path.resolve(__dirname, '../../assets/tray-icon.png'),
      path.resolve(__dirname, '../assets/tray-icon.png'),
      path.resolve(__dirname, 'assets/tray-icon.png'),
      path.resolve(process.resourcesPath, 'assets/tray-icon.png'),
      path.resolve(app.getAppPath(), 'assets/tray-icon.png'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return candidates[0];
  }

  private init(): void {
    try {
      const iconPath = this.resolveIconPath();
      let icon = nativeImage.createFromPath(iconPath);
      if (icon.isEmpty()) {
        console.warn('[TrayService] Loaded tray icon is empty, trying fallback resize.');
        icon = icon.resize({ width: 16, height: 16 });
      }

      this.tray = new Tray(icon);
      this.tray.setToolTip('GameHub — Game Launcher & Library');

      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'GameHub',
          enabled: false,
        },
        {
          type: 'separator',
        },
        {
          label: 'Open',
          click: () => this.restoreWindow(),
        },
        {
          label: 'Rescan',
          click: () => {
            this.restoreWindow();
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('tray:rescan');
            }
          },
        },
        {
          label: 'Recently Played',
          click: () => {
            this.restoreWindow();
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('tray:navigate', 'recently-played');
            }
          },
        },
        {
          type: 'separator',
        },
        {
          label: 'Exit',
          click: () => {
            if (this.onQuitCallback) {
              this.onQuitCallback();
            } else {
              app.quit();
            }
          },
        },
      ]);

      this.tray.setContextMenu(contextMenu);

      // Single click & double click restore window
      this.tray.on('click', () => {
        this.toggleWindow();
      });

      this.tray.on('double-click', () => {
        this.restoreWindow();
      });

      console.log('[TrayService] Windows system tray successfully initialized.');
    } catch (err: any) {
      console.error('[TrayService] Failed to initialize system tray:', err.message);
    }
  }

  public getTray(): Tray | null {
    return this.tray;
  }

  public destroy(): void {
    if (this.tray && !this.isDestroyed) {
      this.tray.destroy();
      this.tray = null;
      this.isDestroyed = true;
      console.log('[TrayService] Tray icon destroyed.');
    }
  }
}

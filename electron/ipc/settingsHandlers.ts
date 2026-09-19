import { ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { SettingsRepository } from '../database/index';

export function registerSettingsHandlers(settingsRepo: SettingsRepository): void {
  ipcMain.handle('settings:get', async (_event, key: string, defaultValue?: any) => {
    try {
      return settingsRepo.get(key, defaultValue);
    } catch (err: any) {
      console.error(`[IPC settings:get] Error for key ${key}:`, err.message);
      return defaultValue;
    }
  });

  ipcMain.handle('settings:set', async (_event, key: string, value: any) => {
    try {
      settingsRepo.set(key, value);
      return true;
    } catch (err: any) {
      console.error(`[IPC settings:set] Error for key ${key}:`, err.message);
      return false;
    }
  });

  ipcMain.handle('settings:getAll', async () => {
    try {
      return settingsRepo.getAll();
    } catch (err: any) {
      console.error('[IPC settings:getAll] Error:', err.message);
      return {};
    }
  });

  ipcMain.handle('settings:openLogs', async () => {
    try {
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      const gameHubDir = path.join(appData, 'GameHub', 'logs');
      if (!fs.existsSync(gameHubDir)) {
        fs.mkdirSync(gameHubDir, { recursive: true });
      }
      await shell.openPath(gameHubDir);
      return true;
    } catch (err: any) {
      console.error('[IPC settings:openLogs] Error:', err.message);
      return false;
    }
  });

  ipcMain.handle('settings:openLogFile', async () => {
    try {
      const { Logger } = await import('../services/Logger');
      const logFile = Logger.getLogPath();
      if (fs.existsSync(logFile)) {
        await shell.openPath(logFile);
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('[IPC settings:openLogFile] Error:', err.message);
      return false;
    }
  });

  ipcMain.handle('settings:clearCache', async () => {
    try {
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      const cacheDir = path.join(appData, 'GameHub', 'Cache');
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true });
      }
      return { success: true };
    } catch (err: any) {
      console.error('[IPC settings:clearCache] Error:', err.message);
      return { success: false, error: err.message };
    }
  });

  // Database recovery and repair (Phase 35)
  ipcMain.handle('database:repair', async () => {
    try {
      const { DatabaseRecoveryService } = await import('../services/DatabaseRecoveryService');
      return DatabaseRecoveryService.repairDatabase();
    } catch (err: any) {
      console.error('[IPC database:repair] Error:', err.message);
      return { success: false, actionTaken: 'vacuum_reindex', message: err.message };
    }
  });

  ipcMain.handle('database:backup', async () => {
    try {
      const { DatabaseRecoveryService } = await import('../services/DatabaseRecoveryService');
      return DatabaseRecoveryService.backupDatabase();
    } catch (err: any) {
      console.error('[IPC database:backup] Error:', err.message);
      return { success: false, error: err.message };
    }
  });
}

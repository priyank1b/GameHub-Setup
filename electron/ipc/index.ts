import { Database } from 'better-sqlite3';
import {
  GameRepository,
  LaunchRepository,
  CategoryRepository,
  SettingsRepository,
  CanonicalGameRepository,
} from '../database/index';
import { registerGameHandlers } from './gameHandlers';
import { registerSettingsHandlers } from './settingsHandlers';
import { registerDriveHandlers } from './driveHandlers';
import { registerDialogHandlers } from './dialogHandlers';
import { registerScannerHandlers } from './scannerHandlers';
import { registerBackupHandlers } from './backupHandlers';
import { registerWindowHandlers } from './windowHandlers';
import { registerAccountHandlers } from './accountHandlers';

import { DriveService } from '../services/DriveService';
import { GameLauncher } from '../services/GameLauncher';
import { LauncherAccountService } from '../services/launchers/LauncherAccountService';

export function registerAllIpcHandlers(db: Database): void {
  const gameRepo = new GameRepository(db);
  const launchRepo = new LaunchRepository(db);
  const categoryRepo = new CategoryRepository(db);
  const settingsRepo = new SettingsRepository(db);
  const canonicalRepo = new CanonicalGameRepository(db);
  const driveService = new DriveService();
  const gameLauncher = new GameLauncher(gameRepo, launchRepo);
  const accountService = new LauncherAccountService(db);

  registerGameHandlers(gameRepo, launchRepo, gameLauncher, canonicalRepo, accountService);
  registerSettingsHandlers(settingsRepo);
  registerDriveHandlers(driveService, settingsRepo);
  registerDialogHandlers();
  registerScannerHandlers(gameRepo, settingsRepo, driveService);
  registerBackupHandlers(gameRepo, categoryRepo, settingsRepo);
  registerWindowHandlers(settingsRepo);
  registerAccountHandlers(accountService, canonicalRepo);

  console.log('[IPC] All secure IPC handlers registered successfully.');
}

import { Database } from 'better-sqlite3';
import {
  GameRepository,
  LaunchRepository,
  CategoryRepository,
  SettingsRepository,
} from '../database/index';
import { registerGameHandlers } from './gameHandlers';
import { registerSettingsHandlers } from './settingsHandlers';
import { registerDriveHandlers } from './driveHandlers';
import { registerDialogHandlers } from './dialogHandlers';
import { registerScannerHandlers } from './scannerHandlers';
import { registerBackupHandlers } from './backupHandlers';

import { DriveService } from '../services/DriveService';
import { GameLauncher } from '../services/GameLauncher';

export function registerAllIpcHandlers(db: Database): void {
  const gameRepo = new GameRepository(db);
  const launchRepo = new LaunchRepository(db);
  const categoryRepo = new CategoryRepository(db);
  const settingsRepo = new SettingsRepository(db);
  const driveService = new DriveService();
  const gameLauncher = new GameLauncher(gameRepo, launchRepo);

  registerGameHandlers(gameRepo, launchRepo, gameLauncher);
  registerSettingsHandlers(settingsRepo);
  registerDriveHandlers(driveService, settingsRepo);
  registerDialogHandlers();
  registerScannerHandlers(gameRepo, settingsRepo, driveService);
  registerBackupHandlers(gameRepo, categoryRepo, settingsRepo);

  console.log('[IPC] All secure IPC handlers registered successfully.');
}

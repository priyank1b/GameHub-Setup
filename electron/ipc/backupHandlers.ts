import { ipcMain } from 'electron';
import { GameRepository, CategoryRepository, SettingsRepository } from '../database/index';
import { BackupService, ExportResult, ImportResult } from '../services/BackupService';

export function registerBackupHandlers(
  gameRepo: GameRepository,
  categoryRepo: CategoryRepository,
  settingsRepo: SettingsRepository
): void {
  const backupService = new BackupService(gameRepo, categoryRepo, settingsRepo);

  // Trigger library backup export
  ipcMain.handle(
    'backup:export',
    async (_event, targetPath?: string): Promise<ExportResult> => {
      console.log('[IPC backup:export] Initiating library export...');
      return backupService.exportLibrary(targetPath);
    }
  );

  // Trigger library backup import
  ipcMain.handle(
    'backup:import',
    async (_event, sourcePath?: string): Promise<ImportResult> => {
      console.log('[IPC backup:import] Initiating library import...');
      return backupService.importLibrary(sourcePath);
    }
  );
}

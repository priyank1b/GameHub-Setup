import { ipcMain } from 'electron';
import { DriveService, WindowsDrive } from '../services/DriveService';
import { SettingsRepository } from '../database/index';

export function registerDriveHandlers(
  driveService: DriveService,
  settingsRepo: SettingsRepository
): void {
  // Get all detected Windows drives
  ipcMain.handle('drives:getAvailable', async (): Promise<WindowsDrive[]> => {
    try {
      const savedIncluded = settingsRepo.get<string[]>('scan_drives');
      const drives = await driveService.getAvailableDrives(savedIncluded);
      return drives;
    } catch (err: any) {
      console.error('[IPC drives:getAvailable] Error:', err.message);
      return [];
    }
  });

  // Toggle drive inclusion for scanning
  ipcMain.handle(
    'drives:toggleInclusion',
    async (_event, letter: string, isIncluded: boolean): Promise<boolean> => {
      try {
        let savedIncluded = settingsRepo.get<string[]>('scan_drives');
        if (!savedIncluded) {
          const allDrives = await driveService.getAvailableDrives();
          savedIncluded = allDrives.map((d) => d.letter);
        }
        let updated: string[];

        if (isIncluded) {
          updated = Array.from(new Set([...savedIncluded, letter]));
        } else {
          updated = savedIncluded.filter((l) => l !== letter);
        }

        settingsRepo.set('scan_drives', updated);
        console.log(`[IPC drives:toggleInclusion] Drive ${letter} inclusion set to ${isIncluded}`);
        return true;
      } catch (err: any) {
        console.error(`[IPC drives:toggleInclusion] Error for ${letter}:`, err.message);
        return false;
      }
    }
  );

  // Check single drive availability
  ipcMain.handle('drives:checkAvailable', async (_event, letter: string): Promise<boolean> => {
    return driveService.isDriveAvailable(letter);
  });
}

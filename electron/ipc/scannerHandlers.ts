import { ipcMain, BrowserWindow } from 'electron';
import { GameRepository, SettingsRepository } from '../database/index';
import { DriveService } from '../services/DriveService';
import { StandaloneDetector } from '../services/StandaloneDetector';
import { SteamDetector } from '../services/detectors/SteamDetector';
import { EpicDetector } from '../services/detectors/EpicDetector';
import { GogDetector } from '../services/detectors/GogDetector';
import { XboxDetector } from '../services/detectors/XboxDetector';
import { UbisoftDetector } from '../services/detectors/UbisoftDetector';
import { GameScanner } from '../services/scanner/GameScanner';
import { StorageResolver } from '../services/scanner/StorageResolver';
import { AutoRescanService } from '../services/scanner/AutoRescanService';
import { GameCandidate, ScanProgress, ScanResult } from '../services/scanner/types';
import path from 'path';

export function registerScannerHandlers(
  gameRepo: GameRepository,
  settingsRepo: SettingsRepository,
  driveService: DriveService
): { autoRescanService: AutoRescanService; storageResolver: StorageResolver } {
  const gameScanner = new GameScanner(gameRepo, settingsRepo, driveService);
  const storageResolver = new StorageResolver(gameRepo);
  const autoRescanService = new AutoRescanService(gameScanner, settingsRepo);
  autoRescanService.initialize();

  const steamDetector = new SteamDetector(driveService);
  const epicDetector = new EpicDetector(driveService);
  const gogDetector = new GogDetector(driveService);
  const xboxDetector = new XboxDetector(driveService);
  const ubisoftDetector = new UbisoftDetector(driveService);
  const standaloneDetector = new StandaloneDetector();

  // Register detection modules (Steam, Epic, GOG, Xbox & Ubisoft prioritized for official manifests)
  gameScanner.registerDetector(steamDetector);
  gameScanner.registerDetector(epicDetector);
  gameScanner.registerDetector(gogDetector);
  gameScanner.registerDetector(xboxDetector);
  gameScanner.registerDetector(ubisoftDetector);
  gameScanner.registerDetector(standaloneDetector);

  // Broadcast real-time progress events to all active renderer windows
  gameScanner.onProgress((progress: ScanProgress) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      try {
        if (!win.isDestroyed()) {
          win.webContents.send('scanner:progress', progress);
        }
      } catch (err: any) {
        console.warn('[IPC scanner] Could not send progress to window:', err.message);
      }
    }
  });

  // Start unified scanner
  ipcMain.handle(
    'scanner:start',
    async (_event, customLocations?: string[]): Promise<ScanResult> => {
      console.log('[IPC scanner:start] Starting unified scan pipeline...');
      if (gameScanner.isRunning()) {
        console.log('[IPC scanner:start] Scan already actively running. Returning gracefully.');
        return {
          status: 'complete',
          scannedLocationsCount: 0,
          totalFoundCandidates: 0,
          newGamesAdded: 0,
          existingGamesUpdated: 0,
          missingGamesMarked: 0,
          durationMs: 0,
        };
      }
      const result = await gameScanner.scan(customLocations);
      autoRescanService.resetTimerFromNow();
      return result;
    }
  );

  // Cancel running scan
  ipcMain.handle('scanner:cancel', async (): Promise<boolean> => {
    console.log('[IPC scanner:cancel] Cancel requested via IPC.');
    return gameScanner.cancel();
  });

  // Get current scanner status
  ipcMain.handle('scanner:getStatus', async () => {
    return { isRunning: gameScanner.isRunning() };
  });

  // games:scan alias pointing to GameScanner engine
  ipcMain.handle('games:scan', async (_event, customLocations?: string[]) => {
    console.log('[IPC games:scan] Executing scan via GameScanner engine...');
    if (gameScanner.isRunning()) {
      return {
        status: 'complete',
        newGamesCount: 0,
        totalFound: 0,
      };
    }
    const result = await gameScanner.scan(customLocations);
    autoRescanService.resetTimerFromNow();
    return {
      status: result.status,
      newGamesCount: result.newGamesAdded,
      totalFound: result.totalFoundCandidates,
      result,
    };
  });

  // Direct standalone scan for targeted folder analysis
  ipcMain.handle(
    'scanner:scanStandalone',
    async (_event, customLocations?: string[]): Promise<GameCandidate[]> => {
      try {
        const locations =
          customLocations && customLocations.length > 0
            ? customLocations
            : settingsRepo.get<string[]>('scan_locations') || [
                'C:\\Games',
                'D:\\Games',
                'E:\\Games',
                'F:\\Games',
                'G:\\Games',
              ];
        console.log('[IPC scanner:scanStandalone] Scanning locations:', locations);
        return await standaloneDetector.detect(locations);
      } catch (err: any) {
        console.error('[IPC scanner:scanStandalone] Error:', err.message);
        return [];
      }
    }
  );

  // Import a single candidate into the library
  ipcMain.handle(
    'scanner:importCandidate',
    async (_event, candidate: GameCandidate) => {
      try {
        const existing = gameRepo.getAll();
        const normCandidate = candidate.executablePath
          ? path.resolve(candidate.executablePath).toLowerCase()
          : path.resolve(candidate.installPath).toLowerCase();

        const alreadyExists = existing.some((g) => {
          const gExe = g.executablePath ? path.resolve(g.executablePath).toLowerCase() : '';
          const gInstall = g.installPath ? path.resolve(g.installPath).toLowerCase() : '';
          return (gExe && gExe === normCandidate) || (gInstall && gInstall === normCandidate);
        });

        if (alreadyExists) {
          console.log(`[IPC scanner:importCandidate] Game already in library: ${candidate.name}`);
          return { success: false, reason: 'Already in library' };
        }

        const created = gameRepo.create({
          name: candidate.name,
          launcher: candidate.launcher,
          launcherAppId: candidate.launcherAppId,
          executablePath: candidate.executablePath,
          installPath: candidate.installPath,
          coverImage: candidate.coverImage,
          backgroundImage: candidate.backgroundImage,
          description: candidate.description || `Discovered game with ${candidate.confidence}% confidence.`,
          genre: candidate.genre,
          isFavorite: false,
          isInstalled: true,
          isManual: false,
          installedSize: candidate.installedSize || 0,
          installSizeBytes: candidate.installSizeBytes ?? candidate.installedSize,
          installSizeStatus: candidate.installSizeStatus,
          installSizeSource: candidate.installSizeSource,
          drive: candidate.drive || candidate.installPath.slice(0, 2).toUpperCase(),
        });

        console.log(`[IPC scanner:importCandidate] Successfully imported: ${created.name} (ID: ${created.id})`);
        return { success: true, game: created };
      } catch (err: any) {
        console.error('[IPC scanner:importCandidate] Error:', err.message);
        return { success: false, error: err.message };
      }
    }
  );

  // Storage Resolution IPC
  ipcMain.handle('storage:resolveSize', async (_event, gameId: number, force?: boolean) => {
    try {
      const game = gameRepo.getById(gameId);
      if (!game) return { success: false, error: 'Game not found' };
      const info = await storageResolver.resolveGameStorage(game, force);
      return { success: true, info };
    } catch (err: any) {
      console.error(`[IPC storage:resolveSize] Error for game ${gameId}:`, err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('storage:resolveAll', async (_event, refresh?: boolean) => {
    try {
      // Run asynchronously in background without blocking IPC caller
      storageResolver.resolveAll(refresh).catch((err) => {
        console.error('[IPC storage:resolveAll] Background error:', err.message);
      });
      return { success: true, message: 'Storage calculation started in background.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Auto-Rescan IPC
  ipcMain.handle('scanner:getAutoRescanStatus', async () => {
    return autoRescanService.getStatus();
  });

  ipcMain.handle(
    'scanner:setAutoRescan',
    async (_event, enabled: boolean, intervalMinutes?: number) => {
      console.log(`[IPC scanner:setAutoRescan] Setting enabled=${enabled}, interval=${intervalMinutes}`);
      return autoRescanService.setConfig(enabled, intervalMinutes);
    }
  );

  ipcMain.handle('scanner:triggerAutoRescan', async () => {
    console.log('[IPC scanner:triggerAutoRescan] Manual trigger of auto-rescan cycle...');
    const result = await autoRescanService.executeScheduledScan();
    return { success: true, result };
  });

  return { autoRescanService, storageResolver };
}

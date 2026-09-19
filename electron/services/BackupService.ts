import fs from 'fs';
import path from 'path';
import { dialog, BrowserWindow } from 'electron';
import { GameRepository, CategoryRepository, SettingsRepository } from '../database/index';
import { Game } from '../../src/types/Game';

export interface GameHubBackup {
  version: number;
  appVersion: string;
  exportedAt: string;
  games: Omit<Game, 'id'>[];
  categories: { name: string; gameNames: string[] }[];
  scanLocations: string[];
  settings: Record<string, any>;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  gamesCount?: number;
  cancelled?: boolean;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  filePath?: string;
  gamesImported: number;
  gamesUpdated: number;
  totalGames: number;
  cancelled?: boolean;
  error?: string;
}

export class BackupService {
  constructor(
    private gameRepo: GameRepository,
    private categoryRepo: CategoryRepository,
    private settingsRepo: SettingsRepository
  ) {}

  /**
   * Exports the library into a structured gamehub-library.json backup
   */
  public async exportLibrary(targetPath?: string): Promise<ExportResult> {
    try {
      let destPath = targetPath;

      if (!destPath) {
        const focusedWindow = BrowserWindow.getFocusedWindow() || undefined;
        const res = await dialog.showSaveDialog(focusedWindow, {
          title: 'Export GameHub Library Backup',
          defaultPath: 'gamehub-library.json',
          filters: [
            { name: 'GameHub Backup (*.json)', extensions: ['json'] },
            { name: 'All Files (*.*)', extensions: ['*'] },
          ],
        });

        if (res.canceled || !res.filePath) {
          return { success: false, cancelled: true };
        }
        destPath = res.filePath;
      }

      // Collect data from database
      const games = this.gameRepo.getAll();
      const sanitizedGames: Omit<Game, 'id'>[] = games.map((g) => {
        const { id, ...rest } = g;
        return rest;
      });

      // Collect categories and games in each category
      const allCategories = this.categoryRepo.getAll();
      const categoriesData: { name: string; gameNames: string[] }[] = [];
      for (const cat of allCategories) {
        // Collect games associated with this category
        const matchingGames = games.filter((g) => {
          const catsForGame = this.categoryRepo.getCategoriesForGame(g.id);
          return catsForGame.some((c) => c.id === cat.id);
        });
        categoriesData.push({
          name: cat.name,
          gameNames: matchingGames.map((g) => g.name),
        });
      }

      // Collect scan locations and general settings
      const scanLocations = (this.settingsRepo.get<string[]>('scan_locations', [])) || [];
      const allSettings = this.settingsRepo.getAll();
      // Remove any sensitive or machine-specific volatile keys if any
      const safeSettings: Record<string, any> = {};
      for (const [k, v] of Object.entries(allSettings)) {
        if (!k.startsWith('volatile_') && !k.startsWith('session_')) {
          safeSettings[k] = v;
        }
      }

      const backup: GameHubBackup = {
        version: 1,
        appVersion: '0.1.0',
        exportedAt: new Date().toISOString(),
        games: sanitizedGames,
        categories: categoriesData,
        scanLocations,
        settings: safeSettings,
      };

      // Atomic write to disk
      const tempPath = `${destPath}.tmp_${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(backup, null, 2), 'utf-8');
      fs.renameSync(tempPath, destPath);

      console.log(`[BackupService] Successfully exported ${games.length} game(s) to "${destPath}"`);
      return {
        success: true,
        filePath: destPath,
        gamesCount: games.length,
      };
    } catch (err: any) {
      console.error('[BackupService] Export error:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Imports and restores games, categories, and settings from a gamehub-library.json backup
   */
  public async importLibrary(sourcePath?: string): Promise<ImportResult> {
    try {
      let srcPath = sourcePath;

      if (!srcPath) {
        const focusedWindow = BrowserWindow.getFocusedWindow() || undefined;
        const res = await dialog.showOpenDialog(focusedWindow, {
          title: 'Import GameHub Library Backup',
          filters: [
            { name: 'GameHub Backup (*.json)', extensions: ['json'] },
            { name: 'All Files (*.*)', extensions: ['*'] },
          ],
          properties: ['openFile'],
        });

        if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
          return { success: false, cancelled: true, gamesImported: 0, gamesUpdated: 0, totalGames: 0 };
        }
        srcPath = res.filePaths[0];
      }

      if (!fs.existsSync(srcPath)) {
        return { success: false, error: `Backup file not found at: ${srcPath}`, gamesImported: 0, gamesUpdated: 0, totalGames: 0 };
      }

      const fileContent = fs.readFileSync(srcPath, 'utf-8');
      let backup: GameHubBackup;
      try {
        backup = JSON.parse(fileContent);
      } catch (jsonErr: any) {
        return { success: false, error: `Malformed JSON in backup file: ${jsonErr.message}`, gamesImported: 0, gamesUpdated: 0, totalGames: 0 };
      }

      if (!backup.games || !Array.isArray(backup.games)) {
        return { success: false, error: 'Invalid GameHub backup format: missing "games" array.', gamesImported: 0, gamesUpdated: 0, totalGames: 0 };
      }

      const existingGames = this.gameRepo.getAll();
      const existingByLauncherApp = new Map<string, typeof existingGames[0]>();
      const existingByInstall = new Map<string, typeof existingGames[0]>();
      const existingByExe = new Map<string, typeof existingGames[0]>();
      const existingByName = new Map<string, typeof existingGames[0]>();

      const normalize = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      for (const g of existingGames) {
        if (g.launcherAppId && g.launcher !== 'STANDALONE' && g.launcher !== 'UNKNOWN') {
          existingByLauncherApp.set(`${g.launcher}:${g.launcherAppId}`, g);
        }
        if (g.installPath) {
          existingByInstall.set(path.resolve(g.installPath).toLowerCase(), g);
        }
        if (g.executablePath) {
          existingByExe.set(path.resolve(g.executablePath).toLowerCase(), g);
        }
        const normN = normalize(g.name);
        if (normN) existingByName.set(normN, g);
      }

      let gamesImported = 0;
      let gamesUpdated = 0;

      // Import or Merge Games
      for (const gameData of backup.games) {
        if (!gameData.name) continue;

        let existing: (typeof existingGames)[0] | undefined;

        // Match priority 1: Launcher & AppId
        if (gameData.launcher && gameData.launcherAppId && gameData.launcher !== 'STANDALONE') {
          existing = existingByLauncherApp.get(`${gameData.launcher}:${gameData.launcherAppId}`);
        }
        // Match priority 2: Install Path
        if (!existing && gameData.installPath) {
          existing = existingByInstall.get(path.resolve(gameData.installPath).toLowerCase());
        }
        // Match priority 3: Executable Path
        if (!existing && gameData.executablePath) {
          existing = existingByExe.get(path.resolve(gameData.executablePath).toLowerCase());
        }
        // Match priority 4: Normalized Name
        if (!existing) {
          existing = existingByName.get(normalize(gameData.name));
        }

        // Verify physical disk presence on current machine
        const hasValidInstallPath = gameData.installPath ? fs.existsSync(gameData.installPath) : false;
        const hasValidExePath = gameData.executablePath ? fs.existsSync(gameData.executablePath) : false;
        const isActuallyInstalled = hasValidInstallPath || hasValidExePath;

        if (existing) {
          // Merge / Update existing game
          const updates: Partial<Game> = {};
          let needsUpdate = false;

          // Retain favorite state if set in backup
          if (gameData.isFavorite && !existing.isFavorite) {
            updates.isFavorite = true;
            needsUpdate = true;
          }
          // Retain higher playtime
          if (gameData.totalPlayTime && gameData.totalPlayTime > (existing.totalPlayTime || 0)) {
            updates.totalPlayTime = gameData.totalPlayTime;
            needsUpdate = true;
          }
          // Backfill metadata
          if (gameData.description && !existing.description) {
            updates.description = gameData.description;
            needsUpdate = true;
          }
          if (gameData.developer && !existing.developer) {
            updates.developer = gameData.developer;
            needsUpdate = true;
          }
          if (gameData.publisher && !existing.publisher) {
            updates.publisher = gameData.publisher;
            needsUpdate = true;
          }
          if (gameData.genre && (!existing.genre || existing.genre === 'Unity' || existing.genre === 'Unreal Engine')) {
            updates.genre = gameData.genre;
            needsUpdate = true;
          }
          if (gameData.releaseDate && !existing.releaseDate) {
            updates.releaseDate = gameData.releaseDate;
            needsUpdate = true;
          }
          if (gameData.coverImage && !existing.coverImage) {
            updates.coverImage = gameData.coverImage;
            needsUpdate = true;
          }
          if (gameData.backgroundImage && !existing.backgroundImage) {
            updates.backgroundImage = gameData.backgroundImage;
            needsUpdate = true;
          }

          if (needsUpdate) {
            this.gameRepo.update(existing.id, updates);
            gamesUpdated++;
          }
        } else {
          // Create new game record from backup
          const created = this.gameRepo.create({
            name: gameData.name,
            launcher: gameData.launcher,
            launcherAppId: gameData.launcherAppId,
            executablePath: gameData.executablePath,
            installPath: gameData.installPath,
            coverImage: gameData.coverImage,
            backgroundImage: gameData.backgroundImage,
            iconPath: gameData.iconPath,
            description: gameData.description,
            developer: gameData.developer,
            publisher: gameData.publisher,
            genre: gameData.genre,
            releaseDate: gameData.releaseDate,
            installedSize: gameData.installedSize || 0,
            isFavorite: Boolean(gameData.isFavorite),
            isInstalled: isActuallyInstalled, // Marked as missing if moved or different drive on target machine
            isManual: Boolean(gameData.isManual),
            totalPlayTime: gameData.totalPlayTime || 0,
            lastPlayedAt: gameData.lastPlayedAt,
          });

          // Index into in-memory maps
          if (created.launcherAppId && created.launcher !== 'STANDALONE') {
            existingByLauncherApp.set(`${created.launcher}:${created.launcherAppId}`, created);
          }
          if (created.installPath) {
            existingByInstall.set(path.resolve(created.installPath).toLowerCase(), created);
          }
          if (created.executablePath) {
            existingByExe.set(path.resolve(created.executablePath).toLowerCase(), created);
          }
          existingByName.set(normalize(created.name), created);

          gamesImported++;
        }
      }

      // Restore Categories
      if (backup.categories && Array.isArray(backup.categories)) {
        const currentCategories = this.categoryRepo.getAll();
        const categoryMap = new Map<string, number>();
        currentCategories.forEach((c) => categoryMap.set(c.name.toLowerCase(), c.id));

        for (const cat of backup.categories) {
          if (!cat.name) continue;
          let catId = categoryMap.get(cat.name.toLowerCase());
          if (!catId) {
            const createdCat = this.categoryRepo.create(cat.name);
            catId = createdCat.id;
            categoryMap.set(cat.name.toLowerCase(), catId);
          }

          if (Array.isArray(cat.gameNames) && catId) {
            for (const gName of cat.gameNames) {
              const matchedGame = this.gameRepo.findByNormalizedName(gName);
              if (matchedGame && matchedGame.length > 0) {
                this.categoryRepo.addGameToCategory(matchedGame[0].id, catId);
              }
            }
          }
        }
      }

      // Restore Scan Locations (merge uniquely)
      if (backup.scanLocations && Array.isArray(backup.scanLocations)) {
        const existingLocs = (this.settingsRepo.get<string[]>('scan_locations', [])) || [];
        const mergedLocs = Array.from(new Set([...existingLocs, ...backup.scanLocations]));
        this.settingsRepo.set('scan_locations', mergedLocs);
      }

      // Restore Safe Settings
      if (backup.settings && typeof backup.settings === 'object') {
        for (const [k, v] of Object.entries(backup.settings)) {
          if (k !== 'scan_locations') {
            this.settingsRepo.set(k, v);
          }
        }
      }

      const totalGames = this.gameRepo.getAll().length;
      console.log(`[BackupService] Import complete: ${gamesImported} added, ${gamesUpdated} updated. Total: ${totalGames}`);

      return {
        success: true,
        filePath: srcPath,
        gamesImported,
        gamesUpdated,
        totalGames,
      };
    } catch (err: any) {
      console.error('[BackupService] Import error:', err.message);
      return { success: false, error: err.message, gamesImported: 0, gamesUpdated: 0, totalGames: 0 };
    }
  }
}

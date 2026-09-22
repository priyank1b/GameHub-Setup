import { ipcMain } from 'electron';
import { GameRepository, LaunchRepository } from '../database/index';
import { Game } from '../../src/types/Game';
import { GameLauncher } from '../services/GameLauncher';

export function registerGameHandlers(
  gameRepo: GameRepository,
  launchRepo: LaunchRepository,
  gameLauncher: GameLauncher
): void {
  // Get all games
  ipcMain.handle('games:getAll', async () => {
    try {
      return gameRepo.getAll();
    } catch (err: any) {
      console.error('[IPC games:getAll] Error:', err.message);
      throw err;
    }
  });

  // Get game by ID
  ipcMain.handle('games:getById', async (_event, id: number) => {
    try {
      if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
        throw new Error(`Invalid game ID: ${id}`);
      }
      return gameRepo.getById(id);
    } catch (err: any) {
      console.error(`[IPC games:getById] Error for id ${id}:`, err.message);
      throw err;
    }
  });

  // Add new game
  ipcMain.handle('games:add', async (_event, gameData: Omit<Game, 'id'>) => {
    try {
      if (!gameData || typeof gameData !== 'object' || !gameData.name) {
        throw new Error('Invalid game data provided');
      }
      return gameRepo.create(gameData);
    } catch (err: any) {
      console.error('[IPC games:add] Error:', err.message);
      throw err;
    }
  });

  // Update existing game
  ipcMain.handle('games:update', async (_event, id: number, updates: Partial<Game>) => {
    try {
      if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
        throw new Error(`Invalid game ID: ${id}`);
      }
      return gameRepo.update(id, updates);
    } catch (err: any) {
      console.error(`[IPC games:update] Error for id ${id}:`, err.message);
      throw err;
    }
  });

  // Remove game
  ipcMain.handle('games:remove', async (_event, id: number) => {
    try {
      if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
        throw new Error(`Invalid game ID: ${id}`);
      }
      return gameRepo.delete(id);
    } catch (err: any) {
      console.error(`[IPC games:remove] Error for id ${id}:`, err.message);
      throw err;
    }
  });

  // Hide game (exclude from library and future rescans)
  ipcMain.handle('games:hide', async (_event, id: number) => {
    try {
      if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
        return false;
      }
      return !!gameRepo.setHidden(id, true);
    } catch (err: any) {
      console.error(`[IPC games:hide] Error for id ${id}:`, err.message);
      return false;
    }
  });

  // Unhide game (restore to library)
  ipcMain.handle('games:unhide', async (_event, id: number) => {
    try {
      if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
        return false;
      }
      return !!gameRepo.setHidden(id, false);
    } catch (err: any) {
      console.error(`[IPC games:unhide] Error for id ${id}:`, err.message);
      return false;
    }
  });

  // Get all hidden/excluded games
  ipcMain.handle('games:getHidden', async () => {
    try {
      return gameRepo.getHidden();
    } catch (err: any) {
      console.error('[IPC games:getHidden] Error:', err.message);
      return [];
    }
  });

  // Toggle favorite
  ipcMain.handle('games:toggleFavorite', async (_event, id: number) => {
    try {
      if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
        throw new Error(`Invalid game ID: ${id}`);
      }
      return gameRepo.toggleFavorite(id);
    } catch (err: any) {
      console.error(`[IPC games:toggleFavorite] Error for id ${id}:`, err.message);
      throw err;
    }
  });

  // Launch game
  ipcMain.handle('games:launch', async (_event, gameId: number) => {
    try {
      if (typeof gameId !== 'number' || !Number.isInteger(gameId) || gameId <= 0) {
        return { success: false, error: `Invalid game ID: ${gameId}` };
      }
      console.log(`[IPC games:launch] Launch requested for game ID ${gameId}`);
      return await gameLauncher.launch(gameId);
    } catch (err: any) {
      console.error(`[IPC games:launch] Error for id ${gameId}:`, err.message);
      return { success: false, error: err.message };
    }
  });

  // Open game installation folder in Explorer
  ipcMain.handle('games:openFolder', async (_event, gameId: number) => {
    try {
      if (typeof gameId !== 'number' || !Number.isInteger(gameId) || gameId <= 0) {
        return false;
      }
      return await gameLauncher.openFolder(gameId);
    } catch (err: any) {
      console.error(`[IPC games:openFolder] Error for id ${gameId}:`, err.message);
      return false;
    }
  });

  // Locate game (re-link moved or re-installed game)
  ipcMain.handle('games:locate', async (_event, id: number, targetPath: string) => {
    try {
      if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
        return { success: false, error: `Invalid game ID: ${id}` };
      }
      if (typeof targetPath !== 'string' || !targetPath.trim() || targetPath.includes('\0')) {
        return { success: false, error: `Invalid target path provided.` };
      }

      const fs = await import('fs');
      const path = await import('path');

      const game = gameRepo.getById(id);
      if (!game) {
        return { success: false, error: `Game with ID ${id} not found` };
      }

      if (!fs.existsSync(targetPath)) {
        return { success: false, error: `Target path does not exist: ${targetPath}` };
      }

      const stat = fs.statSync(targetPath);
      let newExePath = game.executablePath;
      let newInstallPath = game.installPath;

      if (stat.isDirectory()) {
        newInstallPath = targetPath;
        if (game.executablePath) {
          const exeName = path.basename(game.executablePath);
          const candidate = path.join(targetPath, exeName);
          if (fs.existsSync(candidate)) {
            newExePath = candidate;
          }
        }
      } else {
        newExePath = targetPath;
        newInstallPath = path.dirname(targetPath);
      }

      const updated = gameRepo.update(id, {
        executablePath: newExePath,
        installPath: newInstallPath,
        isInstalled: true,
      });

      return { success: true, game: updated };
    } catch (err: any) {
      console.error(`[IPC games:locate] Error for id ${id}:`, err.message);
      return { success: false, error: err.message };
    }
  });

  // Fast check missing games against connected drives
  ipcMain.handle('games:checkMissing', async () => {
    try {
      const fs = await import('fs');
      const allGames = gameRepo.getAll();
      const availableDrives = new Set<string>();
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      for (const letter of letters) {
        if (fs.existsSync(`${letter}:\\`)) {
          availableDrives.add(`${letter}:`);
        }
      }

      let missingCount = 0;
      let restoredCount = 0;

      for (const game of allGames) {
        const gameDrive = (game.drive || (game.installPath ? game.installPath.slice(0, 2) : 'C:')).toUpperCase();
        if (!availableDrives.has(gameDrive)) {
          // Drive is unplugged / disconnected - do not mark as missing
          continue;
        }

        let exists = false;
        if (game.executablePath) {
          if (fs.existsSync(game.executablePath)) {
            exists = true;
          } else if (game.launcher === 'STEAM' && game.launcherAppId) {
            if (game.installPath) {
              const steamappsDir = path.resolve(game.installPath, '..', '..');
              const acfPath = path.join(steamappsDir, `appmanifest_${game.launcherAppId}.acf`);
              if (fs.existsSync(acfPath)) {
                exists = true;
              }
            }
            // If missing at old path, check other connected Steam libraries for relocation
            if (!exists) {
              const standardSteamDirs = [
                'C:\\Program Files (x86)\\Steam\\steamapps',
                'C:\\Program Files\\Steam\\steamapps',
                'C:\\Steam\\steamapps',
                'C:\\SteamLibrary\\steamapps',
                'D:\\SteamLibrary\\steamapps',
                'E:\\SteamLibrary\\steamapps',
                'F:\\SteamLibrary\\steamapps',
                'G:\\SteamLibrary\\steamapps',
              ];
              for (const steamappsDir of standardSteamDirs) {
                const driveLetter = steamappsDir.slice(0, 2).toUpperCase();
                if (!availableDrives.has(driveLetter)) continue;
                const acfPath = path.join(steamappsDir, `appmanifest_${game.launcherAppId}.acf`);
                if (fs.existsSync(acfPath)) {
                  exists = true;
                  try {
                    const content = fs.readFileSync(acfPath, 'utf8');
                    const match = content.match(/"installdir"\s+"([^"]+)"/i);
                    const installDirName = match ? match[1] : (game.installPath ? path.basename(game.installPath) : '');
                    if (installDirName) {
                      const newInstallPath = path.join(steamappsDir, 'common', installDirName);
                      let newExePath = game.executablePath ? path.join(newInstallPath, path.basename(game.executablePath)) : undefined;
                      if (!newExePath || !fs.existsSync(newExePath)) {
                        // Check common known relative binary paths or top-level exe
                        if (fs.existsSync(newInstallPath)) {
                          const dirFiles = fs.readdirSync(newInstallPath);
                          const exeCandidate = dirFiles.find((f) => f.toLowerCase().endsWith('.exe'));
                          if (exeCandidate) {
                            newExePath = path.join(newInstallPath, exeCandidate);
                          }
                        }
                      }
                      gameRepo.update(game.id, {
                        installPath: newInstallPath,
                        ...(newExePath ? { executablePath: newExePath } : {}),
                        drive: driveLetter,
                        isInstalled: true,
                      });
                    }
                  } catch {}
                  break;
                }
              }
            }
          }
        } else if (game.installPath) {
          if (fs.existsSync(game.installPath)) {
            try {
              const files = fs.readdirSync(game.installPath);
              exists = files.length > 0;
            } catch {
              exists = true;
            }
          }
        }

        if (game.isInstalled && !exists) {
          gameRepo.update(game.id, { isInstalled: false });
          missingCount++;
        } else if (!game.isInstalled && exists) {
          gameRepo.update(game.id, { isInstalled: true });
          restoredCount++;
        }
      }

      return { success: true, missingCount, restoredCount };
    } catch (err: any) {
      console.error('[IPC games:checkMissing] Error:', err.message);
      return { success: false, error: err.message };
    }
  });
}

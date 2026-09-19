import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import electron from 'electron';
const { shell } = electron;
import { Game } from '../../src/types/Game';
import { LaunchRepository } from '../database/repositories/LaunchRepository';
import { GameRepository } from '../database/repositories/GameRepository';

export interface LaunchResult {
  success: boolean;
  pid?: number;
  launchId?: number;
  error?: string;
}

export class GameLauncher {
  constructor(
    private gameRepo: GameRepository,
    private launchRepo: LaunchRepository
  ) {}

  public async launch(gameId: number): Promise<LaunchResult> {
    const game = this.gameRepo.getById(gameId);
    if (!game) {
      return { success: false, error: `Game with ID ${gameId} not found in database.` };
    }

    // Official launcher protocol (Steam: steam://rungameid/{APP_ID})
    if (game.launcher === 'STEAM' && game.launcherAppId) {
      return await this.launchUri(`steam://rungameid/${game.launcherAppId}`, game);
    }

    // Official launcher protocol (Epic Games: com.epicgames.launcher://apps/{APP_NAME}?action=launch&silent=true)
    if (game.launcher === 'EPIC' && game.launcherAppId) {
      const epicUri = `com.epicgames.launcher://apps/${encodeURIComponent(game.launcherAppId)}?action=launch&silent=true`;
      const result = await this.launchUri(epicUri, game);
      if (result.success) {
        return result;
      }
      // Fallback: If URI protocol launch fails or user is offline, launch directly via executable
      if (game.executablePath && fs.existsSync(game.executablePath)) {
        console.warn(`[GameLauncher] Epic URI protocol failed, falling back to direct executable: ${game.executablePath}`);
        return this.launchStandalone(game);
      }
      return result;
    }

    // Official launcher protocol (GOG: goggalaxy://runGame/{GAME_ID} or direct DRM-free standalone executable)
    if (game.launcher === 'GOG') {
      const isGalaxyInstalled = this.checkGalaxyInstalled();
      if (isGalaxyInstalled && game.launcherAppId) {
        const gogUri = `goggalaxy://runGame/${encodeURIComponent(game.launcherAppId)}`;
        const result = await this.launchUri(gogUri, game);
        if (result.success) {
          return result;
        }
      }

      // Standalone DRM-free fallback: GOG games are DRM-free executables
      if (game.executablePath && fs.existsSync(game.executablePath)) {
        console.log(`[GameLauncher] Launching GOG game via standalone executable: ${game.executablePath}`);
        return this.launchStandalone(game);
      }

      // If standalone executable not found but appId exists, try Galaxy URI anyway
      if (game.launcherAppId) {
        return await this.launchUri(`goggalaxy://runGame/${encodeURIComponent(game.launcherAppId)}`, game);
      }
    }

    // Official launcher protocol (Xbox / Microsoft Store: shell:AppsFolder/{AUMID} or official Xbox URI)
    if (game.launcher === 'XBOX') {
      // 1. If AUMID is present (PackageFamilyName!AppId)
      if (game.launcherAppId && game.launcherAppId.includes('!')) {
        return await this.launchAumid(game.launcherAppId, game);
      }

      // 2. If modern XboxGames folder executable exists
      if (game.executablePath && fs.existsSync(game.executablePath)) {
        try {
          return this.launchStandalone(game);
        } catch (err: any) {
          console.warn(`[GameLauncher] Standalone launch failed for Xbox game (${err.message}), falling back to Xbox app`);
        }
      }

      // 3. Fallback: Official Xbox application URI protocol
      return await this.launchUri('xbox:', game);
    }

    // Official launcher protocol (Ubisoft Connect: uplay://launch/{GAME_ID}/0 or direct executable fallback)
    if (game.launcher === 'UBISOFT') {
      if (game.launcherAppId && /^\d+$/.test(game.launcherAppId)) {
        const uplayUri = `uplay://launch/${encodeURIComponent(game.launcherAppId)}/0`;
        const result = await this.launchUri(uplayUri, game);
        if (result.success) {
          return result;
        }
      }

      // Standalone executable fallback
      if (game.executablePath && fs.existsSync(game.executablePath)) {
        console.log(`[GameLauncher] Launching Ubisoft game via executable: ${game.executablePath}`);
        return this.launchStandalone(game);
      }

      if (game.launcherAppId) {
        return await this.launchUri(`uplay://launch/${encodeURIComponent(game.launcherAppId)}/0`, game);
      }
    }

    if (game.launcher === 'STANDALONE') {
      return this.launchStandalone(game);
    }

    // Default standalone launch if executable path exists
    if (game.executablePath) {
      return this.launchStandalone(game);
    }

    return {
      success: false,
      error: `Unsupported launcher or missing executable path for ${game.name}.`,
    };
  }

  public async openFolder(gameId: number): Promise<boolean> {
    const game = this.gameRepo.getById(gameId);
    if (!game) return false;

    const targetPath = game.installPath || (game.executablePath ? path.dirname(game.executablePath) : null);
    if (!targetPath || !fs.existsSync(targetPath)) return false;

    try {
      const errorMsg = await shell.openPath(targetPath);
      return !errorMsg;
    } catch {
      return false;
    }
  }

  private launchStandalone(game: Game): LaunchResult {
    if (!game.executablePath) {
      return {
        success: false,
        error: `Executable path is not defined for ${game.name}.`,
      };
    }

    if (!game.executablePath.toLowerCase().endsWith('.exe')) {
      return {
        success: false,
        error: `Security violation: Only verified .exe executables may be executed.`,
      };
    }

    if (game.executablePath.includes('\0')) {
      return {
        success: false,
        error: `Security violation: Null bytes detected in executable path.`,
      };
    }

    const resolvedExe = path.resolve(game.executablePath);
    if (!fs.existsSync(resolvedExe)) {
      return {
        success: false,
        error: `Game executable not found at: ${resolvedExe}. The game may have been moved or uninstalled.`,
      };
    }

    try {
      const workingDir = game.installPath && fs.existsSync(game.installPath)
        ? path.resolve(game.installPath)
        : path.dirname(resolvedExe);

      console.log(`[GameLauncher] Spawning standalone process: "${resolvedExe}" (cwd: "${workingDir}")`);

      // Spawn game process detached
      const child = spawn(resolvedExe, [], {
        cwd: workingDir,
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });

      child.unref();

      // Record launch session in database
      const launchId = this.launchRepo.recordLaunch(game.id, child.pid);

      // Update last played timestamp
      this.gameRepo.updateLastPlayed(game.id);

      console.log(`[GameLauncher] Game launched successfully with PID: ${child.pid}, launchId: ${launchId}`);

      return {
        success: true,
        pid: child.pid,
        launchId,
      };
    } catch (err: any) {
      console.error(`[GameLauncher] Failed to spawn executable:`, err.message);
      return {
        success: false,
        error: `Failed to launch game executable: ${err.message}`,
      };
    }
  }

  private async launchUri(uri: string, game: Game): Promise<LaunchResult> {
    try {
      const ALLOWED_PROTOCOLS = ['steam:', 'com.epicgames.launcher:', 'goggalaxy:', 'uplay:'];
      const parsed = new URL(uri);
      if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        throw new Error(`Unauthorized or unverified URI protocol: "${parsed.protocol}"`);
      }

      console.log(`[GameLauncher] Launching via URI protocol: ${uri} (${game.name} - AppId: ${game.launcherAppId})`);

      // Record launch session in database
      const launchId = this.launchRepo.recordLaunch(game.id);

      // Update last played timestamp
      this.gameRepo.updateLastPlayed(game.id);

      // Primary: Use Electron's native shell.openExternal
      try {
        await shell.openExternal(uri);
        console.log(`[GameLauncher] shell.openExternal successfully dispatched ${uri}`);
      } catch (shellErr: any) {
        console.warn(`[GameLauncher] shell.openExternal failed (${shellErr.message}), falling back to cmd start`);
        // Fallback: Use Windows start command
        spawn('cmd.exe', ['/c', 'start', '', uri], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        }).unref();
      }

      return {
        success: true,
        launchId,
      };
    } catch (err: any) {
      console.error(`[GameLauncher] Failed to launch URI protocol:`, err.message);
      return {
        success: false,
        error: `Failed to launch via launcher protocol: ${err.message}`,
      };
    }
  }

  private async launchAumid(aumid: string, game: Game): Promise<LaunchResult> {
    try {
      console.log(`[GameLauncher] Launching Windows / Xbox Store app via AUMID: shell:AppsFolder\\${aumid} (${game.name})`);

      // Record launch session in database
      const launchId = this.launchRepo.recordLaunch(game.id);

      // Update last played timestamp
      this.gameRepo.updateLastPlayed(game.id);

      // Dispatch via explorer shell:AppsFolder
      const child = spawn('explorer.exe', [`shell:AppsFolder\\${aumid}`], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();

      return {
        success: true,
        launchId,
      };
    } catch (err: any) {
      console.error(`[GameLauncher] Failed to launch AUMID:`, err.message);
      return {
        success: false,
        error: `Failed to launch Xbox / Microsoft Store app: ${err.message}`,
      };
    }
  }

  private checkGalaxyInstalled(): boolean {
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    return (
      fs.existsSync(path.join(programFilesX86, 'GOG Galaxy', 'GalaxyClient.exe')) ||
      fs.existsSync(path.join(programFiles, 'GOG Galaxy', 'GalaxyClient.exe'))
    );
  }
}

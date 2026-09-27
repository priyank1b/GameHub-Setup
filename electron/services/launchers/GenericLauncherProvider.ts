import {
  ILauncherProvider,
  DiscoveredAccount,
  SyncedGameItem,
} from './ILauncherProvider';
import { GameLauncher } from '../../../src/types/Launcher';
import {
  LauncherAccount,
  LauncherGameEntry,
  LocalInstallation,
} from '../../../src/types/LauncherAccount';
import { shell } from 'electron';
import fs from 'fs';

export class GenericLauncherProvider implements ILauncherProvider {
  constructor(
    public readonly launcher: GameLauncher,
    public readonly name: string
  ) {}

  public async identifyConnectedAccounts(): Promise<DiscoveredAccount[]> {
    return [
      {
        externalAccountId: `${this.launcher.toLowerCase()}_local_user`,
        displayName: `${this.name} (Local User)`,
        isMostRecent: true,
      },
    ];
  }

  public async syncLibrary(_account: LauncherAccount): Promise<SyncedGameItem[]> {
    // Generic launchers without public account API report sync unavailable or return empty array
    return [];
  }

  public async handoffInstall(
    _gameEntry: LauncherGameEntry
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    return {
      success: false,
      error: `Automatic install handoff is not supported for ${this.name}. Please install via the official launcher.`,
    };
  }

  public async handoffLaunch(
    _gameEntry?: LauncherGameEntry,
    installation?: LocalInstallation
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    if (installation?.executablePath && fs.existsSync(installation.executablePath)) {
      try {
        await shell.openPath(installation.executablePath);
        return { success: true, message: `Launched ${installation.executablePath}` };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: `No valid executable found for ${this.name} game.` };
  }
}

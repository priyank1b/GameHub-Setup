import { GameLauncher } from '../../../src/types/Launcher';
import {
  LauncherAccount,
  LauncherGameEntry,
  LocalInstallation,
} from '../../../src/types/LauncherAccount';

export interface DiscoveredAccount {
  externalAccountId: string;
  displayName: string;
  avatarUrl?: string;
  isMostRecent?: boolean;
}

export interface SyncedGameItem {
  externalGameId: string;
  title: string;
  coverImage?: string;
  installAvailable: boolean;
  metadataJson?: string;
}

export interface ILauncherProvider {
  readonly launcher: GameLauncher;
  readonly name: string;

  /**
   * Identifies accounts currently logged in or stored in local launcher files
   */
  identifyConnectedAccounts(): Promise<DiscoveredAccount[]>;

  /**
   * Synchronizes library entries for a specific account
   */
  syncLibrary(account: LauncherAccount): Promise<SyncedGameItem[]>;

  /**
   * Hands off installation to the official launcher mechanism
   */
  handoffInstall(
    gameEntry: LauncherGameEntry,
    account?: LauncherAccount
  ): Promise<{ success: boolean; message?: string; error?: string }>;

  /**
   * Hands off game launch to official launcher or direct binary
   */
  handoffLaunch(
    gameEntry?: LauncherGameEntry,
    installation?: LocalInstallation,
    account?: LauncherAccount
  ): Promise<{ success: boolean; message?: string; error?: string }>;
}

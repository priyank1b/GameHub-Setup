import { GameLauncher } from './Launcher';
import { StorageSizeStatus, StorageSizeSource } from './Game';

export type AccountConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'EXPIRED';
export type AccountSyncStatus = 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR';

export interface LauncherAccount {
  id: number;
  launcher: GameLauncher;
  externalAccountId: string; // e.g. SteamID64, Epic Account ID
  displayName: string;
  avatarUrl?: string;
  connectionStatus: AccountConnectionStatus;
  lastConnectedAt?: string;
  lastSyncedAt?: string;
  syncStatus: AccountSyncStatus;
  syncErrorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LauncherGameEntry {
  id: number;
  launcherAccountId: number;
  externalGameId: string; // e.g. Steam AppID, Epic Catalog Item ID
  canonicalGameId?: number;
  title: string;
  ownedStatus: 'OWNED' | 'UNOWNED';
  installAvailable: boolean;
  metadataJson?: string;
  lastSeenAt?: string;
  lastSyncedAt?: string;
}

export type LocalInstallationStatus = 'INSTALLED' | 'MISSING' | 'INSTALLING';

export interface LocalInstallation {
  id: number;
  canonicalGameId: number;
  launcherGameEntryId?: number;
  launcherAccountId?: number;
  launcher: GameLauncher;
  installPath?: string;
  executablePath?: string;
  installSizeBytes?: number;
  installSizeStatus: StorageSizeStatus;
  installSizeSource: StorageSizeSource;
  status: LocalInstallationStatus;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type GameLibraryStatus =
  | 'INSTALLED'
  | 'AVAILABLE'
  | 'INSTALLING'
  | 'UNKNOWN'
  | 'SYNC_ERROR';

export interface OwnershipRecord {
  launcherAccountId: number;
  launcher: GameLauncher;
  accountDisplayName: string;
  externalGameId: string;
  launcherGameEntryId: number;
  isInstalled: boolean;
  localInstallationId?: number;
  installPath?: string;
  status: GameLibraryStatus;
}

export interface CanonicalGame {
  id: number;
  title: string;
  normalizedTitle: string;
  coverImage?: string;
  backgroundImage?: string;
  iconPath?: string;
  description?: string;
  developer?: string;
  publisher?: string;
  genre?: string;
  releaseDate?: string;
  isFavorite: boolean;
  isHidden: boolean;
  lastPlayedAt?: string;
  totalPlayTime: number; // in seconds
  status: GameLibraryStatus;
  ownerships: OwnershipRecord[];
  installations: LocalInstallation[];
  createdAt: string;
  updatedAt: string;
}

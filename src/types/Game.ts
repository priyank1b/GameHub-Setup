import { GameLauncher } from './Launcher';

export type StorageSizeStatus =
  | 'KNOWN'
  | 'CALCULATING'
  | 'UNKNOWN'
  | 'ACCESS_DENIED';

export type StorageSizeSource =
  | 'metadata'
  | 'filesystem'
  | 'package'
  | 'unknown';

export interface StorageInfo {
  installPath?: string;
  sizeBytes?: number;
  status: StorageSizeStatus;
  source: StorageSizeSource;
  updatedAt?: string;
}

export interface Game {
  id: number;
  name: string;
  normalizedName?: string;
  executablePath?: string;
  installPath?: string;
  launcher: GameLauncher;
  launcherAppId?: string;
  coverImage?: string;
  backgroundImage?: string;
  iconPath?: string;
  description?: string;
  developer?: string;
  publisher?: string;
  genre?: string;
  releaseDate?: string;
  installedSize?: number;
  installSizeBytes?: number;
  installSizeStatus?: StorageSizeStatus;
  installSizeSource?: StorageSizeSource;
  installSizeUpdatedAt?: string;
  isFavorite: boolean;
  isInstalled: boolean;
  isManual: boolean;
  isHidden?: boolean;
  lastPlayedAt?: string;
  totalPlayTime: number; // in seconds
  drive?: string;
}

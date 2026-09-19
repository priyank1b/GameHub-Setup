import { GameLauncher } from './Launcher';

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
  isFavorite: boolean;
  isInstalled: boolean;
  isManual: boolean;
  lastPlayedAt?: string;
  totalPlayTime: number; // in seconds
  drive?: string;
}

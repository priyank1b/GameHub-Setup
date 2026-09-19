import { GameLauncher } from '../../../src/types/Launcher';

export interface GameCandidate {
  name: string;
  launcher: GameLauncher;
  launcherAppId?: string;
  executablePath?: string;
  installPath: string;
  confidence: number; // 0 to 100
  coverImage?: string;
  backgroundImage?: string;
  iconPath?: string;
  description?: string;
  developer?: string;
  publisher?: string;
  genre?: string;
  releaseDate?: string;
  installedSize?: number;
  drive?: string;
  totalPlayTime?: number;
  lastPlayedAt?: string;
  metadata?: Record<string, any>;
}

export type ScanStage =
  | 'idle'
  | 'initializing'
  | 'drives'
  | 'detecting'
  | 'deduplicating'
  | 'database_sync'
  | 'complete'
  | 'cancelled'
  | 'error';

export interface ScanProgress {
  stage: ScanStage;
  percent: number; // 0 to 100
  message: string;
  currentDetector?: string;
  currentPath?: string;
  foundCount: number;
}

export interface ScanResult {
  status: 'complete' | 'cancelled' | 'error';
  scannedLocationsCount: number;
  totalFoundCandidates: number;
  newGamesAdded: number;
  existingGamesUpdated: number;
  missingGamesMarked: number;
  durationMs: number;
  error?: string;
}

export interface GameDetector {
  readonly name: string;
  canRun(): Promise<boolean>;
  detect(
    locations: string[],
    onProgress?: (info: { currentPath?: string; message: string }) => void,
    isCancelled?: () => boolean
  ): Promise<GameCandidate[]>;
}

import { Game } from './Game';

export interface GameHubBridge {
  appVersion: string;
  platform: string;
  ping: () => string;

  games: {
    getAll: () => Promise<Game[]>;
    getById: (id: number) => Promise<Game | null>;
    add: (game: Omit<Game, 'id'>) => Promise<Game>;
    update: (id: number, updates: Partial<Game>) => Promise<Game | null>;
    remove: (id: number) => Promise<boolean>;
    toggleFavorite: (id: number) => Promise<boolean>;
    launch: (gameId: number) => Promise<{ success: boolean; launchId?: number; error?: string }>;
    openFolder: (gameId: number) => Promise<boolean>;
    locate: (id: number, targetPath: string) => Promise<{ success: boolean; game?: Game; error?: string }>;
    hide: (id: number) => Promise<boolean>;
    unhide: (id: number) => Promise<boolean>;
    getHidden: () => Promise<Game[]>;
    checkMissing: () => Promise<{ success: boolean; missingCount?: number; restoredCount?: number; error?: string }>;
    scan: () => Promise<{ status: string; newGamesCount: number }>;
  };

  settings: {
    get: <T = any>(key: string, defaultValue?: T) => Promise<T>;
    set: (key: string, value: any) => Promise<boolean>;
    getAll: () => Promise<Record<string, any>>;
    openLogs: () => Promise<boolean>;
    openLogFile: () => Promise<boolean>;
    clearCache: () => Promise<{ success: boolean; error?: string }>;
  };

  database?: {
    repair: () => Promise<{ success: boolean; actionTaken: string; message: string }>;
    backup: () => Promise<{ success: boolean; backupPath?: string; error?: string }>;
  };

  drives: {
    getAvailable: () => Promise<import('./Drive').WindowsDrive[]>;
    toggleInclusion: (letter: string, isIncluded: boolean) => Promise<boolean>;
  };

  dialog: {
    selectExecutable: () => Promise<{ filePath: string; suggestedName: string; folderPath: string } | null>;
    selectFolder: () => Promise<string | null>;
    selectImage: () => Promise<string | null>;
  };

  scanner: {
    start: (customLocations?: string[]) => Promise<{
      status: 'complete' | 'cancelled' | 'error';
      scannedLocationsCount: number;
      totalFoundCandidates: number;
      newGamesAdded: number;
      existingGamesUpdated: number;
      missingGamesMarked: number;
      durationMs: number;
      error?: string;
    }>;
    cancel: () => Promise<boolean>;
    getStatus: () => Promise<{ isRunning: boolean }>;
    onProgress: (callback: (progress: {
      stage: string;
      percent: number;
      message: string;
      currentDetector?: string;
      currentPath?: string;
      foundCount: number;
    }) => void) => () => void;
    scanStandalone: (customLocations?: string[]) => Promise<Array<{
      name: string;
      executablePath: string;
      installPath: string;
      confidence: number;
      engine: string;
      detectedAssets: string[];
      fileSizeBytes: number;
      drive: string;
    }>>;
    importCandidate: (candidate: any) => Promise<{ success: boolean; game?: Game; reason?: string }>;
    getAutoRescanStatus: () => Promise<{
      enabled: boolean;
      intervalMinutes: number;
      lastScanTime?: string;
      nextScanTime?: string;
      isScanning: boolean;
    }>;
    setAutoRescan: (enabled: boolean, intervalMinutes?: number) => Promise<{
      enabled: boolean;
      intervalMinutes: number;
      lastScanTime?: string;
      nextScanTime?: string;
      isScanning: boolean;
    }>;
    triggerAutoRescan: () => Promise<{ success: boolean; result?: any }>;
    onAutoRescanStatus: (callback: (status: any) => void) => () => void;
    onNewGamesDiscovered: (callback: (data: { count: number; missingCount?: number }) => void) => () => void;
  };

  storage?: {
    resolveSize: (gameId: number, force?: boolean) => Promise<{ success: boolean; info?: import('./Game').StorageInfo; error?: string }>;
    resolveAll: (refresh?: boolean) => Promise<{ success: boolean; message?: string; error?: string }>;
  };

  backup: {
    export: (targetPath?: string) => Promise<{
      success: boolean;
      filePath?: string;
      gamesCount?: number;
      cancelled?: boolean;
      error?: string;
    }>;
    import: (sourcePath?: string) => Promise<{
      success: boolean;
      filePath?: string;
      gamesImported: number;
      gamesUpdated: number;
      totalGames: number;
      cancelled?: boolean;
      error?: string;
    }>;
  };

  tray?: {
    onNavigate: (callback: (page: string) => void) => () => void;
    onRescan: (callback: () => void) => () => void;
  };

  window?: {
    minimize: () => Promise<void>;
    maximize: () => Promise<boolean>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    onMaximizedChange: (callback: (isMax: boolean) => void) => () => void;
    onRestored?: (callback: () => void) => () => void;
  };
}

declare global {
  interface Window {
    gameHub?: GameHubBridge;
  }
}

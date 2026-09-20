import { contextBridge, ipcRenderer } from 'electron';
import { Game } from '../src/types/Game';

// Expose safe, strongly-typed API bridge to the renderer process
contextBridge.exposeInMainWorld('gameHub', {
  appVersion: '1.0.2',
  platform: process.platform,
  ping: () => 'pong',

  games: {
    getAll: (): Promise<Game[]> => ipcRenderer.invoke('games:getAll'),
    getById: (id: number): Promise<Game | null> => ipcRenderer.invoke('games:getById', id),
    add: (game: Omit<Game, 'id'>): Promise<Game> => ipcRenderer.invoke('games:add', game),
    update: (id: number, updates: Partial<Game>): Promise<Game | null> =>
      ipcRenderer.invoke('games:update', id, updates),
    remove: (id: number): Promise<boolean> => ipcRenderer.invoke('games:remove', id),
    toggleFavorite: (id: number): Promise<boolean> =>
      ipcRenderer.invoke('games:toggleFavorite', id),
    launch: (gameId: number): Promise<{ success: boolean; launchId?: number; error?: string }> =>
      ipcRenderer.invoke('games:launch', gameId),
    openFolder: (gameId: number): Promise<boolean> =>
      ipcRenderer.invoke('games:openFolder', gameId),
    locate: (id: number, targetPath: string): Promise<{ success: boolean; game?: Game; error?: string }> =>
      ipcRenderer.invoke('games:locate', id, targetPath),
    checkMissing: (): Promise<{ success: boolean; missingCount?: number; restoredCount?: number; error?: string }> =>
      ipcRenderer.invoke('games:checkMissing'),
    scan: (): Promise<{ status: string; newGamesCount: number }> =>
      ipcRenderer.invoke('games:scan'),
  },

  settings: {
    get: <T = any>(key: string, defaultValue?: T): Promise<T> =>
      ipcRenderer.invoke('settings:get', key, defaultValue),
    set: (key: string, value: any): Promise<boolean> =>
      ipcRenderer.invoke('settings:set', key, value),
    getAll: (): Promise<Record<string, any>> => ipcRenderer.invoke('settings:getAll'),
    openLogs: (): Promise<boolean> => ipcRenderer.invoke('settings:openLogs'),
    openLogFile: (): Promise<boolean> => ipcRenderer.invoke('settings:openLogFile'),
    clearCache: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('settings:clearCache'),
  },

  database: {
    repair: (): Promise<{ success: boolean; actionTaken: string; message: string }> =>
      ipcRenderer.invoke('database:repair'),
    backup: (): Promise<{ success: boolean; backupPath?: string; error?: string }> =>
      ipcRenderer.invoke('database:backup'),
  },

  drives: {
    getAvailable: () => ipcRenderer.invoke('drives:getAvailable'),
    toggleInclusion: (letter: string, isIncluded: boolean): Promise<boolean> =>
      ipcRenderer.invoke('drives:toggleInclusion', letter, isIncluded),
  },

  dialog: {
    selectExecutable: (): Promise<{ filePath: string; suggestedName: string; folderPath: string } | null> =>
      ipcRenderer.invoke('dialog:selectExecutable'),
    selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectFolder'),
    selectImage: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectImage'),
  },

  scanner: {
    start: (customLocations?: string[]): Promise<any> =>
      ipcRenderer.invoke('scanner:start', customLocations),
    cancel: (): Promise<boolean> =>
      ipcRenderer.invoke('scanner:cancel'),
    getStatus: (): Promise<{ isRunning: boolean }> =>
      ipcRenderer.invoke('scanner:getStatus'),
    onProgress: (callback: (progress: any) => void): (() => void) => {
      const listener = (_event: any, progress: any) => callback(progress);
      ipcRenderer.on('scanner:progress', listener);
      return () => {
        ipcRenderer.removeListener('scanner:progress', listener);
      };
    },
    scanStandalone: (customLocations?: string[]): Promise<any[]> =>
      ipcRenderer.invoke('scanner:scanStandalone', customLocations),
    importCandidate: (candidate: any): Promise<{ success: boolean; game?: any; reason?: string }> =>
      ipcRenderer.invoke('scanner:importCandidate', candidate),
  },

  backup: {
    export: (targetPath?: string): Promise<{ success: boolean; filePath?: string; gamesCount?: number; cancelled?: boolean; error?: string }> =>
      ipcRenderer.invoke('backup:export', targetPath),
    import: (sourcePath?: string): Promise<{ success: boolean; filePath?: string; gamesImported: number; gamesUpdated: number; totalGames: number; cancelled?: boolean; error?: string }> =>
      ipcRenderer.invoke('backup:import', sourcePath),
  },

  tray: {
    onNavigate: (callback: (page: string) => void): (() => void) => {
      const listener = (_event: any, page: string) => callback(page);
      ipcRenderer.on('tray:navigate', listener);
      return () => {
        ipcRenderer.removeListener('tray:navigate', listener);
      };
    },
    onRescan: (callback: () => void): (() => void) => {
      const listener = () => callback();
      ipcRenderer.on('tray:rescan', listener);
      return () => {
        ipcRenderer.removeListener('tray:rescan', listener);
      };
    },
  },

  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    maximize: (): Promise<boolean> => ipcRenderer.invoke('window:maximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    onMaximizedChange: (callback: (isMax: boolean) => void): (() => void) => {
      const listener = (_event: any, isMax: boolean) => callback(isMax);
      ipcRenderer.on('window:maximizeChange', listener);
      return () => {
        ipcRenderer.removeListener('window:maximizeChange', listener);
      };
    },
    onRestored: (callback: () => void): (() => void) => {
      const listener = () => callback();
      ipcRenderer.on('window:restored', listener);
      return () => {
        ipcRenderer.removeListener('window:restored', listener);
      };
    },
  },
});

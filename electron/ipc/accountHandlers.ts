import { ipcMain } from 'electron';
import { LauncherAccountService } from '../services/launchers/LauncherAccountService';
import { CanonicalGameRepository } from '../database/index';

export function registerAccountHandlers(
  accountService: LauncherAccountService,
  canonicalRepo: CanonicalGameRepository
): void {
  // Get all launcher accounts
  ipcMain.handle('accounts:getAll', async () => {
    try {
      return accountService.getAccounts();
    } catch (err: any) {
      console.error('[IPC accounts:getAll] Error:', err.message);
      throw err;
    }
  });

  // Discover and auto-connect local accounts
  ipcMain.handle('accounts:discover', async () => {
    try {
      return await accountService.discoverAndConnectAccounts();
    } catch (err: any) {
      console.error('[IPC accounts:discover] Error:', err.message);
      throw err;
    }
  });

  // Sync single account
  ipcMain.handle('accounts:sync', async (_event, accountId: number) => {
    try {
      if (typeof accountId !== 'number' || accountId <= 0) {
        throw new Error(`Invalid account ID: ${accountId}`);
      }
      return await accountService.syncAccount(accountId);
    } catch (err: any) {
      console.error(`[IPC accounts:sync] Error for account ${accountId}:`, err.message);
      throw err;
    }
  });

  // Sync all connected accounts
  ipcMain.handle('accounts:syncAll', async () => {
    try {
      return await accountService.syncAll();
    } catch (err: any) {
      console.error('[IPC accounts:syncAll] Error:', err.message);
      throw err;
    }
  });

  // Disconnect account
  ipcMain.handle('accounts:disconnect', async (_event, accountId: number) => {
    try {
      return await accountService.disconnectAccount(accountId);
    } catch (err: any) {
      console.error(`[IPC accounts:disconnect] Error for account ${accountId}:`, err.message);
      throw err;
    }
  });

  // Reconnect account
  ipcMain.handle('accounts:reconnect', async (_event, accountId: number) => {
    try {
      return await accountService.reconnectAccount(accountId);
    } catch (err: any) {
      console.error(`[IPC accounts:reconnect] Error for account ${accountId}:`, err.message);
      throw err;
    }
  });

  // Get detected friends from local launcher caches
  ipcMain.handle('accounts:getDetectedFriends', async () => {
    try {
      return await accountService.getDetectedFriends();
    } catch (err: any) {
      console.error('[IPC accounts:getDetectedFriends] Error:', err.message);
      return [];
    }
  });

  // Add or link a friend / family shared account
  ipcMain.handle('accounts:addFriend', async (_event, friendData: any) => {
    try {
      return await accountService.addFriendAccount(friendData);
    } catch (err: any) {
      console.error('[IPC accounts:addFriend] Error:', err.message);
      throw err;
    }
  });

  // Get canonical games library
  ipcMain.handle('canonical:getAll', async (_event, includeHidden?: boolean) => {
    try {
      return canonicalRepo.getAll(Boolean(includeHidden));
    } catch (err: any) {
      console.error('[IPC canonical:getAll] Error:', err.message);
      throw err;
    }
  });

  // Install game handoff
  ipcMain.handle(
    'canonical:install',
    async (_event, launcherAccountId: number, externalGameId: string) => {
      try {
        return await accountService.installGame(launcherAccountId, externalGameId);
      } catch (err: any) {
        console.error('[IPC canonical:install] Error:', err.message);
        throw err;
      }
    }
  );

  // Launch game handoff
  ipcMain.handle(
    'canonical:launch',
    async (_event, canonicalGameId: number, launcherAccountId?: number) => {
      try {
        return await accountService.launchGame(canonicalGameId, launcherAccountId);
      } catch (err: any) {
        console.error('[IPC canonical:launch] Error:', err.message);
        throw err;
      }
    }
  );

  // Toggle favorite
  ipcMain.handle('canonical:toggleFavorite', async (_event, canonicalGameId: number) => {
    try {
      return canonicalRepo.toggleFavorite(canonicalGameId);
    } catch (err: any) {
      console.error('[IPC canonical:toggleFavorite] Error:', err.message);
      throw err;
    }
  });

  // Set hidden
  ipcMain.handle('canonical:setHidden', async (_event, canonicalGameId: number, isHidden: boolean) => {
    try {
      return canonicalRepo.setHidden(canonicalGameId, isHidden);
    } catch (err: any) {
      console.error('[IPC canonical:setHidden] Error:', err.message);
      throw err;
    }
  });
}

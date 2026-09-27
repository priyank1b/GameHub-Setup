import { Database } from 'better-sqlite3';
import { ILauncherProvider } from './ILauncherProvider';
import { SteamLauncherProvider } from './SteamLauncherProvider';
import { EpicLauncherProvider } from './EpicLauncherProvider';
import { GenericLauncherProvider } from './GenericLauncherProvider';
import {
  LauncherAccountRepository,
  LauncherGameEntryRepository,
  CanonicalGameRepository,
  LocalInstallationRepository,
  SettingsRepository,
} from '../../database/index';
import {
  LauncherAccount,
  CanonicalGame,
} from '../../../src/types/LauncherAccount';
import { GameLauncher } from '../../../src/types/Launcher';
import { CanonicalMatcher } from '../CanonicalMatcher';

export class LauncherAccountService {
  private providers: Map<GameLauncher, ILauncherProvider> = new Map();
  private accountRepo: LauncherAccountRepository;
  private gameEntryRepo: LauncherGameEntryRepository;
  private canonicalRepo: CanonicalGameRepository;
  private localInstallRepo: LocalInstallationRepository;
  private settingsRepo: SettingsRepository;

  constructor(db: Database, settingsRepo?: SettingsRepository) {
    this.accountRepo = new LauncherAccountRepository(db);
    this.gameEntryRepo = new LauncherGameEntryRepository(db);
    this.canonicalRepo = new CanonicalGameRepository(db);
    this.localInstallRepo = new LocalInstallationRepository(db);
    this.settingsRepo = settingsRepo || new SettingsRepository(db);

    // Register official providers
    this.registerProvider(
      new SteamLauncherProvider(
        (key, def) => this.settingsRepo.get(key, def),
        (extId, accId) => this.gameEntryRepo.isOwnedByOtherAccount(extId, accId)
      )
    );
    this.registerProvider(new EpicLauncherProvider());

    // Register generic providers for remaining platforms
    const genericLaunchers: GameLauncher[] = [
      'GOG',
      'XBOX',
      'EA',
      'UBISOFT',
      'BATTLE_NET',
      'ROCKSTAR',
      'STANDALONE',
    ];
    for (const l of genericLaunchers) {
      this.registerProvider(new GenericLauncherProvider(l, l));
    }
  }

  public registerProvider(provider: ILauncherProvider): void {
    this.providers.set(provider.launcher, provider);
  }

  public getProvider(launcher: GameLauncher): ILauncherProvider | undefined {
    return this.providers.get(launcher);
  }

  public getAccounts(): LauncherAccount[] {
    return this.accountRepo.getAll();
  }

  public getAccountById(id: number): LauncherAccount | null {
    return this.accountRepo.getById(id);
  }

  /**
   * Discovers and registers connected accounts across detected local launchers
   */
  public async discoverAndConnectAccounts(): Promise<LauncherAccount[]> {
    const connected: LauncherAccount[] = [];

    for (const [launcher, provider] of this.providers.entries()) {
      try {
        const discovered = await provider.identifyConnectedAccounts();
        for (const item of discovered) {
          let account = this.accountRepo.getByLauncherAndExternalId(
            launcher,
            item.externalAccountId
          );

          if (!account) {
            account = this.accountRepo.create({
              launcher,
              externalAccountId: item.externalAccountId,
              displayName: item.displayName,
              avatarUrl: item.avatarUrl,
              connectionStatus: 'CONNECTED',
              syncStatus: 'IDLE',
            });
          } else if (account.connectionStatus !== 'CONNECTED') {
            account = this.accountRepo.update(account.id, {
              connectionStatus: 'CONNECTED',
              displayName: item.displayName || account.displayName,
            })!;
          }
          connected.push(account);
        }
      } catch (err: any) {
        console.warn(`[LauncherAccountService] Error identifying ${launcher} accounts:`, err.message);
      }
    }

    return connected;
  }

  /**
   * Synchronizes library entries for a specific account independently
   */
  public async syncAccount(
    accountId: number
  ): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    const account = this.accountRepo.getById(accountId);
    if (!account) {
      return { success: false, syncedCount: 0, error: 'Account not found' };
    }

    const provider = this.providers.get(account.launcher);
    if (!provider) {
      return { success: false, syncedCount: 0, error: `No provider for launcher ${account.launcher}` };
    }

    this.accountRepo.updateSyncStatus(accountId, 'SYNCING');

    try {
      const items = await provider.syncLibrary(account);

      // Reconcile items with database
      const preparedEntries = items.map((item) => {
        // Resolve or create canonical game
        const canonical = CanonicalMatcher.findOrCreateCanonical(this.canonicalRepo, {
          title: item.title,
          launcher: account.launcher,
          externalGameId: item.externalGameId,
          coverImage: item.coverImage,
        });

        return {
          externalGameId: item.externalGameId,
          title: item.title,
          canonicalGameId: canonical.id,
          ownedStatus: 'OWNED' as const,
          installAvailable: item.installAvailable,
          metadataJson: item.metadataJson,
        };
      });

      this.gameEntryRepo.upsertBatch(accountId, preparedEntries);

      // Clean up stale entries only if items were returned or if uninstalled sync is disabled
      if (items.length > 0) {
        const validExternalIds = items.map((i) => i.externalGameId);
        this.gameEntryRepo.deleteUnseenForAccount(accountId, validExternalIds);
        this.canonicalRepo.deleteOrphanedPlaceholders();
      } else {
        const syncUninstalled = this.settingsRepo.get<boolean | string>(`account_${accountId}_sync_uninstalled`, true);
        if (syncUninstalled === false || syncUninstalled === 'false') {
          this.gameEntryRepo.deleteByAccountId(accountId);
          this.canonicalRepo.deleteOrphanedPlaceholders();
        }
      }

      this.accountRepo.updateSyncStatus(accountId, 'SUCCESS');

      return { success: true, syncedCount: items.length };
    } catch (err: any) {
      console.error(`[LauncherAccountService] Sync error for account ${accountId}:`, err.message);
      this.accountRepo.updateSyncStatus(accountId, 'ERROR', err.message);
      // Cached entries remain usable offline per spec
      return { success: false, syncedCount: 0, error: err.message };
    }
  }

  /**
   * Syncs all connected accounts in parallel/isolation
   */
  public async syncAll(): Promise<Record<number, { success: boolean; syncedCount: number; error?: string }>> {
    const accounts = this.accountRepo.getAll().filter((a) => a.connectionStatus === 'CONNECTED');
    const results: Record<number, { success: boolean; syncedCount: number; error?: string }> = {};

    await Promise.all(
      accounts.map(async (acc) => {
        results[acc.id] = await this.syncAccount(acc.id);
      })
    );

    return results;
  }

  /**
   * Disconnects an account:
   * - Removes cached library entries for that account
   * - Retains local installations on disk
   * - Retains canonical game if another account or local install remains
   */
  public async disconnectAccount(accountId: number): Promise<boolean> {
    const account = this.accountRepo.getById(accountId);
    if (!account) return false;

    // 1. Remove cached game entries
    this.gameEntryRepo.deleteByAccountId(accountId);

    // 2. Mark account as disconnected
    this.accountRepo.update(accountId, { connectionStatus: 'DISCONNECTED' });

    // 3. Clean up orphan canonical games (games with 0 ownerships and 0 local installations)
    const allGames = this.canonicalRepo.getAll(true);
    for (const g of allGames) {
      if (g.ownerships.length === 0 && g.installations.length === 0) {
        this.canonicalRepo.delete(g.id);
      }
    }

    return true;
  }

  /**
   * Reconnects an account and triggers sync
   */
  public async reconnectAccount(accountId: number): Promise<boolean> {
    const account = this.accountRepo.getById(accountId);
    if (!account) return false;

    this.accountRepo.update(accountId, { connectionStatus: 'CONNECTED' });
    await this.syncAccount(accountId);
    return true;
  }

  /**
   * Hands off installation to the official launcher
   */
  public async installGame(
    launcherAccountId: number,
    externalGameId: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const account = this.accountRepo.getById(launcherAccountId);
    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    const provider = this.providers.get(account.launcher);
    if (!provider) {
      return { success: false, error: `No provider for launcher ${account.launcher}` };
    }

    const entry = this.gameEntryRepo.getByAccountAndExternalId(launcherAccountId, externalGameId);
    if (!entry) {
      return { success: false, error: 'Game entry not found' };
    }

    return provider.handoffInstall(entry, account);
  }

  /**
   * Hands off game launch to official launcher or local binary
   */
  public async launchGame(
    canonicalGameId: number,
    launcherAccountId?: number
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const game = this.canonicalRepo.getById(canonicalGameId);
    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    // Determine target installation or ownership
    let installation = game.installations.find((i) =>
      launcherAccountId ? i.launcherAccountId === launcherAccountId : i.status === 'INSTALLED'
    ) || game.installations[0];

    let ownership = game.ownerships.find((o) =>
      launcherAccountId ? o.launcherAccountId === launcherAccountId : true
    ) || game.ownerships[0];

    const launcher = installation?.launcher || ownership?.launcher || 'UNKNOWN';
    const provider = this.providers.get(launcher);

    if (!provider) {
      return { success: false, error: `No launcher provider available for ${launcher}` };
    }

    const entry = ownership
      ? this.gameEntryRepo.getByAccountAndExternalId(ownership.launcherAccountId, ownership.externalGameId) || undefined
      : undefined;

    const account = ownership ? this.accountRepo.getById(ownership.launcherAccountId) || undefined : undefined;

    const result = await provider.handoffLaunch(entry, installation, account);
    if (result.success) {
      this.canonicalRepo.recordPlayTime(canonicalGameId, 0);
    }
    return result;
  }

  /**
   * Retrieves all canonical games for the UI
   */
  public getCanonicalLibrary(includeHidden = false): CanonicalGame[] {
    return this.canonicalRepo.getAll(includeHidden);
  }

  /**
   * Discovers known Steam friends from local Steam friendstore cache
   */
  public async getDetectedFriends(): Promise<
    Array<{ steamId: string; personaName: string; avatarUrl?: string }>
  > {
    const steamProvider = this.providers.get('STEAM') as SteamLauncherProvider | undefined;
    if (steamProvider && typeof steamProvider.getDetectedSteamFriends === 'function') {
      return await steamProvider.getDetectedSteamFriends();
    }
    return [];
  }

  /**
   * Adds or links a friend / shared family account
   */
  public async addFriendAccount(data: {
    launcher: GameLauncher;
    externalAccountId: string;
    displayName: string;
    avatarUrl?: string;
  }): Promise<LauncherAccount> {
    let account = this.accountRepo.getByLauncherAndExternalId(
      data.launcher,
      data.externalAccountId
    );

    if (!account) {
      account = this.accountRepo.create({
        launcher: data.launcher,
        externalAccountId: data.externalAccountId,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        connectionStatus: 'CONNECTED',
        syncStatus: 'IDLE',
      });
    } else {
      account = this.accountRepo.update(account.id, {
        connectionStatus: 'CONNECTED',
        displayName: data.displayName || account.displayName,
        avatarUrl: data.avatarUrl || account.avatarUrl,
      })!;
    }

    // Immediately trigger a sync for this friend account
    await this.syncAccount(account.id);
    return account;
  }
}

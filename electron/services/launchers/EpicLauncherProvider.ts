import fs from 'fs';
import path from 'path';
import { shell } from 'electron';
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

interface CatCacheItem {
  id?: string;
  namespace?: string;
  title?: string;
  description?: string;
  developer?: string;
  categories?: Array<{ path: string }>;
  keyImages?: Array<{
    type: string;
    url: string;
    width?: number;
    height?: number;
  }>;
  releaseInfo?: Array<{
    appId?: string;
    platform?: string[];
  }>;
}

export class EpicLauncherProvider implements ILauncherProvider {
  public readonly launcher: GameLauncher = 'EPIC';
  public readonly name = 'Epic Games';

  public async identifyConnectedAccounts(): Promise<DiscoveredAccount[]> {
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
    const epicSaved = path.join(localAppData, 'EpicGamesLauncher', 'Saved');

    let activeAccountId: string | null = null;
    let logUserName: string | null = null;

    // 1. Inspect active login from EpicGamesLauncher.log
    const logPath = path.join(epicSaved, 'Logs', 'EpicGamesLauncher.log');
    if (fs.existsSync(logPath)) {
      try {
        const logContent = fs.readFileSync(logPath, 'utf8');
        const loginMatch = logContent.match(/FAccountService::OnLoginComplete\s+-\s+\d+\s+TRUE\s+([a-f0-9]{32})/i);
        if (loginMatch && loginMatch[1]) {
          activeAccountId = loginMatch[1].trim();
        }
        const userMatch = logContent.match(/User:\s*([a-zA-Z0-9_\-\.]+)/i);
        if (userMatch && userMatch[1]) {
          logUserName = userMatch[1].trim();
        }
      } catch {}
    }

    // 2. Check GameUserSettings.ini if not in log
    if (!activeAccountId) {
      const candidateIniPaths = [
        path.join(epicSaved, 'Config', 'WindowsEditor', 'GameUserSettings.ini'),
        path.join(epicSaved, 'Config', 'Windows', 'GameUserSettings.ini'),
      ];
      for (const iniPath of candidateIniPaths) {
        if (fs.existsSync(iniPath)) {
          try {
            const content = fs.readFileSync(iniPath, 'utf8');
            const match = content.match(/ActiveAccountId=([^\r\n]+)/i);
            if (match && match[1]) {
              activeAccountId = match[1].trim();
              break;
            }
          } catch {}
        }
      }
    }

    // 3. Fallback to newest OC_*.dat in Saved/Data
    if (!activeAccountId) {
      const dataDir = path.join(epicSaved, 'Data');
      if (fs.existsSync(dataDir)) {
        try {
          const files = fs.readdirSync(dataDir);
          let newestTime = 0;
          for (const file of files) {
            const match = file.match(/^OC_([a-f0-9]{32})\.dat$/i);
            if (match && match[1]) {
              const stat = fs.statSync(path.join(dataDir, file));
              if (stat.mtimeMs > newestTime) {
                newestTime = stat.mtimeMs;
                activeAccountId = match[1];
              }
            }
          }
        } catch {}
      }
    }

    // Epic Games does not support family sharing; exactly ONE primary Epic account is identified
    const accountId = activeAccountId || 'epic_local_user';
    return [
      {
        externalAccountId: accountId,
        displayName: 'Epic Games',
        isMostRecent: true,
      },
    ];
  }

  public async syncLibrary(account: LauncherAccount): Promise<SyncedGameItem[]> {
    const progData = process.env.ProgramData || 'C:\\ProgramData';
    const manifestsDir = path.join(progData, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
    const items: SyncedGameItem[] = [];
    const installedIds = new Set<string>();
    const seenTitles = new Set<string>();

    // 1. Load and index local Epic catalog cache (catcache.bin)
    const catcachePath = path.join(progData, 'Epic', 'EpicGamesLauncher', 'Data', 'Catalog', 'catcache.bin');
    const catalogItems: CatCacheItem[] = [];
    const byCatalogId = new Map<string, CatCacheItem>();
    const byAppId = new Map<string, CatCacheItem>();
    const byNormalizedTitle = new Map<string, CatCacheItem>();

    if (fs.existsSync(catcachePath)) {
      try {
        const raw = fs.readFileSync(catcachePath, 'utf8');
        const decoded = Buffer.from(raw, 'base64').toString('utf8');
        const parsed: CatCacheItem[] = JSON.parse(decoded);

        for (const item of parsed) {
          if (!item.title) continue;
          catalogItems.push(item);
          if (item.id) byCatalogId.set(item.id.toLowerCase(), item);
          if (item.releaseInfo && Array.isArray(item.releaseInfo)) {
            for (const rel of item.releaseInfo) {
              if (rel.appId) byAppId.set(rel.appId.toLowerCase(), item);
            }
          }
          const normTitle = this.normalizeTitle(item.title);
          if (normTitle) byNormalizedTitle.set(normTitle, item);
        }
      } catch (err: any) {
        console.warn('[EpicLauncherProvider] Failed to load catcache.bin:', err.message);
      }
    }

    const findCatMeta = (appName?: string, catalogItemId?: string, title?: string): CatCacheItem | undefined => {
      if (catalogItemId && byCatalogId.has(catalogItemId.toLowerCase())) {
        return byCatalogId.get(catalogItemId.toLowerCase());
      }
      if (appName && byAppId.has(appName.toLowerCase())) {
        return byAppId.get(appName.toLowerCase());
      }
      if (title) {
        const norm = this.normalizeTitle(title);
        if (byNormalizedTitle.has(norm)) return byNormalizedTitle.get(norm);
      }
      return undefined;
    };

    const getTallCover = (item?: CatCacheItem): string | undefined => {
      if (!item?.keyImages || !Array.isArray(item.keyImages)) return undefined;
      const tall = item.keyImages.find(
        (k) => k.type === 'DieselGameBoxTall' || k.type === 'OfferImageTall' || k.type === 'Thumbnail'
      );
      return tall?.url;
    };

    // 2. Read all local manifests (Installed games)
    if (fs.existsSync(manifestsDir)) {
      try {
        const files = fs.readdirSync(manifestsDir);
        for (const file of files) {
          if (!file.endsWith('.item')) continue;
          try {
            const filePath = path.join(manifestsDir, file);
            const raw = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(raw);
            const appName = data.AppName || data.CatalogItemId;
            const title = data.DisplayName;

            if (appName && title) {
              installedIds.add(appName.toLowerCase());
              if (data.CatalogItemId) installedIds.add(data.CatalogItemId.toLowerCase());
              seenTitles.add(this.normalizeTitle(title));

              const meta = findCatMeta(appName, data.CatalogItemId, title);
              const coverImage = getTallCover(meta);

              items.push({
                externalGameId: appName,
                title,
                coverImage,
                installAvailable: false, // already installed locally
                metadataJson: JSON.stringify({
                  catalogItemId: data.CatalogItemId,
                  namespace: data.CatalogNamespace,
                  installLocation: data.InstallLocation,
                  executable: data.LaunchExecutable,
                }),
              });
            }
          } catch {}
        }
      } catch (err: any) {
        console.warn('[EpicLauncherProvider] Error scanning manifests:', err.message);
      }
    }

    // 3. Populate full owned cloud library from catcache.bin
    for (const catItem of catalogItems) {
      if (!catItem.title) continue;
      const title = catItem.title.trim();
      const normTitle = this.normalizeTitle(title);

      // Filter out non-games (engine tools, asset packs, promotions, testing)
      if (this.isExcludedItem(title, catItem)) continue;

      // Extract cover image
      const coverImage = getTallCover(catItem);
      if (!coverImage) continue; // Require valid cover poster for available games

      const appName = catItem.releaseInfo?.[0]?.appId || catItem.id || normTitle;
      const catalogItemId = catItem.id;

      // Skip if already installed
      if (installedIds.has(appName.toLowerCase()) || (catalogItemId && installedIds.has(catalogItemId.toLowerCase()))) {
        continue;
      }

      // Avoid duplicate title entries
      if (seenTitles.has(normTitle)) continue;
      seenTitles.add(normTitle);

      items.push({
        externalGameId: appName,
        title,
        coverImage,
        installAvailable: true, // owned in Epic library, ready to install
        metadataJson: JSON.stringify({
          catalogItemId,
          namespace: catItem.namespace,
          appName,
        }),
      });
    }

    return items;
  }

  private normalizeTitle(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private isExcludedItem(title: string, item: CatCacheItem): boolean {
    const lower = title.toLowerCase();
    if (
      lower.includes('twinmotion') ||
      lower.includes('unreal engine') ||
      lower.includes('coupon') ||
      lower.includes('promotion') ||
      lower.includes('internal testing') ||
      lower.includes('editorial') ||
      lower.includes('sample project') ||
      lower.includes('tech beta') ||
      lower.includes('closed beta') ||
      lower.includes('playtest') ||
      lower.includes('press kit') ||
      lower.includes('soundtrack') ||
      lower.includes('artbook') ||
      lower.includes('rot pack')
    ) {
      return true;
    }

    const categories = item.categories?.map((c) => c.path.toLowerCase()) || [];
    const isAddon = categories.some(
      (c) =>
        c.includes('addon') ||
        c.includes('dlc') ||
        c.includes('plugin') ||
        c.includes('sample') ||
        c.includes('engine') ||
        c.includes('asset') ||
        c.includes('track') ||
        c.includes('music') ||
        c.includes('mod')
    );
    if (isAddon) return true;

    const isGame = categories.some((c) => c === 'games' || c === 'applications');
    return !isGame;
  }

  public async handoffInstall(
    gameEntry: LauncherGameEntry
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const uri = `com.epicgames.launcher://apps/${gameEntry.externalGameId}?action=install`;
      await shell.openExternal(uri);
      return { success: true, message: `Dispatched install to Epic Games for ${gameEntry.externalGameId}` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async handoffLaunch(
    gameEntry?: LauncherGameEntry,
    installation?: LocalInstallation
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      if (installation?.executablePath && fs.existsSync(installation.executablePath)) {
        if (gameEntry?.externalGameId) {
          const uri = `com.epicgames.launcher://apps/${gameEntry.externalGameId}?action=launch`;
          await shell.openExternal(uri);
          return { success: true, message: `Launched via Epic URI: ${uri}` };
        }
      } else if (gameEntry?.externalGameId) {
        const uri = `com.epicgames.launcher://apps/${gameEntry.externalGameId}?action=launch`;
        await shell.openExternal(uri);
        return { success: true, message: `Launched via Epic URI: ${uri}` };
      }

      return { success: false, error: 'Cannot launch: missing executable and game ID' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}


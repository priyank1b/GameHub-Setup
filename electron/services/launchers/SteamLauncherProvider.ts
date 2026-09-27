import fs from 'fs';
import path from 'path';
import { shell } from 'electron';
import { exec } from 'child_process';
import util from 'util';
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

const execAsync = util.promisify(exec);

export class SteamLauncherProvider implements ILauncherProvider {
  public readonly launcher: GameLauncher = 'STEAM';
  public readonly name = 'Steam';
  private steamPath: string | null = null;

  constructor(
    private getSetting?: (key: string, defaultValue?: any) => any,
    private isOwnedByOtherAccount?: (externalGameId: string, currentAccountId: number) => boolean
  ) {}

  public async getDetectedSteamFriends(): Promise<
    Array<{ steamId: string; personaName: string; avatarUrl?: string }>
  > {
    const steamDir = await this.getSteamPath();
    if (!steamDir) return [];

    const friendsMap = new Map<string, { steamId: string; personaName: string; avatarUrl?: string }>();
    const localAccountIds = new Set<string>();

    const loginUsersPath = path.join(steamDir, 'config', 'loginusers.vdf');
    if (fs.existsSync(loginUsersPath)) {
      try {
        const content = fs.readFileSync(loginUsersPath, 'utf8');
        const regex = /"(\d{17})"/g;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(content)) !== null) {
          localAccountIds.add(m[1]);
        }
      } catch {}
    }

    const userdataDir = path.join(steamDir, 'userdata');
    if (fs.existsSync(userdataDir)) {
      try {
        const userDirs = fs.readdirSync(userdataDir);
        for (const u of userDirs) {
          const cfgPath = path.join(userdataDir, u, 'config', 'localconfig.vdf');
          if (fs.existsSync(cfgPath)) {
            try {
              const text = fs.readFileSync(cfgPath, 'utf8');
              const cacheMatch = text.match(/"friendstore_playercache"\s+"(.+?)"\r?\n/);
              if (cacheMatch) {
                const rawJson = cacheMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                const parsed = JSON.parse(rawJson);
                if (Array.isArray(parsed)) {
                  for (const f of parsed) {
                    if (f.steamid && !localAccountIds.has(f.steamid)) {
                      const avatarUrl = f.avatar_hash
                        ? `https://avatars.steamstatic.com/${f.avatar_hash}_full.jpg`
                        : undefined;
                      friendsMap.set(f.steamid, {
                        steamId: f.steamid,
                        personaName: f.persona_name || `Steam Friend (${f.steamid.slice(-4)})`,
                        avatarUrl,
                      });
                    }
                  }
                }
              }
            } catch {}
          }
        }
      } catch {}
    }

    return Array.from(friendsMap.values());
  }

  public async getSteamPath(): Promise<string | null> {
    if (this.steamPath && fs.existsSync(this.steamPath)) {
      return this.steamPath;
    }

    try {
      const cmd = `powershell -NoProfile -NonInteractive -Command "Get-ItemProperty -Path 'HKCU:\\Software\\Valve\\Steam' -Name 'SteamPath' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty SteamPath"`;
      const { stdout } = await execAsync(cmd, { timeout: 3000 });
      if (stdout && stdout.trim()) {
        const p = stdout.trim().replace(/\//g, '\\');
        if (fs.existsSync(p)) {
          this.steamPath = p;
          return p;
        }
      }
    } catch {}

    const standardPaths = [
      'C:\\Program Files (x86)\\Steam',
      'C:\\Program Files\\Steam',
      'C:\\Steam',
      'D:\\Steam',
      'E:\\Steam',
    ];

    for (const p of standardPaths) {
      if (fs.existsSync(p)) {
        this.steamPath = p;
        return p;
      }
    }

    return null;
  }

  public async identifyConnectedAccounts(): Promise<DiscoveredAccount[]> {
    const steamDir = await this.getSteamPath();
    if (!steamDir) {
      return [];
    }

    const loginUsersPath = path.join(steamDir, 'config', 'loginusers.vdf');
    if (!fs.existsSync(loginUsersPath)) {
      return [];
    }

    const accounts: DiscoveredAccount[] = [];
    try {
      const content = fs.readFileSync(loginUsersPath, 'utf8');
      // Matches "76561198..." { ... }
      const userBlockRegex = /"(\d{17})"\s*\{([^}]+)\}/g;
      let match: RegExpExecArray | null;

      while ((match = userBlockRegex.exec(content)) !== null) {
        const steamId64 = match[1];
        const block = match[2];

        const personaMatch = block.match(/"PersonaName"\s+"([^"]+)"/i);
        const accountMatch = block.match(/"AccountName"\s+"([^"]+)"/i);
        const mostRecentMatch = block.match(/"MostRecent"\s+"([^"]+)"/i);

        const displayName = personaMatch?.[1] || accountMatch?.[1] || `Steam User (${steamId64.slice(-4)})`;
        const isMostRecent = mostRecentMatch?.[1] === '1';

        accounts.push({
          externalAccountId: steamId64,
          displayName,
          avatarUrl: undefined,
          isMostRecent,
        });
      }
    } catch (err: any) {
      console.warn('[SteamLauncherProvider] Error parsing loginusers.vdf:', err.message);
    }

    return accounts;
  }

  public async syncLibrary(account: LauncherAccount): Promise<SyncedGameItem[]> {
    const steamDir = await this.getSteamPath();
    if (!steamDir) {
      throw new Error('Steam installation not found on this system.');
    }

    const items: Map<string, SyncedGameItem> = new Map();

    // 1. Read library folders
    const libraryPaths = new Set<string>();
    libraryPaths.add(steamDir);

    const vdfPath = path.join(steamDir, 'steamapps', 'libraryfolders.vdf');
    if (fs.existsSync(vdfPath)) {
      try {
        const content = fs.readFileSync(vdfPath, 'utf8');
        const regex = /"path"\s+"([^"]+)"/gi;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
          const raw = match[1].replace(/\\\\/g, '\\');
          if (fs.existsSync(raw)) {
            libraryPaths.add(raw);
          }
        }
      } catch {}
    }

    // Check if account has local userdata on this PC
    const steamIdBig = BigInt(account.externalAccountId || '0');
    const steamId32 = steamIdBig > BigInt('76561197960265728')
      ? (steamIdBig - BigInt('76561197960265728')).toString()
      : account.externalAccountId;
    const localUserdataDir = path.join(steamDir, 'userdata', steamId32);
    const hasLocalUserData = fs.existsSync(localUserdataDir);

    // 2. Discover games from appmanifest files across all Steam libraries
    // First map all installed games and their LastOwners across this PC
    const allInstalledLastOwners = new Map<string, string>();
    for (const libPath of libraryPaths) {
      const steamappsDir = path.join(libPath, 'steamapps');
      if (!fs.existsSync(steamappsDir)) continue;

      let entries: string[] = [];
      try {
        entries = fs.readdirSync(steamappsDir);
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (entry.startsWith('appmanifest_') && entry.endsWith('.acf')) {
          const fullPath = path.join(steamappsDir, entry);
          try {
            const manifestContent = fs.readFileSync(fullPath, 'utf8');
            const appIdMatch = manifestContent.match(/"appid"\s+"([^"]+)"/i);
            const nameMatch = manifestContent.match(/"name"\s+"([^"]+)"/i);
            const lastOwnerMatch = manifestContent.match(/"LastOwner"\s+"([^"]+)"/i);

            if (appIdMatch && nameMatch) {
              const appId = appIdMatch[1];
              const title = nameMatch[1];
              const lastOwner = lastOwnerMatch?.[1];

              // Skip common runtimes/redists
              const ignored = ['228980', '228990', '1391110', '1070560', '250820', '896660'];
              if (ignored.includes(appId)) continue;

              if (lastOwner) {
                allInstalledLastOwners.set(appId, lastOwner);
              }

              // Strict ownership: an account ONLY owns an installed game if it is the LastOwner!
              // This ensures family-shared installed games are NOT falsely credited to borrower accounts.
              if (lastOwner && lastOwner === account.externalAccountId) {
                const coverImage = this.getSteamArtwork(steamDir, appId);
                items.set(appId, {
                  externalGameId: appId,
                  title,
                  coverImage,
                  installAvailable: false, // already installed
                });
              }
            }
          } catch {}
        }
      }
    }

    // 3. Inspect user-specific licenses / cache if userdata exists for this account
    const syncUninstalled = this.getSetting?.(`account_${account.id}_sync_uninstalled`, true) ?? true;

    if (hasLocalUserData && syncUninstalled) {
      try {
        const appInfoMap = this.getSteamAppInfoMap(steamDir);
        const localConfigPath = path.join(localUserdataDir, 'config', 'localconfig.vdf');
        const libraryCacheDir = path.join(localUserdataDir, 'config', 'librarycache');

        const candidateAppIds = new Set<string>();

        // A. Direct App IDs from localconfig.vdf
        if (fs.existsSync(localConfigPath)) {
          const cfgContent = fs.readFileSync(localConfigPath, 'utf8');
          for (const id of this.extractDirectAppIds(cfgContent)) {
            candidateAppIds.add(id);
          }
        }

        // B. App IDs from local librarycache (e.g. unlaunched owned games like Bubba Yuga)
        if (fs.existsSync(libraryCacheDir)) {
          try {
            const cacheFiles = fs.readdirSync(libraryCacheDir);
            for (const f of cacheFiles) {
              if (f.endsWith('.json') && !f.startsWith('achievement')) {
                const appId = f.replace('.json', '');
                if (/^\d+$/.test(appId)) {
                  // Verify that it's not an empty browsing/store stub (0 total and 0 unachieved)
                  try {
                    const parsed = JSON.parse(fs.readFileSync(path.join(libraryCacheDir, f), 'utf8'));
                    if (Array.isArray(parsed) && parsed[0]?.[0] === 'achievements') {
                      const ach = parsed[0][1]?.data;
                      if (
                        !ach ||
                        (ach.nTotal === 0 &&
                          ach.nAchieved === 0 &&
                          (!ach.vecUnachieved || ach.vecUnachieved.length === 0))
                      ) {
                        continue; // Skip empty store/browsing stub
                      }
                    }
                  } catch {}
                  candidateAppIds.add(appId);
                }
              }
            }
          } catch {}
        }

        for (const rawId of candidateAppIds) {
          if (!rawId || items.has(rawId)) continue;

          const isInstalledOnDisk = allInstalledLastOwners.has(rawId);

          // If NOT installed on disk and already confirmed as owned by another family account, don't duplicate
          if (!isInstalledOnDisk && this.isOwnedByOtherAccount?.(rawId, account.id)) {
            continue;
          }

          const info = appInfoMap.get(rawId);
          // Filter non-game utilities (config, tools, dedicated servers, screenshot managers, demos, playtests)
          if (info) {
            const t = info.type.toLowerCase();
            const n = info.name.toLowerCase();
            if (
              t === 'config' ||
              t === 'tool' ||
              t === 'demo' ||
              (t === 'application' && n.includes('server')) ||
              n.includes('dedicated server') ||
              n.includes("friend's pass") ||
              n.includes('playtest')
            ) {
              continue;
            }
          } else if (
            rawId === '7' ||
            rawId === '760' ||
            rawId === '2371090' ||
            rawId === '2394010' ||
            rawId === '4347980' ||
            rawId === '4704030'
          ) {
            continue;
          }

          const title = info?.name || `Steam App ${rawId}`;
          const coverImage = this.getSteamArtwork(steamDir, rawId);

          items.set(rawId, {
            externalGameId: rawId,
            title,
            coverImage,
            installAvailable: !isInstalledOnDisk, // If installed on disk, installAvailable is false (ready to play)
          });
        }
      } catch (err: any) {
        console.warn('[SteamLauncherProvider] Error syncing Steam userdata library:', err.message);
      }
    }

    // 4. If an optional Steam Web API key is configured, sync remote library (ideal for remote friends)
    const apiKey = (this.getSetting?.('steam_web_api_key', '') || '').trim();
    if (apiKey && account.externalAccountId) {
      try {
        const remoteGames = await this.fetchSteamWebAPIGames(apiKey, account.externalAccountId, steamDir);
        for (const g of remoteGames) {
          if (!items.has(g.externalGameId)) {
            items.set(g.externalGameId, g);
          }
        }
      } catch (err: any) {
        console.warn('[SteamLauncherProvider] Error querying Steam Web API:', err.message);
      }
    }

    return Array.from(items.values());
  }

  private async fetchSteamWebAPIGames(
    apiKey: string,
    steamId64: string,
    steamDir?: string | null
  ): Promise<SyncedGameItem[]> {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${encodeURIComponent(
      apiKey
    )}&steamid=${encodeURIComponent(
      steamId64
    )}&include_appinfo=1&include_played_free_games=1&format=json`;

    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'GameHub/2.0.0' } });
      if (!res.ok) {
        console.warn(`[SteamLauncherProvider] Steam Web API error: ${res.status} ${res.statusText}`);
        return [];
      }
      const data: any = await res.json();
      const games = data?.response?.games;
      if (!Array.isArray(games)) return [];

      return games.map((g: any) => {
        const appId = String(g.appid);
        const title = g.name || `Steam App ${appId}`;
        const coverImage = steamDir
          ? this.getSteamArtwork(steamDir, appId)
          : `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;

        return {
          externalGameId: appId,
          title,
          coverImage,
          installAvailable: true,
        };
      });
    } catch (err: any) {
      console.warn('[SteamLauncherProvider] fetchSteamWebAPIGames error:', err.message);
      return [];
    }
  }

  private extractDirectAppIds(content: string): string[] {
    const appsIdx = content.search(/"Apps"\s*\{/i);
    if (appsIdx === -1) return [];
    const start = content.indexOf('{', appsIdx);
    if (start === -1) return [];

    const appIds: string[] = [];
    let depth = 1;
    let i = start + 1;
    let tokenStart = -1;

    while (i < content.length && depth > 0) {
      const ch = content[i];
      if (ch === '{') {
        if (depth === 1 && tokenStart !== -1) {
          const key = content.slice(tokenStart, i).trim().replace(/"/g, '');
          if (/^\d+$/.test(key)) {
            appIds.push(key);
          }
          tokenStart = -1;
        }
        depth++;
      } else if (ch === '}') {
        depth--;
        tokenStart = -1;
      } else if (depth === 1) {
        if (ch === '"' && tokenStart === -1) {
          tokenStart = i;
        }
      }
      i++;
    }
    return appIds;
  }

  private getSteamArtwork(steamDir: string, appId: string): string {
    const local600 = path.join(steamDir, 'appcache', 'librarycache', appId, 'library_600x900.jpg');
    if (fs.existsSync(local600)) {
      return local600;
    }
    const localHeader = path.join(steamDir, 'appcache', 'librarycache', appId, 'header.jpg');
    if (fs.existsSync(localHeader)) {
      return localHeader;
    }
    // High-res Steam CDN cover art
    return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;
  }

  private appInfoCache: Map<string, { name: string; type: string }> | null = null;

  private getSteamAppInfoMap(steamDir: string): Map<string, { name: string; type: string }> {
    if (this.appInfoCache) {
      return this.appInfoCache;
    }

    const appinfoPath = path.join(steamDir, 'appcache', 'appinfo.vdf');
    if (!fs.existsSync(appinfoPath)) {
      return new Map();
    }

    try {
      const buf = fs.readFileSync(appinfoPath);
      if (buf.length < 16) return new Map();

      const strTableOffset = Number(buf.readBigUInt64LE(8));
      if (strTableOffset >= buf.length || strTableOffset === 0) return new Map();

      const strCount = buf.readUInt32LE(strTableOffset);
      const strings: string[] = [];
      let p = strTableOffset + 4;
      for (let i = 0; i < strCount && p < buf.length; i++) {
        const zero = buf.indexOf(0, p);
        if (zero === -1) break;
        strings.push(buf.slice(p, zero).toString('utf8'));
        p = zero + 1;
      }

      const nameIdx = strings.indexOf('name');
      const typeIdx = strings.indexOf('type');
      const map = new Map<string, { name: string; type: string }>();

      let off = 16;
      while (off < strTableOffset) {
        const appId = buf.readUInt32LE(off);
        if (appId === 0) break;
        const size = buf.readUInt32LE(off + 4);
        const end = Math.min(strTableOffset, off + 8 + size);

        let name = '';
        let type = '';
        for (let i = off + 8; i < end - 5; i++) {
          if (buf[i] === 1) { // Type 1 (string)
            const k = buf.readUInt32LE(i + 1);
            if (k === nameIdx && !name) {
              const valEnd = buf.indexOf(0, i + 5);
              if (valEnd !== -1 && valEnd <= end) {
                name = buf.slice(i + 5, valEnd).toString('utf8');
              }
            } else if (k === typeIdx && !type) {
              const valEnd = buf.indexOf(0, i + 5);
              if (valEnd !== -1 && valEnd <= end) {
                type = buf.slice(i + 5, valEnd).toString('utf8');
              }
            }
          }
          if (name && type) break;
        }

        if (name) {
          map.set(appId.toString(), { name, type: (type || 'game').toLowerCase() });
        }
        off += 8 + size;
      }

      this.appInfoCache = map;
      return map;
    } catch (err: any) {
      console.warn('[SteamLauncherProvider] Failed parsing appinfo.vdf:', err.message);
      return new Map();
    }
  }

  public async handoffInstall(
    gameEntry: LauncherGameEntry
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const url = `steam://install/${gameEntry.externalGameId}`;
      await shell.openExternal(url);
      return {
        success: true,
        message: `Dispatched installation to Steam for App ID ${gameEntry.externalGameId}`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async handoffLaunch(
    gameEntry?: LauncherGameEntry,
    installation?: LocalInstallation,
    account?: LauncherAccount
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      if (gameEntry?.externalGameId) {
        const url = `steam://run/${gameEntry.externalGameId}`;
        await shell.openExternal(url);
        return { success: true, message: `Launched via Steam URI: ${url}` };
      }

      if (installation?.executablePath && fs.existsSync(installation.executablePath)) {
        await shell.openPath(installation.executablePath);
        return { success: true, message: `Launched executable: ${installation.executablePath}` };
      }

      return { success: false, error: 'Neither executable nor external game ID available' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

import fs from 'fs';
import path from 'path';
import { GameCandidate, GameDetector } from '../scanner/types';
import { DriveService } from '../DriveService';
import { SteamMetadataService } from '../SteamMetadataService';
import { locateSteam } from '../SteamLocator';

export class SteamDetector implements GameDetector {
  public readonly name = 'Steam Detector';

  // Common tool / redistributable app IDs to ignore
  private readonly ignoredAppIds = new Set([
    '228980',  // Steamworks Common Redistributables
    '228990',  // DirectX Redist
    '1391110', // Steam Linux Runtime
    '1070560', // SteamVR
    '250820',  // SteamVR Runtime
    '896660',  // Proton
  ]);

  private primarySteamPath: string | null = null;
  private playtimeMap = new Map<string, { playtimeSeconds: number; lastPlayedAt?: string }>();
  private officialInstalledAppIds = new Set<string>();
  public readonly metadataService: SteamMetadataService;

  constructor(private driveService?: DriveService, metadataService?: SteamMetadataService) {
    this.metadataService = metadataService || new SteamMetadataService();
  }

  public async canRun(): Promise<boolean> {
    return process.platform === 'win32';
  }

  public async detect(
    locations: string[],
    onProgress?: (info: { currentPath?: string; message: string }) => void,
    isCancelled?: () => boolean
  ): Promise<GameCandidate[]> {
    const candidates: GameCandidate[] = [];
    const seenAppIds = new Set<string>();
    this.officialInstalledAppIds.clear();

    onProgress?.({ message: 'Locating Steam libraries across all storage drives...' });

    // Step 1: Discover all Steam library folders
    const libraryPaths = await this.discoverSteamLibraryFolders();
    console.log(`[SteamDetector] Discovered ${libraryPaths.length} Steam library path(s):`, libraryPaths);

    // Step 1b: Load user playtimes from Steam userdata
    this.loadSteamPlaytimes();

    // Step 2: Iterate through each library and read appmanifest files
    for (const libPath of libraryPaths) {
      if (isCancelled?.()) {
        console.log('[SteamDetector] Scan cancelled by user request.');
        break;
      }

      onProgress?.({
        currentPath: libPath,
        message: `Scanning Steam library: ${libPath}...`,
      });

      const steamappsDir = path.join(libPath, 'steamapps');
      if (!fs.existsSync(steamappsDir)) continue;

      let entries: string[];
      try {
        entries = fs.readdirSync(steamappsDir);
      } catch (err: any) {
        console.warn(`[SteamDetector] Could not read "${steamappsDir}":`, err.message);
        continue;
      }

      const manifestFiles = entries.filter(
        (f) => f.startsWith('appmanifest_') && f.endsWith('.acf')
      );

      for (const manifestFile of manifestFiles) {
        if (isCancelled?.()) break;

        const manifestPath = path.join(steamappsDir, manifestFile);
        try {
          const candidate = this.parseAppManifest(manifestPath, libPath);
          if (candidate && !seenAppIds.has(candidate.launcherAppId!)) {
            seenAppIds.add(candidate.launcherAppId!);
            candidates.push(candidate);
            onProgress?.({
              currentPath: candidate.installPath,
              message: `Discovered Steam game: ${candidate.name} (App ID: ${candidate.launcherAppId})`,
            });
          }
        } catch (err: any) {
          console.warn(`[SteamDetector] Failed parsing "${manifestFile}":`, err.message);
        }
      }
    }

    // Step 3: Enrich Steam candidates with rich store metadata (Developer, Publisher, Genre, Release Date, Description)
    if (candidates.length > 0 && !isCancelled?.()) {
      onProgress?.({ message: 'Fetching rich metadata from Steam Store...' });
      const appIds = candidates.map((c) => c.launcherAppId!).filter(Boolean);
      try {
        const metaMap = await this.metadataService.batchFetchMetadata(appIds, 4, (done, total) => {
          onProgress?.({
            message: `Enriching Steam game details (${done}/${total})...`,
          });
        });

        for (const candidate of candidates) {
          if (candidate.launcherAppId && metaMap.has(candidate.launcherAppId)) {
            const meta = metaMap.get(candidate.launcherAppId)!;
            if (meta.description) candidate.description = meta.description;
            if (meta.developer) candidate.developer = meta.developer;
            if (meta.publisher) candidate.publisher = meta.publisher;
            if (meta.genre) candidate.genre = meta.genre;
            if (meta.releaseDate) candidate.releaseDate = meta.releaseDate;
          }
        }
      } catch (err: any) {
        console.warn('[SteamDetector] Metadata enrichment failed:', err.message);
      }
    }

    console.log(`[SteamDetector] Total Steam games detected: ${candidates.length}`);
    return candidates;
  }

  /**
   * Discovers all Steam library folders (registry via reg.exe, libraryfolders.vdf in
   * both modern and legacy formats, and a sweep of common folders on every drive).
   */
  public async discoverSteamLibraryFolders(): Promise<string[]> {
    let driveRoots: string[] | undefined;
    try {
      if (this.driveService) {
        // Use every connected drive for Steam: libraries are authoritative, so
        // drive exclusions (meant for the heuristic folder scan) should not hide them.
        const drives = await this.driveService.getAvailableDrives();
        driveRoots = drives.map((d) => d.mountPath);
      }
    } catch (err: any) {
      console.warn('[SteamDetector] Drive listing failed, probing all letters:', err.message);
    }

    const location = await locateSteam(driveRoots);
    this.primarySteamPath = location.clientPath;
    location.listedAppIds.forEach((id) => this.officialInstalledAppIds.add(id));
    if (!location.clientPath) {
      console.warn('[SteamDetector] Steam client folder not found (registry + common paths).');
    }
    return location.libraryPaths;
  }

  /**
   * Parses an appmanifest_*.acf file and constructs a GameCandidate
   */
  private parseAppManifest(manifestPath: string, libraryPath: string): GameCandidate | null {
    const content = fs.readFileSync(manifestPath, 'utf-8');

    const appid = this.extractValue(content, 'appid');
    const name = this.extractValue(content, 'name');
    const installdir = this.extractValue(content, 'installdir');
    const sizeOnDisk = parseInt(this.extractValue(content, 'SizeOnDisk') || '0', 10);
    const lastPlayedUnix = parseInt(this.extractValue(content, 'LastPlayed') || '0', 10);
    const lastOwner = this.extractValue(content, 'LastOwner');

    if (!appid || !name || !installdir) return null;
    if (this.ignoredAppIds.has(appid)) return null;

    // NOTE: libraryfolders.vdf is only rewritten by Steam lazily (often on exit), so a game that was
    // just installed has an appmanifest but is not yet listed there. Do NOT use that list to reject
    // games; the appmanifest plus an existing install directory (checked below) is authoritative.

    // Ignore dedicated servers / background tools
    const lowerName = name.toLowerCase();
    if (lowerName.includes('dedicated server') || lowerName.includes('server tool')) {
      return null;
    }

    // Resolve install directory: <library>/steamapps/common/<installdir>
    const installPath = path.join(libraryPath, 'steamapps', 'common', installdir);
    if (!fs.existsSync(installPath)) {
      return null; // Installation directory missing or game was uninstalled
    }

    // Identify primary executable
    const executablePath = this.findPrimaryExecutable(installPath, installdir);

    // Official Steam Artwork Resolution (with local cache / Akamai hash support)
    const artwork = this.resolveSteamArtwork(appid);

    const playStats = this.playtimeMap.get(appid);
    const totalPlayTime = playStats ? playStats.playtimeSeconds : 0;

    const drive = installPath.slice(0, 2).toUpperCase();

    const cachedMeta = this.metadataService.getCached(appid);

    return {
      name,
      launcher: 'STEAM',
      launcherAppId: appid,
      executablePath: executablePath || undefined,
      installPath,
      confidence: 100, // Official Steam manifest
      coverImage: artwork.coverImage,
      backgroundImage: artwork.backgroundImage,
      iconPath: artwork.iconPath,
      installedSize: sizeOnDisk,
      drive,
      totalPlayTime,
      lastPlayedAt: undefined, // Only tracked when played through GameHub
      description: cachedMeta?.description || `Official Steam installation for ${name} (App ID: ${appid}).`,
      developer: cachedMeta?.developer,
      publisher: cachedMeta?.publisher,
      genre: cachedMeta?.genre,
      releaseDate: cachedMeta?.releaseDate,
      metadata: {
        lastPlayedUnix,
        lastOwner: lastOwner || undefined,
        manifestPath,
        playtimeSeconds: totalPlayTime,
      },
    };
  }

  /**
   * Extracts a string value by key from Valve ACF format
   */
  private extractValue(content: string, key: string): string | null {
    const regex = new RegExp(`"${key}"\\s+"([^"]+)"`, 'i');
    const match = content.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Searches for the primary executable within the game installation folder
   */
  private findPrimaryExecutable(installPath: string, folderName: string): string | null {
    try {
      const isBlacklisted = (name: string): boolean => {
        const lower = name.toLowerCase();
        return (
          lower.startsWith('unins') ||
          lower.startsWith('setup') ||
          lower.startsWith('install') ||
          lower.startsWith('cleanup') ||
          lower.startsWith('touchup') ||
          lower.startsWith('crash') ||
          lower.startsWith('dxsetup') ||
          lower.startsWith('vcredist') ||
          lower.startsWith('unitycrash') ||
          lower.includes('redist') ||
          lower.includes('activation') ||
          lower.includes('reporter') ||
          lower.includes('injector') ||
          lower.includes('overlay') ||
          lower.includes('trial') ||
          lower.includes('server')
        );
      };

      const cleanTarget = folderName.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Helper to scan directory up to maxDepth
      const findExes = (dir: string, depth: number, maxDepth: number): string[] => {
        if (depth > maxDepth) return [];
        const results: string[] = [];
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const lowerDir = entry.name.toLowerCase();
              if (
                !lowerDir.startsWith('.') &&
                !lowerDir.startsWith('__') &&
                lowerDir !== 'crashreporter' &&
                lowerDir !== 'redist'
              ) {
                results.push(...findExes(path.join(dir, entry.name), depth + 1, maxDepth));
              }
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.exe')) {
              if (!isBlacklisted(entry.name)) {
                results.push(path.join(dir, entry.name));
              }
            }
          }
        } catch {}
        return results;
      };

      // Search up to 3 levels deep
      const allExes = findExes(installPath, 0, 3);
      if (allExes.length === 0) return null;

      // Score candidates
      let bestExe: string | null = null;
      let highestScore = -1;

      for (const exe of allExes) {
        let score = 10;
        const exeBaseName = path.basename(exe, '.exe');
        const cleanBase = exeBaseName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const relPath = path.relative(installPath, exe).toLowerCase();

        // Exact match with folder name
        if (cleanBase === cleanTarget) {
          score += 80;
        } else if (cleanTarget.includes(cleanBase) && cleanBase.length >= 4) {
          score += 50;
        } else if (cleanBase.includes(cleanTarget) && cleanTarget.length >= 4) {
          score += 50;
        }

        // Unreal/Engine standard binary paths prefered for real binaries
        if (relPath.includes('binaries\\win64') || relPath.includes('bin\\x64')) {
          score += 30;
        }

        // Penalize wrappers/prelaunchers if real executable exists
        if (cleanBase.includes('prelauncher')) {
          score -= 40;
        } else if (cleanBase.includes('launcher')) {
          score -= 10;
        }

        // Favor root executables slightly if not a launcher
        if (!relPath.includes(path.sep)) {
          score += 5;
        }

        if (score > highestScore) {
          highestScore = score;
          bestExe = exe;
        }
      }

      return bestExe || allExes[0];
    } catch {
      return null;
    }
  }

  /**
   * Resolves official Steam cover and background artwork.
   * Checks the local Steam client's librarycache first to extract modern Akamai asset hashes,
   * falling back to the Cloudflare CDN.
   */
  private resolveSteamArtwork(appid: string): { coverImage: string; backgroundImage?: string; iconPath?: string } {
    if (this.primarySteamPath) {
      const cacheDir = path.join(this.primarySteamPath, 'appcache', 'librarycache', appid);
      if (fs.existsSync(cacheDir)) {
        try {
          const subdirs = fs.readdirSync(cacheDir, { withFileTypes: true });
          let capsuleHash: string | null = null;
          let heroHash: string | null = null;
          let coverFileName = 'library_600x900.jpg';

          for (const entry of subdirs) {
            if (entry.isDirectory()) {
              const subDirPath = path.join(cacheDir, entry.name);
              const files = fs.readdirSync(subDirPath);
              if (files.includes('library_600x900.jpg')) {
                capsuleHash = entry.name;
                coverFileName = 'library_600x900.jpg';
              } else if (files.includes('library_capsule.jpg') && !capsuleHash) {
                capsuleHash = entry.name;
                coverFileName = 'library_capsule.jpg';
              }
              if (files.includes('library_hero.jpg')) {
                heroHash = entry.name;
              }
            }
          }

          if (capsuleHash) {
            return {
              coverImage: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/${capsuleHash}/${coverFileName}`,
              backgroundImage: heroHash
                ? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/${heroHash}/library_hero.jpg`
                : undefined,
              iconPath: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
            };
          }
        } catch (err: any) {
          console.warn(`[SteamDetector] Failed reading local artwork cache for ${appid}:`, err.message);
        }
      }
    }

    // Default standard Steam Cloudflare CDN URLs
    return {
      coverImage: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`,
      backgroundImage: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_hero.jpg`,
      iconPath: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
    };
  }

  /**
   * Scans Steam user data directories to extract playtimes and last played timestamps
   * from localconfig.vdf files.
   */
  private loadSteamPlaytimes(): void {
    if (!this.primarySteamPath) return;
    const userdataDir = path.join(this.primarySteamPath, 'userdata');
    if (!fs.existsSync(userdataDir)) return;

    try {
      const accounts = fs.readdirSync(userdataDir, { withFileTypes: true });
      for (const acc of accounts) {
        if (!acc.isDirectory()) continue;
        const configFile = path.join(userdataDir, acc.name, 'config', 'localconfig.vdf');
        if (!fs.existsSync(configFile)) continue;

        try {
          const content = fs.readFileSync(configFile, 'utf-8');
          // Match app blocks: "<appid>" { ... "Playtime" "..." }
          const appBlockRegex = /"(\d{3,10})"\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
          let match: RegExpExecArray | null;

          while ((match = appBlockRegex.exec(content)) !== null) {
            const appid = match[1];
            const blockContent = match[2];

            const ptMatch = blockContent.match(/"Playtime"\s*"(\d+)"/i);
            const lpMatch = blockContent.match(/"LastPlayed"\s*"(\d+)"/i);

            const minutes = ptMatch ? parseInt(ptMatch[1], 10) : 0;
            const lastPlayed = lpMatch ? parseInt(lpMatch[1], 10) : 0;

            if (minutes > 0 || lastPlayed > 0) {
              const existing = this.playtimeMap.get(appid);
              const totalSec = minutes * 60;
              const lastPlayedIso =
                lastPlayed > 0 ? new Date(lastPlayed * 1000).toISOString() : undefined;

              if (!existing || existing.playtimeSeconds < totalSec) {
                this.playtimeMap.set(appid, {
                  playtimeSeconds: totalSec,
                  lastPlayedAt: lastPlayedIso || existing?.lastPlayedAt,
                });
              }
            }
          }
        } catch (err: any) {
          console.warn(`[SteamDetector] Could not parse "${configFile}":`, err.message);
        }
      }
      console.log(`[SteamDetector] Loaded playtimes for ${this.playtimeMap.size} games from Steam userdata.`);
    } catch (err: any) {
      console.warn('[SteamDetector] Failed loading Steam userdata:', err.message);
    }
  }
}

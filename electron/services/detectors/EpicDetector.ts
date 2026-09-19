import fs from 'fs';
import path from 'path';
import { GameCandidate, GameDetector } from '../scanner/types';
import { DriveService } from '../DriveService';

interface EpicManifestItem {
  FormatVersion?: number;
  DisplayName?: string;
  AppName?: string;
  CatalogItemId?: string;
  CatalogNamespace?: string;
  InstallLocation?: string;
  LaunchExecutable?: string;
  LaunchCommand?: string;
  InstallSize?: number;
  MainGameAppName?: string;
  bIsIncompleteInstall?: boolean;
  bIsApplication?: boolean;
  AppCategories?: string[];
  AppVersionString?: string;
}

interface CatCacheItem {
  id?: string;
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
  customAttributes?: Record<string, { type: string; value: string }>;
}

export class EpicDetector implements GameDetector {
  public readonly name = 'Epic Games Detector';

  private catCacheMap = new Map<string, CatCacheItem>();
  private catCacheLoaded = false;
  private lastPlayedMap = new Map<string, string>();
  private lastPlayedLoaded = false;

  constructor(private driveService?: DriveService) {}

  public async canRun(): Promise<boolean> {
    return process.platform === 'win32';
  }

  public async detect(
    locations: string[],
    onProgress?: (info: { currentPath?: string; message: string }) => void,
    isCancelled?: () => boolean
  ): Promise<GameCandidate[]> {
    const candidates: GameCandidate[] = [];
    const seenAppNames = new Set<string>();
    const seenInstallPaths = new Set<string>();

    onProgress?.({ message: 'Searching for Epic Games Launcher installation manifests...' });

    // Step 1: Load local catalog cache (catcache.bin) for high-res cover art and descriptions
    this.loadCatalogCache();

    // Step 1b: Load last played timestamps from Epic configuration
    this.loadLastPlayedTimestamps();

    // Step 2: Locate all manifest directories
    const manifestDirs = this.getManifestDirectories();
    console.log(`[EpicDetector] Found ${manifestDirs.length} Epic manifest directory path(s):`, manifestDirs);

    for (const dir of manifestDirs) {
      if (isCancelled?.()) {
        console.log('[EpicDetector] Detection cancelled by user request.');
        break;
      }

      if (!fs.existsSync(dir)) continue;

      let fileNames: string[];
      try {
        fileNames = fs.readdirSync(dir);
      } catch (err: any) {
        console.warn(`[EpicDetector] Could not read directory "${dir}":`, err.message);
        continue;
      }

      const itemFiles = fileNames.filter((f) => f.endsWith('.item'));

      for (const itemFile of itemFiles) {
        if (isCancelled?.()) break;

        const fullPath = path.join(dir, itemFile);
        try {
          const candidate = this.parseManifestFile(fullPath);
          if (
            candidate &&
            !seenAppNames.has(candidate.launcherAppId!) &&
            !seenInstallPaths.has(candidate.installPath.toLowerCase())
          ) {
            seenAppNames.add(candidate.launcherAppId!);
            seenInstallPaths.add(candidate.installPath.toLowerCase());
            candidates.push(candidate);

            onProgress?.({
              currentPath: candidate.installPath,
              message: `Discovered Epic game: ${candidate.name}`,
            });
          }
        } catch (err: any) {
          console.warn(`[EpicDetector] Error parsing manifest "${itemFile}":`, err.message);
        }
      }
    }

    // Step 3: Check configured drives for .egstore manifest folders (for games moved or installed across drives)
    if (!isCancelled?.()) {
      const driveCandidates = await this.scanDrivesForEgStore(locations, seenAppNames, seenInstallPaths, onProgress, isCancelled);
      candidates.push(...driveCandidates);
    }

    console.log(`[EpicDetector] Total Epic Games detected: ${candidates.length}`);
    return candidates;
  }

  /**
   * Identifies candidate manifest directories on Windows
   */
  private getManifestDirectories(): string[] {
    const dirs: string[] = [];

    // 1. ProgramData primary location
    const programData = process.env.ProgramData || 'C:\\ProgramData';
    dirs.push(path.join(programData, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests'));

    // 2. LocalAppData fallback location
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      dirs.push(path.join(localAppData, 'EpicGamesLauncher', 'Saved', 'Data', 'Manifests'));
    }

    return dirs.filter((d) => fs.existsSync(d));
  }

  /**
   * Parses an individual Epic .item manifest file
   */
  private parseManifestFile(manifestPath: string): GameCandidate | null {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const item: EpicManifestItem = JSON.parse(raw);

    // Filter out invalid items
    if (!item.DisplayName || !item.InstallLocation) {
      return null;
    }

    // Filter out incomplete installations
    if (item.bIsIncompleteInstall === true) {
      return null;
    }

    // Filter out DLCs / Addons (they reference a different MainGameAppName)
    if (item.MainGameAppName && item.MainGameAppName.trim() !== '' && item.MainGameAppName !== item.AppName) {
      return null;
    }

    // Filter out non-games (e.g. engines, Unreal Engine tools, plugins)
    if (item.AppCategories && Array.isArray(item.AppCategories)) {
      const isGameOrApp = item.AppCategories.some(
        (c) => c.toLowerCase() === 'games' || c.toLowerCase() === 'applications'
      );
      if (!isGameOrApp && item.AppCategories.length > 0) {
        return null;
      }
    }

    const normInstallPath = path.resolve(item.InstallLocation);
    if (!fs.existsSync(normInstallPath)) {
      console.warn(`[EpicDetector] Installation path does not exist: "${normInstallPath}" for ${item.DisplayName}`);
      return null;
    }

    // Determine executable path
    let executablePath: string | undefined;
    if (item.LaunchExecutable) {
      const candidateExe = path.resolve(normInstallPath, item.LaunchExecutable);
      if (fs.existsSync(candidateExe)) {
        executablePath = candidateExe;
      }
    }

    // If launch executable is missing, search root of install directory for likely .exe
    if (!executablePath) {
      try {
        const files = fs.readdirSync(normInstallPath);
        const exe = files.find((f) => f.toLowerCase().endsWith('.exe') && !f.toLowerCase().includes('crash') && !f.toLowerCase().includes('unity'));
        if (exe) {
          executablePath = path.join(normInstallPath, exe);
        }
      } catch {
        // Ignore read errors
      }
    }

    const drive = normInstallPath.slice(0, 2).toUpperCase();

    // Look up rich metadata and high-res cover art from cached catalog
    const meta = this.findMetadataInCatCache(item.AppName, item.CatalogItemId, item.DisplayName);

    return {
      name: item.DisplayName.trim(),
      launcher: 'EPIC',
      launcherAppId: item.AppName || item.CatalogItemId,
      executablePath,
      installPath: normInstallPath,
      confidence: 100,
      coverImage: meta?.coverImage,
      backgroundImage: meta?.backgroundImage,
      description: meta?.description,
      developer: meta?.developer,
      genre: meta?.genre || 'Game',
      installedSize: item.InstallSize && item.InstallSize > 0 ? item.InstallSize : undefined,
      drive: drive.endsWith(':') ? drive : `${drive}:`,
      lastPlayedAt: undefined, // Only tracked when launched through GameHub
      metadata: {
        catalogItemId: item.CatalogItemId,
        catalogNamespace: item.CatalogNamespace,
        appVersionString: item.AppVersionString,
      },
    };
  }

  /**
   * Scans drive roots for standard game folders containing .egstore manifests
   */
  private async scanDrivesForEgStore(
    locations: string[],
    seenAppNames: Set<string>,
    seenInstallPaths: Set<string>,
    onProgress?: (info: { currentPath?: string; message: string }) => void,
    isCancelled?: () => boolean
  ): Promise<GameCandidate[]> {
    const candidates: GameCandidate[] = [];

    // Collect drive letters
    const drivesToScan = new Set<string>();
    for (const loc of locations) {
      const match = loc.match(/^([A-Za-z]:)/);
      if (match) {
        drivesToScan.add(match[1].toUpperCase());
      }
    }

    const commonParentDirs = ['Games', 'Epic Games', 'Program Files\\Epic Games'];

    for (const drive of drivesToScan) {
      if (isCancelled?.()) break;

      for (const parent of commonParentDirs) {
        const fullParent = path.join(`${drive}\\`, parent);
        if (!fs.existsSync(fullParent)) continue;

        let gameFolders: string[] = [];
        try {
          gameFolders = fs.readdirSync(fullParent);
        } catch {
          continue;
        }

        for (const gf of gameFolders) {
          if (isCancelled?.()) break;

          const gameDir = path.join(fullParent, gf);
          if (seenInstallPaths.has(gameDir.toLowerCase())) continue;

          const egstoreDir = path.join(gameDir, '.egstore');
          if (!fs.existsSync(egstoreDir)) continue;

          // Look for .mancpn or .manifest files
          try {
            const egFiles = fs.readdirSync(egstoreDir);
            const manifestFile = egFiles.find((f) => f.endsWith('.manifest') || f.endsWith('.mancpn'));
            if (!manifestFile) continue;

            const manifestId = manifestFile.split('.')[0];
            // Check if this manifest ID matches an already seen app
            if (seenAppNames.has(manifestId)) continue;

            // Look for executable in game dir
            const exes = fs.readdirSync(gameDir).filter((f) => f.toLowerCase().endsWith('.exe'));
            const mainExe = exes.find((e) => !e.toLowerCase().includes('crash') && !e.toLowerCase().includes('unity')) || exes[0];

            if (mainExe) {
              const meta = this.findMetadataInCatCache(undefined, undefined, gf);
              const candidate: GameCandidate = {
                name: meta?.title || gf,
                launcher: 'EPIC',
                launcherAppId: manifestId,
                executablePath: path.join(gameDir, mainExe),
                installPath: gameDir,
                confidence: 95,
                coverImage: meta?.coverImage,
                backgroundImage: meta?.backgroundImage,
                description: meta?.description,
                developer: meta?.developer,
                genre: meta?.genre || 'Game',
                drive,
              };

              seenAppNames.add(manifestId);
              candidates.push(candidate);
              onProgress?.({
                currentPath: gameDir,
                message: `Discovered Epic game from drive ${drive}: ${candidate.name}`,
              });
            }
          } catch {
            // Ignore individual folder read errors
          }
        }
      }
    }

    return candidates;
  }

  /**
   * Loads and decodes Epic's local Base64 catcache.bin
   */
  private loadCatalogCache(): void {
    if (this.catCacheLoaded) return;
    this.catCacheLoaded = true;

    const programData = process.env.ProgramData || 'C:\\ProgramData';
    const catcachePath = path.join(programData, 'Epic', 'EpicGamesLauncher', 'Data', 'Catalog', 'catcache.bin');

    if (!fs.existsSync(catcachePath)) {
      console.log('[EpicDetector] catcache.bin not found at:', catcachePath);
      return;
    }

    try {
      const raw = fs.readFileSync(catcachePath, 'utf8');
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      const items: CatCacheItem[] = JSON.parse(decoded);

      for (const item of items) {
        if (item.id) {
          this.catCacheMap.set(item.id.toLowerCase(), item);
        }
        if (item.title) {
          this.catCacheMap.set(this.normalizeTitle(item.title), item);
        }
        if (item.releaseInfo && Array.isArray(item.releaseInfo)) {
          for (const rel of item.releaseInfo) {
            if (rel.appId) {
              this.catCacheMap.set(rel.appId.toLowerCase(), item);
            }
          }
        }
      }

      console.log(`[EpicDetector] Successfully loaded ${items.length} items from Epic catalog cache.`);
    } catch (err: any) {
      console.warn('[EpicDetector] Failed to parse catcache.bin:', err.message);
    }
  }

  /**
   * Matches metadata and artwork from catcache
   */
  private findMetadataInCatCache(
    appName?: string,
    catalogItemId?: string,
    displayName?: string
  ): {
    title?: string;
    coverImage?: string;
    backgroundImage?: string;
    developer?: string;
    description?: string;
    genre?: string;
  } | null {
    let item: CatCacheItem | undefined;

    if (catalogItemId) {
      item = this.catCacheMap.get(catalogItemId.toLowerCase());
    }
    if (!item && appName) {
      item = this.catCacheMap.get(appName.toLowerCase());
    }
    if (!item && displayName) {
      item = this.catCacheMap.get(this.normalizeTitle(displayName));
    }

    if (!item) return null;

    // Pick portrait cover image
    let coverImage: string | undefined;
    let backgroundImage: string | undefined;

    if (item.keyImages && Array.isArray(item.keyImages)) {
      const tallImg = item.keyImages.find(
        (img) => img.type === 'DieselGameBoxTall' || img.type === 'OfferImageTall' || img.type === 'Thumbnail'
      );
      if (tallImg) coverImage = tallImg.url;

      const wideImg = item.keyImages.find(
        (img) => img.type === 'DieselGameBox' || img.type === 'OfferImageWide'
      );
      if (wideImg) backgroundImage = wideImg.url;
    }

    // Genre extraction
    let genre: string | undefined;
    if (item.categories && Array.isArray(item.categories)) {
      const genreCat = item.categories.find((c) => c.path && c.path !== 'games' && c.path !== 'applications');
      if (genreCat) {
        genre = genreCat.path.charAt(0).toUpperCase() + genreCat.path.slice(1);
      }
    }

    return {
      title: item.title,
      coverImage,
      backgroundImage,
      developer: item.developer,
      description: item.description,
      genre,
    };
  }

  /**
   * Reads GameUserSettings.ini from Epic config to extract real lastPlayed timestamps
   */
  private loadLastPlayedTimestamps(): void {
    if (this.lastPlayedLoaded) return;
    this.lastPlayedLoaded = true;

    const localAppData = process.env.LOCALAPPDATA;
    if (!localAppData) return;

    const candidateIniPaths = [
      path.join(localAppData, 'EpicGamesLauncher', 'Saved', 'Config', 'WindowsEditor', 'GameUserSettings.ini'),
      path.join(localAppData, 'EpicGamesLauncher', 'Saved', 'Config', 'Windows', 'GameUserSettings.ini'),
    ];

    for (const iniPath of candidateIniPaths) {
      if (!fs.existsSync(iniPath)) continue;

      try {
        const content = fs.readFileSync(iniPath, 'utf8');
        const lines = content.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          // Example: LastPlayedGame=namespace:catalogItemId:appName,2025-12-30T19:56:08.095Z
          if (trimmed.startsWith('LastPlayedGame=')) {
            const rawVal = trimmed.slice('LastPlayedGame='.length).trim();
            const commaIdx = rawVal.lastIndexOf(',');
            if (commaIdx > 0) {
              const idsPart = rawVal.slice(0, commaIdx);
              const datePart = rawVal.slice(commaIdx + 1).trim();

              const parts = idsPart.split(':');
              for (const part of parts) {
                const cleaned = part.trim().toLowerCase();
                if (cleaned && !this.lastPlayedMap.has(cleaned)) {
                  this.lastPlayedMap.set(cleaned, datePart);
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.warn(`[EpicDetector] Failed to parse ${iniPath}:`, err.message);
      }
    }

    console.log(`[EpicDetector] Loaded ${this.lastPlayedMap.size} last-played timestamp records from Epic config.`);
  }

  private normalizeTitle(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
}

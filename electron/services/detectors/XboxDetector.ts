import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { GameCandidate, GameDetector } from '../scanner/types';
import { DriveService } from '../DriveService';

const execAsync = util.promisify(exec);

// Known non-game Xbox/Microsoft components to filter out
const SYSTEM_PACKAGE_NAMES = new Set([
  'microsoft.gamingapp',
  'microsoft.gamingservices',
  'microsoft.xboxidentityprovider',
  'microsoft.xboxgamingoverlay',
  'microsoft.xboxspeechtotextoverlay',
  'microsoft.xboxgamecallableui',
  'microsoft.windowsstore',
  'microsoft.storepurchaseapp',
  'microsoft.desktopappinstaller',
  'microsoft.edge.gameassist',
]);

// Known Microsoft Store Product / Catalog IDs for popular games
const KNOWN_STORE_IDS: Record<string, string> = {
  'microsoft.microsoftsolitairecollection': '9WZDNCRFHWD2',
  'microsoftsolitairecollection': '9WZDNCRFHWD2',
  'solitairecasualgames': '9WZDNCRFHWD2',
  'a278ab0d.asphalt9': '9NZQPT0MWTD0',
  'asphalt9': '9NZQPT0MWTD0',
  'asphaltlegends': '9NZQPT0MWTD0',
  'microsoft.minecraftuwp': '9NBLGGH2JHXJ',
  'minecraft': '9NBLGGH2JHXJ',
  'microsoft.seaoftheives': '9P2N57MC619K',
  'microsoft.forzahorizon5': '9NKX70BBC2TN',
  'microsoft.haloinfinite': '9PP5G1F0C2B6',
  'microsoft.flightsimulator': '9NRBDJX8751M',
  'microsoft.ageofempiresiv': '9PHLD808P40C',
  'microsoft.stateofdecay2': '9NT4X7P8BPD3',
  'microsoft.psychonauts2': '9N86N4P27101',
  'microsoft.hellblade2': '9P8H39K3Z7G7',
};

export class XboxDetector implements GameDetector {
  public readonly name = 'Xbox Detector';

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
    const seenAppIds = new Set<string>();
    const seenInstallPaths = new Set<string>();

    onProgress?.({ message: 'Searching for Xbox and Windows Store installations...' });

    // Step 1: Scan XboxGames directories across active drives and custom locations
    try {
      const xboxGamesCandidates = await this.detectFromXboxGamesFolders(locations, seenAppIds, seenInstallPaths, onProgress, isCancelled);
      candidates.push(...xboxGamesCandidates);
    } catch (err: any) {
      console.warn('[XboxDetector] XboxGames folder scan encountered error:', err.message);
    }

    if (isCancelled?.()) return candidates;

    // Step 2: Scan Windows GamingServices and Store AppX packages
    try {
      const storeCandidates = await this.detectFromGamingServices(seenAppIds, seenInstallPaths, onProgress);
      candidates.push(...storeCandidates);
    } catch (err: any) {
      console.warn('[XboxDetector] GamingServices package scan encountered error:', err.message);
    }

    console.log(`[XboxDetector] Total Xbox / Microsoft Store games detected: ${candidates.length}`);
    return candidates;
  }

  /**
   * Scans <Drive>:\XboxGames and user custom locations for MicrosoftGame.config manifests
   */
  private async detectFromXboxGamesFolders(
    locations: string[],
    seenAppIds: Set<string>,
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

    // Build list of target root folders to inspect
    const rootFolders = new Set<string>();
    for (const drive of drivesToScan) {
      rootFolders.add(path.join(`${drive}\\`, 'XboxGames'));
    }

    for (const loc of locations) {
      if (fs.existsSync(loc)) {
        rootFolders.add(path.resolve(loc));
        const subXbox = path.join(loc, 'XboxGames');
        if (fs.existsSync(subXbox)) {
          rootFolders.add(path.resolve(subXbox));
        }
        // Check if loc itself is an individual game directory
        const selfCandidate = await this.parseXboxGameDir(loc, seenAppIds, seenInstallPaths);
        if (selfCandidate) {
          seenAppIds.add(selfCandidate.launcherAppId!);
          seenInstallPaths.add(selfCandidate.installPath.toLowerCase());
          candidates.push(selfCandidate);
          onProgress?.({
            currentPath: selfCandidate.installPath,
            message: `Discovered Xbox game: ${selfCandidate.name}`,
          });
        }
      }
    }

    for (const root of rootFolders) {
      if (isCancelled?.()) break;
      if (!fs.existsSync(root)) continue;

      let subdirs: string[] = [];
      try {
        subdirs = fs.readdirSync(root);
      } catch {
        continue;
      }

      for (const sub of subdirs) {
        if (isCancelled?.()) break;

        const gameDir = path.join(root, sub);
        if (seenInstallPaths.has(gameDir.toLowerCase())) continue;

        try {
          const stat = fs.statSync(gameDir);
          if (!stat.isDirectory()) continue;
        } catch {
          continue;
        }

        const candidate = await this.parseXboxGameDir(gameDir, seenAppIds, seenInstallPaths);
        if (candidate) {
          seenAppIds.add(candidate.launcherAppId!);
          seenInstallPaths.add(candidate.installPath.toLowerCase());
          candidates.push(candidate);

          onProgress?.({
            currentPath: candidate.installPath,
            message: `Discovered Xbox game: ${candidate.name}`,
          });
        }
      }
    }

    return candidates;
  }

  /**
   * Parses an individual game directory containing MicrosoftGame.config or appxmanifest
   */
  private async parseXboxGameDir(
    gameDir: string,
    seenAppIds: Set<string>,
    seenInstallPaths: Set<string>
  ): Promise<GameCandidate | null> {
    if (seenInstallPaths.has(gameDir.toLowerCase())) return null;

    // Check for MicrosoftGame.config in root or Content/
    const configPath = fs.existsSync(path.join(gameDir, 'MicrosoftGame.config'))
      ? path.join(gameDir, 'MicrosoftGame.config')
      : fs.existsSync(path.join(gameDir, 'Content', 'MicrosoftGame.config'))
      ? path.join(gameDir, 'Content', 'MicrosoftGame.config')
      : null;

    if (!configPath) return null;

    try {
      const xml = fs.readFileSync(configPath, 'utf8');

      // Extract DisplayName (prioritize DefaultDisplayName and DisplayName over PublisherDisplayName)
      const displayNameMatch =
        xml.match(/<ShellVisuals[^>]*(?:DefaultDisplayName|DisplayName)="([^"]+)"/i) ||
        xml.match(/<Executable[^>]*DisplayName="([^"]+)"/i) ||
        xml.match(/<ShellVisuals[^>]*PublisherDisplayName="([^"]+)"/i);
      const name = displayNameMatch ? displayNameMatch[1].trim() : path.basename(gameDir);

      // Extract Identity Name
      const identityMatch = xml.match(/<Identity[^>]*Name="([^"]+)"/i);
      const appId = identityMatch ? identityMatch[1].trim() : path.basename(gameDir);

      if (seenAppIds.has(appId)) return null;

      // Extract StoreId if present
      const storeIdMatch = xml.match(/<StoreId>(9[A-Z0-9]{11})<\/StoreId>/i);
      const storeId = storeIdMatch ? storeIdMatch[1] : undefined;

      // Extract Executable Name
      const exeMatch = xml.match(/<Executable[^>]*Name="([^"]+)"/i);
      let executablePath: string | undefined;

      const baseDir = path.dirname(configPath);
      if (exeMatch) {
        const candidateExe = path.join(baseDir, exeMatch[1]);
        if (fs.existsSync(candidateExe)) {
          executablePath = candidateExe;
        }
      }

      if (!executablePath) {
        try {
          const files = fs.readdirSync(baseDir);
          const exes = files.filter(
            (f) =>
              f.toLowerCase().endsWith('.exe') &&
              !f.toLowerCase().includes('unins') &&
              !f.toLowerCase().includes('crash')
          );
          if (exes.length > 0) {
            executablePath = path.join(baseDir, exes[0]);
          }
        } catch {}
      }

      // Extract Local Visuals from ShellVisuals
      let iconPath: string | undefined;
      let coverImage: string | undefined;
      let backgroundImage: string | undefined;

      const square480Match = xml.match(/Square480x480Logo="([^"]+)"/i);
      const storeLogoMatch = xml.match(/StoreLogo="([^"]+)"/i);
      const splashMatch = xml.match(/SplashScreenImage="([^"]+)"/i);
      const square150Match = xml.match(/Square150x150Logo="([^"]+)"/i);
      const square44Match = xml.match(/Square44x44Logo="([^"]+)"/i);

      if (square480Match) {
        coverImage = this.resolveAssetFile(baseDir, square480Match[1]);
      }
      if (!coverImage && storeLogoMatch) {
        coverImage = this.resolveAssetFile(baseDir, storeLogoMatch[1]);
      }
      if (splashMatch) {
        backgroundImage = this.resolveAssetFile(baseDir, splashMatch[1]);
      }
      if (square150Match) {
        iconPath = this.resolveAssetFile(baseDir, square150Match[1]);
      } else if (square44Match) {
        iconPath = this.resolveAssetFile(baseDir, square44Match[1]);
      }

      // Query Microsoft Store Catalog API for official high-resolution CDN artwork & metadata
      const storeMeta = await this.fetchStoreMetadata(name, storeId || appId);
      if (storeMeta) {
        if (storeMeta.coverImage) coverImage = storeMeta.coverImage;
        if (storeMeta.backgroundImage) backgroundImage = storeMeta.backgroundImage;
      }

      const driveMatch = gameDir.match(/^([A-Za-z]:)/);
      const drive = driveMatch ? driveMatch[1].toUpperCase() : 'C:';
      
      const isWindowsApps = gameDir.toLowerCase().includes('windowsapps');
      let installedSize: number | undefined;
      let installSizeStatus: 'KNOWN' | 'CALCULATING' | 'UNKNOWN' | 'ACCESS_DENIED' = 'UNKNOWN';
      let installSizeSource: 'metadata' | 'filesystem' | 'package' | 'unknown' = isWindowsApps ? 'package' : 'filesystem';

      if (!isWindowsApps && fs.existsSync(gameDir)) {
        installedSize = this.calculateFolderSize(gameDir);
        if (installedSize && installedSize > 0) {
          installSizeStatus = 'KNOWN';
        }
      } else if (isWindowsApps) {
        try {
          fs.readdirSync(gameDir);
          installedSize = this.calculateFolderSize(gameDir);
          if (installedSize && installedSize > 0) {
            installSizeStatus = 'KNOWN';
          }
        } catch {
          installSizeStatus = 'ACCESS_DENIED';
        }
      }

      return {
        name: storeMeta?.title || name,
        launcher: 'XBOX',
        launcherAppId: appId,
        executablePath,
        installPath: gameDir,
        confidence: 100,
        drive,
        iconPath,
        coverImage,
        backgroundImage,
        installedSize,
        installSizeBytes: installedSize,
        installSizeStatus,
        installSizeSource,
        genre: 'Game',
        description: storeMeta?.description || `Xbox installation for ${name}.`,
        developer: storeMeta?.developer,
        publisher: storeMeta?.publisher,
      };
    } catch (err: any) {
      console.warn(`[XboxDetector] Failed parsing ${configPath}:`, err.message);
      return null;
    }
  }

  /**
   * Queries Windows GamingServices package repository and AppX store for registered games
   */
  private async detectFromGamingServices(
    seenAppIds: Set<string>,
    seenInstallPaths: Set<string>,
    onProgress?: (info: { currentPath?: string; message: string }) => void
  ): Promise<GameCandidate[]> {
    const candidates: GameCandidate[] = [];

    const psScript = `
      $ErrorActionPreference = 'SilentlyContinue'
      $results = @()
      
      $gsKey = 'HKLM:\\SOFTWARE\\Microsoft\\GamingServices\\PackageRepository\\Package'
      if (Test-Path $gsKey) {
        $item = Get-Item $gsKey
        foreach ($prop in $item.Property) {
          $baseName = $prop -replace '_.*$', ''
          if (-not $baseName) { continue }
          $pkg = Get-AppxPackage -Name $baseName
          if ($pkg -and -not $pkg.IsFramework) {
            $manifest = Get-AppxPackageManifest $pkg
            $app = $manifest.Package.Applications.Application
            $appId = if ($app.Id) { $app.Id } else { 'App' }
            
            $displayName = $manifest.Package.Properties.DisplayName
            if ($app.VisualElements.DisplayName -and -not $app.VisualElements.DisplayName.StartsWith('ms-resource:')) {
              $displayName = $app.VisualElements.DisplayName
            }
            
            $logo = $app.VisualElements.Square150x150Logo
            if (-not $logo) { $logo = $app.VisualElements.Logo }

            $results += [PSCustomObject]@{
              PackageName = $pkg.Name
              DisplayName = $displayName
              PackageFamilyName = $pkg.PackageFamilyName
              PackageFullName = $pkg.PackageFullName
              InstallLocation = $pkg.InstallLocation
              Aumid = ($pkg.PackageFamilyName + '!' + $appId)
              Logo = $logo
            }
          }
        }
      }
      
      $results | ConvertTo-Json -Compress
    `;

    try {
      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      const { stdout } = await execAsync(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
        { maxBuffer: 10 * 1024 * 1024 }
      );

      const trimmed = stdout.trim();
      if (!trimmed) return candidates;

      const raw = JSON.parse(trimmed);
      const items = Array.isArray(raw) ? raw : [raw];

      for (const item of items) {
        if (!item.PackageName || !item.Aumid) continue;

        const pkgLower = item.PackageName.toLowerCase();
        if (SYSTEM_PACKAGE_NAMES.has(pkgLower)) continue;

        const appId = item.Aumid;
        if (seenAppIds.has(appId)) continue;

        const installPath = item.InstallLocation || `C:\\Program Files\\WindowsApps\\${item.PackageFullName}`;
        if (seenInstallPaths.has(installPath.toLowerCase())) continue;

        let name = item.DisplayName || item.PackageName;
        // Clean up common system naming or ms-resource references
        if (name.startsWith('ms-resource:') || name.includes('__')) {
          name = this.formatPackageName(item.PackageName);
        }

        const driveMatch = installPath.match(/^([A-Za-z]:)/);
        const drive = driveMatch ? driveMatch[1].toUpperCase() : 'C:';

        // Check local assets in installPath
        let iconPath: string | undefined;
        let coverImage: string | undefined;
        let backgroundImage: string | undefined;

        if (fs.existsSync(installPath)) {
          const localArt = this.findBestLocalArtwork(installPath);
          if (localArt.cover) coverImage = localArt.cover;
          if (localArt.background) backgroundImage = localArt.background;
          if (localArt.icon) iconPath = localArt.icon;

          if (item.Logo && !iconPath) {
            iconPath = this.resolveAssetFile(installPath, item.Logo);
          }
        }

        // Query Microsoft Store Catalog API for official high-definition cover artwork
        const storeMeta = await this.fetchStoreMetadata(name, item.PackageName);
        if (storeMeta) {
          if (storeMeta.coverImage) coverImage = storeMeta.coverImage;
          if (storeMeta.backgroundImage) backgroundImage = storeMeta.backgroundImage;
        }

        const isWindowsApps = installPath.toLowerCase().includes('windowsapps');
        let installedSize: number | undefined;
        let installSizeStatus: 'KNOWN' | 'CALCULATING' | 'UNKNOWN' | 'ACCESS_DENIED' = 'UNKNOWN';
        let installSizeSource: 'metadata' | 'filesystem' | 'package' | 'unknown' = isWindowsApps ? 'package' : 'filesystem';

        if (!isWindowsApps && fs.existsSync(installPath)) {
          installedSize = this.calculateFolderSize(installPath);
          if (installedSize && installedSize > 0) {
            installSizeStatus = 'KNOWN';
          }
        } else if (isWindowsApps) {
          try {
            fs.readdirSync(installPath);
            installedSize = this.calculateFolderSize(installPath);
            if (installedSize && installedSize > 0) {
              installSizeStatus = 'KNOWN';
            }
          } catch {
            installSizeStatus = 'ACCESS_DENIED';
          }
        }

        const candidate: GameCandidate = {
          name: storeMeta?.title || name.trim(),
          launcher: 'XBOX',
          launcherAppId: appId,
          installPath,
          executablePath: undefined, // Managed by Windows Store/UWP; dispatched via AUMID
          confidence: 100,
          drive,
          iconPath,
          coverImage,
          backgroundImage,
          installedSize,
          installSizeBytes: installedSize,
          installSizeStatus,
          installSizeSource,
          genre: 'Game',
          description: storeMeta?.description || `Windows / Xbox Store game: ${name}.`,
          developer: storeMeta?.developer,
          publisher: storeMeta?.publisher,
        };

        seenAppIds.add(appId);
        seenInstallPaths.add(installPath.toLowerCase());
        candidates.push(candidate);

        onProgress?.({
          currentPath: installPath,
          message: `Discovered Windows / Xbox Store game: ${candidate.name}`,
        });
      }
    } catch (err: any) {
      console.warn('[XboxDetector] Failed querying GamingServices packages:', err.message);
    }

    return candidates;
  }

  /**
   * Fetches official cover and background artwork from the public Microsoft Store Catalog CDN
   */
  public async fetchStoreMetadata(
    name: string,
    rawIdOrPackage?: string
  ): Promise<{
    title?: string;
    coverImage?: string;
    backgroundImage?: string;
    description?: string;
    developer?: string;
    publisher?: string;
  } | null> {
    let storeId: string | undefined;

    // Check if raw ID is already a 12-char alphanumeric StoreId
    if (rawIdOrPackage && /^9[A-Z0-9]{11}$/i.test(rawIdOrPackage.trim())) {
      storeId = rawIdOrPackage.trim().toUpperCase();
    }

    // Check known store dictionary
    if (!storeId && rawIdOrPackage) {
      const lower = rawIdOrPackage.toLowerCase();
      for (const [key, id] of Object.entries(KNOWN_STORE_IDS)) {
        if (lower.includes(key)) {
          storeId = id;
          break;
        }
      }
    }

    if (!storeId) {
      const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [key, id] of Object.entries(KNOWN_STORE_IDS)) {
        if (cleanName.includes(key)) {
          storeId = id;
          break;
        }
      }
    }

    // If still no StoreId, perform a live catalog search by title
    if (!storeId) {
      try {
        const cleanTitle = name.replace(/[™®©]/g, '').trim();
        const searchUrl = `https://storeedgefd.dsx.mp.microsoft.com/v9.0/pages/searchResults?searchTerm=${encodeURIComponent(
          cleanTitle
        )}&market=US&locale=en-us&deviceFamily=windows.desktop`;

        const sRes = await fetch(searchUrl);
        if (sRes.ok) {
          const text = await sRes.text();
          const pids = [...new Set(text.match(/\b9[A-Z0-9]{11}\b/g) || [])];
          if (pids.length > 0) {
            const batchUrl = `https://displaycatalog.mp.microsoft.com/v7/products?bigIds=${pids
              .slice(0, 10)
              .join(',')}&market=US&languages=en-US`;
            const bRes = await fetch(batchUrl);
            if (bRes.ok) {
              const bData = (await bRes.json()) as any;
              const normTarget = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
              for (const p of bData.Products || []) {
                const pTitle = p.LocalizedProperties?.[0]?.ProductTitle || '';
                const normP = pTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (normP.includes(normTarget) || normTarget.includes(normP)) {
                  storeId = p.ProductId;
                  break;
                }
              }
            }
          }
        }
      } catch {}
    }

    if (storeId) {
      try {
        const url = `https://displaycatalog.mp.microsoft.com/v7/products/${storeId}?market=US&languages=en-US`;
        const res = await fetch(url);
        if (res.ok) {
          const data = (await res.json()) as any;
          const p = data.Product;
          const props = p?.LocalizedProperties?.[0];
          const images: Array<{ ImagePurpose: string; Uri: string }> = props?.Images || [];

          let coverImage = images.find((i) => i.ImagePurpose === 'Poster')?.Uri;
          if (!coverImage) coverImage = images.find((i) => i.ImagePurpose === 'BoxArt')?.Uri;
          if (!coverImage) coverImage = images.find((i) => i.ImagePurpose === 'BrandedKeyArt')?.Uri;
          if (!coverImage) coverImage = images.find((i) => i.ImagePurpose === 'FeaturePromotionalSquareArt')?.Uri;
          if (!coverImage) coverImage = images.find((i) => i.ImagePurpose === 'Logo')?.Uri;

          let backgroundImage = images.find((i) => i.ImagePurpose === 'SuperHeroArt')?.Uri;
          if (!backgroundImage) backgroundImage = images.find((i) => i.ImagePurpose === 'TitledHeroArt')?.Uri;

          return {
            title: props?.ProductTitle || name,
            coverImage: coverImage ? `https:${coverImage}` : undefined,
            backgroundImage: backgroundImage ? `https:${backgroundImage}` : undefined,
            description: props?.ProductDescription,
            developer: props?.DeveloperName,
            publisher: props?.PublisherName,
          };
        }
      } catch {}
    }

    return null;
  }

  /**
   * Resolves a local asset file, checking scale variants (.scale-400.png, .scale-200.png, etc.)
   */
  private resolveAssetFile(baseDir: string, relativePath: string): string | undefined {
    const directPath = path.join(baseDir, relativePath);
    if (fs.existsSync(directPath)) return directPath;

    const dir = path.dirname(directPath);
    if (!fs.existsSync(dir)) return undefined;

    const baseName = path.basename(relativePath, path.extname(relativePath));
    const ext = path.extname(relativePath);

    // Check standard Windows scale variants
    const scales = ['scale-400', 'scale-200', 'scale-150', 'scale-125', 'scale-100'];
    for (const scale of scales) {
      const candidate = path.join(dir, `${baseName}.${scale}${ext}`);
      if (fs.existsSync(candidate)) return candidate;
    }

    // Try finding any file starting with baseName
    try {
      const files = fs.readdirSync(dir);
      const match = files.find((f) => f.toLowerCase().startsWith(baseName.toLowerCase()) && f.endsWith(ext));
      if (match) return path.join(dir, match);
    } catch {}

    return undefined;
  }

  /**
   * Scans a package directory for high-resolution logo, tile, and splash assets
   */
  private findBestLocalArtwork(dir: string): { cover?: string; background?: string; icon?: string } {
    const result: { cover?: string; background?: string; icon?: string } = {};

    try {
      const collectFiles = (folder: string, depth = 0): string[] => {
        if (depth > 2) return [];
        const files: string[] = [];
        try {
          const entries = fs.readdirSync(folder, { withFileTypes: true });
          for (const entry of entries) {
            const full = path.join(folder, entry.name);
            if (entry.isFile() && (entry.name.endsWith('.png') || entry.name.endsWith('.jpg'))) {
              files.push(full);
            } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
              files.push(...collectFiles(full, depth + 1));
            }
          }
        } catch {}
        return files;
      };

      const allImgs = collectFiles(dir);

      // Best cover: 480x480 logo or LargeTile scale-400/200, or StoreLogo
      const coverCandidates = allImgs.filter(
        (f) =>
          (f.includes('480x480') || f.includes('LargeTile') || f.includes('StoreLogo')) &&
          !f.includes('contrast')
      );
      if (coverCandidates.length > 0) {
        // Pick largest scale if possible
        result.cover =
          coverCandidates.find((f) => f.includes('scale-400')) ||
          coverCandidates.find((f) => f.includes('scale-200')) ||
          coverCandidates[0];
      }

      // Best background: SplashScreen
      const splashCandidates = allImgs.filter((f) => f.includes('Splash') && !f.includes('contrast'));
      if (splashCandidates.length > 0) {
        result.background =
          splashCandidates.find((f) => f.includes('scale-400')) ||
          splashCandidates.find((f) => f.includes('scale-200')) ||
          splashCandidates[0];
      }

      // Best icon: Square150 or MedTile
      const iconCandidates = allImgs.filter((f) => (f.includes('150x150') || f.includes('MedTile')) && !f.includes('contrast'));
      if (iconCandidates.length > 0) {
        result.icon = iconCandidates[0];
      }
    } catch {}

    return result;
  }

  private formatPackageName(rawName: string): string {
    // E.g. "Microsoft.MicrosoftSolitaireCollection" -> "Microsoft Solitaire Collection"
    const stripped = rawName.replace(/^Microsoft\./i, '');
    return stripped.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  private calculateFolderSize(folderPath: string): number | undefined {
    try {
      let totalSize = 0;
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const stat = fs.statSync(path.join(folderPath, entry.name));
          totalSize += stat.size;
        }
      }
      return totalSize > 0 ? totalSize : undefined;
    } catch {
      return undefined;
    }
  }
}

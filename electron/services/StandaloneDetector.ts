import fs from 'fs';
import path from 'path';
import { GameCandidate, GameDetector } from './scanner/types';

export interface StandaloneCandidate extends GameCandidate {
  engine: 'Unity' | 'Unreal' | 'Godot' | 'Custom Engine' | 'Standard Executable';
  detectedAssets: string[];
}

export class StandaloneDetector implements GameDetector {
  public readonly name = 'Standalone Game Detector';

  public async canRun(): Promise<boolean> {
    return true;
  }

  /**
   * Implements GameDetector.detect
   */
  public async detect(
    locations: string[],
    onProgress?: (info: { currentPath?: string; message: string }) => void,
    isCancelled?: () => boolean
  ): Promise<GameCandidate[]> {
    return this.scanLocations(locations, onProgress, isCancelled);
  }

  // Ignored directory names (case-insensitive)
  private readonly ignoredDirNames = new Set([
    'windows',
    'system32',
    'syswow64',
    'winsxs',
    '$recycle.bin',
    'system volume information',
    'appdata',
    'local',
    'locallow',
    'roaming',
    'programdata',
    'node_modules',
    '.git',
    '.vscode',
    '.idea',
    'temp',
    'tmp',
    'driver',
    'drivers',
    'windowsdefender',
    'microsoft',
    'msi',
    'common files',
  ]);

  // Blacklisted executable names / prefixes (case-insensitive)
  private readonly ignoredExePatterns = [
    /^unins\w*\.exe$/i,
    /^uninstall\w*\.exe$/i,
    /^setup\w*\.exe$/i,
    /^install\w*\.exe$/i,
    /^update\w*\.exe$/i,
    /^patch\w*\.exe$/i,
    /^crash\w*\.exe$/i,
    /^unitycrashhandler\w*\.exe$/i,
    /^dxsetup\w*\.exe$/i,
    /^vcredist\w*\.exe$/i,
    /^dotnet\w*\.exe$/i,
    /^epicwebhelper\w*\.exe$/i,
    /^cef\w*\.exe$/i,
    /^easyanticheat\w*\.exe$/i,
    /^battleye\w*\.exe$/i,
    /^benchmark\w*\.exe$/i,
    /^editor\w*\.exe$/i,
    /^dedicated\w*\.exe$/i,
    /^server\w*\.exe$/i,
    /^config\w*\.exe$/i,
    /^launcher\w*\.exe$/i,
  ];

  // Common game asset directory names
  private readonly assetDirNames = new Set([
    'assets',
    'content',
    'data',
    'paks',
    'sound',
    'sounds',
    'music',
    'textures',
    'maps',
    'res',
    'media',
    'binaries',
    'plugins',
    'streamingassets',
    'cooked',
  ]);

  // Common game engine libraries
  private readonly engineLibraries = new Set([
    'unityplayer.dll',
    'unitycrashhandler64.exe',
    'unitycrashhandler32.exe',
    'mono-2.0-sgen.dll',
    'sdl2.dll',
    'sdl.dll',
    'd3d11.dll',
    'd3d12.dll',
    'openal32.dll',
    'fmod.dll',
    'fmodstudio.dll',
    'binkw64.dll',
    'binkw32.dll',
    'xaudio2_9.dll',
    'steam_api64.dll',
    'steam_api.dll',
  ]);

  /**
   * Scans a list of root folders for standalone game installations
   */
  public async scanLocations(
    locations: string[],
    onProgress?: (info: { currentPath?: string; message: string }) => void,
    isCancelled?: () => boolean
  ): Promise<StandaloneCandidate[]> {
    const candidates: StandaloneCandidate[] = [];
    const seenExecutables = new Set<string>();

    for (const loc of locations) {
      if (isCancelled?.()) {
        console.log('[StandaloneDetector] Scan cancelled by user request.');
        break;
      }

      if (!loc || !fs.existsSync(loc)) continue;

      onProgress?.({
        currentPath: loc,
        message: `Analyzing directory ${path.basename(loc)}...`,
      });

      try {
        const stat = fs.statSync(loc);
        if (!stat.isDirectory()) continue;

        // Bounded recursive exploration (depth limit 3)
        await this.exploreDirectory(loc, 0, 3, candidates, seenExecutables, onProgress, isCancelled);
      } catch (err: any) {
        console.warn(`[StandaloneDetector] Skipping inaccessible location "${loc}":`, err.message);
      }
    }

    // Sort by confidence descending
    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Explores directories recursively up to maxDepth
   */
  private async exploreDirectory(
    dirPath: string,
    currentDepth: number,
    maxDepth: number,
    candidates: StandaloneCandidate[],
    seenExecutables: Set<string>,
    onProgress?: (info: { currentPath?: string; message: string }) => void,
    isCancelled?: () => boolean
  ): Promise<void> {
    if (currentDepth > maxDepth || isCancelled?.()) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return; // Inaccessible directory
    }

    const files: string[] = [];
    const subdirs: string[] = [];

    for (const entry of entries) {
      const lower = entry.name.toLowerCase();

      if (entry.isDirectory()) {
        if (!this.ignoredDirNames.has(lower) && !lower.startsWith('.')) {
          subdirs.push(path.join(dirPath, entry.name));
        }
      } else if (entry.isFile()) {
        if (lower.endsWith('.exe') && !this.isIgnoredExe(entry.name)) {
          files.push(path.join(dirPath, entry.name));
        }
      }
    }

    // Evaluate all non-blacklisted .exe files in this folder
    for (const exePath of files) {
      if (isCancelled?.()) return;

      const normalizedPath = path.resolve(exePath).toLowerCase();
      if (seenExecutables.has(normalizedPath)) continue;

      const candidate = this.evaluateCandidate(exePath, dirPath, entries);
      if (candidate && candidate.confidence >= 50) {
        seenExecutables.add(normalizedPath);
        candidates.push(candidate);
        onProgress?.({
          currentPath: exePath,
          message: `Identified candidate: ${candidate.name} (${candidate.confidence}%)`,
        });
      }
    }

    // Recurse into subdirectories
    for (const sub of subdirs) {
      if (isCancelled?.()) return;
      await this.exploreDirectory(sub, currentDepth + 1, maxDepth, candidates, seenExecutables, onProgress, isCancelled);
    }
  }

  /**
   * Heuristic analysis of a single executable candidate
   */
  private evaluateCandidate(
    exePath: string,
    folderPath: string,
    entries: fs.Dirent[]
  ): StandaloneCandidate | null {
    let score = 0;
    const detectedAssets: string[] = [];
    let engine: StandaloneCandidate['engine'] = 'Standard Executable';

    const exeNameWithoutExt = path.basename(exePath, path.extname(exePath));
    const parentFolderName = path.basename(folderPath);

    let fileSizeBytes = 0;
    try {
      const stat = fs.statSync(exePath);
      fileSizeBytes = stat.size;
    } catch {
      return null;
    }

    // 1. Unity Engine Check (+45%)
    const expectedUnityDataDir = `${exeNameWithoutExt}_Data`.toLowerCase();
    const hasUnityData = entries.some(
      (e) => e.isDirectory() && e.name.toLowerCase() === expectedUnityDataDir
    );
    const hasUnityDll = entries.some(
      (e) => e.isFile() && e.name.toLowerCase() === 'unityplayer.dll'
    );
    const hasUnityCrash = entries.some(
      (e) => e.isFile() && e.name.toLowerCase().startsWith('unitycrashhandler')
    );

    if (hasUnityData || (hasUnityDll && hasUnityCrash)) {
      score += 45;
      engine = 'Unity';
      detectedAssets.push('Unity Engine Structure');
    }

    // 2. Unreal Engine Check (+45%)
    const hasBinariesWin64 = entries.some(
      (e) => e.isDirectory() && e.name.toLowerCase() === 'binaries'
    );
    const hasEngineDir = entries.some(
      (e) => e.isDirectory() && e.name.toLowerCase() === 'engine'
    );
    const hasContentDir = entries.some(
      (e) => e.isDirectory() && e.name.toLowerCase() === 'content'
    );

    let hasPakFiles = false;
    try {
      const paksPath = path.join(folderPath, 'Content', 'Paks');
      if (fs.existsSync(paksPath)) {
        hasPakFiles = true;
      }
    } catch {}

    if ((hasEngineDir && hasBinariesWin64) || (hasContentDir && hasPakFiles)) {
      score += 45;
      engine = 'Unreal';
      detectedAssets.push('Unreal Engine Structure');
    }

    // 3. Godot Engine Check (+35%)
    const expectedGodotPck = `${exeNameWithoutExt}.pck`.toLowerCase();
    const hasGodotPck = entries.some(
      (e) => e.isFile() && e.name.toLowerCase() === expectedGodotPck
    );
    if (hasGodotPck) {
      score += 35;
      engine = 'Godot';
      detectedAssets.push('Godot Engine Archive (.pck)');
    }

    // 4. Common Game Runtime Libraries (+30%)
    const matchingLibraries: string[] = [];
    for (const e of entries) {
      if (e.isFile() && this.engineLibraries.has(e.name.toLowerCase())) {
        matchingLibraries.push(e.name);
      }
    }

    if (matchingLibraries.length > 0) {
      score += Math.min(30, matchingLibraries.length * 10);
      if (engine === 'Standard Executable') {
        engine = 'Custom Engine';
      }
      detectedAssets.push(`Runtime Libraries: ${matchingLibraries.slice(0, 3).join(', ')}`);
    }

    // 5. Game Asset Subdirectories (+25%)
    const foundAssetDirs: string[] = [];
    for (const e of entries) {
      if (e.isDirectory() && this.assetDirNames.has(e.name.toLowerCase())) {
        foundAssetDirs.push(e.name);
      }
    }

    if (foundAssetDirs.length > 0) {
      score += Math.min(25, foundAssetDirs.length * 8);
      detectedAssets.push(`Asset Folders: ${foundAssetDirs.slice(0, 3).join(', ')}`);
    }

    // 6. Name Cohesion (+15%)
    if (exeNameWithoutExt.toLowerCase() === parentFolderName.toLowerCase()) {
      score += 15;
    }

    // 7. Binary Size (+10%)
    if (fileSizeBytes > 5 * 1024 * 1024) {
      score += 10;
    } else if (fileSizeBytes > 1 * 1024 * 1024) {
      score += 5;
    }

    const confidence = Math.min(98, score);
    const formattedName = this.formatGameName(exeNameWithoutExt, parentFolderName);
    const driveMatch = exePath.match(/^[a-zA-Z]:/);
    const drive = driveMatch ? driveMatch[0].toUpperCase() : 'C:';

    return {
      name: formattedName,
      launcher: 'STANDALONE',
      executablePath: exePath,
      installPath: folderPath,
      confidence,
      engine,
      detectedAssets,
      installedSize: fileSizeBytes,
      installSizeBytes: fileSizeBytes,
      installSizeStatus: 'CALCULATING',
      installSizeSource: 'filesystem',
      description: `Discovered standalone game (${engine}) with ${confidence}% heuristic match.`,
      genre: engine,
      drive,
      metadata: {
        engine,
        detectedAssets,
      },
    };
  }

  private isIgnoredExe(filename: string): boolean {
    return this.ignoredExePatterns.some((pattern) => pattern.test(filename));
  }

  private formatGameName(exeName: string, folderName: string): string {
    const candidateName =
      folderName.length > 3 && !['bin', 'binaries', 'win64', 'x64', 'x86'].includes(folderName.toLowerCase())
        ? folderName
        : exeName;

    return candidateName
      .replace(/[._-]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

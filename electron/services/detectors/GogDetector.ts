import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { GameCandidate, GameDetector } from '../scanner/types';
import { DriveService } from '../DriveService';

const execAsync = util.promisify(exec);

interface GogGameInfo {
  gameId?: string;
  rootGameId?: string;
  name?: string;
  playTasks?: Array<{
    isPrimary?: boolean;
    type?: string;
    path?: string;
    workingDir?: string;
    arguments?: string;
  }>;
  version?: number;
}

export class GogDetector implements GameDetector {
  public readonly name = 'GOG Detector';

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
    const seenGameIds = new Set<string>();
    const seenInstallPaths = new Set<string>();

    onProgress?.({ message: 'Searching for GOG installation metadata and registry entries...' });

    // Step 1: Query Windows Registry for GOG Games
    try {
      const regCandidates = await this.detectFromRegistry();
      for (const c of regCandidates) {
        if (!seenGameIds.has(c.launcherAppId!) && !seenInstallPaths.has(c.installPath.toLowerCase())) {
          seenGameIds.add(c.launcherAppId!);
          seenInstallPaths.add(c.installPath.toLowerCase());
          candidates.push(c);
          onProgress?.({
            currentPath: c.installPath,
            message: `Discovered GOG game from registry: ${c.name}`,
          });
        }
      }
    } catch (err: any) {
      console.warn('[GogDetector] Registry scan encountered error:', err.message);
    }

    if (isCancelled?.()) return candidates;

    // Step 2: Check GOG Galaxy Database (%ProgramData%\GOG.com\Galaxy\storage\galaxy-2.0.db)
    try {
      const galaxyCandidates = await this.detectFromGalaxyDatabase();
      for (const c of galaxyCandidates) {
        if (!seenGameIds.has(c.launcherAppId!) && !seenInstallPaths.has(c.installPath.toLowerCase())) {
          seenGameIds.add(c.launcherAppId!);
          seenInstallPaths.add(c.installPath.toLowerCase());
          candidates.push(c);
          onProgress?.({
            currentPath: c.installPath,
            message: `Discovered GOG game from Galaxy database: ${c.name}`,
          });
        }
      }
    } catch (err: any) {
      console.warn('[GogDetector] Galaxy database scan encountered error:', err.message);
    }

    if (isCancelled?.()) return candidates;

    // Step 3: Scan target drives and folders for goggame-*.info files
    try {
      const fileCandidates = await this.detectFromInfoFiles(locations, seenGameIds, seenInstallPaths, onProgress, isCancelled);
      candidates.push(...fileCandidates);
    } catch (err: any) {
      console.warn('[GogDetector] Info files scan encountered error:', err.message);
    }

    console.log(`[GogDetector] Total GOG games detected: ${candidates.length}`);
    return candidates;
  }

  /**
   * Queries Windows Registry for GOG installed games
   */
  private async detectFromRegistry(): Promise<GameCandidate[]> {
    const candidates: GameCandidate[] = [];
    const psScript = `
      $keys = @(
        'HKLM:\\SOFTWARE\\WOW6432Node\\GOG.com\\Games',
        'HKLM:\\SOFTWARE\\GOG.com\\Games',
        'HKCU:\\SOFTWARE\\GOG.com\\Games'
      )
      $results = @()
      foreach ($k in $keys) {
        if (Test-Path $k) {
          Get-ChildItem -Path $k -ErrorAction SilentlyContinue | ForEach-Object {
            $props = Get-ItemProperty -Path $_.PSPath -ErrorAction SilentlyContinue
            if ($props) {
              $results += [PSCustomObject]@{
                gameId = if ($props.gameId) { $props.gameId.ToString() } else { $props.gameID.ToString() }
                gameName = if ($props.gameName) { $props.gameName } else { $props.GAMENAME }
                path = if ($props.path) { $props.path } else { $props.PATH }
                exe = if ($props.exe) { $props.exe } else { $props.EXE }
                launchCommand = $props.launchCommand
              }
            }
          }
        }
      }
      $results | ConvertTo-Json -Compress
    `;

    try {
      const { stdout } = await execAsync(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${psScript.replace(/\n/g, ' ')}"`,
        { maxBuffer: 10 * 1024 * 1024 }
      );

      const trimmed = stdout.trim();
      if (!trimmed) return candidates;

      const raw = JSON.parse(trimmed);
      const items = Array.isArray(raw) ? raw : [raw];

      for (const item of items) {
        if (!item.gameName || !item.path) continue;

        const normInstallPath = path.resolve(item.path);
        if (!fs.existsSync(normInstallPath)) continue;

        let executablePath: string | undefined;
        if (item.exe) {
          const candidateExe = path.isAbsolute(item.exe) ? item.exe : path.join(normInstallPath, item.exe);
          if (fs.existsSync(candidateExe)) {
            executablePath = candidateExe;
          }
        }

        // If exe is not resolved yet, search install dir
        if (!executablePath) {
          executablePath = this.findExecutableInFolder(normInstallPath);
        }

        const drive = normInstallPath.slice(0, 2).toUpperCase();
        const iconPath = this.findGogIcon(normInstallPath, item.gameId);
        const installedSize = this.calculateFolderSize(normInstallPath);

        candidates.push({
          name: item.gameName.trim(),
          launcher: 'GOG',
          launcherAppId: item.gameId || path.basename(normInstallPath),
          executablePath,
          installPath: normInstallPath,
          confidence: 100,
          drive: drive.endsWith(':') ? drive : `${drive}:`,
          iconPath,
          installedSize,
          genre: 'Game',
          description: `GOG installation for ${item.gameName}.`,
        });
      }
    } catch {
      // Registry query may return empty if no GOG games exist in registry
    }

    return candidates;
  }

  /**
   * Reads GOG Galaxy SQLite storage (%ProgramData%\GOG.com\Galaxy\storage\galaxy-2.0.db)
   */
  private async detectFromGalaxyDatabase(): Promise<GameCandidate[]> {
    const candidates: GameCandidate[] = [];
    const programData = process.env.ProgramData || 'C:\\ProgramData';
    const dbPath = path.join(programData, 'GOG.com', 'Galaxy', 'storage', 'galaxy-2.0.db');

    if (!fs.existsSync(dbPath)) return candidates;

    try {
      // Use better-sqlite3 dynamically
      const Database = (await import('better-sqlite3')).default;
      const db = new Database(dbPath, { readonly: true, fileMustExist: true });

      // Check if InstalledBaseProducts table exists
      const hasTable = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='InstalledBaseProducts'"
      ).get();

      if (hasTable) {
        const rows = db.prepare('SELECT productId, title, installationPath, executable FROM InstalledBaseProducts').all() as any[];
        for (const row of rows) {
          if (!row.title || !row.installationPath) continue;

          const normInstallPath = path.resolve(row.installationPath);
          if (!fs.existsSync(normInstallPath)) continue;

          let executablePath: string | undefined;
          if (row.executable) {
            const candidateExe = path.isAbsolute(row.executable) ? row.executable : path.join(normInstallPath, row.executable);
            if (fs.existsSync(candidateExe)) {
              executablePath = candidateExe;
            }
          }

          if (!executablePath) {
            executablePath = this.findExecutableInFolder(normInstallPath);
          }

          const drive = normInstallPath.slice(0, 2).toUpperCase();
          const iconPath = this.findGogIcon(normInstallPath, row.productId);
          const installedSize = this.calculateFolderSize(normInstallPath);

          candidates.push({
            name: row.title.trim(),
            launcher: 'GOG',
            launcherAppId: String(row.productId),
            executablePath,
            installPath: normInstallPath,
            confidence: 100,
            drive: drive.endsWith(':') ? drive : `${drive}:`,
            iconPath,
            installedSize,
            genre: 'Game',
            description: `GOG Galaxy installation for ${row.title}.`,
          });
        }
      }

      db.close();
    } catch (err: any) {
      console.warn('[GogDetector] Could not parse galaxy-2.0.db:', err.message);
    }

    return candidates;
  }

  /**
   * Scans target drives and custom directories for goggame-*.info files
   */
  private async detectFromInfoFiles(
    locations: string[],
    seenGameIds: Set<string>,
    seenInstallPaths: Set<string>,
    onProgress?: (info: { currentPath?: string; message: string }) => void,
    isCancelled?: () => boolean
  ): Promise<GameCandidate[]> {
    const candidates: GameCandidate[] = [];

    // 1. Gather all potential folders to inspect
    const foldersToInspect = new Set<string>();

    const addDirAndSubdirs = (dir: string, depth: number) => {
      if (!fs.existsSync(dir)) return;
      foldersToInspect.add(path.resolve(dir));
      if (depth <= 0) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const name = entry.name.toLowerCase();
            if (
              name === '$recycle.bin' ||
              name === 'windows' ||
              name === 'node_modules' ||
              name === 'system volume information' ||
              name === 'appdata'
            ) {
              continue;
            }
            addDirAndSubdirs(path.join(dir, entry.name), depth - 1);
          }
        }
      } catch {
        // Ignore inaccessible subfolders
      }
    };

    // Collect drive letters
    const drivesToScan = new Set<string>();
    for (const loc of locations) {
      if (fs.existsSync(loc)) {
        addDirAndSubdirs(loc, 2);
      }

      const match = loc.match(/^([A-Za-z]:)/);
      if (match) {
        drivesToScan.add(match[1].toUpperCase());
      }
    }

    const commonParentDirs = [
      'GOG Games',
      'Games',
      'Games\\GOG',
      'Program Files\\GOG Games',
      'Program Files (x86)\\GOG Games',
      'Program Files (x86)\\GOG Galaxy\\Games',
    ];

    for (const drive of drivesToScan) {
      for (const parent of commonParentDirs) {
        const fullParent = path.join(`${drive}\\`, parent);
        if (fs.existsSync(fullParent)) {
          try {
            const subdirs = fs.readdirSync(fullParent);
            for (const sub of subdirs) {
              const fullSub = path.join(fullParent, sub);
              foldersToInspect.add(path.resolve(fullSub));
            }
          } catch {
            // Ignore
          }
        }
      }
    }

    // 2. Parse candidate folders
    for (const folder of foldersToInspect) {
      if (isCancelled?.()) break;

      const candidate = this.parseGogGameDirectory(folder, seenGameIds, seenInstallPaths);
      if (candidate) {
        seenGameIds.add(candidate.launcherAppId!);
        seenInstallPaths.add(candidate.installPath.toLowerCase());
        candidates.push(candidate);

        onProgress?.({
          currentPath: candidate.installPath,
          message: `Discovered GOG game from info manifest: ${candidate.name}`,
        });
      }
    }

    return candidates;
  }

  /**
   * Checks a specific directory for goggame-*.info manifest and parses game candidate
   */
  private parseGogGameDirectory(
    gameDir: string,
    seenGameIds: Set<string>,
    seenInstallPaths: Set<string>
  ): GameCandidate | null {
    if (seenInstallPaths.has(gameDir.toLowerCase())) return null;

    let dirFiles: string[] = [];
    try {
      dirFiles = fs.readdirSync(gameDir);
    } catch {
      return null;
    }

    const infoFile = dirFiles.find((f) => f.startsWith('goggame-') && f.endsWith('.info'));
    if (!infoFile) return null;

    const fullInfoPath = path.join(gameDir, infoFile);
    try {
      const raw = fs.readFileSync(fullInfoPath, 'utf8');
      const info: GogGameInfo = JSON.parse(raw);

      const gameId = info.gameId || infoFile.replace('goggame-', '').replace('.info', '');
      if (seenGameIds.has(gameId)) return null;

      const name = info.name || path.basename(gameDir);
      let executablePath: string | undefined;

      // Find primary play task
      if (info.playTasks && Array.isArray(info.playTasks)) {
        const primaryTask = info.playTasks.find((t) => t.isPrimary && t.path) || info.playTasks.find((t) => t.path);
        if (primaryTask?.path) {
          const candidateExe = path.join(gameDir, primaryTask.path);
          if (fs.existsSync(candidateExe)) {
            executablePath = candidateExe;
          }
        }
      }

      if (!executablePath) {
        executablePath = this.findExecutableInFolder(gameDir);
      }

      const driveMatch = gameDir.match(/^([A-Za-z]:)/);
      const drive = driveMatch ? driveMatch[1].toUpperCase() : 'C:';
      const iconPath = this.findGogIcon(gameDir, gameId);
      const installedSize = this.calculateFolderSize(gameDir);

      return {
        name: name.trim(),
        launcher: 'GOG',
        launcherAppId: gameId,
        executablePath,
        installPath: gameDir,
        confidence: 100, // Official GOG installation manifest
        drive,
        iconPath,
        installedSize,
        genre: 'Game',
        description: `GOG installation for ${name}.`,
      };
    } catch (err: any) {
      console.warn(`[GogDetector] Failed parsing ${fullInfoPath}:`, err.message);
      return null;
    }
  }

  private findExecutableInFolder(dir: string): string | undefined {
    try {
      const files = fs.readdirSync(dir);
      const exes = files.filter((f) => f.toLowerCase().endsWith('.exe'));
      const mainExe = exes.find(
        (e) =>
          !e.toLowerCase().includes('unins') &&
          !e.toLowerCase().includes('crash') &&
          !e.toLowerCase().includes('unity') &&
          !e.toLowerCase().includes('setup')
      ) || exes[0];

      return mainExe ? path.join(dir, mainExe) : undefined;
    } catch {
      return undefined;
    }
  }

  private findGogIcon(dir: string, gameId?: string): string | undefined {
    try {
      const files = fs.readdirSync(dir);
      if (gameId) {
        const specificIcon = files.find((f) => f.toLowerCase() === `goggame-${gameId.toLowerCase()}.ico`);
        if (specificIcon) return path.join(dir, specificIcon);
      }
      const genericIcon = files.find((f) => f.toLowerCase().endsWith('.ico'));
      return genericIcon ? path.join(dir, genericIcon) : undefined;
    } catch {
      return undefined;
    }
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

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { GameCandidate, GameDetector } from '../scanner/types';
import { DriveService } from '../DriveService';

const execAsync = util.promisify(exec);

export class UbisoftDetector implements GameDetector {
  public readonly name = 'Ubisoft Detector';

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

    onProgress?.({ message: 'Searching for Ubisoft Connect games...' });

    // Step 1: Scan Windows Registry for Ubisoft installations
    try {
      const regCandidates = await this.detectFromRegistry(seenAppIds, seenInstallPaths, onProgress);
      candidates.push(...regCandidates);
    } catch (err: any) {
      console.warn('[UbisoftDetector] Registry scan encountered error:', err.message);
    }

    if (isCancelled?.()) return candidates;

    // Step 2: Scan target drives and common Ubisoft game folders
    try {
      const folderCandidates = await this.detectFromFolders(locations, seenAppIds, seenInstallPaths, onProgress, isCancelled);
      candidates.push(...folderCandidates);
    } catch (err: any) {
      console.warn('[UbisoftDetector] Folder scan encountered error:', err.message);
    }

    console.log(`[UbisoftDetector] Total Ubisoft games detected: ${candidates.length}`);
    return candidates;
  }

  /**
   * Queries Windows Registry for Ubisoft launcher installs, game-specific keys, and uninstall keys
   */
  private async detectFromRegistry(
    seenAppIds: Set<string>,
    seenInstallPaths: Set<string>,
    onProgress?: (info: { currentPath?: string; message: string }) => void
  ): Promise<GameCandidate[]> {
    const candidates: GameCandidate[] = [];

    const psScript = `
      $ErrorActionPreference = 'SilentlyContinue'
      $results = @()

      # 1. Launcher Installs
      $installKeys = @(
        'HKLM:\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs',
        'HKLM:\\SOFTWARE\\Ubisoft\\Launcher\\Installs',
        'HKCU:\\SOFTWARE\\Ubisoft\\Launcher\\Installs'
      )
      foreach ($k in $installKeys) {
        if (Test-Path $k) {
          Get-ChildItem -Path $k | ForEach-Object {
            $props = Get-ItemProperty -Path $_.PSPath
            if ($props.InstallDir) {
              $results += [PSCustomObject]@{
                AppId = $_.PSChildName
                InstallDir = $props.InstallDir
                Name = $props.DisplayName
              }
            }
          }
        }
      }

      # 2. Game-specific keys under Ubisoft
      $rootKeys = @(
        'HKLM:\\SOFTWARE\\WOW6432Node\\Ubisoft',
        'HKLM:\\SOFTWARE\\Ubisoft',
        'HKCU:\\SOFTWARE\\Ubisoft'
      )
      foreach ($rk in $rootKeys) {
        if (Test-Path $rk) {
          Get-ChildItem -Path $rk | ForEach-Object {
            $name = $_.PSChildName
            if ($name -ne 'Launcher' -and $name -ne 'Dependencies') {
              $props = Get-ItemProperty -Path $_.PSPath
              if ($props.InstallDir) {
                $results += [PSCustomObject]@{
                  AppId = $name
                  InstallDir = $props.InstallDir
                  Name = $name
                }
              }
            }
          }
        }
      }

      # 3. Uplay Install uninstall registry entries
      $uKeys = @(
        'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
        'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
        'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
      )
      foreach ($uk in $uKeys) {
        if (Test-Path $uk) {
          Get-ChildItem -Path $uk | Where-Object { $_.PSChildName -match 'Uplay Install' } | ForEach-Object {
            $props = Get-ItemProperty -Path $_.PSPath
            $gameId = ''
            if ($props.UninstallString -match '-gameid\\s+(\\d+)') {
              $gameId = $matches[1]
            }
            if ($props.InstallLocation -or $props.DisplayIcon) {
              $dir = $props.InstallLocation
              if (-not $dir -and $props.DisplayIcon) {
                $dir = Split-Path -Path $props.DisplayIcon -Parent
              }
              $results += [PSCustomObject]@{
                AppId = if ($gameId) { $gameId } else { $_.PSChildName }
                InstallDir = $dir
                Name = $props.DisplayName
                DisplayIcon = $props.DisplayIcon
              }
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
        if (!item.InstallDir) continue;

        const normInstallPath = path.resolve(item.InstallDir);
        if (!fs.existsSync(normInstallPath)) continue;
        if (seenInstallPaths.has(normInstallPath.toLowerCase())) continue;

        const appId = String(item.AppId || path.basename(normInstallPath));
        if (seenAppIds.has(appId)) continue;

        const gameName = this.formatGameName(item.Name || path.basename(normInstallPath));
        const executablePath = this.findExecutableInFolder(normInstallPath);
        const iconPath = item.DisplayIcon && fs.existsSync(item.DisplayIcon)
          ? item.DisplayIcon
          : this.findUbisoftIcon(normInstallPath);
        const installedSize = this.calculateFolderSize(normInstallPath);
        const driveMatch = normInstallPath.match(/^([A-Za-z]:)/);
        const drive = driveMatch ? driveMatch[1].toUpperCase() : 'C:';

        const candidate: GameCandidate = {
          name: gameName,
          launcher: 'UBISOFT',
          launcherAppId: appId,
          executablePath,
          installPath: normInstallPath,
          confidence: 100,
          drive,
          iconPath,
          installedSize,
          genre: 'Game',
          description: `Ubisoft Connect installation for ${gameName}.`,
        };

        seenAppIds.add(appId);
        seenInstallPaths.add(normInstallPath.toLowerCase());
        candidates.push(candidate);

        onProgress?.({
          currentPath: normInstallPath,
          message: `Discovered Ubisoft game: ${gameName}`,
        });
      }
    } catch (err: any) {
      console.warn('[UbisoftDetector] Registry parse error:', err.message);
    }

    return candidates;
  }

  /**
   * Scans common directories on storage drives and custom scan paths for Ubisoft game folders
   */
  private async detectFromFolders(
    locations: string[],
    seenAppIds: Set<string>,
    seenInstallPaths: Set<string>,
    onProgress?: (info: { currentPath?: string; message: string }) => void,
    isCancelled?: () => boolean
  ): Promise<GameCandidate[]> {
    const candidates: GameCandidate[] = [];

    const targetDirs = new Set<string>();

    const addDirAndSubdirs = (dir: string, depth: number) => {
      if (!fs.existsSync(dir)) return;
      targetDirs.add(path.resolve(dir));
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
        // Ignore
      }
    };

    const drivesToScan = new Set<string>();
    for (const loc of locations) {
      if (fs.existsSync(loc)) {
        addDirAndSubdirs(loc, 2);
      }

      const match = loc.match(/^([A-Za-z]:)/);
      if (match) drivesToScan.add(match[1].toUpperCase());
    }

    const commonParentDirs = [
      'Ubisoft Games',
      'Ubisoft Game Launcher\\games',
      'Games\\Ubisoft',
      'Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\games',
      'Program Files\\Ubisoft\\Ubisoft Game Launcher\\games',
    ];

    for (const drive of drivesToScan) {
      for (const parent of commonParentDirs) {
        const fullParent = path.join(`${drive}\\`, parent);
        if (fs.existsSync(fullParent)) {
          addDirAndSubdirs(fullParent, 1);
        }
      }
    }

    for (const folder of targetDirs) {
      if (isCancelled?.()) break;

      const candidate = this.inspectPotentialUbisoftFolder(folder, seenAppIds, seenInstallPaths);
      if (candidate) {
        seenAppIds.add(candidate.launcherAppId!);
        seenInstallPaths.add(candidate.installPath.toLowerCase());
        candidates.push(candidate);
        onProgress?.({
          currentPath: candidate.installPath,
          message: `Discovered Ubisoft game: ${candidate.name}`,
        });
      }
    }

    return candidates;
  }

  /**
   * Checks if a folder contains Ubisoft Connect game markers (manifests or runtime loaders)
   */
  private inspectPotentialUbisoftFolder(
    folderPath: string,
    seenAppIds: Set<string>,
    seenInstallPaths: Set<string>
  ): GameCandidate | null {
    if (seenInstallPaths.has(folderPath.toLowerCase())) return null;

    let files: string[] = [];
    try {
      files = fs.readdirSync(folderPath);
    } catch {
      return null;
    }

    const filesLower = new Set(files.map((f) => f.toLowerCase()));

    // Recognized Ubisoft Connect marker files
    const isUbisoft =
      filesLower.has('uplay_install.manifest') ||
      filesLower.has('uplay_install.state') ||
      filesLower.has('uplay_r1_loader64.dll') ||
      filesLower.has('uplay_r1_loader.dll') ||
      filesLower.has('uplay_r2_loader.dll') ||
      filesLower.has('uplay_r2.dll') ||
      filesLower.has('upc.exe');

    if (!isUbisoft) return null;

    let gameId = path.basename(folderPath);

    // Try reading gameId from uplay_install.state or manifest if available
    const stateFile = path.join(folderPath, 'uplay_install.state');
    if (fs.existsSync(stateFile)) {
      try {
        const raw = fs.readFileSync(stateFile, 'utf8');
        const match = raw.match(/gameid[^\d]*(\d+)/i);
        if (match) gameId = match[1];
      } catch {
        // Ignore
      }
    }

    if (seenAppIds.has(gameId)) return null;

    const gameName = this.formatGameName(path.basename(folderPath));
    const executablePath = this.findExecutableInFolder(folderPath);
    const iconPath = this.findUbisoftIcon(folderPath);
    const installedSize = this.calculateFolderSize(folderPath);
    const driveMatch = folderPath.match(/^([A-Za-z]:)/);
    const drive = driveMatch ? driveMatch[1].toUpperCase() : 'C:';

    return {
      name: gameName,
      launcher: 'UBISOFT',
      launcherAppId: gameId,
      executablePath,
      installPath: folderPath,
      confidence: 95,
      drive,
      iconPath,
      installedSize,
      genre: 'Game',
      description: `Ubisoft Connect installation for ${gameName}.`,
    };
  }

  private findExecutableInFolder(dir: string): string | undefined {
    try {
      const files = fs.readdirSync(dir);
      const exes = files.filter((f) => f.toLowerCase().endsWith('.exe'));
      const mainExe = exes.find(
        (e) =>
          !e.toLowerCase().includes('unins') &&
          !e.toLowerCase().includes('crash') &&
          !e.toLowerCase().includes('upc') &&
          !e.toLowerCase().includes('support') &&
          !e.toLowerCase().includes('setup')
      ) || exes[0];

      if (mainExe) return path.join(dir, mainExe);

      // Check bin or bin/x64 subdirectory
      const binSub = path.join(dir, 'bin');
      if (fs.existsSync(binSub)) {
        const binFiles = fs.readdirSync(binSub).filter((f) => f.toLowerCase().endsWith('.exe'));
        if (binFiles.length > 0) return path.join(binSub, binFiles[0]);
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  private findUbisoftIcon(dir: string): string | undefined {
    try {
      const files = fs.readdirSync(dir);
      const icon = files.find((f) => f.toLowerCase().endsWith('.ico'));
      return icon ? path.join(dir, icon) : undefined;
    } catch {
      return undefined;
    }
  }

  private formatGameName(rawName: string): string {
    let clean = rawName.replace(/_/g, ' ').replace(/\.exe$/i, '');
    // Space CamelCase if needed
    if (!clean.includes(' ') && /[a-z][A-Z]/.test(clean)) {
      clean = clean.replace(/([a-z])([A-Z])/g, '$1 $2');
    }
    return clean.trim();
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

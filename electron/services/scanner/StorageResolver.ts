import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Game, StorageInfo, StorageSizeStatus, StorageSizeSource } from '../../../src/types/Game';
import { GameRepository } from '../../database/index';

const execAsync = promisify(exec);

export class StorageResolver {
  private inFlight = new Map<number, Promise<StorageInfo>>();
  private activeCalculations = 0;
  private maxConcurrentCalculations = 2; // Prevent disk I/O thrashing
  private waitQueue: Array<() => void> = [];

  constructor(private gameRepo: GameRepository) {}

  /**
   * Resolves storage size for a game using the priority hierarchy:
   * 1. Launcher/package metadata
   * 2. Safe recursive filesystem calculation
   * 3. Package-aware fallback
   * 4. Honest UNKNOWN / ACCESS_DENIED (never fake 0 B)
   */
  public async resolveGameStorage(game: Game, forceRecalculate = false): Promise<StorageInfo> {
    // Return cached if known and valid, unless force-recalculate requested
    if (
      !forceRecalculate &&
      game.installSizeStatus === 'KNOWN' &&
      game.installedSize &&
      game.installedSize > 0
    ) {
      return {
        installPath: game.installPath,
        sizeBytes: game.installedSize,
        status: 'KNOWN',
        source: game.installSizeSource || 'metadata',
        updatedAt: game.installSizeUpdatedAt || new Date().toISOString(),
      };
    }

    // In-flight deduplication
    if (this.inFlight.has(game.id)) {
      return this.inFlight.get(game.id)!;
    }

    const calcPromise = this.executeResolution(game).finally(() => {
      this.inFlight.delete(game.id);
    });

    this.inFlight.set(game.id, calcPromise);
    return calcPromise;
  }

  private async executeResolution(game: Game): Promise<StorageInfo> {
    const now = new Date().toISOString();

    // Set status to CALCULATING temporarily if not already known
    this.gameRepo.updateStorageInfo(game.id, game.installedSize, 'CALCULATING', game.installSizeSource || 'unknown');

    try {
      // 1. Launcher metadata priority
      const metaSize = await this.tryMetadataResolution(game);
      if (metaSize && metaSize > 0) {
        const info: StorageInfo = {
          installPath: game.installPath,
          sizeBytes: metaSize,
          status: 'KNOWN',
          source: 'metadata',
          updatedAt: now,
        };
        this.gameRepo.updateStorageInfo(game.id, metaSize, 'KNOWN', 'metadata');
        return info;
      }

      // 2. Microsoft Store / Xbox specific safe handling
      if (game.launcher === 'XBOX') {
        const xboxInfo = await this.resolveXboxStorage(game);
        this.gameRepo.updateStorageInfo(game.id, xboxInfo.sizeBytes, xboxInfo.status, xboxInfo.source);
        return xboxInfo;
      }

      // 3. Filesystem calculation for Standalone, GOG, Ubisoft, or missing metadata
      const targetDir = this.determineInstallRoot(game);
      if (!targetDir || !fs.existsSync(targetDir)) {
        const info: StorageInfo = {
          installPath: game.installPath,
          sizeBytes: undefined,
          status: 'UNKNOWN',
          source: 'unknown',
          updatedAt: now,
        };
        this.gameRepo.updateStorageInfo(game.id, undefined, 'UNKNOWN', 'unknown');
        return info;
      }

      // Concurrency throttled calculation
      await this.acquireSlot();
      try {
        const fsResult = await this.calculateFolderSize(targetDir);
        const info: StorageInfo = {
          installPath: targetDir,
          sizeBytes: fsResult.sizeBytes,
          status: fsResult.status,
          source: fsResult.source,
          updatedAt: now,
        };
        this.gameRepo.updateStorageInfo(game.id, fsResult.sizeBytes, fsResult.status, fsResult.source);
        return info;
      } finally {
        this.releaseSlot();
      }
    } catch (err: any) {
      console.warn(`[StorageResolver] Failed to resolve size for ${game.name}:`, err.message);
      const isAccessDenied = err.code === 'EACCES' || err.code === 'EPERM';
      const status: StorageSizeStatus = isAccessDenied ? 'ACCESS_DENIED' : 'UNKNOWN';
      this.gameRepo.updateStorageInfo(game.id, undefined, status, 'unknown');
      return {
        installPath: game.installPath,
        sizeBytes: undefined,
        status,
        source: 'unknown',
        updatedAt: now,
      };
    }
  }

  /**
   * Checks launcher-specific metadata files without walking the directory
   */
  private async tryMetadataResolution(game: Game): Promise<number | undefined> {
    // If game already has a trusted metadata size from manifest parsing during scan
    if (game.installSizeSource === 'metadata' && game.installedSize && game.installedSize > 0) {
      return game.installedSize;
    }

    // Steam ACF manifest check
    if (game.launcher === 'STEAM' && game.launcherAppId && game.installPath) {
      try {
        const steamappsDir = path.dirname(game.installPath);
        const manifestPath = path.join(steamappsDir, `appmanifest_${game.launcherAppId}.acf`);
        if (fs.existsSync(manifestPath)) {
          const content = fs.readFileSync(manifestPath, 'utf8');
          const sizeMatch = content.match(/"SizeOnDisk"\s+"(\d+)"/i);
          if (sizeMatch) {
            const bytes = parseInt(sizeMatch[1], 10);
            if (!isNaN(bytes) && bytes > 0) return bytes;
          }
        }
      } catch {}
    }

    // Epic Games Store .item manifest check
    if (game.launcher === 'EPIC' && game.installPath) {
      try {
        const epicManifests = path.join(
          process.env.PROGRAMDATA || 'C:\\ProgramData',
          'Epic',
          'EpicGamesLauncher',
          'Data',
          'Manifests'
        );
        if (fs.existsSync(epicManifests)) {
          const files = fs.readdirSync(epicManifests).filter((f) => f.endsWith('.item'));
          for (const file of files) {
            const itemPath = path.join(epicManifests, file);
            const content = fs.readFileSync(itemPath, 'utf8');
            const data = JSON.parse(content);
            if (
              data.InstallLocation &&
              path.normalize(data.InstallLocation).toLowerCase() ===
                path.normalize(game.installPath).toLowerCase()
            ) {
              if (data.InstallSize && data.InstallSize > 0) {
                return data.InstallSize;
              }
            }
          }
        }
      } catch {}
    }

    // GOG goggame-*.info check
    if (game.launcher === 'GOG' && game.installPath && fs.existsSync(game.installPath)) {
      try {
        const files = fs.readdirSync(game.installPath);
        const infoFile = files.find((f) => f.startsWith('goggame-') && f.endsWith('.info'));
        if (infoFile) {
          // If GOG already parsed size, or return undefined to let filesystem calculate
        }
      } catch {}
    }

    return undefined;
  }

  /**
   * Microsoft Store / Xbox safe inspection:
   * - Never modify ACLs or grant elevation.
   * - Uses safe package inspection or accessible XboxGames paths.
   */
  private async resolveXboxStorage(game: Game): Promise<StorageInfo> {
    const now = new Date().toISOString();

    // 1. If installPath points to an accessible custom Xbox directory (e.g. C:\XboxGames\GameName)
    if (game.installPath && !game.installPath.toLowerCase().includes('windowsapps')) {
      if (fs.existsSync(game.installPath)) {
        await this.acquireSlot();
        try {
          const fsRes = await this.calculateFolderSize(game.installPath);
          return {
            installPath: game.installPath,
            sizeBytes: fsRes.sizeBytes,
            status: fsRes.status,
            source: 'filesystem',
            updatedAt: now,
          };
        } finally {
          this.releaseSlot();
        }
      }
    }

    // 2. If it is in WindowsApps: test read accessibility safely without taking ownership
    if (game.installPath && game.installPath.toLowerCase().includes('windowsapps')) {
      try {
        // Test if directory entries can be read without elevation
        fs.readdirSync(game.installPath);
        // If readable, calculate
        await this.acquireSlot();
        try {
          const fsRes = await this.calculateFolderSize(game.installPath);
          return {
            installPath: game.installPath,
            sizeBytes: fsRes.sizeBytes,
            status: fsRes.status,
            source: 'package',
            updatedAt: now,
          };
        } finally {
          this.releaseSlot();
        }
      } catch (err: any) {
        // Protected WindowsApps access denied - do NOT fake 0 B
        return {
          installPath: game.installPath,
          sizeBytes: undefined,
          status: 'ACCESS_DENIED',
          source: 'package',
          updatedAt: now,
        };
      }
    }

    // 3. Fallback: Query AppX Package safely using PowerShell without elevation
    if (game.launcherAppId) {
      try {
        const cmd = `powershell -NoProfile -NonInteractive -Command "Get-AppxPackage -Name '*${game.launcherAppId}*' | Select-Object -First 1 -ExpandProperty InstallLocation"`;
        const { stdout } = await execAsync(cmd, { timeout: 4000 });
        const location = stdout.trim();
        if (location && fs.existsSync(location)) {
          try {
            fs.readdirSync(location);
            await this.acquireSlot();
            try {
              const fsRes = await this.calculateFolderSize(location);
              return {
                installPath: location,
                sizeBytes: fsRes.sizeBytes,
                status: fsRes.status,
                source: 'package',
                updatedAt: now,
              };
            } finally {
              this.releaseSlot();
            }
          } catch {
            return {
              installPath: location,
              sizeBytes: undefined,
              status: 'ACCESS_DENIED',
              source: 'package',
              updatedAt: now,
            };
          }
        }
      } catch {}
    }

    return {
      installPath: game.installPath,
      sizeBytes: undefined,
      status: 'UNKNOWN',
      source: 'unknown',
      updatedAt: now,
    };
  }

  /**
   * Determines the real installation root directory for a game
   * Prevents full drive scans or assuming single exe folder is the root.
   */
  private determineInstallRoot(game: Game): string | undefined {
    if (game.installPath && fs.existsSync(game.installPath)) {
      const norm = path.normalize(game.installPath);
      // Ensure it's not a root drive like "C:\" or "D:\"
      if (!/^[A-Za-z]:\\?$/.test(norm)) {
        return norm;
      }
    }

    if (game.executablePath && fs.existsSync(game.executablePath)) {
      const exeDir = path.dirname(game.executablePath);
      if (!/^[A-Za-z]:\\?$/.test(exeDir)) {
        return exeDir;
      }
    }

    return undefined;
  }

  /**
   * Recursively calculates folder size asynchronously.
   * - Protects against symlink/reparse point infinite loops
   * - Max depth limit (15 levels)
   * - Gracefully continues on individual locked files
   */
  public async calculateFolderSize(
    folderPath: string,
    maxDepth = 15
  ): Promise<{ sizeBytes?: number; status: StorageSizeStatus; source: StorageSizeSource }> {
    try {
      if (!fs.existsSync(folderPath)) {
        return { sizeBytes: undefined, status: 'UNKNOWN', source: 'unknown' };
      }

      let totalBytes = 0;
      let filesCount = 0;
      const visitedInodes = new Set<string>();

      // Queue-based BFS traversal to avoid stack overflow and yield event loop
      const queue: Array<{ dir: string; depth: number }> = [{ dir: folderPath, depth: 0 }];

      while (queue.length > 0) {
        const { dir, depth } = queue.shift()!;
        if (depth > maxDepth) continue;

        let entries: fs.Dirent[];
        try {
          entries = await fs.promises.readdir(dir, { withFileTypes: true });
        } catch (err: any) {
          if (err.code === 'EACCES' || err.code === 'EPERM') {
            // If top directory is inaccessible, return ACCESS_DENIED
            if (depth === 0) {
              return { sizeBytes: undefined, status: 'ACCESS_DENIED', source: 'filesystem' };
            }
          }
          continue;
        }

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          try {
            // Avoid symlinks and reparse points to prevent loops
            if (entry.isSymbolicLink()) continue;

            if (entry.isFile()) {
              const stat = await fs.promises.stat(fullPath);
              // Deduplicate hard links if supported
              const inodeKey = `${stat.dev}:${stat.ino}`;
              if (stat.ino && visitedInodes.has(inodeKey)) continue;
              if (stat.ino) visitedInodes.add(inodeKey);

              totalBytes += stat.size;
              filesCount++;

              // Yield event loop every 200 files
              if (filesCount % 200 === 0) {
                await new Promise((res) => setImmediate(res));
              }
            } else if (entry.isDirectory()) {
              queue.push({ dir: fullPath, depth: depth + 1 });
            }
          } catch {
            // Skip unreadable files without failing the whole calculation
          }
        }
      }

      return {
        sizeBytes: totalBytes > 0 ? totalBytes : undefined,
        status: totalBytes > 0 ? 'KNOWN' : 'UNKNOWN',
        source: 'filesystem',
      };
    } catch (err: any) {
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        return { sizeBytes: undefined, status: 'ACCESS_DENIED', source: 'filesystem' };
      }
      return { sizeBytes: undefined, status: 'UNKNOWN', source: 'unknown' };
    }
  }

  /**
   * Concurrency slot limiter
   */
  private acquireSlot(): Promise<void> {
    if (this.activeCalculations < this.maxConcurrentCalculations) {
      this.activeCalculations++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.waitQueue.push(() => {
        this.activeCalculations++;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.activeCalculations = Math.max(0, this.activeCalculations - 1);
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      next?.();
    }
  }

  /**
   * Batch resolves storage for all installed games in background
   */
  public async resolveAll(refresh = false): Promise<void> {
    const games = this.gameRepo.getAll().filter((g) => g.isInstalled);
    for (const game of games) {
      try {
        await this.resolveGameStorage(game, refresh);
      } catch (err: any) {
        console.warn(`[StorageResolver] Batch resolve error for ${game.name}:`, err.message);
      }
    }
  }
}

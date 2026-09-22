import path from 'path';
import fs from 'fs';
import { GameRepository, SettingsRepository } from '../../database/index';
import { DriveService } from '../DriveService';
import { GameCandidate, GameDetector, ScanProgress, ScanResult } from './types';

export class GameScanner {
  private detectors: Map<string, GameDetector> = new Map();
  private isScanRunning = false;
  private cancelRequested = false;
  private progressListeners: Set<(progress: ScanProgress) => void> = new Set();

  constructor(
    private gameRepo: GameRepository,
    private settingsRepo: SettingsRepository,
    private driveService: DriveService
  ) {}

  /**
   * Registers a detection module
   */
  public registerDetector(detector: GameDetector): void {
    this.detectors.set(detector.name, detector);
    console.log(`[GameScanner] Registered detector module: ${detector.name}`);
  }

  /**
   * Subscribes to real-time scan progress updates
   */
  public onProgress(listener: (progress: ScanProgress) => void): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  /**
   * Emits progress to all active listeners
   */
  private emitProgress(progress: ScanProgress): void {
    for (const listener of this.progressListeners) {
      try {
        listener(progress);
      } catch (err: any) {
        console.error('[GameScanner] Progress listener error:', err.message);
      }
    }
  }

  /**
   * Requests cancellation of the currently active scan
   */
  public cancel(): boolean {
    if (!this.isScanRunning) return false;
    this.cancelRequested = true;
    console.log('[GameScanner] Scan cancellation requested.');
    this.emitProgress({
      stage: 'cancelled',
      percent: 100,
      message: 'Cancelling scan...',
      foundCount: 0,
    });
    return true;
  }

  public isRunning(): boolean {
    return this.isScanRunning;
  }

  /**
   * Executes the full 11-step unified scanning pipeline
   */
  public async scan(customLocations?: string[]): Promise<ScanResult> {
    if (this.isScanRunning) {
      throw new Error('A game scan is already actively running.');
    }

    this.isScanRunning = true;
    this.cancelRequested = false;
    const startTime = Date.now();

    let newGamesAdded = 0;
    let existingGamesUpdated = 0;
    let missingGamesMarked = 0;
    let totalFoundCandidates = 0;
    let targetLocations: string[] = [];

    try {
      // Step 1: Initialize
      this.emitProgress({
        stage: 'initializing',
        percent: 5,
        message: 'Initializing game scanner pipeline...',
        foundCount: 0,
      });

      if (this.cancelRequested) return this.buildResult('cancelled', 0, 0, 0, 0, 0, startTime);

      // Step 2: Get Drives & Active Letters
      this.emitProgress({
        stage: 'drives',
        percent: 10,
        message: 'Discovering active storage drives...',
        foundCount: 0,
      });

      const savedDrives = this.settingsRepo.get<string[]>('scan_drives');
      const detectedDrives = await this.driveService.getAvailableDrives(savedDrives);
      const includedDrives = detectedDrives.filter((d) => d.isIncluded);
      const availableLetters = new Set(detectedDrives.map((d) => d.letter.toUpperCase()));

      // Step 3: Load Scan Locations
      this.emitProgress({
        stage: 'initializing',
        percent: 15,
        message: 'Compiling search directories...',
        foundCount: 0,
      });

      if (customLocations && customLocations.length > 0) {
        targetLocations = customLocations;
      } else {
        const locationsSet = new Set<string>();

        // Custom saved locations
        const savedLocations = this.settingsRepo.get<string[]>('scan_locations') || [
          'C:\\Games',
          'D:\\Games',
          'E:\\Games',
          'F:\\Games',
          'G:\\Games',
        ];
        for (const loc of savedLocations) {
          locationsSet.add(loc);
        }

        // Standard games roots on each active included drive
        for (const drive of includedDrives) {
          locationsSet.add(path.join(drive.mountPath, 'Games'));
          locationsSet.add(path.join(drive.mountPath, 'Game'));
          locationsSet.add(path.join(drive.mountPath, 'Installed Games'));
          locationsSet.add(path.join(drive.mountPath, 'GOG Games'));
          locationsSet.add(path.join(drive.mountPath, 'SteamLibrary'));
        }

        targetLocations = Array.from(locationsSet);
      }

      console.log(`[GameScanner] Scanning across ${targetLocations.length} target directories.`);

      // Step 4 & 5: Run Detectors & Generate Candidates
      const rawCandidates: GameCandidate[] = [];
      const activeDetectors = Array.from(this.detectors.values());
      const totalDetectors = activeDetectors.length;

      for (let i = 0; i < totalDetectors; i++) {
        if (this.cancelRequested) return this.buildResult('cancelled', targetLocations.length, 0, 0, 0, 0, startTime);

        const detector = activeDetectors[i];
        const canRun = await detector.canRun();
        if (!canRun) {
          console.log(`[GameScanner] Skipping detector: ${detector.name} (canRun returned false)`);
          continue;
        }

        const basePercent = 20 + Math.round((i / totalDetectors) * 50);

        this.emitProgress({
          stage: 'detecting',
          percent: basePercent,
          message: `Running ${detector.name}...`,
          currentDetector: detector.name,
          foundCount: rawCandidates.length,
        });

        const detected = await detector.detect(
          targetLocations,
          (info) => {
            this.emitProgress({
              stage: 'detecting',
              percent: basePercent,
              message: info.message,
              currentDetector: detector.name,
              currentPath: info.currentPath,
              foundCount: rawCandidates.length,
            });
          },
          () => this.cancelRequested
        );

        rawCandidates.push(...detected);
      }

      if (this.cancelRequested) return this.buildResult('cancelled', targetLocations.length, rawCandidates.length, 0, 0, 0, startTime);

      totalFoundCandidates = rawCandidates.length;

      // Step 6 & 7: Normalize Paths & Deduplicate Candidates
      this.emitProgress({
        stage: 'deduplicating',
        percent: 75,
        message: 'Deduplicating game candidates...',
        foundCount: totalFoundCandidates,
      });

      const deduplicatedCandidates = this.deduplicateCandidates(rawCandidates);

      // Step 8: Compare with Database
      this.emitProgress({
        stage: 'database_sync',
        percent: 85,
        message: 'Synchronizing with local database...',
        foundCount: deduplicatedCandidates.length,
      });

      const existingGames = this.gameRepo.getAll(true);
      const existingByLauncherApp = new Map<string, typeof existingGames[0]>();
      const existingByInstall = new Map<string, typeof existingGames[0]>();
      const existingByExe = new Map<string, typeof existingGames[0]>();
      const existingByName = new Map<string, Array<typeof existingGames[0]>>();

      for (const game of existingGames) {
        if (game.launcherAppId && game.launcher !== 'STANDALONE' && game.launcher !== 'UNKNOWN') {
          existingByLauncherApp.set(`${game.launcher}:${game.launcherAppId}`, game);
        }
        if (game.installPath) {
          existingByInstall.set(this.normalizePath(game.installPath), game);
        }
        if (game.executablePath) {
          existingByExe.set(this.normalizePath(game.executablePath), game);
        }
        const normN = this.normalizeName(game.name);
        if (normN) {
          if (!existingByName.has(normN)) existingByName.set(normN, []);
          existingByName.get(normN)!.push(game);
        }
      }

      // Step 9: Insert New Games & Update Existing Games using Priority Hierarchy:
      // Priority 1: Launcher ID > Priority 2: Installation Path > Priority 3: Executable Path > Priority 4: Normalized Name
      this.gameRepo.transaction(() => {
        for (const cand of deduplicatedCandidates) {
          if (this.cancelRequested) break;

        const normExe = cand.executablePath ? this.normalizePath(cand.executablePath) : '';
        const normInstall = this.normalizePath(cand.installPath);
        const candNormName = this.normalizeName(cand.name);
        const candDrive = (cand.drive || cand.installPath.slice(0, 2)).toUpperCase();

        let existing: (typeof existingGames)[0] | undefined;

        // Priority 1: Launcher ID
        if (cand.launcher && cand.launcherAppId && cand.launcher !== 'STANDALONE' && cand.launcher !== 'UNKNOWN') {
          existing = existingByLauncherApp.get(`${cand.launcher}:${cand.launcherAppId}`);
        }

        // Priority 2: Installation Path
        if (!existing && cand.installPath) {
          existing = existingByInstall.get(normInstall);
          if (!existing) {
            for (const [instPath, game] of existingByInstall.entries()) {
              if (
                (normInstall.startsWith(instPath + path.sep) || instPath.startsWith(normInstall + path.sep)) &&
                this.normalizeName(game.name) === candNormName
              ) {
                existing = game;
                break;
              }
            }
          }
        }

        // Priority 3: Executable Path
        if (!existing && normExe) {
          existing = existingByExe.get(normExe);
        }

        // Priority 4: Normalized Name
        if (!existing && candNormName) {
          const nameMatches = existingByName.get(candNormName);
          if (nameMatches && nameMatches.length > 0) {
            existing = nameMatches.find((g) => {
              const gDrive = (g.drive || (g.installPath ? g.installPath.slice(0, 2) : '')).toUpperCase();
              return !candDrive || !gDrive || candDrive === gDrive;
            });
          }
        }

        if (existing) {
          // Game already in database: verify if update is needed
          let needsUpdate = false;
          const updates: Partial<typeof existing> = {};

          // If game is not hidden, ensure isInstalled is true
          if (!existing.isHidden && !existing.isInstalled) {
            updates.isInstalled = true;
            existing.isInstalled = true;
            needsUpdate = true;
          }
          // Location updates (game moved, reinstalled in another library/drive, or updated directory):
          if (cand.executablePath && cand.executablePath !== existing.executablePath) {
            updates.executablePath = cand.executablePath;
            if (existing.executablePath) {
              existingByExe.delete(this.normalizePath(existing.executablePath));
            }
            existing.executablePath = cand.executablePath;
            existingByExe.set(normExe, existing);
            needsUpdate = true;
          }
          if (cand.installPath && cand.installPath !== existing.installPath) {
            updates.installPath = cand.installPath;
            existingByInstall.delete(this.normalizePath(existing.installPath));
            existing.installPath = cand.installPath;
            existingByInstall.set(normInstall, existing);
            needsUpdate = true;
          }
          if (candDrive && candDrive !== existing.drive) {
            updates.drive = candDrive;
            existing.drive = candDrive;
            needsUpdate = true;
          }
          if (cand.installedSize && (!existing.installedSize || existing.installedSize === 0 || existing.installedSize < cand.installedSize)) {
            updates.installedSize = cand.installedSize;
            updates.installSizeBytes = cand.installedSize;
            updates.installSizeStatus = cand.installSizeStatus || 'KNOWN';
            updates.installSizeSource = cand.installSizeSource || 'metadata';
            updates.installSizeUpdatedAt = new Date().toISOString();
            needsUpdate = true;
          }
          if (cand.coverImage && (!existing.coverImage || existing.coverImage !== cand.coverImage)) {
            updates.coverImage = cand.coverImage;
            needsUpdate = true;
          }
          if (cand.backgroundImage && (!existing.backgroundImage || existing.backgroundImage !== cand.backgroundImage)) {
            updates.backgroundImage = cand.backgroundImage;
            needsUpdate = true;
          }
          if (cand.iconPath && !existing.iconPath) {
            updates.iconPath = cand.iconPath;
            needsUpdate = true;
          }
          // Description: update if missing or if existing is a generic placeholder
          const isPlaceholderDesc =
            !existing.description ||
            existing.description.startsWith('Official Steam installation for ') ||
            existing.description.startsWith('Discovered standalone game ');
          if (cand.description && (isPlaceholderDesc || !existing.description)) {
            if (existing.description !== cand.description) {
              updates.description = cand.description;
              needsUpdate = true;
            }
          }

          // Developer: update if existing is missing or unknown
          if (cand.developer && (!existing.developer || existing.developer === 'Unknown')) {
            if (existing.developer !== cand.developer) {
              updates.developer = cand.developer;
              needsUpdate = true;
            }
          }

          // Publisher: update if existing is missing or unknown
          if (cand.publisher && (!existing.publisher || existing.publisher === 'Unknown')) {
            if (existing.publisher !== cand.publisher) {
              updates.publisher = cand.publisher;
              needsUpdate = true;
            }
          }

          // Genre: update if existing is missing or was heuristic engine name
          const isEngineOrGenericGenre =
            !existing.genre ||
            existing.genre === 'Unity' ||
            existing.genre === 'Unreal Engine' ||
            existing.genre === 'Standard Executable' ||
            existing.genre === 'Game';
          if (cand.genre && (isEngineOrGenericGenre || !existing.genre)) {
            if (existing.genre !== cand.genre) {
              updates.genre = cand.genre;
              needsUpdate = true;
            }
          }

          // Release Date: update if existing is missing or unknown
          if (cand.releaseDate && (!existing.releaseDate || existing.releaseDate === 'Unknown')) {
            if (existing.releaseDate !== cand.releaseDate) {
              updates.releaseDate = cand.releaseDate;
              needsUpdate = true;
            }
          }
          // Upgrade launcher from STANDALONE to Official Launcher
          if (
            (!existing.launcher || existing.launcher === 'STANDALONE' || existing.launcher === 'UNKNOWN') &&
            cand.launcher &&
            cand.launcher !== 'STANDALONE' &&
            cand.launcher !== 'UNKNOWN'
          ) {
            updates.launcher = cand.launcher;
            needsUpdate = true;
          }
          if (!existing.launcherAppId && cand.launcherAppId) {
            updates.launcherAppId = cand.launcherAppId;
            needsUpdate = true;
          }
          if (cand.totalPlayTime && (!existing.totalPlayTime || existing.totalPlayTime < cand.totalPlayTime)) {
            updates.totalPlayTime = cand.totalPlayTime;
            needsUpdate = true;
          }
          if (cand.lastPlayedAt && (!existing.lastPlayedAt || new Date(cand.lastPlayedAt) > new Date(existing.lastPlayedAt))) {
            updates.lastPlayedAt = cand.lastPlayedAt;
            needsUpdate = true;
          }

          if (needsUpdate) {
            this.gameRepo.update(existing.id, updates);
            existingGamesUpdated++;
          }
        } else {
          // Only automatically add high confidence candidates (>= 80%)
          if (cand.confidence >= 80) {
            const created = this.gameRepo.create({
              name: cand.name,
              launcher: cand.launcher,
              launcherAppId: cand.launcherAppId,
              executablePath: cand.executablePath,
              installPath: cand.installPath,
              coverImage: cand.coverImage,
              backgroundImage: cand.backgroundImage,
              iconPath: cand.iconPath,
              description: cand.description,
              developer: cand.developer,
              publisher: cand.publisher,
              genre: cand.genre,
              installedSize: cand.installedSize || cand.installSizeBytes || 0,
              installSizeBytes: cand.installedSize || cand.installSizeBytes || 0,
              installSizeStatus: cand.installSizeStatus || (cand.installedSize ? 'KNOWN' : 'UNKNOWN'),
              installSizeSource: cand.installSizeSource || (cand.installedSize ? 'metadata' : 'unknown'),
              installSizeUpdatedAt: (cand.installedSize || cand.installSizeBytes) ? new Date().toISOString() : undefined,
              isInstalled: true,
              isManual: false,
              totalPlayTime: cand.totalPlayTime || 0,
              lastPlayedAt: cand.lastPlayedAt,
              drive: cand.drive || cand.installPath.slice(0, 2).toUpperCase(),
            });
            newGamesAdded++;

            // Register in in-memory lookup maps to prevent intra-scan duplicates
            if (created.launcherAppId && created.launcher !== 'STANDALONE' && created.launcher !== 'UNKNOWN') {
              existingByLauncherApp.set(`${created.launcher}:${created.launcherAppId}`, created);
            }
            if (created.installPath) {
              existingByInstall.set(this.normalizePath(created.installPath), created);
            }
            if (created.executablePath) {
              existingByExe.set(this.normalizePath(created.executablePath), created);
            }
            const normN = this.normalizeName(created.name);
            if (normN) {
              if (!existingByName.has(normN)) existingByName.set(normN, []);
              existingByName.get(normN)!.push(created);
            }
          }
        }
      }
    });

      if (this.cancelRequested) return this.buildResult('cancelled', targetLocations.length, totalFoundCandidates, newGamesAdded, existingGamesUpdated, 0, startTime);

      // Step 10: Mark Missing Games (Safely)
      this.emitProgress({
        stage: 'database_sync',
        percent: 95,
        message: 'Validating disk accessibility for installed games...',
        foundCount: totalFoundCandidates,
      });

      const allCurrentGames = this.gameRepo.getAll();
      for (const game of allCurrentGames) {
        const gameDrive = (game.drive || (game.installPath ? game.installPath.slice(0, 2) : 'C:')).toUpperCase();
        // If the drive is currently connected to the PC:
        if (availableLetters.has(gameDrive)) {
          let exists = false;
          if (game.executablePath) {
            if (fs.existsSync(game.executablePath)) {
              exists = true;
            } else if (game.launcher === 'STEAM' && game.launcherAppId && game.installPath) {
              const steamappsDir = path.resolve(game.installPath, '..', '..');
              const acfPath = path.join(steamappsDir, `appmanifest_${game.launcherAppId}.acf`);
              if (fs.existsSync(acfPath)) {
                exists = true;
              }
            }
          } else if (game.installPath) {
            if (fs.existsSync(game.installPath)) {
              try {
                const files = fs.readdirSync(game.installPath);
                exists = files.length > 0;
              } catch {
                // Inaccessible folder (e.g. protected WindowsApps) - if it exists on disk, treat as installed
                exists = true;
              }
            }
          }

          // Path is on an active connected drive but files were deleted or moved
          if (game.isInstalled && !exists) {
            this.gameRepo.update(game.id, { isInstalled: false });
            missingGamesMarked++;
          } else if (!game.isInstalled && exists) {
            // Files have returned or were reinstalled in original location
            this.gameRepo.update(game.id, { isInstalled: true });
            existingGamesUpdated++;
          }
        }
      }

      // Step 11: Finish
      const result = this.buildResult(
        'complete',
        targetLocations.length,
        totalFoundCandidates,
        newGamesAdded,
        existingGamesUpdated,
        missingGamesMarked,
        startTime
      );

      this.emitProgress({
        stage: 'complete',
        percent: 100,
        message: `Scan complete. Found ${totalFoundCandidates} games (${newGamesAdded} new added).`,
        foundCount: totalFoundCandidates,
      });

      return result;
    } catch (err: any) {
      console.error('[GameScanner] Pipeline encountered fatal error:', err);
      this.emitProgress({
        stage: 'error',
        percent: 100,
        message: `Scan failed: ${err.message}`,
        foundCount: 0,
      });
      return this.buildResult('error', targetLocations.length, 0, 0, 0, 0, startTime, err.message);
    } finally {
      this.isScanRunning = false;
      this.cancelRequested = false;
    }
  }

  /**
   * Normalizes path slashes and casing for comparisons
   */
  private normalizePath(p: string): string {
    return path.resolve(p).toLowerCase();
  }

  /**
   * Normalizes game title by stripping trademark symbols, punctuation, and extra whitespace
   */
  public normalizeName(name: string): string {
    return (name || '')
      .toLowerCase()
      .replace(/[™®©]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Deduplicates candidates using the strict 4-level priority hierarchy:
   * Priority 1: Launcher ID
   * Priority 2: Installation Path
   * Priority 3: Executable Path
   * Priority 4: Normalized Name
   */
  private deduplicateCandidates(candidates: GameCandidate[]): GameCandidate[] {
    const accepted: GameCandidate[] = [];

    for (const cand of candidates) {
      const matchIndex = this.findMatchingCandidateIndex(accepted, cand);
      if (matchIndex >= 0) {
        // Merge into the existing candidate respecting priority
        accepted[matchIndex] = this.mergeCandidates(accepted[matchIndex], cand);
      } else {
        accepted.push(cand);
      }
    }

    return accepted;
  }

  /**
   * Finds matching candidate index based on strict priority:
   * Priority 1: Launcher ID
   * Priority 2: Installation Path
   * Priority 3: Executable Path
   * Priority 4: Normalized Name
   */
  private findMatchingCandidateIndex(list: GameCandidate[], cand: GameCandidate): number {
    const candNormInstall = this.normalizePath(cand.installPath);
    const candNormExe = cand.executablePath ? this.normalizePath(cand.executablePath) : '';
    const candNormName = this.normalizeName(cand.name);
    const candDrive = (cand.drive || cand.installPath.slice(0, 2)).toUpperCase();

    // Priority 1: Launcher ID (Match official launcher + launcherAppId)
    if (cand.launcher && cand.launcherAppId && cand.launcher !== 'STANDALONE' && cand.launcher !== 'UNKNOWN') {
      const idx = list.findIndex(
        (item) => item.launcher === cand.launcher && item.launcherAppId === cand.launcherAppId
      );
      if (idx >= 0) return idx;
    }

    // Priority 2: Installation Path
    if (cand.installPath) {
      const idx = list.findIndex((item) => {
        const itemInstall = this.normalizePath(item.installPath);
        if (itemInstall === candNormInstall) return true;
        // Check if one installPath is a subfolder of another within 1 level (e.g. game root vs bin folder)
        if (
          (candNormInstall.startsWith(itemInstall + path.sep) || itemInstall.startsWith(candNormInstall + path.sep)) &&
          this.normalizeName(item.name) === candNormName
        ) {
          return true;
        }
        return false;
      });
      if (idx >= 0) return idx;
    }

    // Priority 3: Executable Path
    if (candNormExe) {
      const idx = list.findIndex(
        (item) => item.executablePath && this.normalizePath(item.executablePath) === candNormExe
      );
      if (idx >= 0) return idx;
    }

    // Priority 4: Normalized Name
    if (candNormName) {
      const idx = list.findIndex((item) => {
        if (this.normalizeName(item.name) !== candNormName) return false;
        const itemDrive = (item.drive || item.installPath.slice(0, 2)).toUpperCase();
        if (candDrive && itemDrive && candDrive === itemDrive) return true;
        return false;
      });
      if (idx >= 0) return idx;
    }

    return -1;
  }

  /**
   * Merges two candidate records, prioritizing official launchers and richer metadata
   */
  private mergeCandidates(existing: GameCandidate, incoming: GameCandidate): GameCandidate {
    const isIncomingOfficial = incoming.launcher !== 'STANDALONE' && incoming.launcher !== 'UNKNOWN';
    const isExistingOfficial = existing.launcher !== 'STANDALONE' && existing.launcher !== 'UNKNOWN';

    let primary = existing;
    let secondary = incoming;

    if (isIncomingOfficial && !isExistingOfficial) {
      primary = incoming;
      secondary = existing;
    } else if (!isIncomingOfficial && isExistingOfficial) {
      primary = existing;
      secondary = incoming;
    } else if (incoming.confidence > existing.confidence) {
      primary = incoming;
      secondary = existing;
    }

    return {
      name: (primary.name && primary.name.length > 2) ? primary.name : secondary.name,
      launcher: isIncomingOfficial || isExistingOfficial
        ? (isIncomingOfficial ? incoming.launcher : existing.launcher)
        : primary.launcher,
      launcherAppId: primary.launcherAppId || secondary.launcherAppId,
      executablePath: primary.executablePath || secondary.executablePath,
      installPath: primary.installPath || secondary.installPath,
      confidence: Math.max(primary.confidence, secondary.confidence),
      drive: primary.drive || secondary.drive,
      iconPath: primary.iconPath || secondary.iconPath,
      coverImage: primary.coverImage || secondary.coverImage,
      backgroundImage: primary.backgroundImage || secondary.backgroundImage,
      description: primary.description || secondary.description,
      developer: primary.developer || secondary.developer,
      publisher: primary.publisher || secondary.publisher,
      genre: primary.genre || secondary.genre,
      releaseDate: primary.releaseDate || secondary.releaseDate,
      installedSize: Math.max(primary.installedSize || 0, secondary.installedSize || 0) || undefined,
      totalPlayTime: Math.max(primary.totalPlayTime || 0, secondary.totalPlayTime || 0) || undefined,
      lastPlayedAt: primary.lastPlayedAt || secondary.lastPlayedAt,
    };
  }

  private buildResult(
    status: ScanResult['status'],
    scannedLocationsCount: number,
    totalFoundCandidates: number,
    newGamesAdded: number,
    existingGamesUpdated: number,
    missingGamesMarked: number,
    startTime: number,
    error?: string
  ): ScanResult {
    return {
      status,
      scannedLocationsCount,
      totalFoundCandidates,
      newGamesAdded,
      existingGamesUpdated,
      missingGamesMarked,
      durationMs: Date.now() - startTime,
      error,
    };
  }
}

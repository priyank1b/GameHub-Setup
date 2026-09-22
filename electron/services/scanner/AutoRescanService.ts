import { BrowserWindow } from 'electron';
import { GameScanner } from './GameScanner';
import { SettingsRepository } from '../../database/index';
import { ScanResult } from './types';

export interface AutoRescanStatus {
  enabled: boolean;
  intervalMinutes: number;
  lastScanTime?: string;
  nextScanTime?: string;
  isScanning: boolean;
}

export class AutoRescanService {
  private timer: NodeJS.Timeout | null = null;
  private isEnabled = false;
  private intervalMinutes = 60;
  private lastScanTime?: string;
  private nextScanTime?: string;

  public static readonly SUPPORTED_INTERVALS = [15, 30, 60, 120, 360, 720, 1440];

  constructor(
    private gameScanner: GameScanner,
    private settingsRepo: SettingsRepository
  ) {}

  /**
   * Initializes AutoRescanService on Electron app ready lifecycle
   */
  public initialize(): void {
    const savedEnabled = this.settingsRepo.get<boolean>('auto_rescan_enabled', false) ?? false;
    const savedInterval = this.settingsRepo.get<number>('auto_rescan_interval_minutes', 60) ?? 60;
    const validInterval = AutoRescanService.SUPPORTED_INTERVALS.includes(savedInterval)
      ? savedInterval
      : 60;

    this.isEnabled = savedEnabled;
    this.intervalMinutes = validInterval;

    console.log(
      `[AutoRescanService] Initializing: enabled=${this.isEnabled}, interval=${this.intervalMinutes}m`
    );

    if (this.isEnabled) {
      this.startTimer();
    }
  }

  /**
   * Starts a fresh session timer
   */
  private startTimer(): void {
    this.clearTimer();

    const intervalMs = this.intervalMinutes * 60 * 1000;
    const nextDate = new Date(Date.now() + intervalMs);
    this.nextScanTime = nextDate.toISOString();

    console.log(
      `[AutoRescanService] Scheduled next auto-rescan in ${this.intervalMinutes} minutes at ${this.nextScanTime}`
    );
    this.broadcastStatus();

    this.timer = setTimeout(async () => {
      await this.executeScheduledScan();
    }, intervalMs);
  }

  /**
   * Clears the current active timer
   */
  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.nextScanTime = undefined;
  }

  /**
   * Executes the scheduled scan with strict concurrency collision protection
   */
  public async executeScheduledScan(): Promise<ScanResult | null> {
    if (this.gameScanner.isRunning()) {
      console.warn('[AutoRescanService] Active scan already in progress. Skipping scheduled cycle.');
      // Re-schedule for next interval without queueing a duplicate
      if (this.isEnabled) {
        this.startTimer();
      }
      return null;
    }

    console.log('[AutoRescanService] Executing scheduled automatic library rescan...');
    this.broadcastStatus();

    try {
      const result = await this.gameScanner.scan();
      this.lastScanTime = new Date().toISOString();

      const hasChanges =
        result.newGamesAdded > 0 ||
        result.missingGamesMarked > 0 ||
        result.existingGamesUpdated > 0;

      if (hasChanges) {
        console.log(
          `[AutoRescanService] Auto-rescan complete: ${result.newGamesAdded} new, ${result.missingGamesMarked} missing, ${result.existingGamesUpdated} updated.`
        );
        this.broadcastNewGames(result.newGamesAdded, result.missingGamesMarked);
      } else {
        console.log('[AutoRescanService] Auto-rescan complete: Library is up to date.');
      }

      return result;
    } catch (err: any) {
      console.error('[AutoRescanService] Scheduled scan failed:', err.message);
      return null;
    } finally {
      // If still enabled, start next interval timer
      if (this.isEnabled) {
        this.startTimer();
      } else {
        this.broadcastStatus();
      }
    }
  }

  /**
   * Updates configuration from Settings UI
   */
  public setConfig(enabled: boolean, intervalMinutes?: number): AutoRescanStatus {
    const wasEnabled = this.isEnabled;
    const prevInterval = this.intervalMinutes;

    this.isEnabled = enabled;
    this.settingsRepo.set('auto_rescan_enabled', enabled);

    if (intervalMinutes !== undefined && AutoRescanService.SUPPORTED_INTERVALS.includes(intervalMinutes)) {
      this.intervalMinutes = intervalMinutes;
      this.settingsRepo.set('auto_rescan_interval_minutes', intervalMinutes);
    }

    if (this.isEnabled) {
      // If newly enabled, or interval changed while enabled: restart fresh timer
      if (!wasEnabled || prevInterval !== this.intervalMinutes) {
        this.startTimer();
      }
    } else {
      // If disabled: clear immediately
      this.clearTimer();
    }

    this.broadcastStatus();
    return this.getStatus();
  }

  /**
   * Resets the timer countdown starting from now (e.g. after a manual scan)
   */
  public resetTimerFromNow(): void {
    if (this.isEnabled) {
      console.log('[AutoRescanService] Manual scan activity detected. Resetting timer countdown.');
      this.lastScanTime = new Date().toISOString();
      this.startTimer();
    }
  }

  public getStatus(): AutoRescanStatus {
    return {
      enabled: this.isEnabled,
      intervalMinutes: this.intervalMinutes,
      lastScanTime: this.lastScanTime,
      nextScanTime: this.nextScanTime,
      isScanning: this.gameScanner.isRunning(),
    };
  }

  /**
   * Cleans up on application exit
   */
  public dispose(): void {
    this.clearTimer();
  }

  private broadcastStatus(): void {
    const status = this.getStatus();
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      try {
        if (!win.isDestroyed()) {
          win.webContents.send('scanner:autoRescanStatus', status);
        }
      } catch {}
    }
  }

  private broadcastNewGames(count: number, missingCount: number = 0): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      try {
        if (!win.isDestroyed()) {
          win.webContents.send('scanner:newGamesDiscovered', { count, missingCount });
        }
      } catch {}
    }
  }
}

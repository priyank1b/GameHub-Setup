import fs from 'fs';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export type DriveTypeCategory = 'FIXED' | 'REMOVABLE' | 'NETWORK' | 'CDROM' | 'UNKNOWN';

export interface WindowsDrive {
  letter: string;          // "C:"
  name: string;            // Volume label or descriptive name
  mountPath: string;       // "C:\"
  totalBytes: number;
  availableBytes: number;
  usedBytes: number;
  usedPercent: number;
  driveType: DriveTypeCategory;
  isAvailable: boolean;
  isIncluded: boolean;
}

export class DriveService {
  private cachedLabels: Map<string, { label: string; driveType: DriveTypeCategory }> = new Map();
  private lastLabelQueryTime = 0;

  /**
   * Detects all currently available drives on the Windows PC
   */
  public async getAvailableDrives(includedDriveLetters?: string[]): Promise<WindowsDrive[]> {
    // Refresh drive labels if cache is older than 30s
    if (Date.now() - this.lastLabelQueryTime > 30000 || this.cachedLabels.size === 0) {
      await this.refreshDriveLabels();
    }

    const drives: WindowsDrive[] = [];
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    for (const char of letters) {
      const letter = `${char}:`;
      const mountPath = `${letter}\\`;

      try {
        // Fast, non-blocking check if root directory is accessible
        if (!fs.existsSync(mountPath)) {
          continue;
        }

        const stat = fs.statfsSync(mountPath);
        const totalBytes = Number(stat.bsize) * Number(stat.blocks);
        const availableBytes = Number(stat.bsize) * Number(stat.bavail);
        const usedBytes = Math.max(0, totalBytes - availableBytes);
        const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

        const info = this.cachedLabels.get(letter);
        let name = info?.label;
        if (!name || name.trim() === '') {
          name = letter === 'C:' ? 'Windows System Drive' : `Local Disk (${letter})`;
        }

        const isIncluded = includedDriveLetters
          ? includedDriveLetters.includes(letter)
          : true; // Enabled by default

        drives.push({
          letter,
          name,
          mountPath,
          totalBytes,
          availableBytes,
          usedBytes,
          usedPercent,
          driveType: info?.driveType || 'FIXED',
          isAvailable: true,
          isIncluded,
        });
      } catch (err: any) {
        // Drive not available, disconnected, or permission denied - safe skip
        // This ensures disconnected drives NEVER crash the application
      }
    }

    return drives;
  }

  /**
   * Safely checks a specific drive's accessibility
   */
  public isDriveAvailable(driveLetter: string): boolean {
    const cleanLetter = driveLetter.slice(0, 2).toUpperCase();
    const mountPath = `${cleanLetter}\\`;
    try {
      if (!fs.existsSync(mountPath)) return false;
      fs.statfsSync(mountPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Enriches drives with volume labels using Windows CIM
   */
  private async refreshDriveLabels(): Promise<void> {
    try {
      const command = `powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, VolumeName, DriveType | ConvertTo-Json -Compress"`;
      const { stdout } = await execAsync(command, { timeout: 4000 });
      if (!stdout || stdout.trim() === '') return;

      const parsed = JSON.parse(stdout.trim());
      const disks = Array.isArray(parsed) ? parsed : [parsed];

      this.cachedLabels.clear();
      for (const d of disks) {
        if (!d.DeviceID) continue;
        const letter = String(d.DeviceID).toUpperCase();
        let driveType: DriveTypeCategory = 'FIXED';
        if (d.DriveType === 2) driveType = 'REMOVABLE';
        else if (d.DriveType === 3) driveType = 'FIXED';
        else if (d.DriveType === 4) driveType = 'NETWORK';
        else if (d.DriveType === 5) driveType = 'CDROM';

        this.cachedLabels.set(letter, {
          label: d.VolumeName || '',
          driveType,
        });
      }
      this.lastLabelQueryTime = Date.now();
    } catch {
      // Fallback gracefully without throwing
    }
  }
}

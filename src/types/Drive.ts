export type DriveTypeCategory = 'FIXED' | 'REMOVABLE' | 'NETWORK' | 'CDROM' | 'UNKNOWN';

export interface WindowsDrive {
  letter: string;
  name: string;
  mountPath: string;
  totalBytes: number;
  availableBytes: number;
  usedBytes: number;
  usedPercent: number;
  driveType: DriveTypeCategory;
  isAvailable: boolean;
  isIncluded: boolean;
}

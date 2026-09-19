import { Database } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { getDatabasePath, getDatabase, initDatabase, closeDatabase } from '../database/database';
import { Logger } from './Logger';

export interface IntegrityCheckResult {
  ok: boolean;
  errors: string[];
}

export interface RepairResult {
  success: boolean;
  actionTaken: 'vacuum_reindex' | 'restored_from_backup' | 'recreated_fresh';
  backupCreated?: string;
  message: string;
}

export class DatabaseRecoveryService {
  /**
   * Creates a safety backup of the current database file.
   */
  public static backupDatabase(): { success: boolean; backupPath?: string; error?: string } {
    try {
      const dbPath = getDatabasePath();
      if (!fs.existsSync(dbPath)) {
        return { success: false, error: 'Database file does not exist.' };
      }

      const backupDir = path.dirname(dbPath);
      const backupPath = path.join(backupDir, 'gamehub.db.backup');
      fs.copyFileSync(dbPath, backupPath);

      Logger.info('DatabaseRecovery', `Database safety backup created at: ${backupPath}`);
      return { success: true, backupPath };
    } catch (err: any) {
      Logger.error('DatabaseRecovery', `Failed to create database backup: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Executes PRAGMA integrity_check against the current database.
   */
  public static checkIntegrity(db?: Database): IntegrityCheckResult {
    try {
      const targetDb = db || getDatabase();
      const rows = targetDb.pragma('integrity_check') as Array<{ integrity_check: string }>;
      const errors = rows
        .map((r) => r.integrity_check)
        .filter((msg) => msg.toLowerCase() !== 'ok');

      return {
        ok: errors.length === 0,
        errors,
      };
    } catch (err: any) {
      Logger.error('DatabaseRecovery', `Integrity check failed with error: ${err.message}`);
      return {
        ok: false,
        errors: [err.message],
      };
    }
  }

  /**
   * Repairs and optimizes the SQLite database:
   * - If healthy: executes VACUUM and REINDEX to optimize storage and rebuild indices.
   * - If corrupt: archives corrupt db to gamehub.db.corrupt.<timestamp>, restores from backup if valid, or recovers fresh.
   */
  public static repairDatabase(): RepairResult {
    Logger.info('DatabaseRecovery', 'Initiating database repair & recovery procedure...');
    const dbPath = getDatabasePath();

    // 1. Check existing integrity
    let currentDb: Database | null = null;
    try {
      currentDb = getDatabase();
    } catch (e) {
      // Database failed to even open
    }

    const integrity = currentDb ? this.checkIntegrity(currentDb) : { ok: false, errors: ['Failed to open DB'] };

    if (integrity.ok && currentDb) {
      try {
        Logger.info('DatabaseRecovery', 'Database integrity check passed. Executing VACUUM & REINDEX...');
        currentDb.exec('REINDEX;');
        currentDb.exec('VACUUM;');

        // Create safety backup of healthy state
        this.backupDatabase();

        return {
          success: true,
          actionTaken: 'vacuum_reindex',
          message: 'Database integrity verified. Tables reindexed and vacuumed successfully.',
        };
      } catch (err: any) {
        Logger.warn('DatabaseRecovery', `REINDEX/VACUUM encountered issue: ${err.message}`);
      }
    }

    // 2. Database is corrupted or failed to open -> Execute Safe Recovery
    Logger.warn('DatabaseRecovery', 'Database corruption detected! Preserving corrupt file and restoring...');

    // Close active database handle
    closeDatabase();

    const timestamp = Date.now();
    const corruptArchive = `${dbPath}.corrupt.${timestamp}`;
    if (fs.existsSync(dbPath)) {
      try {
        fs.renameSync(dbPath, corruptArchive);
        Logger.warn('DatabaseRecovery', `Archived corrupted database to: ${corruptArchive}`);
      } catch (e: any) {
        fs.copyFileSync(dbPath, corruptArchive);
      }
    }

    // Check if safety backup exists and is healthy
    const backupPath = path.join(path.dirname(dbPath), 'gamehub.db.backup');
    let restoredFromBackup = false;

    if (fs.existsSync(backupPath)) {
      try {
        fs.copyFileSync(backupPath, dbPath);
        const restoredDb = initDatabase(dbPath);
        const check = this.checkIntegrity(restoredDb);
        if (check.ok) {
          restoredFromBackup = true;
          Logger.info('DatabaseRecovery', 'Successfully restored healthy database from backup.');
        } else {
          closeDatabase();
          if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        }
      } catch (err: any) {
        Logger.error('DatabaseRecovery', `Failed to restore backup: ${err.message}`);
      }
    }

    if (restoredFromBackup) {
      return {
        success: true,
        actionTaken: 'restored_from_backup',
        backupCreated: corruptArchive,
        message: 'Corrupted database was archived, and healthy database was restored from backup.',
      };
    }

    // 3. Fallback: Re-create fresh database with schema migrations
    Logger.info('DatabaseRecovery', 'Creating fresh database with standard schema migrations...');
    const freshDb = initDatabase(dbPath);
    this.backupDatabase();

    return {
      success: true,
      actionTaken: 'recreated_fresh',
      backupCreated: corruptArchive,
      message: 'Corrupted database archived safely. Fresh database initialized and migrated.',
    };
  }
}

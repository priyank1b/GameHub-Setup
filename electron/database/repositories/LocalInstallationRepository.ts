import { Database } from 'better-sqlite3';
import {
  LocalInstallation,
  LocalInstallationStatus,
} from '../../../src/types/LauncherAccount';
import { GameLauncher } from '../../../src/types/Launcher';
import { StorageSizeStatus, StorageSizeSource } from '../../../src/types/Game';

export class LocalInstallationRepository {
  constructor(private db: Database) {}

  public getAll(): LocalInstallation[] {
    const stmt = this.db.prepare('SELECT * FROM local_installations');
    const rows = stmt.all() as any[];
    return rows.map(this.mapRowToInstallation);
  }

  public getByCanonicalId(canonicalGameId: number): LocalInstallation[] {
    const stmt = this.db.prepare(
      'SELECT * FROM local_installations WHERE canonical_game_id = ?'
    );
    const rows = stmt.all(canonicalGameId) as any[];
    return rows.map(this.mapRowToInstallation);
  }

  public getById(id: number): LocalInstallation | null {
    const stmt = this.db.prepare('SELECT * FROM local_installations WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapRowToInstallation(row) : null;
  }

  public getByInstallPath(installPath: string): LocalInstallation | null {
    const stmt = this.db.prepare(
      'SELECT * FROM local_installations WHERE install_path = ?'
    );
    const row = stmt.get(installPath) as any;
    return row ? this.mapRowToInstallation(row) : null;
  }

  public create(
    installation: Omit<LocalInstallation, 'id' | 'createdAt' | 'updatedAt'>
  ): LocalInstallation {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO local_installations (
        canonical_game_id, launcher_game_entry_id, launcher_account_id,
        install_path, executable_path, launcher, install_size_bytes,
        install_size_status, install_size_source, status,
        last_verified_at, created_at, updated_at
      ) VALUES (
        @canonical_game_id, @launcher_game_entry_id, @launcher_account_id,
        @install_path, @executable_path, @launcher, @install_size_bytes,
        @install_size_status, @install_size_source, @status,
        @last_verified_at, @created_at, @updated_at
      )
    `);

    const result = stmt.run({
      canonical_game_id: installation.canonicalGameId,
      launcher_game_entry_id: installation.launcherGameEntryId || null,
      launcher_account_id: installation.launcherAccountId || null,
      install_path: installation.installPath || null,
      executable_path: installation.executablePath || null,
      launcher: installation.launcher,
      install_size_bytes: installation.installSizeBytes || 0,
      install_size_status: installation.installSizeStatus || 'UNKNOWN',
      install_size_source: installation.installSizeSource || 'unknown',
      status: installation.status || 'INSTALLED',
      last_verified_at: installation.lastVerifiedAt || now,
      created_at: now,
      updated_at: now,
    });

    return this.getById(Number(result.lastInsertRowid))!;
  }

  public update(
    id: number,
    updates: Partial<Omit<LocalInstallation, 'id' | 'createdAt'>>
  ): LocalInstallation | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: Record<string, any> = { id, updated_at: now };

    if (updates.installPath !== undefined) {
      fields.push('install_path = @install_path');
      values.install_path = updates.installPath || null;
    }
    if (updates.executablePath !== undefined) {
      fields.push('executable_path = @executable_path');
      values.executable_path = updates.executablePath || null;
    }
    if (updates.installSizeBytes !== undefined) {
      fields.push('install_size_bytes = @install_size_bytes');
      values.install_size_bytes = updates.installSizeBytes;
    }
    if (updates.installSizeStatus !== undefined) {
      fields.push('install_size_status = @install_size_status');
      values.install_size_status = updates.installSizeStatus;
    }
    if (updates.installSizeSource !== undefined) {
      fields.push('install_size_source = @install_size_source');
      values.install_size_source = updates.installSizeSource;
    }
    if (updates.status !== undefined) {
      fields.push('status = @status');
      values.status = updates.status;
    }
    if (updates.lastVerifiedAt !== undefined) {
      fields.push('last_verified_at = @last_verified_at');
      values.last_verified_at = updates.lastVerifiedAt;
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = @updated_at');
    const sql = `UPDATE local_installations SET ${fields.join(', ')} WHERE id = @id`;
    this.db.prepare(sql).run(values);

    return this.getById(id);
  }

  public delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM local_installations WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  private mapRowToInstallation(row: any): LocalInstallation {
    return {
      id: row.id,
      canonicalGameId: row.canonical_game_id,
      launcherGameEntryId: row.launcher_game_entry_id || undefined,
      launcherAccountId: row.launcher_account_id || undefined,
      installPath: row.install_path || undefined,
      executablePath: row.executable_path || undefined,
      launcher: row.launcher as GameLauncher,
      installSizeBytes: row.install_size_bytes,
      installSizeStatus: row.install_size_status as StorageSizeStatus,
      installSizeSource: row.install_size_source as StorageSizeSource,
      status: row.status as LocalInstallationStatus,
      lastVerifiedAt: row.last_verified_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

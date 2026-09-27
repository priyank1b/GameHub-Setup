import { Database } from 'better-sqlite3';
import {
  LauncherAccount,
  AccountConnectionStatus,
  AccountSyncStatus,
} from '../../../src/types/LauncherAccount';
import { GameLauncher } from '../../../src/types/Launcher';

export class LauncherAccountRepository {
  constructor(private db: Database) {}

  public getAll(): LauncherAccount[] {
    const stmt = this.db.prepare(
      'SELECT * FROM launcher_accounts ORDER BY launcher ASC, display_name COLLATE NOCASE ASC'
    );
    const rows = stmt.all() as any[];
    return rows.map(this.mapRowToAccount);
  }

  public getById(id: number): LauncherAccount | null {
    const stmt = this.db.prepare('SELECT * FROM launcher_accounts WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapRowToAccount(row) : null;
  }

  public getByLauncherAndExternalId(
    launcher: GameLauncher,
    externalAccountId: string
  ): LauncherAccount | null {
    const stmt = this.db.prepare(
      'SELECT * FROM launcher_accounts WHERE launcher = ? AND external_account_id = ?'
    );
    const row = stmt.get(launcher, externalAccountId) as any;
    return row ? this.mapRowToAccount(row) : null;
  }

  public create(
    account: Omit<LauncherAccount, 'id' | 'createdAt' | 'updatedAt'>
  ): LauncherAccount {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO launcher_accounts (
        launcher, external_account_id, display_name, avatar_url,
        connection_status, last_connected_at, last_synced_at,
        sync_status, sync_error_message, created_at, updated_at
      ) VALUES (
        @launcher, @external_account_id, @display_name, @avatar_url,
        @connection_status, @last_connected_at, @last_synced_at,
        @sync_status, @sync_error_message, @created_at, @updated_at
      )
    `);

    const result = stmt.run({
      launcher: account.launcher,
      external_account_id: account.externalAccountId,
      display_name: account.displayName,
      avatar_url: account.avatarUrl || null,
      connection_status: account.connectionStatus || 'CONNECTED',
      last_connected_at: account.lastConnectedAt || now,
      last_synced_at: account.lastSyncedAt || null,
      sync_status: account.syncStatus || 'IDLE',
      sync_error_message: account.syncErrorMessage || null,
      created_at: now,
      updated_at: now,
    });

    return this.getById(Number(result.lastInsertRowid))!;
  }

  public update(
    id: number,
    updates: Partial<Omit<LauncherAccount, 'id' | 'createdAt'>>
  ): LauncherAccount | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: Record<string, any> = { id, updated_at: now };

    if (updates.displayName !== undefined) {
      fields.push('display_name = @display_name');
      values.display_name = updates.displayName;
    }
    if (updates.avatarUrl !== undefined) {
      fields.push('avatar_url = @avatar_url');
      values.avatar_url = updates.avatarUrl || null;
    }
    if (updates.connectionStatus !== undefined) {
      fields.push('connection_status = @connection_status');
      values.connection_status = updates.connectionStatus;
    }
    if (updates.lastConnectedAt !== undefined) {
      fields.push('last_connected_at = @last_connected_at');
      values.last_connected_at = updates.lastConnectedAt;
    }
    if (updates.lastSyncedAt !== undefined) {
      fields.push('last_synced_at = @last_synced_at');
      values.last_synced_at = updates.lastSyncedAt;
    }
    if (updates.syncStatus !== undefined) {
      fields.push('sync_status = @sync_status');
      values.sync_status = updates.syncStatus;
    }
    if (updates.syncErrorMessage !== undefined) {
      fields.push('sync_error_message = @sync_error_message');
      values.sync_error_message = updates.syncErrorMessage || null;
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = @updated_at');
    const sql = `UPDATE launcher_accounts SET ${fields.join(', ')} WHERE id = @id`;
    this.db.prepare(sql).run(values);

    return this.getById(id);
  }

  public updateSyncStatus(
    id: number,
    status: AccountSyncStatus,
    errorMessage?: string
  ): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE launcher_accounts
      SET sync_status = ?,
          sync_error_message = ?,
          last_synced_at = CASE WHEN ? = 'SUCCESS' THEN ? ELSE last_synced_at END,
          updated_at = ?
      WHERE id = ?
    `);
    stmt.run(status, errorMessage || null, status, now, now, id);
  }

  public delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM launcher_accounts WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  private mapRowToAccount(row: any): LauncherAccount {
    return {
      id: row.id,
      launcher: row.launcher as GameLauncher,
      externalAccountId: row.external_account_id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url || undefined,
      connectionStatus: row.connection_status as AccountConnectionStatus,
      lastConnectedAt: row.last_connected_at || undefined,
      lastSyncedAt: row.last_synced_at || undefined,
      syncStatus: row.sync_status as AccountSyncStatus,
      syncErrorMessage: row.sync_error_message || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

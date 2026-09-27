import { Database } from 'better-sqlite3';
import { LauncherGameEntry } from '../../../src/types/LauncherAccount';

export class LauncherGameEntryRepository {
  constructor(private db: Database) {}

  public getByAccountId(accountId: number): LauncherGameEntry[] {
    const stmt = this.db.prepare(
      'SELECT * FROM launcher_game_entries WHERE launcher_account_id = ? ORDER BY title COLLATE NOCASE ASC'
    );
    const rows = stmt.all(accountId) as any[];
    return rows.map(this.mapRowToEntry);
  }

  public getByCanonicalId(canonicalId: number): LauncherGameEntry[] {
    const stmt = this.db.prepare(
      'SELECT * FROM launcher_game_entries WHERE canonical_game_id = ?'
    );
    const rows = stmt.all(canonicalId) as any[];
    return rows.map(this.mapRowToEntry);
  }

  public getByAccountAndExternalId(
    accountId: number,
    externalGameId: string
  ): LauncherGameEntry | null {
    const stmt = this.db.prepare(
      'SELECT * FROM launcher_game_entries WHERE launcher_account_id = ? AND external_game_id = ?'
    );
    const row = stmt.get(accountId, externalGameId) as any;
    return row ? this.mapRowToEntry(row) : null;
  }

  public upsertBatch(
    accountId: number,
    entries: Array<{
      externalGameId: string;
      title: string;
      canonicalGameId?: number;
      ownedStatus?: 'OWNED' | 'UNOWNED';
      installAvailable?: boolean;
      metadataJson?: string;
    }>
  ): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO launcher_game_entries (
        launcher_account_id, external_game_id, canonical_game_id,
        title, owned_status, install_available, metadata_json,
        last_seen_at, last_synced_at
      ) VALUES (
        @launcher_account_id, @external_game_id, @canonical_game_id,
        @title, @owned_status, @install_available, @metadata_json,
        @last_seen_at, @last_synced_at
      )
      ON CONFLICT(launcher_account_id, external_game_id) DO UPDATE SET
        title = excluded.title,
        canonical_game_id = COALESCE(excluded.canonical_game_id, launcher_game_entries.canonical_game_id),
        owned_status = excluded.owned_status,
        install_available = excluded.install_available,
        metadata_json = COALESCE(excluded.metadata_json, launcher_game_entries.metadata_json),
        last_seen_at = excluded.last_seen_at,
        last_synced_at = excluded.last_synced_at
    `);

    const transaction = this.db.transaction((items: typeof entries) => {
      for (const item of items) {
        stmt.run({
          launcher_account_id: accountId,
          external_game_id: item.externalGameId,
          canonical_game_id: item.canonicalGameId || null,
          title: item.title,
          owned_status: item.ownedStatus || 'OWNED',
          install_available: item.installAvailable !== false ? 1 : 0,
          metadata_json: item.metadataJson || null,
          last_seen_at: now,
          last_synced_at: now,
        });
      }
    });

    transaction(entries);
  }

  public assignCanonicalId(entryId: number, canonicalId: number): void {
    const stmt = this.db.prepare(
      'UPDATE launcher_game_entries SET canonical_game_id = ? WHERE id = ?'
    );
    stmt.run(canonicalId, entryId);
  }

  public deleteByAccountId(accountId: number): void {
    const stmt = this.db.prepare(
      'DELETE FROM launcher_game_entries WHERE launcher_account_id = ?'
    );
    stmt.run(accountId);
  }

  public deleteUnseenForAccount(accountId: number, keepExternalIds: string[]): number {
    if (keepExternalIds.length === 0) {
      const stmt = this.db.prepare('DELETE FROM launcher_game_entries WHERE launcher_account_id = ?');
      return stmt.run(accountId).changes;
    }
    const placeholders = keepExternalIds.map(() => '?').join(',');
    const stmt = this.db.prepare(
      `DELETE FROM launcher_game_entries WHERE launcher_account_id = ? AND external_game_id NOT IN (${placeholders})`
    );
    return stmt.run(accountId, ...keepExternalIds).changes;
  }

  public isOwnedByOtherAccount(externalGameId: string, currentAccountId: number): boolean {
    const stmt = this.db.prepare(
      'SELECT id FROM launcher_game_entries WHERE external_game_id = ? AND launcher_account_id != ? LIMIT 1'
    );
    return stmt.get(externalGameId, currentAccountId) !== undefined;
  }

  private mapRowToEntry(row: any): LauncherGameEntry {
    return {
      id: row.id,
      launcherAccountId: row.launcher_account_id,
      externalGameId: row.external_game_id,
      canonicalGameId: row.canonical_game_id || undefined,
      title: row.title,
      ownedStatus: row.owned_status,
      installAvailable: row.install_available === 1,
      metadataJson: row.metadata_json || undefined,
      lastSeenAt: row.last_seen_at || undefined,
      lastSyncedAt: row.last_synced_at || undefined,
    };
  }
}

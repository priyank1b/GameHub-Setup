import { Database } from 'better-sqlite3';
import {
  CanonicalGame,
  GameLibraryStatus,
  OwnershipRecord,
} from '../../../src/types/LauncherAccount';
import { LocalInstallationRepository } from './LocalInstallationRepository';
import { GameLauncher } from '../../../src/types/Launcher';

export class CanonicalGameRepository {
  private localInstallationsRepo: LocalInstallationRepository;

  constructor(private db: Database) {
    this.localInstallationsRepo = new LocalInstallationRepository(db);
  }

  public getAll(includeHidden = false): CanonicalGame[] {
    const sql = includeHidden
      ? 'SELECT * FROM canonical_games ORDER BY title COLLATE NOCASE ASC'
      : 'SELECT * FROM canonical_games WHERE is_hidden = 0 ORDER BY title COLLATE NOCASE ASC';

    const rows = this.db.prepare(sql).all() as any[];
    if (rows.length === 0) return [];

    // Batch load installations
    const allInstalls = this.localInstallationsRepo.getAll();
    const installMap = new Map<number, any[]>();
    for (const inst of allInstalls) {
      if (inst.canonicalGameId) {
        const list = installMap.get(inst.canonicalGameId) || [];
        list.push(inst);
        installMap.set(inst.canonicalGameId, list);
      }
    }

    // Batch load all ownerships
    const ownershipRows = this.db.prepare(`
      SELECT 
        lge.id as entry_id,
        lge.external_game_id,
        lge.owned_status,
        lge.install_available,
        lge.canonical_game_id,
        la.id as account_id,
        la.launcher,
        la.display_name as account_name
      FROM launcher_game_entries lge
      JOIN launcher_accounts la ON lge.launcher_account_id = la.id
    `).all() as any[];

    const ownershipMap = new Map<number, any[]>();
    for (const o of ownershipRows) {
      if (o.canonical_game_id) {
        const list = ownershipMap.get(o.canonical_game_id) || [];
        list.push(o);
        ownershipMap.set(o.canonical_game_id, list);
      }
    }

    return rows.map((row) => {
      const installations = installMap.get(row.id) || [];
      const rawOwn = ownershipMap.get(row.id) || [];

      const ownerships: OwnershipRecord[] = rawOwn.map((o) => {
        const matchingInstall = installations.find(
          (i) =>
            (i.launcherGameEntryId && i.launcherGameEntryId === o.entry_id) ||
            (i.launcherAccountId && i.launcherAccountId === o.account_id) ||
            (!i.launcherAccountId && i.launcher === o.launcher)
        );
        const hasInstallOnLauncher = installations.some(
          (i) => i.status === 'INSTALLED' && i.launcher === o.launcher
        );
        const isInstalled = Boolean(
          hasInstallOnLauncher &&
          (o.install_available === 0 ||
           matchingInstall?.launcherAccountId === o.account_id ||
           matchingInstall?.launcherGameEntryId === o.entry_id)
        );

        return {
          launcherAccountId: o.account_id,
          launcher: o.launcher as GameLauncher,
          accountDisplayName: o.account_name,
          externalGameId: o.external_game_id,
          launcherGameEntryId: o.entry_id,
          isInstalled,
          localInstallationId: matchingInstall?.id,
          installPath: matchingInstall?.installPath,
          status: isInstalled ? 'INSTALLED' : 'AVAILABLE',
        };
      });

      let status: GameLibraryStatus = 'UNKNOWN';
      if (installations.some((i) => i.status === 'INSTALLED')) {
        status = 'INSTALLED';
      } else if (ownerships.length > 0) {
        status = 'AVAILABLE';
      }

      return {
        id: row.id,
        title: row.title,
        normalizedTitle: row.normalized_title,
        coverImage: row.cover_image || undefined,
        backgroundImage: row.background_image || undefined,
        iconPath: row.icon_path || undefined,
        description: row.description || undefined,
        developer: row.developer || undefined,
        publisher: row.publisher || undefined,
        genre: row.genre || undefined,
        releaseDate: row.release_date || undefined,
        isFavorite: row.is_favorite === 1,
        isHidden: row.is_hidden === 1,
        lastPlayedAt: row.last_played_at || undefined,
        totalPlayTime: row.total_play_time || 0,
        status,
        ownerships,
        installations,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  public getById(id: number): CanonicalGame | null {
    const stmt = this.db.prepare('SELECT * FROM canonical_games WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.hydrateCanonicalGame(row) : null;
  }

  public getByNormalizedTitle(normalizedTitle: string): CanonicalGame | null {
    const stmt = this.db.prepare(
      'SELECT * FROM canonical_games WHERE normalized_title = ? LIMIT 1'
    );
    const row = stmt.get(normalizedTitle) as any;
    return row ? this.hydrateCanonicalGame(row) : null;
  }

  public create(
    game: Omit<CanonicalGame, 'id' | 'status' | 'ownerships' | 'installations' | 'createdAt' | 'updatedAt'>
  ): CanonicalGame {
    const now = new Date().toISOString();
    const normalizedTitle =
      game.normalizedTitle ||
      (game.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const stmt = this.db.prepare(`
      INSERT INTO canonical_games (
        title, normalized_title, cover_image, background_image,
        icon_path, description, developer, publisher, genre,
        release_date, is_favorite, is_hidden, last_played_at,
        total_play_time, created_at, updated_at
      ) VALUES (
        @title, @normalized_title, @cover_image, @background_image,
        @icon_path, @description, @developer, @publisher, @genre,
        @release_date, @is_favorite, @is_hidden, @last_played_at,
        @total_play_time, @created_at, @updated_at
      )
    `);

    const result = stmt.run({
      title: game.title,
      normalized_title: normalizedTitle,
      cover_image: game.coverImage || null,
      background_image: game.backgroundImage || null,
      icon_path: game.iconPath || null,
      description: game.description || null,
      developer: game.developer || null,
      publisher: game.publisher || null,
      genre: game.genre || null,
      release_date: game.releaseDate || null,
      is_favorite: game.isFavorite ? 1 : 0,
      is_hidden: game.isHidden ? 1 : 0,
      last_played_at: game.lastPlayedAt || null,
      total_play_time: game.totalPlayTime || 0,
      created_at: now,
      updated_at: now,
    });

    return this.getById(Number(result.lastInsertRowid))!;
  }

  public update(
    id: number,
    updates: Partial<Omit<CanonicalGame, 'id' | 'status' | 'ownerships' | 'installations' | 'createdAt'>>
  ): CanonicalGame | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: Record<string, any> = { id, updated_at: now };

    if (updates.title !== undefined) {
      fields.push('title = @title');
      values.title = updates.title;
      if (!updates.normalizedTitle) {
        fields.push('normalized_title = @normalized_title');
        values.normalized_title = updates.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      }
    }
    if (updates.normalizedTitle !== undefined) {
      fields.push('normalized_title = @normalized_title');
      values.normalized_title = updates.normalizedTitle;
    }
    if (updates.coverImage !== undefined) {
      fields.push('cover_image = @cover_image');
      values.cover_image = updates.coverImage || null;
    }
    if (updates.backgroundImage !== undefined) {
      fields.push('background_image = @background_image');
      values.background_image = updates.backgroundImage || null;
    }
    if (updates.iconPath !== undefined) {
      fields.push('icon_path = @icon_path');
      values.icon_path = updates.iconPath || null;
    }
    if (updates.description !== undefined) {
      fields.push('description = @description');
      values.description = updates.description || null;
    }
    if (updates.developer !== undefined) {
      fields.push('developer = @developer');
      values.developer = updates.developer || null;
    }
    if (updates.publisher !== undefined) {
      fields.push('publisher = @publisher');
      values.publisher = updates.publisher || null;
    }
    if (updates.genre !== undefined) {
      fields.push('genre = @genre');
      values.genre = updates.genre || null;
    }
    if (updates.releaseDate !== undefined) {
      fields.push('release_date = @release_date');
      values.release_date = updates.releaseDate || null;
    }
    if (updates.isFavorite !== undefined) {
      fields.push('is_favorite = @is_favorite');
      values.is_favorite = updates.isFavorite ? 1 : 0;
    }
    if (updates.isHidden !== undefined) {
      fields.push('is_hidden = @is_hidden');
      values.is_hidden = updates.isHidden ? 1 : 0;
    }
    if (updates.lastPlayedAt !== undefined) {
      fields.push('last_played_at = @last_played_at');
      values.last_played_at = updates.lastPlayedAt || null;
    }
    if (updates.totalPlayTime !== undefined) {
      fields.push('total_play_time = @total_play_time');
      values.total_play_time = updates.totalPlayTime;
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = @updated_at');
    const sql = `UPDATE canonical_games SET ${fields.join(', ')} WHERE id = @id`;
    this.db.prepare(sql).run(values);

    return this.getById(id);
  }

  public toggleFavorite(id: number): boolean {
    const game = this.getById(id);
    if (!game) return false;
    const newFav = !game.isFavorite;
    this.update(id, { isFavorite: newFav });
    return newFav;
  }

  public setHidden(id: number, isHidden: boolean): boolean {
    const res = this.update(id, { isHidden });
    return Boolean(res);
  }

  public recordPlayTime(id: number, additionalSeconds: number): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE canonical_games
      SET total_play_time = total_play_time + ?,
          last_played_at = ?,
          updated_at = ?
      WHERE id = ?
    `);
    stmt.run(additionalSeconds, now, now, id);
  }

  public delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM canonical_games WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  public deleteOrphanedPlaceholders(): number {
    const stmt = this.db.prepare(`
      DELETE FROM canonical_games
      WHERE title LIKE 'Steam App %'
        AND id NOT IN (SELECT DISTINCT canonical_game_id FROM launcher_game_entries WHERE canonical_game_id IS NOT NULL)
        AND id NOT IN (SELECT DISTINCT canonical_game_id FROM local_installations WHERE canonical_game_id IS NOT NULL)
    `);
    const result = stmt.run();
    return result.changes;
  }

  private hydrateCanonicalGame(row: any): CanonicalGame {
    const installations = this.localInstallationsRepo.getByCanonicalId(row.id);

    // Fetch ownerships across accounts for this canonical game
    const ownershipRows = this.db.prepare(`
      SELECT 
        lge.id as entry_id,
        lge.external_game_id,
        lge.owned_status,
        lge.install_available,
        la.id as account_id,
        la.launcher,
        la.display_name as account_name
      FROM launcher_game_entries lge
      JOIN launcher_accounts la ON lge.launcher_account_id = la.id
      WHERE lge.canonical_game_id = ?
    `).all(row.id) as any[];

    const ownerships: OwnershipRecord[] = ownershipRows.map((o) => {
      const matchingInstall = installations.find(
        (i) =>
          (i.launcherGameEntryId && i.launcherGameEntryId === o.entry_id) ||
          (i.launcherAccountId && i.launcherAccountId === o.account_id) ||
          (!i.launcherAccountId && i.launcher === o.launcher)
      );
      const hasInstallOnLauncher = installations.some(
        (i) => i.status === 'INSTALLED' && i.launcher === o.launcher
      );
      const isInstalled = Boolean(
        hasInstallOnLauncher &&
        (o.install_available === 0 ||
         matchingInstall?.launcherAccountId === o.account_id ||
         matchingInstall?.launcherGameEntryId === o.entry_id)
      );

      return {
        launcherAccountId: o.account_id,
        launcher: o.launcher as GameLauncher,
        accountDisplayName: o.account_name,
        externalGameId: o.external_game_id,
        launcherGameEntryId: o.entry_id,
        isInstalled,
        localInstallationId: matchingInstall?.id,
        installPath: matchingInstall?.installPath,
        status: isInstalled ? 'INSTALLED' : 'AVAILABLE',
      };
    });

    // Compute overall game library status:
    // If any local installation is INSTALLED -> INSTALLED
    // Else if ownership exists with install available -> AVAILABLE
    // Else -> UNKNOWN
    let status: GameLibraryStatus = 'UNKNOWN';
    if (installations.some((i) => i.status === 'INSTALLED')) {
      status = 'INSTALLED';
    } else if (ownerships.length > 0) {
      status = 'AVAILABLE';
    }

    return {
      id: row.id,
      title: row.title,
      normalizedTitle: row.normalized_title,
      coverImage: row.cover_image || undefined,
      backgroundImage: row.background_image || undefined,
      iconPath: row.icon_path || undefined,
      description: row.description || undefined,
      developer: row.developer || undefined,
      publisher: row.publisher || undefined,
      genre: row.genre || undefined,
      releaseDate: row.release_date || undefined,
      isFavorite: row.is_favorite === 1,
      isHidden: row.is_hidden === 1,
      lastPlayedAt: row.last_played_at || undefined,
      totalPlayTime: row.total_play_time || 0,
      status,
      ownerships,
      installations,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

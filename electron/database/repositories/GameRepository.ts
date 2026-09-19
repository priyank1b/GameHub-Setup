import { Database } from 'better-sqlite3';
import { Game } from '../../../src/types/Game';
import { GameLauncher } from '../../../src/types/Launcher';

export class GameRepository {
  constructor(private db: Database) {}

  public create(game: Omit<Game, 'id'>): Game {
    const now = new Date().toISOString();
    const normalizedName = (game.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const stmt = this.db.prepare(`
      INSERT INTO games (
        name, normalized_name, executable_path, install_path,
        launcher, launcher_app_id, cover_image, background_image,
        icon_path, description, developer, publisher, genre,
        release_date, installed_size, is_favorite, is_installed,
        is_manual, last_played_at, total_play_time, created_at, updated_at
      ) VALUES (
        @name, @normalized_name, @executable_path, @install_path,
        @launcher, @launcher_app_id, @cover_image, @background_image,
        @icon_path, @description, @developer, @publisher, @genre,
        @release_date, @installed_size, @is_favorite, @is_installed,
        @is_manual, @last_played_at, @total_play_time, @created_at, @updated_at
      )
    `);

    const result = stmt.run({
      name: game.name,
      normalized_name: normalizedName,
      executable_path: game.executablePath || null,
      install_path: game.installPath || null,
      launcher: game.launcher,
      launcher_app_id: game.launcherAppId || null,
      cover_image: game.coverImage || null,
      background_image: game.backgroundImage || null,
      icon_path: game.iconPath || null,
      description: game.description || null,
      developer: game.developer || null,
      publisher: game.publisher || null,
      genre: game.genre || null,
      release_date: game.releaseDate || null,
      installed_size: game.installedSize || 0,
      is_favorite: game.isFavorite ? 1 : 0,
      is_installed: game.isInstalled !== false ? 1 : 0,
      is_manual: game.isManual ? 1 : 0,
      last_played_at: game.lastPlayedAt || null,
      total_play_time: game.totalPlayTime || 0,
      created_at: now,
      updated_at: now,
    });

    return this.getById(Number(result.lastInsertRowid))!;
  }

  public getDb(): Database {
    return this.db;
  }

  public transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  public getById(id: number): Game | null {
    const stmt = this.db.prepare('SELECT * FROM games WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapRowToGame(row) : null;
  }

  public getAll(): Game[] {
    const stmt = this.db.prepare('SELECT * FROM games ORDER BY name COLLATE NOCASE ASC');
    const rows = stmt.all() as any[];
    return rows.map(this.mapRowToGame);
  }

  public getFavorites(): Game[] {
    const stmt = this.db.prepare(
      'SELECT * FROM games WHERE is_favorite = 1 ORDER BY name COLLATE NOCASE ASC'
    );
    const rows = stmt.all() as any[];
    return rows.map(this.mapRowToGame);
  }

  public getByLauncher(launcher: GameLauncher): Game[] {
    const stmt = this.db.prepare(
      'SELECT * FROM games WHERE launcher = ? ORDER BY name COLLATE NOCASE ASC'
    );
    const rows = stmt.all(launcher) as any[];
    return rows.map(this.mapRowToGame);
  }

  public findByLauncherAppId(launcher: GameLauncher, appId: string): Game | null {
    const stmt = this.db.prepare('SELECT * FROM games WHERE launcher = ? AND launcher_app_id = ?');
    const row = stmt.get(launcher, appId) as any;
    return row ? this.mapRowToGame(row) : null;
  }

  public findByInstallPath(installPath: string): Game | null {
    const stmt = this.db.prepare('SELECT * FROM games WHERE install_path = ?');
    const row = stmt.get(installPath) as any;
    return row ? this.mapRowToGame(row) : null;
  }

  public findByNormalizedName(name: string): Game[] {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const stmt = this.db.prepare('SELECT * FROM games WHERE normalized_name = ?');
    const rows = stmt.all(normalized) as any[];
    return rows.map(this.mapRowToGame);
  }

  public update(id: number, updates: Partial<Game>): Game | null {
    const current = this.getById(id);
    if (!current) return null;

    const fields: string[] = [];
    const values: Record<string, any> = { id, updated_at: new Date().toISOString() };

    if (updates.name !== undefined) {
      fields.push('name = @name, normalized_name = @normalized_name');
      values.name = updates.name;
      values.normalized_name = updates.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    if (updates.executablePath !== undefined) {
      fields.push('executable_path = @executable_path');
      values.executable_path = updates.executablePath;
    }
    if (updates.installPath !== undefined) {
      fields.push('install_path = @install_path');
      values.install_path = updates.installPath;
    }
    if (updates.coverImage !== undefined) {
      fields.push('cover_image = @cover_image');
      values.cover_image = updates.coverImage;
    }
    if (updates.backgroundImage !== undefined) {
      fields.push('background_image = @background_image');
      values.background_image = updates.backgroundImage;
    }
    if (updates.isFavorite !== undefined) {
      fields.push('is_favorite = @is_favorite');
      values.is_favorite = updates.isFavorite ? 1 : 0;
    }
    if (updates.isInstalled !== undefined) {
      fields.push('is_installed = @is_installed');
      values.is_installed = updates.isInstalled ? 1 : 0;
    }
    if (updates.lastPlayedAt !== undefined) {
      fields.push('last_played_at = @last_played_at');
      values.last_played_at = updates.lastPlayedAt;
    }
    if (updates.totalPlayTime !== undefined) {
      fields.push('total_play_time = @total_play_time');
      values.total_play_time = updates.totalPlayTime;
    }
    if (updates.launcher !== undefined) {
      fields.push('launcher = @launcher');
      values.launcher = updates.launcher;
    }
    if (updates.launcherAppId !== undefined) {
      fields.push('launcher_app_id = @launcher_app_id');
      values.launcher_app_id = updates.launcherAppId;
    }
    if (updates.installedSize !== undefined) {
      fields.push('installed_size = @installed_size');
      values.installed_size = updates.installedSize;
    }
    if (updates.description !== undefined) {
      fields.push('description = @description');
      values.description = updates.description;
    }
    if (updates.developer !== undefined) {
      fields.push('developer = @developer');
      values.developer = updates.developer;
    }
    if (updates.publisher !== undefined) {
      fields.push('publisher = @publisher');
      values.publisher = updates.publisher;
    }
    if (updates.genre !== undefined) {
      fields.push('genre = @genre');
      values.genre = updates.genre;
    }
    if (updates.releaseDate !== undefined) {
      fields.push('release_date = @release_date');
      values.release_date = updates.releaseDate;
    }

    if (fields.length === 0) return current;

    fields.push('updated_at = @updated_at');

    const sql = `UPDATE games SET ${fields.join(', ')} WHERE id = @id`;
    this.db.prepare(sql).run(values);

    return this.getById(id);
  }

  public delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM games WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  public toggleFavorite(id: number): boolean {
    const stmt = this.db.prepare(
      'UPDATE games SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?'
    );
    const result = stmt.run(new Date().toISOString(), id);
    return result.changes > 0;
  }

  public updateLastPlayed(id: number): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE games
      SET last_played_at = ?,
          updated_at = ?
      WHERE id = ?
    `);
    stmt.run(now, now, id);
  }

  public recordPlayTime(id: number, additionalSeconds: number): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE games
      SET total_play_time = total_play_time + ?,
          last_played_at = ?,
          updated_at = ?
      WHERE id = ?
    `);
    stmt.run(additionalSeconds, now, now, id);
  }

  private mapRowToGame(row: any): Game {
    return {
      id: row.id,
      name: row.name,
      normalizedName: row.normalized_name,
      executablePath: row.executable_path,
      installPath: row.install_path,
      launcher: row.launcher as GameLauncher,
      launcherAppId: row.launcher_app_id,
      coverImage: row.cover_image,
      backgroundImage: row.background_image,
      iconPath: row.icon_path,
      description: row.description,
      developer: row.developer,
      publisher: row.publisher,
      genre: row.genre,
      releaseDate: row.release_date,
      installedSize: row.installed_size,
      isFavorite: row.is_favorite === 1,
      isInstalled: row.is_installed === 1,
      isManual: row.is_manual === 1,
      lastPlayedAt: row.last_played_at,
      totalPlayTime: row.total_play_time,
      drive: row.install_path ? row.install_path.slice(0, 2).toUpperCase() : undefined,
    };
  }
}

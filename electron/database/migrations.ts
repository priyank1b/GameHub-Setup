import { Database } from 'better-sqlite3';
import fs from 'fs';

export function runMigrations(db: Database, dbPath?: string): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number;
  console.log(`[Migrations] Current database schema version: ${currentVersion}`);

  // Migration 1: Initial schema
  if (currentVersion < 1) {
    console.log('[Migrations] Applying Migration 1: Initial schema creation...');

    // Backup before initial migration if db exists and is not memory
    if (dbPath && dbPath !== ':memory:' && fs.existsSync(dbPath)) {
      try {
        fs.copyFileSync(dbPath, `${dbPath}.backup_v0`);
      } catch (e) {
        // Ignore backup error on initial empty creation
      }
    }

    db.exec(`
      -- Games table
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        normalized_name TEXT,
        executable_path TEXT,
        install_path TEXT,
        launcher TEXT NOT NULL,
        launcher_app_id TEXT,
        cover_image TEXT,
        background_image TEXT,
        icon_path TEXT,
        description TEXT,
        developer TEXT,
        publisher TEXT,
        genre TEXT,
        release_date TEXT,
        installed_size INTEGER,
        is_favorite INTEGER DEFAULT 0,
        is_installed INTEGER DEFAULT 1,
        is_manual INTEGER DEFAULT 0,
        last_played_at TEXT,
        total_play_time INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Indexing for fast search and filtering
      CREATE INDEX IF NOT EXISTS idx_games_launcher ON games(launcher);
      CREATE INDEX IF NOT EXISTS idx_games_favorite ON games(is_favorite);
      CREATE INDEX IF NOT EXISTS idx_games_normalized_name ON games(normalized_name);
      CREATE INDEX IF NOT EXISTS idx_games_app_id ON games(launcher, launcher_app_id);

      -- Launch History table
      CREATE TABLE IF NOT EXISTS launch_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        launched_at TEXT NOT NULL,
        exited_at TEXT,
        duration INTEGER DEFAULT 0,
        FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_launch_history_game ON launch_history(game_id);
      CREATE INDEX IF NOT EXISTS idx_launch_history_launched_at ON launch_history(launched_at DESC);

      -- Categories table
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );

      -- Game-to-Category association table
      CREATE TABLE IF NOT EXISTS game_categories (
        game_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        PRIMARY KEY (game_id, category_id),
        FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
        FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
      );

      -- Application Settings table
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      -- Ignored paths table (e.g. system directories or user ignored folders)
      CREATE TABLE IF NOT EXISTS ignored_paths (
        path TEXT PRIMARY KEY,
        reason TEXT,
        created_at TEXT NOT NULL
      );
    `);

    db.pragma('user_version = 1');
    console.log('[Migrations] Migration 1 applied successfully. Schema version is now 1.');
  }

  // Migration 2: Performance optimization indices for large libraries (Phase 31)
  if (currentVersion < 2) {
    console.log('[Migrations] Applying Migration 2: Performance indices...');
    if (dbPath && dbPath !== ':memory:' && fs.existsSync(dbPath)) {
      try {
        fs.copyFileSync(dbPath, `${dbPath}.backup`);
      } catch (e) {}
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_games_name_nocase ON games(name COLLATE NOCASE ASC);
      CREATE INDEX IF NOT EXISTS idx_games_installed ON games(is_installed);
      CREATE INDEX IF NOT EXISTS idx_games_last_played ON games(last_played_at DESC);
      CREATE INDEX IF NOT EXISTS idx_games_playtime ON games(total_play_time DESC);
    `);

    db.pragma('user_version = 2');
    console.log('[Migrations] Migration 2 applied successfully. Schema version is now 2.');
  }
}

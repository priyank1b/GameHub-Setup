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

  // Migration 3: Storage detection metadata columns (v1.0.3)
  if (currentVersion < 3) {
    console.log('[Migrations] Applying Migration 3: Storage detection metadata columns...');
    if (dbPath && dbPath !== ':memory:' && fs.existsSync(dbPath)) {
      try {
        fs.copyFileSync(dbPath, `${dbPath}.backup_v2`);
      } catch (e) {}
    }

    const columns = db.pragma('table_info(games)') as { name: string }[];
    const colNames = new Set(columns.map((c) => c.name));

    if (!colNames.has('install_size_status')) {
      db.exec("ALTER TABLE games ADD COLUMN install_size_status TEXT NOT NULL DEFAULT 'UNKNOWN'");
    }
    if (!colNames.has('install_size_source')) {
      db.exec("ALTER TABLE games ADD COLUMN install_size_source TEXT NOT NULL DEFAULT 'unknown'");
    }
    if (!colNames.has('install_size_updated_at')) {
      db.exec("ALTER TABLE games ADD COLUMN install_size_updated_at TEXT NULL");
    }

    // Backfill existing games with known sizes
    db.exec(`
      UPDATE games
      SET install_size_status = 'KNOWN',
          install_size_source = 'metadata'
      WHERE installed_size > 0 AND install_size_status = 'UNKNOWN';
    `);

    db.pragma('user_version = 3');
    console.log('[Migrations] Migration 3 applied successfully. Schema version is now 3.');
  }

  // Migration 4: Hidden/Excluded Games (v1.0.3)
  if (currentVersion < 4) {
    console.log('[Migrations] Applying Migration 4: Hidden/Excluded games support...');
    if (dbPath && dbPath !== ':memory:' && fs.existsSync(dbPath)) {
      try {
        fs.copyFileSync(dbPath, `${dbPath}.backup_v3`);
      } catch (e) {}
    }

    const columns = db.pragma('table_info(games)') as { name: string }[];
    const colNames = new Set(columns.map((c) => c.name));

    if (!colNames.has('is_hidden')) {
      db.exec('ALTER TABLE games ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0');
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_games_hidden ON games(is_hidden);
    `);

    db.pragma('user_version = 4');
    console.log('[Migrations] Migration 4 applied successfully. Schema version is now 4.');
  }

  // Migration 5: v2.0.0 Canonical Games, Multi-Account Launchers, and Local Installations
  if (currentVersion < 5) {
    console.log('[Migrations] Applying Migration 5: v2.0.0 Multi-Account & Canonical Games schema...');
    if (dbPath && dbPath !== ':memory:' && fs.existsSync(dbPath)) {
      try {
        fs.copyFileSync(dbPath, `${dbPath}.backup_v4`);
      } catch (e) {}
    }

    db.exec(`
      -- Launcher Accounts Table
      CREATE TABLE IF NOT EXISTS launcher_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        launcher TEXT NOT NULL,
        external_account_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        connection_status TEXT NOT NULL DEFAULT 'CONNECTED',
        last_connected_at TEXT,
        last_synced_at TEXT,
        sync_status TEXT NOT NULL DEFAULT 'IDLE',
        sync_error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (launcher, external_account_id)
      );

      CREATE INDEX IF NOT EXISTS idx_launcher_accounts_launcher ON launcher_accounts(launcher);
      CREATE INDEX IF NOT EXISTS idx_launcher_accounts_status ON launcher_accounts(connection_status);

      -- Canonical Games Table
      CREATE TABLE IF NOT EXISTS canonical_games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        normalized_title TEXT,
        cover_image TEXT,
        background_image TEXT,
        icon_path TEXT,
        description TEXT,
        developer TEXT,
        publisher TEXT,
        genre TEXT,
        release_date TEXT,
        is_favorite INTEGER DEFAULT 0,
        is_hidden INTEGER DEFAULT 0,
        last_played_at TEXT,
        total_play_time INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_canonical_games_title ON canonical_games(normalized_title);
      CREATE INDEX IF NOT EXISTS idx_canonical_games_favorite ON canonical_games(is_favorite);
      CREATE INDEX IF NOT EXISTS idx_canonical_games_hidden ON canonical_games(is_hidden);
      CREATE INDEX IF NOT EXISTS idx_canonical_games_playtime ON canonical_games(total_play_time DESC);

      -- Launcher Game Entries Table (synced library entries per account)
      CREATE TABLE IF NOT EXISTS launcher_game_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        launcher_account_id INTEGER NOT NULL,
        external_game_id TEXT NOT NULL,
        canonical_game_id INTEGER,
        title TEXT NOT NULL,
        owned_status TEXT NOT NULL DEFAULT 'OWNED',
        install_available INTEGER NOT NULL DEFAULT 1,
        metadata_json TEXT,
        last_seen_at TEXT,
        last_synced_at TEXT,
        FOREIGN KEY (launcher_account_id) REFERENCES launcher_accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (canonical_game_id) REFERENCES canonical_games(id) ON DELETE SET NULL,
        UNIQUE (launcher_account_id, external_game_id)
      );

      CREATE INDEX IF NOT EXISTS idx_lge_account ON launcher_game_entries(launcher_account_id);
      CREATE INDEX IF NOT EXISTS idx_lge_canonical ON launcher_game_entries(canonical_game_id);
      CREATE INDEX IF NOT EXISTS idx_lge_external_id ON launcher_game_entries(external_game_id);

      -- Local Installations Table
      CREATE TABLE IF NOT EXISTS local_installations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        canonical_game_id INTEGER NOT NULL,
        launcher_game_entry_id INTEGER,
        launcher_account_id INTEGER,
        install_path TEXT,
        executable_path TEXT,
        launcher TEXT NOT NULL,
        install_size_bytes INTEGER DEFAULT 0,
        install_size_status TEXT NOT NULL DEFAULT 'UNKNOWN',
        install_size_source TEXT NOT NULL DEFAULT 'unknown',
        status TEXT NOT NULL DEFAULT 'INSTALLED',
        last_verified_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (canonical_game_id) REFERENCES canonical_games(id) ON DELETE CASCADE,
        FOREIGN KEY (launcher_game_entry_id) REFERENCES launcher_game_entries(id) ON DELETE SET NULL,
        FOREIGN KEY (launcher_account_id) REFERENCES launcher_accounts(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_li_canonical ON local_installations(canonical_game_id);
      CREATE INDEX IF NOT EXISTS idx_li_account ON local_installations(launcher_account_id);
      CREATE INDEX IF NOT EXISTS idx_li_entry ON local_installations(launcher_game_entry_id);
      CREATE INDEX IF NOT EXISTS idx_li_status ON local_installations(status);
    `);

    // Backfill from legacy games table if it has existing records
    try {
      const hasGames = db.prepare('SELECT count(*) as count FROM games').get() as { count: number };
      const hasCanonical = db.prepare('SELECT count(*) as count FROM canonical_games').get() as { count: number };

      if (hasGames.count > 0 && hasCanonical.count === 0) {
        console.log(`[Migrations] Backfilling ${hasGames.count} games into canonical_games and local_installations...`);
        const games = db.prepare('SELECT * FROM games').all() as any[];
        const insertCanonical = db.prepare(`
          INSERT INTO canonical_games (
            id, title, normalized_title, cover_image, background_image,
            icon_path, description, developer, publisher, genre,
            release_date, is_favorite, is_hidden, last_played_at,
            total_play_time, created_at, updated_at
          ) VALUES (
            @id, @title, @normalized_title, @cover_image, @background_image,
            @icon_path, @description, @developer, @publisher, @genre,
            @release_date, @is_favorite, @is_hidden, @last_played_at,
            @total_play_time, @created_at, @updated_at
          )
        `);

        const insertInstallation = db.prepare(`
          INSERT INTO local_installations (
            canonical_game_id, launcher, install_path, executable_path,
            install_size_bytes, install_size_status, install_size_source,
            status, last_verified_at, created_at, updated_at
          ) VALUES (
            @canonical_game_id, @launcher, @install_path, @executable_path,
            @install_size_bytes, @install_size_status, @install_size_source,
            @status, @last_verified_at, @created_at, @updated_at
          )
        `);

        db.transaction(() => {
          for (const g of games) {
            insertCanonical.run({
              id: g.id,
              title: g.name,
              normalized_title: g.normalized_name || (g.name || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
              cover_image: g.cover_image,
              background_image: g.background_image,
              icon_path: g.icon_path,
              description: g.description,
              developer: g.developer,
              publisher: g.publisher,
              genre: g.genre,
              release_date: g.release_date,
              is_favorite: g.is_favorite || 0,
              is_hidden: g.is_hidden || 0,
              last_played_at: g.last_played_at,
              total_play_time: g.total_play_time || 0,
              created_at: g.created_at || new Date().toISOString(),
              updated_at: g.updated_at || new Date().toISOString(),
            });

            insertInstallation.run({
              canonical_game_id: g.id,
              launcher: g.launcher,
              install_path: g.install_path,
              executable_path: g.executable_path,
              install_size_bytes: g.installed_size || 0,
              install_size_status: g.install_size_status || (g.installed_size ? 'KNOWN' : 'UNKNOWN'),
              install_size_source: g.install_size_source || (g.installed_size ? 'metadata' : 'unknown'),
              status: g.is_installed === 1 ? 'INSTALLED' : 'MISSING',
              last_verified_at: g.updated_at || new Date().toISOString(),
              created_at: g.created_at || new Date().toISOString(),
              updated_at: g.updated_at || new Date().toISOString(),
            });
          }
        })();
        console.log('[Migrations] Backfill completed successfully.');
      }
    } catch (err: any) {
      console.warn('[Migrations] Warning during migration 5 backfill:', err.message);
    }

    db.pragma('user_version = 5');
    console.log('[Migrations] Migration 5 applied successfully. Schema version is now 5.');
  }
}



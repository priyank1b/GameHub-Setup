import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { runMigrations } from './migrations';

let dbInstance: DatabaseType | null = null;

export function getDatabasePath(): string {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const gameHubDir = path.join(appData, 'GameHub');
  if (!fs.existsSync(gameHubDir)) {
    fs.mkdirSync(gameHubDir, { recursive: true });
  }
  return path.join(gameHubDir, 'gamehub.db');
}

export function initDatabase(dbPath?: string): DatabaseType {
  if (dbInstance) {
    return dbInstance;
  }

  const targetPath = dbPath || getDatabasePath();
  console.log(`[Database] Initializing SQLite database at: ${targetPath}`);

  const db = new Database(targetPath);

  // Performance and integrity pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000'); // 64MB memory page cache
  db.pragma('mmap_size = 268435456'); // 256MB memory mapped I/O
  db.pragma('temp_store = MEMORY');

  // Run migrations
  runMigrations(db, targetPath);

  dbInstance = db;
  return db;
}

export function getDatabase(): DatabaseType {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
      console.log('[Database] Database connection closed.');
    } catch (err: any) {
      console.error('[Database] Error closing database:', err.message);
    }
    dbInstance = null;
  }
}

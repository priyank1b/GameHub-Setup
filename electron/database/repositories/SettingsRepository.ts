import { Database } from 'better-sqlite3';

export class SettingsRepository {
  constructor(private db: Database) {}

  public get<T = string>(key: string, defaultValue?: T): T | undefined {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    if (!row) return defaultValue;

    try {
      return JSON.parse(row.value) as T;
    } catch {
      return row.value as unknown as T;
    }
  }

  public set(key: string, value: any): void {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    stmt.run(key, serialized);
  }

  public getAll(): Record<string, any> {
    const stmt = this.db.prepare('SELECT key, value FROM settings');
    const rows = stmt.all() as { key: string; value: string }[];
    const result: Record<string, any> = {};

    for (const r of rows) {
      try {
        result[r.key] = JSON.parse(r.value);
      } catch {
        result[r.key] = r.value;
      }
    }
    return result;
  }

  public delete(key: string): boolean {
    const stmt = this.db.prepare('DELETE FROM settings WHERE key = ?');
    return stmt.run(key).changes > 0;
  }
}

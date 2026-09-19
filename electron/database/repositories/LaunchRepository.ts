import { Database } from 'better-sqlite3';

export interface LaunchRecord {
  id: number;
  gameId: number;
  launchedAt: string;
  exitedAt?: string;
  duration: number; // in seconds
}

export class LaunchRepository {
  constructor(private db: Database) {}

  public recordLaunch(gameId: number): number {
    const stmt = this.db.prepare(`
      INSERT INTO launch_history (game_id, launched_at, duration)
      VALUES (?, ?, 0)
    `);
    const result = stmt.run(gameId, new Date().toISOString());
    return Number(result.lastInsertRowid);
  }

  public recordExit(launchId: number, durationSeconds: number): void {
    const stmt = this.db.prepare(`
      UPDATE launch_history
      SET exited_at = ?, duration = ?
      WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), durationSeconds, launchId);
  }

  public getHistoryForGame(gameId: number, limit = 20): LaunchRecord[] {
    const stmt = this.db.prepare(`
      SELECT id, game_id, launched_at, exited_at, duration
      FROM launch_history
      WHERE game_id = ?
      ORDER BY launched_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(gameId, limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      gameId: r.game_id,
      launchedAt: r.launched_at,
      exitedAt: r.exited_at || undefined,
      duration: r.duration,
    }));
  }

  public getRecentLaunches(limit = 10): LaunchRecord[] {
    const stmt = this.db.prepare(`
      SELECT id, game_id, launched_at, exited_at, duration
      FROM launch_history
      ORDER BY launched_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      gameId: r.game_id,
      launchedAt: r.launched_at,
      exitedAt: r.exited_at || undefined,
      duration: r.duration,
    }));
  }
}

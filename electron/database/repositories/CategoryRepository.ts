import { Database } from 'better-sqlite3';

export interface Category {
  id: number;
  name: string;
}

export class CategoryRepository {
  constructor(private db: Database) {}

  public getAll(): Category[] {
    const stmt = this.db.prepare('SELECT id, name FROM categories ORDER BY name ASC');
    return stmt.all() as Category[];
  }

  public create(name: string): Category {
    const stmt = this.db.prepare('INSERT INTO categories (name) VALUES (?)');
    const result = stmt.run(name.trim());
    return { id: Number(result.lastInsertRowid), name: name.trim() };
  }

  public delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM categories WHERE id = ?');
    return stmt.run(id).changes > 0;
  }

  public addGameToCategory(gameId: number, categoryId: number): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO game_categories (game_id, category_id)
      VALUES (?, ?)
    `);
    stmt.run(gameId, categoryId);
  }

  public removeGameFromCategory(gameId: number, categoryId: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM game_categories
      WHERE game_id = ? AND category_id = ?
    `);
    stmt.run(gameId, categoryId);
  }

  public getCategoriesForGame(gameId: number): Category[] {
    const stmt = this.db.prepare(`
      SELECT c.id, c.name
      FROM categories c
      JOIN game_categories gc ON c.id = gc.category_id
      WHERE gc.game_id = ?
      ORDER BY c.name ASC
    `);
    return stmt.all(gameId) as Category[];
  }
}

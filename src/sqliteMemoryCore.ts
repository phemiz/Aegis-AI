import Database from "better-sqlite3";
import type {
  MemoryCore,
  MemoryItem,
  UserProfile,
} from "./memoryCore.js";

export class SqliteMemoryCore implements MemoryCore {
  private db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS profiles (
          userId TEXT PRIMARY KEY,
          data   TEXT NOT NULL
        )`
      )
      .run();

    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS items (
          userId    TEXT NOT NULL,
          key       TEXT NOT NULL,
          type      TEXT NOT NULL,
          data      TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          tags      TEXT NOT NULL,
          PRIMARY KEY (userId, key)
        )`
      )
      .run();

    this.db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_items_user_type ON items(userId, type)`
      )
      .run();
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const row = this.db
      .prepare("SELECT data FROM profiles WHERE userId = ?")
      .get(userId) as { data: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.data) as UserProfile;
  }

  async writeUserProfile(profile: UserProfile): Promise<void> {
    const data = JSON.stringify(profile);
    this.db
      .prepare(
        `INSERT INTO profiles (userId, data)
         VALUES (@userId, @data)
         ON CONFLICT(userId) DO UPDATE SET data = excluded.data`
      )
      .run({ userId: profile.userId, data });
  }

  async getItem(userId: string, key: string): Promise<MemoryItem | null> {
    const row = this.db
      .prepare(
        "SELECT key, type, data, createdAt, tags FROM items WHERE userId = ? AND key = ?"
      )
      .get(userId, key) as
      | {
          key: string;
          type: string;
          data: string;
          createdAt: string;
          tags: string;
        }
      | undefined;

    if (!row) return null;

    return {
      key: row.key,
      type: row.type,
      data: JSON.parse(row.data) as Record<string, unknown>,
      createdAt: row.createdAt,
      tags: JSON.parse(row.tags) as string[],
    };
  }

  async queryItems(
    userId: string,
    filter: { type?: string; tags?: string[]; text?: string; limit: number }
  ): Promise<MemoryItem[]> {
    // For simplicity and flexibility, load items for the user and filter in memory.
    const rows = this.db
      .prepare(
        "SELECT key, type, data, createdAt, tags FROM items WHERE userId = ?"
      )
      .all(userId) as {
      key: string;
      type: string;
      data: string;
      createdAt: string;
      tags: string;
    }[];

    let items: MemoryItem[] = rows.map((row) => ({
      key: row.key,
      type: row.type,
      data: JSON.parse(row.data) as Record<string, unknown>,
      createdAt: row.createdAt,
      tags: JSON.parse(row.tags) as string[],
    }));

    if (filter.type) {
      items = items.filter((item) => item.type === filter.type);
    }

    if (filter.tags && filter.tags.length > 0) {
      items = items.filter((item) => {
        const set = new Set(item.tags);
        return filter.tags!.some((t) => set.has(t));
      });
    }

    if (filter.text) {
      const needle = filter.text.toLowerCase();
      items = items.filter((item) =>
        JSON.stringify(item.data).toLowerCase().includes(needle)
      );
    }

    return items.slice(0, filter.limit);
  }

  async writeItem(userId: string, item: MemoryItem): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO items (userId, key, type, data, createdAt, tags)
         VALUES (@userId, @key, @type, @data, @createdAt, @tags)
         ON CONFLICT(userId, key) DO UPDATE SET
           type = excluded.type,
           data = excluded.data,
           createdAt = excluded.createdAt,
           tags = excluded.tags`
      )
      .run({
        userId,
        key: item.key,
        type: item.type,
        data: JSON.stringify(item.data ?? {}),
        createdAt: item.createdAt,
        tags: JSON.stringify(item.tags ?? []),
      });
  }

  async deleteItem(userId: string, key: string): Promise<void> {
    this.db
      .prepare("DELETE FROM items WHERE userId = ? AND key = ?")
      .run(userId, key);
  }

  async listItems(
    userId: string,
    filter: { type?: string }
  ): Promise<Pick<MemoryItem, "key" | "type" | "createdAt" | "tags">[]> {
    let sql =
      "SELECT key, type, createdAt, tags FROM items WHERE userId = @userId";
    const params: { userId: string; type?: string } = { userId };
    if (filter.type) {
      sql += " AND type = @type";
      params.type = filter.type;
    }

    const rows = this.db.prepare(sql).all(params) as {
      key: string;
      type: string;
      createdAt: string;
      tags: string;
    }[];

    return rows.map((row) => ({
      key: row.key,
      type: row.type,
      createdAt: row.createdAt,
      tags: JSON.parse(row.tags) as string[],
    }));
  }
}

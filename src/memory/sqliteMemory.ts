import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { MemoryCore, MemoryItem, UserProfile } from "../memoryCore.js";

export class SqliteMemory implements MemoryCore {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
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
         VALUES (?, ?)
         ON CONFLICT(userId) DO UPDATE SET data = excluded.data`
      )
      .run(profile.userId, data);
  }

  async getItem(userId: string, key: string): Promise<MemoryItem | null> {
    const row = this.db
      .prepare(
        `SELECT key, type, data, createdAt, tags
         FROM items
         WHERE userId = ? AND key = ?`
      )
      .get(userId, key) as
      | { key: string; type: string; data: string; createdAt: string; tags: string }
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
    const rows = this.db
      .prepare(
        `SELECT key, type, data, createdAt, tags
         FROM items
         WHERE userId = ?`
      )
      .all(userId) as {
      key: string;
      type: string;
      data: string;
      createdAt: string;
      tags: string;
    }[];

    const parsed: MemoryItem[] = rows.map((row) => ({
      key: row.key,
      type: row.type,
      data: JSON.parse(row.data) as Record<string, unknown>,
      createdAt: row.createdAt,
      tags: JSON.parse(row.tags) as string[],
    }));

    const filtered = parsed.filter((item) => {
      if (filter.type && item.type !== filter.type) return false;
      if (filter.tags && filter.tags.length > 0) {
        const tagSet = new Set(item.tags);
        if (!filter.tags.some((t) => tagSet.has(t))) return false;
      }
      if (filter.text) {
        const text = JSON.stringify(item.data).toLowerCase();
        if (!text.includes(filter.text.toLowerCase())) return false;
      }
      return true;
    });

    return filtered.slice(0, filter.limit);
  }

  async writeItem(userId: string, item: MemoryItem): Promise<void> {
    const data = JSON.stringify(item.data ?? {});
    const tags = JSON.stringify(item.tags ?? []);

    this.db
      .prepare(
        `INSERT INTO items (userId, key, type, data, createdAt, tags)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(userId, key) DO UPDATE SET
           type = excluded.type,
           data = excluded.data,
           createdAt = excluded.createdAt,
           tags = excluded.tags`
      )
      .run(userId, item.key, item.type, data, item.createdAt, tags);
  }

  async deleteItem(userId: string, key: string): Promise<void> {
    this.db
      .prepare(`DELETE FROM items WHERE userId = ? AND key = ?`)
      .run(userId, key);
  }

  async listItems(
    userId: string,
    filter: { type?: string }
  ): Promise<Pick<MemoryItem, "key" | "type" | "createdAt" | "tags">[]> {
    const rows = this.db
      .prepare(
        `SELECT key, type, createdAt, tags
         FROM items
         WHERE userId = ?`
      )
      .all(userId) as {
      key: string;
      type: string;
      createdAt: string;
      tags: string;
    }[];

    return rows
      .filter((row) => (filter.type ? row.type === filter.type : true))
      .map((row) => ({
        key: row.key,
        type: row.type,
        createdAt: row.createdAt,
        tags: JSON.parse(row.tags) as string[],
      }));
  }
}

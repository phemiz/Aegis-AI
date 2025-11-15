export interface MemoryItem {
  key: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
  tags: string[];
}

export interface UserProfile {
  userId: string;
  name?: string;
  roles?: string[];
  professionalTone?: string;
  linkedinProfileUrl?: string;
  preferredPlatforms?: string[];
  tags?: string[];
}

export interface MemoryCore {
  getUserProfile(userId: string): Promise<UserProfile | null>;
  writeUserProfile(profile: UserProfile): Promise<void>;

  getItem(userId: string, key: string): Promise<MemoryItem | null>;
  queryItems(
    userId: string,
    filter: { type?: string; tags?: string[]; text?: string; limit: number }
  ): Promise<MemoryItem[]>;
  writeItem(userId: string, item: MemoryItem): Promise<void>;
  deleteItem(userId: string, key: string): Promise<void>;
  listItems(
    userId: string,
    filter: { type?: string }
  ): Promise<Pick<MemoryItem, "key" | "type" | "createdAt" | "tags">[]>;
}

// Simple in-memory implementation (for development and testing)
export class InMemoryMemoryCore implements MemoryCore {
  private profiles = new Map<string, UserProfile>();
  private items = new Map<string, Map<string, MemoryItem>>();

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    return this.profiles.get(userId) ?? null;
  }

  async writeUserProfile(profile: UserProfile): Promise<void> {
    this.profiles.set(profile.userId, profile);
  }

  private ensureUserMap(userId: string): Map<string, MemoryItem> {
    let userMap = this.items.get(userId);
    if (!userMap) {
      userMap = new Map();
      this.items.set(userId, userMap);
    }
    return userMap;
  }

  async getItem(userId: string, key: string): Promise<MemoryItem | null> {
    return this.ensureUserMap(userId).get(key) ?? null;
  }

  async queryItems(
    userId: string,
    filter: { type?: string; tags?: string[]; text?: string; limit: number }
  ): Promise<MemoryItem[]> {
    const userMap = this.ensureUserMap(userId);
    const values = Array.from(userMap.values());
    return values
      .filter((item) => {
        if (filter.type && item.type !== filter.type) return false;
        if (filter.tags && filter.tags.length > 0) {
          const set = new Set(item.tags);
          if (!filter.tags.some((t) => set.has(t))) return false;
        }
        if (filter.text) {
          const text = JSON.stringify(item.data).toLowerCase();
          if (!text.includes(filter.text.toLowerCase())) return false;
        }
        return true;
      })
      .slice(0, filter.limit);
  }

  async writeItem(userId: string, item: MemoryItem): Promise<void> {
    this.ensureUserMap(userId).set(item.key, item);
  }

  async deleteItem(userId: string, key: string): Promise<void> {
    this.ensureUserMap(userId).delete(key);
  }

  async listItems(
    userId: string,
    filter: { type?: string }
  ): Promise<Pick<MemoryItem, "key" | "type" | "createdAt" | "tags">[]> {
    const userMap = this.ensureUserMap(userId);
    return Array.from(userMap.values())
      .filter((item) => (filter.type ? item.type === filter.type : true))
      .map((item) => ({
        key: item.key,
        type: item.type,
        createdAt: item.createdAt,
        tags: item.tags,
      }));
  }
}

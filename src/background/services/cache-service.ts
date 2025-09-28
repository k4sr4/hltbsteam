interface CacheEntry {
  data: any;
  timestamp: number;
  hits: number;
}

export class CacheService {
  private readonly CACHE_KEY = 'hltb_cache';
  private cache: Map<string, CacheEntry> = new Map();
  private cacheDuration: number = 7 * 24 * 60 * 60 * 1000;

  constructor() {
    this.loadCache();
  }

  private async loadCache() {
    const stored = await chrome.storage.local.get(this.CACHE_KEY);
    if (stored[this.CACHE_KEY]) {
      this.cache = new Map(Object.entries(stored[this.CACHE_KEY]));
      this.cleanExpired();
    }
  }

  private async saveCache() {
    await chrome.storage.local.set({
      [this.CACHE_KEY]: Object.fromEntries(this.cache)
    });
  }

  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > this.cacheDuration) {
      this.cache.delete(key);
      await this.saveCache();
      return null;
    }

    entry.hits++;
    await this.saveCache();

    return entry.data;
  }

  async set(key: string, data: any): Promise<void> {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0
    });

    if (this.cache.size > 1000) {
      this.evictLRU();
    }

    await this.saveCache();
  }

  private cleanExpired() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheDuration) {
        this.cache.delete(key);
      }
    }
  }

  private evictLRU() {
    let lruKey = '';
    let minScore = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      const score = entry.hits + (Date.now() - entry.timestamp) / 1000000;
      if (score < minScore) {
        minScore = score;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  async getStats() {
    const values = Array.from(this.cache.values());
    if (values.length === 0) {
      return {
        size: 0,
        hits: 0,
        oldestEntry: null,
        totalSize: 0
      };
    }

    return {
      size: this.cache.size,
      hits: values.reduce((sum, e) => sum + e.hits, 0),
      oldestEntry: Math.min(...values.map(e => e.timestamp)),
      totalSize: JSON.stringify(Object.fromEntries(this.cache)).length
    };
  }

  async clear() {
    this.cache.clear();
    await chrome.storage.local.remove(this.CACHE_KEY);
  }
}
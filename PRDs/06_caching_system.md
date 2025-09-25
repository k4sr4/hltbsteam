name: "Caching System"
description: |

## Purpose
Implement a robust, efficient caching system using Chrome Storage API to minimize HLTB requests, improve performance, and provide offline functionality while managing storage limits intelligently.

## Core Principles
1. **Context is King**: Include Chrome Storage API limits and best practices
2. **Validation Loops**: Test cache hits, misses, and expiration scenarios
3. **Information Dense**: Use exact Chrome Storage API patterns
4. **Progressive Success**: Basic caching first, then intelligent eviction
5. **Efficiency First**: Minimize storage operations and size

---

## Goal
Create a sophisticated caching layer that achieves 80%+ cache hit rate, manages storage efficiently, and provides fast data retrieval while respecting Chrome's storage limits.

## Why
- **Performance**: Cached data loads instantly vs 2+ second API calls
- **Rate Limiting**: Reduces HLTB requests to avoid blocks
- **Offline Support**: Works without internet connection
- **User Experience**: Instant data display for previously viewed games

## What
Caching system providing:
- Multi-tier cache strategy
- Intelligent cache invalidation
- LRU eviction policy
- Storage size management
- Batch operations
- Cache warming
- Statistics tracking
- Compression support
- Version migration
- Export/import functionality

### Success Criteria
- [ ] Cache hit rate > 80%
- [ ] Retrieval time < 10ms
- [ ] Storage usage < 8MB (80% of limit)
- [ ] Batch operations optimized
- [ ] LRU eviction working
- [ ] Cache survives extension updates
- [ ] Statistics accurate
- [ ] No storage quota errors
- [ ] Compression reduces size 30%+
- [ ] Migration handles schema changes

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Critical Documentation
- url: https://developer.chrome.com/docs/extensions/reference/storage/
  why: Chrome Storage API complete reference
  sections: local, sync, session storage types

- url: https://developer.chrome.com/docs/extensions/mv3/storage/
  why: Storage best practices and limits
  sections: Quota, performance tips

- file: C:\steamhltb\HLTB_Steam_Extension_Design.md
  lines: 133-153
  why: Caching strategy requirements

- url: https://github.com/pieroxy/lz-string
  why: JavaScript compression library
  sections: Compression for localStorage

- url: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate
  why: Storage quota estimation
  sections: Available space detection
```

### Chrome Storage Limits
```javascript
// Storage quotas
chrome.storage.local: 10MB (10,485,760 bytes)
chrome.storage.sync: 100KB total, 8KB per item
chrome.storage.session: 10MB (memory only)

// Operation limits
MAX_ITEMS: 512
MAX_WRITE_OPERATIONS_PER_HOUR: 1800
MAX_WRITE_OPERATIONS_PER_MINUTE: 120
MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE: 1000000

// Best practices
- Batch operations when possible
- Use chrome.storage.local for large data
- Compress data before storing
- Monitor quota usage
```

### Cache Structure Design
```typescript
interface CacheStructure {
  version: string;           // Schema version for migrations
  games: {
    [appId: string]: {
      steamTitle: string;
      hltbData: HLTBData;
      timestamp: number;
      hits: number;         // Access count for LRU
      size: number;         // Bytes for quota management
      compressed: boolean;  // Whether data is compressed
    }
  };
  metadata: {
    totalSize: number;
    itemCount: number;
    oldestEntry: number;
    lastCleanup: number;
    statistics: {
      hits: number;
      misses: number;
      evictions: number;
    }
  };
}
```

## Implementation Blueprint

### Task 1: Cache Manager Core
```typescript
// src/background/services/cache-manager.ts
import LZString from 'lz-string';

export class CacheManager {
  private readonly CACHE_VERSION = '1.0.0';
  private readonly MAX_CACHE_SIZE = 8 * 1024 * 1024; // 8MB
  private readonly MAX_ITEM_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly COMPRESSION_THRESHOLD = 1024; // Compress if > 1KB

  private memoryCache: Map<string, CacheEntry> = new Map();
  private statistics = {
    hits: 0,
    misses: 0,
    evictions: 0
  };

  async initialize() {
    console.log('[Cache] Initializing cache manager...');

    // Load existing cache
    await this.loadFromStorage();

    // Check version and migrate if needed
    await this.migrateIfNeeded();

    // Clean expired entries
    await this.cleanExpired();

    // Set up periodic cleanup
    this.setupPeriodicCleanup();
  }

  async get(key: string): Promise<CacheEntry | null> {
    // Check memory cache first
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key)!;
      if (!this.isExpired(entry)) {
        this.statistics.hits++;
        entry.hits++;
        return entry;
      }
    }

    // Check storage cache
    const stored = await chrome.storage.local.get(`cache_${key}`);
    const cacheKey = `cache_${key}`;

    if (stored[cacheKey]) {
      const entry = await this.deserializeEntry(stored[cacheKey]);

      if (!this.isExpired(entry)) {
        this.statistics.hits++;
        entry.hits++;

        // Promote to memory cache
        this.memoryCache.set(key, entry);

        // Update hit count in storage
        await this.updateHitCount(key, entry.hits);

        return entry;
      } else {
        // Remove expired entry
        await this.remove(key);
      }
    }

    this.statistics.misses++;
    return null;
  }

  async set(key: string, data: any, metadata: CacheMetadata = {}) {
    const size = this.calculateSize(data);
    const shouldCompress = size > this.COMPRESSION_THRESHOLD;

    const entry: CacheEntry = {
      data: shouldCompress ? this.compress(data) : data,
      timestamp: Date.now(),
      hits: 0,
      size,
      compressed: shouldCompress,
      steamTitle: metadata.steamTitle,
      ...metadata
    };

    // Check if we need to evict entries
    const currentSize = await this.getTotalSize();
    if (currentSize + size > this.MAX_CACHE_SIZE) {
      await this.evictLRU(size);
    }

    // Store in both memory and storage
    this.memoryCache.set(key, entry);

    const serialized = await this.serializeEntry(entry);
    await chrome.storage.local.set({ [`cache_${key}`]: serialized });

    // Update metadata
    await this.updateMetadata();
  }

  async remove(key: string) {
    this.memoryCache.delete(key);
    await chrome.storage.local.remove(`cache_${key}`);
  }

  async clear() {
    this.memoryCache.clear();

    // Get all cache keys
    const allStorage = await chrome.storage.local.get();
    const cacheKeys = Object.keys(allStorage).filter(k => k.startsWith('cache_'));

    if (cacheKeys.length > 0) {
      await chrome.storage.local.remove(cacheKeys);
    }

    // Reset statistics
    this.statistics = { hits: 0, misses: 0, evictions: 0 };
    await this.updateMetadata();
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.MAX_ITEM_AGE;
  }

  private compress(data: any): string {
    return LZString.compressToUTF16(JSON.stringify(data));
  }

  private decompress(data: string): any {
    return JSON.parse(LZString.decompressFromUTF16(data));
  }

  private calculateSize(data: any): number {
    return new Blob([JSON.stringify(data)]).size;
  }

  private async serializeEntry(entry: CacheEntry): Promise<string> {
    return JSON.stringify(entry);
  }

  private async deserializeEntry(serialized: string): Promise<CacheEntry> {
    const entry = JSON.parse(serialized);
    if (entry.compressed && typeof entry.data === 'string') {
      entry.data = this.decompress(entry.data);
    }
    return entry;
  }

  private async evictLRU(requiredSpace: number) {
    console.log(`[Cache] Evicting entries to free ${requiredSpace} bytes`);

    // Get all cache entries with their access patterns
    const allStorage = await chrome.storage.local.get();
    const cacheEntries: Array<[string, CacheEntry]> = [];

    for (const [key, value] of Object.entries(allStorage)) {
      if (key.startsWith('cache_')) {
        const entry = await this.deserializeEntry(value as string);
        cacheEntries.push([key.replace('cache_', ''), entry]);
      }
    }

    // Sort by LRU score (combination of hits and age)
    cacheEntries.sort((a, b) => {
      const scoreA = a[1].hits / (Date.now() - a[1].timestamp);
      const scoreB = b[1].hits / (Date.now() - b[1].timestamp);
      return scoreA - scoreB;
    });

    // Evict until we have enough space
    let freedSpace = 0;
    const keysToRemove: string[] = [];

    for (const [key, entry] of cacheEntries) {
      if (freedSpace >= requiredSpace) break;

      keysToRemove.push(`cache_${key}`);
      freedSpace += entry.size;
      this.statistics.evictions++;
      this.memoryCache.delete(key);
    }

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      console.log(`[Cache] Evicted ${keysToRemove.length} entries`);
    }
  }

  private async getTotalSize(): Promise<number> {
    const allStorage = await chrome.storage.local.get();
    let totalSize = 0;

    for (const [key, value] of Object.entries(allStorage)) {
      if (key.startsWith('cache_')) {
        totalSize += new Blob([JSON.stringify(value)]).size;
      }
    }

    return totalSize;
  }

  private async updateHitCount(key: string, hits: number) {
    const stored = await chrome.storage.local.get(`cache_${key}`);
    if (stored[`cache_${key}`]) {
      const entry = await this.deserializeEntry(stored[`cache_${key}`]);
      entry.hits = hits;
      const serialized = await this.serializeEntry(entry);
      await chrome.storage.local.set({ [`cache_${key}`]: serialized });
    }
  }

  private async cleanExpired() {
    const allStorage = await chrome.storage.local.get();
    const expiredKeys: string[] = [];

    for (const [key, value] of Object.entries(allStorage)) {
      if (key.startsWith('cache_')) {
        const entry = await this.deserializeEntry(value as string);
        if (this.isExpired(entry)) {
          expiredKeys.push(key);
        }
      }
    }

    if (expiredKeys.length > 0) {
      await chrome.storage.local.remove(expiredKeys);
      console.log(`[Cache] Cleaned ${expiredKeys.length} expired entries`);
    }
  }

  private setupPeriodicCleanup() {
    // Clean up every hour
    chrome.alarms.create('cache-cleanup', { periodInMinutes: 60 });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'cache-cleanup') {
        this.cleanExpired();
        this.updateMetadata();
      }
    });
  }

  private async loadFromStorage() {
    // Load frequently accessed items into memory
    const allStorage = await chrome.storage.local.get();
    const cacheEntries: Array<[string, CacheEntry]> = [];

    for (const [key, value] of Object.entries(allStorage)) {
      if (key.startsWith('cache_')) {
        const entry = await this.deserializeEntry(value as string);
        cacheEntries.push([key.replace('cache_', ''), entry]);
      }
    }

    // Sort by hits and load top entries into memory
    cacheEntries.sort((a, b) => b[1].hits - a[1].hits);

    const memoryLimit = 50; // Keep top 50 in memory
    for (let i = 0; i < Math.min(memoryLimit, cacheEntries.length); i++) {
      const [key, entry] = cacheEntries[i];
      if (!this.isExpired(entry)) {
        this.memoryCache.set(key, entry);
      }
    }
  }

  private async migrateIfNeeded() {
    const metadata = await chrome.storage.local.get('cache_metadata');

    if (!metadata.cache_metadata || metadata.cache_metadata.version !== this.CACHE_VERSION) {
      console.log('[Cache] Migrating cache to new version...');
      // Implement migration logic here
      await this.updateMetadata();
    }
  }

  private async updateMetadata() {
    const totalSize = await this.getTotalSize();
    const allStorage = await chrome.storage.local.get();
    const cacheKeys = Object.keys(allStorage).filter(k => k.startsWith('cache_'));

    const metadata = {
      version: this.CACHE_VERSION,
      totalSize,
      itemCount: cacheKeys.length,
      lastCleanup: Date.now(),
      statistics: this.statistics
    };

    await chrome.storage.local.set({ cache_metadata: metadata });
  }

  async getStatistics() {
    const metadata = await chrome.storage.local.get('cache_metadata');
    const totalSize = await this.getTotalSize();

    return {
      ...this.statistics,
      totalSize,
      itemCount: this.memoryCache.size,
      hitRate: this.statistics.hits / (this.statistics.hits + this.statistics.misses),
      metadata: metadata.cache_metadata
    };
  }
}

interface CacheEntry {
  data: any;
  timestamp: number;
  hits: number;
  size: number;
  compressed: boolean;
  steamTitle?: string;
  [key: string]: any;
}

interface CacheMetadata {
  steamTitle?: string;
  appId?: string;
  priority?: number;
}
```

### Task 2: Cache Warmer
```typescript
// src/background/services/cache-warmer.ts
export class CacheWarmer {
  constructor(private cacheManager: CacheManager) {}

  async warmPopularGames() {
    const popularGames = [
      { title: 'Counter-Strike 2', appId: '730' },
      { title: 'Dota 2', appId: '570' },
      { title: 'PUBG', appId: '578080' },
      { title: 'Apex Legends', appId: '1172470' },
      { title: 'Grand Theft Auto V', appId: '271590' },
      { title: 'Team Fortress 2', appId: '440' },
      { title: 'Rust', appId: '252490' },
      { title: 'Terraria', appId: '105600' },
      { title: 'Stardew Valley', appId: '413150' },
      { title: 'The Witcher 3', appId: '292030' }
    ];

    console.log('[Cache] Warming cache with popular games...');

    for (const game of popularGames) {
      const cached = await this.cacheManager.get(game.appId);
      if (!cached) {
        // Fetch and cache (would call HLTB service)
        // This is a placeholder - actual implementation would fetch real data
        console.log(`[Cache] Warming ${game.title}`);
      }
    }
  }

  async warmFromHistory() {
    // Get user's recent Steam activity
    const recentGames = await this.getRecentGames();

    for (const game of recentGames) {
      await this.cacheManager.get(game.appId);
    }
  }

  private async getRecentGames(): Promise<any[]> {
    // Placeholder - would integrate with Steam API or browser history
    return [];
  }
}
```

### Task 3: Storage Monitor
```typescript
// src/background/services/storage-monitor.ts
export class StorageMonitor {
  private readonly WARNING_THRESHOLD = 0.8; // Warn at 80% usage
  private readonly CRITICAL_THRESHOLD = 0.95; // Critical at 95% usage

  async checkQuota(): Promise<QuotaStatus> {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 10485760; // 10MB default

    const percentUsed = usage / quota;

    return {
      usage,
      quota,
      percentUsed,
      status: this.getStatus(percentUsed),
      availableSpace: quota - usage
    };
  }

  private getStatus(percentUsed: number): 'ok' | 'warning' | 'critical' {
    if (percentUsed >= this.CRITICAL_THRESHOLD) return 'critical';
    if (percentUsed >= this.WARNING_THRESHOLD) return 'warning';
    return 'ok';
  }

  async monitorContinuously() {
    chrome.alarms.create('storage-monitor', { periodInMinutes: 5 });

    chrome.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm.name === 'storage-monitor') {
        const status = await this.checkQuota();

        if (status.status === 'critical') {
          console.error('[Storage] Critical: Storage nearly full!');
          // Trigger aggressive cleanup
        } else if (status.status === 'warning') {
          console.warn('[Storage] Warning: Storage usage high');
          // Trigger gentle cleanup
        }
      }
    });
  }
}

interface QuotaStatus {
  usage: number;
  quota: number;
  percentUsed: number;
  status: 'ok' | 'warning' | 'critical';
  availableSpace: number;
}
```

## Validation Loop

### Level 1: Unit Tests
```typescript
describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager();
  });

  it('should cache and retrieve data', async () => {
    const data = { mainStory: 12, mainExtra: 20 };
    await cacheManager.set('test-key', data);

    const retrieved = await cacheManager.get('test-key');
    expect(retrieved?.data).toEqual(data);
  });

  it('should track hit rate', async () => {
    await cacheManager.set('key1', { test: 1 });

    await cacheManager.get('key1'); // Hit
    await cacheManager.get('key2'); // Miss

    const stats = await cacheManager.getStatistics();
    expect(stats.hitRate).toBe(0.5);
  });

  it('should evict LRU entries', async () => {
    // Fill cache to near limit
    for (let i = 0; i < 100; i++) {
      await cacheManager.set(`key${i}`, { data: 'x'.repeat(100000) });
    }

    const stats = await cacheManager.getStatistics();
    expect(stats.totalSize).toBeLessThan(8 * 1024 * 1024);
  });

  it('should compress large entries', async () => {
    const largeData = { text: 'x'.repeat(10000) };
    await cacheManager.set('large', largeData);

    const stored = await chrome.storage.local.get('cache_large');
    expect(stored.cache_large.compressed).toBe(true);
  });
});
```

## Agent Task Assignments

### For `performance-optimizer` Agent:
- Implement efficient caching algorithms
- Optimize storage operations
- Design compression strategy
- Create batch operation logic

### For `database-architect` Agent:
- Design cache schema
- Plan migration strategies
- Implement indexing logic
- Create eviction policies

## Anti-Patterns to Avoid
- ❌ Don't store uncompressed large data
- ❌ Don't ignore storage quotas
- ❌ Don't skip cache invalidation
- ❌ Don't use sync storage for large data
- ❌ Don't block on storage operations
- ❌ Don't cache sensitive data
- ❌ Don't forget migration logic
- ❌ Don't ignore memory limits
- ❌ Don't skip compression
- ❌ Don't cache invalid data

## Final Validation Checklist
- [ ] Cache hit rate > 80%
- [ ] Retrieval < 10ms
- [ ] Storage < 8MB limit
- [ ] LRU eviction working
- [ ] Compression effective
- [ ] Statistics accurate
- [ ] Migration tested
- [ ] Batch ops optimized
- [ ] Memory cache working
- [ ] Cleanup scheduled
- [ ] Tests passing
- [ ] No quota errors

---

## Confidence Score: 8/10
High confidence due to:
- Clear Chrome Storage API
- Proven caching patterns
- LRU algorithm well-understood

Risk factors:
- Storage quota variations
- Compression overhead
- Migration complexity
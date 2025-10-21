name: "Caching System (OPTIONAL)"
description: |

## Purpose
Implement lightweight caching to remember which Steam games have been matched to HLTB database entries, avoiding re-running fuzzy matching algorithms for previously viewed games.

## Core Principles
1. **Context is King**: Cache only processed match results, not raw data
2. **Validation Loops**: Test cache persistence across sessions
3. **Information Dense**: Use Chrome Storage API efficiently
4. **Progressive Success**: Basic caching first, then statistics
5. **Simplicity First**: Minimal overhead since data is already local

---

## Goal
Create a simple cache that stores Steam game → HLTB database entry mappings to improve performance for repeat page visits.

## Why
- **Performance**: Skip fuzzy matching on repeat visits (~15ms saved per lookup)
- **User Experience**: Instant data display for previously viewed games
- **Offline Support**: Cache persists even after extension restart
- **Statistics**: Track which games users view most

## What Changed from Original PRD
**Original Approach (Abandoned)**:
- ❌ Complex multi-tier caching for API responses
- ❌ LRU eviction with compression
- ❌ Rate limit management
- ❌ Network request caching
- ❌ 8MB storage targets

**New Approach (Current)**:
- ✅ Simple key-value cache for match results
- ✅ Store: `{appId: matchedGameTitle, timestamp, confidence}`
- ✅ No compression needed (tiny data)
- ✅ Minimal storage (<100KB for thousands of entries)
- ✅ Optional feature - fallback database works without cache

## What
Caching system providing:
- Game match result storage
- Cache hit statistics
- 7-day expiration
- Manual clear functionality
- Persistent across sessions

### Success Criteria
- [ ] Cache hit rate > 50%
- [ ] Retrieval time < 5ms
- [ ] Storage usage < 100KB
- [ ] Cache survives extension updates
- [ ] Statistics accurate
- [ ] No storage quota errors

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Critical Documentation
- url: https://developer.chrome.com/docs/extensions/reference/storage/
  why: Chrome Storage API complete reference
  sections: chrome.storage.local basics

- file: C:\hltbsteam\src\background\services\hltb-fallback.ts
  lines: 1-200
  why: Current fallback database implementation
  note: Already has in-memory Map for fast lookups
```

### Chrome Storage Limits
```javascript
// Storage quotas (we need minimal space)
chrome.storage.local: 10MB (10,485,760 bytes)
// We'll use < 100KB for thousands of cache entries

// Best practices
- Use chrome.storage.local for persistent cache
- No compression needed (data is tiny)
- Simple key-value structure
```

### Cache Structure Design
```typescript
interface CacheStructure {
  version: string;
  matches: {
    [steamAppId: string]: {
      matchedTitle: string;      // Title from fallback database
      timestamp: number;          // When match was cached
      confidence: string;         // 'high', 'medium', 'low'
      source: 'direct' | 'alias' | 'fuzzy' | 'partial';
    }
  };
  metadata: {
    totalMatches: number;
    lastCleanup: number;
    statistics: {
      hits: number;
      misses: number;
    }
  };
}
```

## Implementation Blueprint

### Task 1: Simple Cache Manager
```typescript
// src/background/services/cache-manager.ts
export class MatchCacheManager {
  private readonly CACHE_VERSION = '1.0.0';
  private readonly MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

  private memoryCache: Map<string, CachedMatch> = new Map();
  private statistics = {
    hits: 0,
    misses: 0
  };

  async initialize() {
    console.log('[Cache] Initializing match cache...');
    await this.loadFromStorage();
    await this.cleanExpired();
  }

  async get(steamAppId: string): Promise<CachedMatch | null> {
    // Check memory cache first
    if (this.memoryCache.has(steamAppId)) {
      const entry = this.memoryCache.get(steamAppId)!;

      if (!this.isExpired(entry)) {
        this.statistics.hits++;
        console.log(`[Cache] Hit for appId ${steamAppId}: ${entry.matchedTitle}`);
        return entry;
      } else {
        // Expired, remove it
        await this.remove(steamAppId);
      }
    }

    // Check storage cache
    const stored = await chrome.storage.local.get(`match_${steamAppId}`);
    const cacheKey = `match_${steamAppId}`;

    if (stored[cacheKey]) {
      const entry = stored[cacheKey] as CachedMatch;

      if (!this.isExpired(entry)) {
        this.statistics.hits++;
        this.memoryCache.set(steamAppId, entry);
        console.log(`[Cache] Storage hit for appId ${steamAppId}: ${entry.matchedTitle}`);
        return entry;
      } else {
        await this.remove(steamAppId);
      }
    }

    this.statistics.misses++;
    return null;
  }

  async set(steamAppId: string, match: MatchResult) {
    const entry: CachedMatch = {
      matchedTitle: match.title,
      timestamp: Date.now(),
      confidence: match.confidence,
      source: match.source
    };

    // Store in both memory and storage
    this.memoryCache.set(steamAppId, entry);
    await chrome.storage.local.set({ [`match_${steamAppId}`]: entry });

    console.log(`[Cache] Cached match for appId ${steamAppId}: ${match.title}`);
  }

  async remove(steamAppId: string) {
    this.memoryCache.delete(steamAppId);
    await chrome.storage.local.remove(`match_${steamAppId}`);
  }

  async clear() {
    this.memoryCache.clear();

    // Get all cache keys
    const allStorage = await chrome.storage.local.get();
    const matchKeys = Object.keys(allStorage).filter(k => k.startsWith('match_'));

    if (matchKeys.length > 0) {
      await chrome.storage.local.remove(matchKeys);
    }

    // Reset statistics
    this.statistics = { hits: 0, misses: 0 };
    console.log('[Cache] Cleared all cached matches');
  }

  private isExpired(entry: CachedMatch): boolean {
    return Date.now() - entry.timestamp > this.MAX_CACHE_AGE;
  }

  private async cleanExpired() {
    const allStorage = await chrome.storage.local.get();
    const expiredKeys: string[] = [];

    for (const [key, value] of Object.entries(allStorage)) {
      if (key.startsWith('match_')) {
        const entry = value as CachedMatch;
        if (this.isExpired(entry)) {
          expiredKeys.push(key);

          // Also remove from memory cache
          const appId = key.replace('match_', '');
          this.memoryCache.delete(appId);
        }
      }
    }

    if (expiredKeys.length > 0) {
      await chrome.storage.local.remove(expiredKeys);
      console.log(`[Cache] Cleaned ${expiredKeys.length} expired entries`);
    }
  }

  private async loadFromStorage() {
    const allStorage = await chrome.storage.local.get();
    let loadedCount = 0;

    for (const [key, value] of Object.entries(allStorage)) {
      if (key.startsWith('match_')) {
        const entry = value as CachedMatch;
        if (!this.isExpired(entry)) {
          const appId = key.replace('match_', '');
          this.memoryCache.set(appId, entry);
          loadedCount++;
        }
      }
    }

    console.log(`[Cache] Loaded ${loadedCount} cached matches into memory`);
  }

  async getStatistics() {
    const allStorage = await chrome.storage.local.get();
    const matchKeys = Object.keys(allStorage).filter(k => k.startsWith('match_'));

    return {
      ...this.statistics,
      totalCached: matchKeys.length,
      hitRate: this.statistics.hits / (this.statistics.hits + this.statistics.misses) || 0,
      memorySize: this.memoryCache.size
    };
  }
}

interface CachedMatch {
  matchedTitle: string;
  timestamp: number;
  confidence: 'high' | 'medium' | 'low';
  source: 'direct' | 'alias' | 'fuzzy' | 'partial';
}

interface MatchResult {
  title: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'direct' | 'alias' | 'fuzzy' | 'partial';
}
```

### Task 2: Integration with Fallback Service
```typescript
// Update src/background/services/hltb-fallback.ts

import { MatchCacheManager } from './cache-manager';

export class HLTBFallbackService {
  private cacheManager: MatchCacheManager;

  constructor() {
    this.cacheManager = new MatchCacheManager();
  }

  async initialize() {
    await this.cacheManager.initialize();
    this.initializeLocalDatabase();
  }

  async searchByTitle(title: string, appId?: string): Promise<HLTBData | null> {
    // Check cache first if we have appId
    if (appId) {
      const cached = await this.cacheManager.get(appId);
      if (cached) {
        console.log('[HLTB] Using cached match');
        return this.localDatabase.get(this.normalizeTitle(cached.matchedTitle))?.data || null;
      }
    }

    // Cache miss - run normal matching
    const result = this.performMatching(title);

    // Cache the result if we found a match
    if (result && appId) {
      await this.cacheManager.set(appId, {
        title: result.matchedTitle,
        confidence: result.confidence,
        source: result.source
      });
    }

    return result?.data || null;
  }

  private performMatching(title: string): MatchWithMetadata | null {
    // Existing matching logic...
    // Returns { matchedTitle, data, confidence, source }
  }

  async getCacheStats() {
    return this.cacheManager.getStatistics();
  }

  async clearCache() {
    await this.cacheManager.clear();
  }
}
```

### Task 3: Background Service Integration
```typescript
// Add to src/background/background.ts

// Handle cache statistics request
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCacheStats') {
    fallbackService.getCacheStats().then(stats => {
      sendResponse({ success: true, data: stats });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'clearCache') {
    fallbackService.clearCache().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});
```

## Validation Loop

### Level 1: Unit Tests
```typescript
describe('MatchCacheManager', () => {
  let cacheManager: MatchCacheManager;

  beforeEach(async () => {
    cacheManager = new MatchCacheManager();
    await cacheManager.initialize();
  });

  it('should cache and retrieve match results', async () => {
    await cacheManager.set('480', {
      title: 'Portal',
      confidence: 'high',
      source: 'direct'
    });

    const cached = await cacheManager.get('480');
    expect(cached?.matchedTitle).toBe('Portal');
    expect(cached?.confidence).toBe('high');
  });

  it('should track hit rate', async () => {
    await cacheManager.set('480', {
      title: 'Portal',
      confidence: 'high',
      source: 'direct'
    });

    await cacheManager.get('480'); // Hit
    await cacheManager.get('999'); // Miss

    const stats = await cacheManager.getStatistics();
    expect(stats.hitRate).toBe(0.5);
  });

  it('should expire old entries', async () => {
    const oldEntry = {
      matchedTitle: 'Portal',
      timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000), // 8 days old
      confidence: 'high' as const,
      source: 'direct' as const
    };

    await chrome.storage.local.set({ 'match_480': oldEntry });

    const cached = await cacheManager.get('480');
    expect(cached).toBeNull();
  });

  it('should use minimal storage space', async () => {
    // Cache 100 matches
    for (let i = 0; i < 100; i++) {
      await cacheManager.set(`${i}`, {
        title: `Game ${i}`,
        confidence: 'high',
        source: 'direct'
      });
    }

    const allStorage = await chrome.storage.local.get();
    const storageSize = JSON.stringify(allStorage).length;

    // Should be < 50KB for 100 entries
    expect(storageSize).toBeLessThan(50 * 1024);
  });
});
```

## Why This is Optional

The cache provides **performance benefits** but is not required for functionality:

1. **Fallback database already fast**: In-memory Map lookups are ~1ms
2. **Fuzzy matching is fast**: ~15ms for most cases
3. **Main benefit**: Avoiding re-running fuzzy matching on repeat visits
4. **Can skip for MVP**: Focus on core functionality first

## Implementation Priority

**Phase 1 (MVP)**: ❌ Skip caching entirely
- Fallback database works fine without it
- Every lookup runs fresh matching (~15ms)
- Simpler architecture

**Phase 2 (Enhancement)**: ✅ Add simple caching
- Implement MatchCacheManager
- 50%+ cache hit rate expected
- ~10-15ms performance improvement per cached hit

## Anti-Patterns to Avoid
- ❌ Don't cache HLTB data itself (already in fallback database)
- ❌ Don't use compression (data is tiny)
- ❌ Don't implement complex eviction (7-day expiration is enough)
- ❌ Don't cache failed lookups (waste of space)
- ❌ Don't block on cache operations (always async)

## Final Validation Checklist
- [ ] Cache hit rate > 50%
- [ ] Retrieval < 5ms
- [ ] Storage < 100KB
- [ ] Expiration working
- [ ] Statistics accurate
- [ ] No quota errors
- [ ] Survives extension restart
- [ ] Clear functionality works
- [ ] Tests passing

---

## Confidence Score: 10/10
Very high confidence due to:
- Simple key-value structure
- Clear Chrome Storage API
- Minimal storage requirements
- Optional feature - can skip for MVP

No significant risks.

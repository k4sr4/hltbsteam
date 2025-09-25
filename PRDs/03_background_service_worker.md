name: "Background Service Worker"
description: |

## Purpose
Implement a robust service worker that handles all background operations including HLTB data fetching, caching, message routing, and managing CORS restrictions for the Chrome Extension.

## Core Principles
1. **Context is King**: Include complete service worker lifecycle and Chrome Extension API patterns
2. **Validation Loops**: Test message passing, CORS handling, and service worker persistence
3. **Information Dense**: Use exact Chrome Extension API methods and service worker patterns
4. **Progressive Success**: Basic message handling first, then complex operations
5. **Resilience First**: Handle service worker termination and revival gracefully

---

## Goal
Create a service worker that manages all background tasks, handles cross-origin requests to HLTB, implements intelligent caching, and provides reliable message-based communication with content scripts.

## Why
- **CORS Bypass**: Service workers can make cross-origin requests that content scripts cannot
- **Performance**: Centralized caching and request management
- **Reliability**: Service workers persist across page navigations
- **Architecture**: Clean separation of concerns between UI and data layer

## What
Service worker system providing:
- Message-based API for content scripts
- HLTB data fetching with CORS handling
- Request queuing and rate limiting
- Cache management with expiration
- Automatic retry logic
- Batch request optimization
- State persistence across sessions
- Error handling and logging
- Keep-alive mechanism

### Success Criteria
- [ ] Service worker stays alive during operations
- [ ] HLTB requests succeed despite CORS
- [ ] Message response time < 100ms
- [ ] Cache hit rate > 80%
- [ ] Rate limiting prevents 429 errors
- [ ] Handles service worker termination gracefully
- [ ] Batch requests reduce API calls by 50%
- [ ] Memory usage < 50MB
- [ ] No message channel leaks
- [ ] Retry logic handles transient failures

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Critical Documentation
- url: https://developer.chrome.com/docs/extensions/mv3/service_workers/
  why: Service worker lifecycle and patterns
  sections: Persistence, events, debugging

- url: https://developer.chrome.com/docs/extensions/reference/runtime/
  why: Chrome runtime API for messaging
  sections: sendMessage, onMessage, connect

- url: https://developer.chrome.com/docs/extensions/reference/storage/
  why: Chrome storage API for caching
  sections: local, session, sync storage

- url: https://howlongtobeat.com/
  why: Analyze HLTB request patterns
  action: Use DevTools to inspect API calls

- url: https://github.com/fregante/webext-polyfill
  why: Cross-browser compatibility layer
  sections: Promise-based APIs

- file: C:\steamhltb\HLTB_Steam_Extension_Design.md
  lines: 73-91, 108-133
  why: Background worker requirements and data flow
```

### Service Worker Lifecycle
```javascript
// Service worker states
INSTALLING -> INSTALLED -> ACTIVATING -> ACTIVATED -> REDUNDANT

// Key events
install     // First installation
activate    // Worker takes control
fetch       // Network request interception (not used in extensions)
message     // Message from content script

// Chrome Extension specific events
chrome.runtime.onInstalled      // Extension installed/updated
chrome.runtime.onStartup        // Browser starts
chrome.runtime.onSuspend        // Worker about to terminate
chrome.runtime.onMessage         // Message from content script
chrome.runtime.onConnect         // Persistent connection established
```

### HLTB API Structure (Reverse Engineered)
```javascript
// HLTB Search endpoint
POST https://howlongtobeat.com/api/search
Headers:
  Content-Type: application/json
  Referer: https://howlongtobeat.com
Body: {
  searchType: "games",
  searchTerms: ["game title"],
  searchPage: 1,
  size: 20,
  searchOptions: {
    games: {
      userId: 0,
      platform: "",
      sortCategory: "popular",
      rangeCategory: "main",
      rangeTime: { min: 0, max: 0 },
      gameplay: { perspective: "", flow: "", genre: "" },
      modifier: ""
    },
    users: { sortCategory: "postcount" },
    filter: "",
    sort: 0,
    randomizer: 0
  }
}

// Response structure
{
  data: [
    {
      game_id: 12345,
      game_name: "Game Title",
      comp_main: 720,        // Minutes for main story
      comp_plus: 1440,       // Minutes for main + extras
      comp_100: 2160,        // Minutes for completionist
      comp_all: 1440,        // Average of all playstyles
      invested_co: 0,
      invested_mp: 0,
      invested_co_mp: 0,
      count_comp: 100,       // Number of completions
      count_speedrun: 0,
      count_backlog: 500,
      count_review: 200
    }
  ]
}
```

### Known Gotchas & Critical Information
```typescript
// CRITICAL: Service workers terminate after 30 seconds of inactivity
// Use keep-alive pattern or chrome.alarms API

// CRITICAL: No access to localStorage or sessionStorage
// Must use chrome.storage API

// CRITICAL: Service workers have no DOM
// Cannot use document, window, or XMLHttpRequest

// CRITICAL: Fetch API is the only way to make HTTP requests
// No jQuery.ajax or axios

// CRITICAL: chrome.runtime.sendMessage must return true for async
// Or the message channel closes immediately

// CRITICAL: Service worker updates require version bump
// Changes don't apply until extension is reloaded

// CRITICAL: CORS mode must be 'cors' or 'no-cors'
// 'no-cors' limits response access

// CRITICAL: chrome.storage.local has 10MB limit
// Plan cache size accordingly

// CRITICAL: Rate limiting is crucial
// HLTB may block excessive requests
```

## Implementation Blueprint

### Task 1: Service Worker Base
```typescript
// src/background/service-worker.ts
import { MessageHandler } from './message-handler';
import { HLTBService } from './services/hltb-service';
import { CacheService } from './services/cache-service';
import { QueueService } from './services/queue-service';

// Initialize services
const cacheService = new CacheService();
const queueService = new QueueService();
const hltbService = new HLTBService(cacheService, queueService);
const messageHandler = new MessageHandler(hltbService);

// Extension lifecycle events
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[HLTB] Extension installed:', details.reason);

  if (details.reason === 'install') {
    // Set default settings
    await chrome.storage.local.set({
      enabled: true,
      cacheEnabled: true,
      cacheDurationHours: 168, // 7 days
      rateLimit: {
        maxRequests: 10,
        windowMs: 60000 // 1 minute
      }
    });
  } else if (details.reason === 'update') {
    // Handle migrations if needed
    const previousVersion = details.previousVersion;
    console.log('[HLTB] Updated from version:', previousVersion);
  }
});

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[HLTB] Message received:', request.action);

  // Handle message asynchronously
  messageHandler
    .handle(request, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('[HLTB] Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    });

  // Keep message channel open
  return true;
});

// Keep service worker alive
const keepAlive = () => {
  // Simple keep-alive using chrome API calls
  chrome.runtime.getPlatformInfo(() => {});
};

// Set up periodic keep-alive
chrome.alarms.create('keep-alive', { periodInMinutes: 0.25 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keep-alive') {
    keepAlive();
  }
});

// Handle suspension (cleanup before termination)
chrome.runtime.onSuspend.addListener(() => {
  console.log('[HLTB] Service worker suspending...');
  // Flush any pending operations
  queueService.flush();
});
```

### Task 2: Message Handler
```typescript
// src/background/message-handler.ts
export class MessageHandler {
  constructor(private hltbService: HLTBService) {}

  async handle(request: any, sender: chrome.runtime.MessageSender) {
    switch (request.action) {
      case 'fetchHLTB':
        return this.handleFetchHLTB(request);

      case 'clearCache':
        return this.handleClearCache();

      case 'getCacheStats':
        return this.handleGetCacheStats();

      case 'batchFetch':
        return this.handleBatchFetch(request);

      default:
        throw new Error(`Unknown action: ${request.action}`);
    }
  }

  private async handleFetchHLTB(request: any) {
    const { gameTitle, appId } = request;

    if (!gameTitle) {
      return { success: false, error: 'Game title is required' };
    }

    try {
      const data = await this.hltbService.getGameData(gameTitle, appId);
      return { success: true, data };
    } catch (error) {
      console.error('[HLTB] Fetch error:', error);
      return { success: false, error: error.message };
    }
  }

  private async handleClearCache() {
    await chrome.storage.local.remove(['cache']);
    return { success: true, message: 'Cache cleared' };
  }

  private async handleGetCacheStats() {
    const stats = await this.hltbService.getCacheStats();
    return { success: true, data: stats };
  }

  private async handleBatchFetch(request: any) {
    const { games } = request;

    if (!Array.isArray(games)) {
      return { success: false, error: 'Games array is required' };
    }

    const results = await this.hltbService.batchFetch(games);
    return { success: true, data: results };
  }
}
```

### Task 3: HLTB Service
```typescript
// src/background/services/hltb-service.ts
interface HLTBData {
  mainStory: number | null;
  mainExtra: number | null;
  completionist: number | null;
  allStyles: number | null;
}

export class HLTBService {
  private readonly API_URL = 'https://howlongtobeat.com/api/search';

  constructor(
    private cacheService: CacheService,
    private queueService: QueueService
  ) {}

  async getGameData(gameTitle: string, appId?: string): Promise<HLTBData | null> {
    // Check cache first
    const cached = await this.cacheService.get(appId || gameTitle);
    if (cached) {
      console.log('[HLTB] Cache hit:', gameTitle);
      return cached;
    }

    // Queue the request
    return this.queueService.enqueue(async () => {
      const data = await this.fetchFromHLTB(gameTitle);

      // Cache the result
      if (data) {
        await this.cacheService.set(appId || gameTitle, data);
      }

      return data;
    });
  }

  private async fetchFromHLTB(gameTitle: string): Promise<HLTBData | null> {
    console.log('[HLTB] Fetching data for:', gameTitle);

    const searchPayload = {
      searchType: 'games',
      searchTerms: [gameTitle],
      searchPage: 1,
      size: 20,
      searchOptions: {
        games: {
          userId: 0,
          platform: '',
          sortCategory: 'popular',
          rangeCategory: 'main',
          rangeTime: { min: 0, max: 0 },
          gameplay: { perspective: '', flow: '', genre: '' },
          modifier: ''
        },
        users: { sortCategory: 'postcount' },
        filter: '',
        sort: 0,
        randomizer: 0
      }
    };

    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer': 'https://howlongtobeat.com'
        },
        body: JSON.stringify(searchPayload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      const games = json.data;

      if (!games || games.length === 0) {
        console.log('[HLTB] No results found for:', gameTitle);
        return null;
      }

      // Find best match (will be improved in game matching PRD)
      const bestMatch = games[0];

      return this.parseGameData(bestMatch);
    } catch (error) {
      console.error('[HLTB] Fetch error:', error);

      // Try fallback scraping method
      return this.fallbackScraping(gameTitle);
    }
  }

  private parseGameData(game: any): HLTBData {
    // Convert minutes to hours
    const minutesToHours = (minutes: number) => {
      return minutes > 0 ? Math.round(minutes / 60) : null;
    };

    return {
      mainStory: minutesToHours(game.comp_main),
      mainExtra: minutesToHours(game.comp_plus),
      completionist: minutesToHours(game.comp_100),
      allStyles: minutesToHours(game.comp_all)
    };
  }

  private async fallbackScraping(gameTitle: string): Promise<HLTBData | null> {
    console.log('[HLTB] Trying fallback scraping for:', gameTitle);

    try {
      // Encode game title for URL
      const encoded = encodeURIComponent(gameTitle);
      const searchUrl = `https://howlongtobeat.com/?q=${encoded}`;

      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Scraping failed: ${response.status}`);
      }

      const html = await response.text();

      // Parse HTML (simplified - actual implementation would use DOMParser)
      // This is a placeholder - real implementation in HLTB Data Integration PRD
      return null;
    } catch (error) {
      console.error('[HLTB] Scraping error:', error);
      return null;
    }
  }

  async batchFetch(games: Array<{ title: string; appId: string }>) {
    const results = new Map();

    // Check cache for all games first
    for (const game of games) {
      const cached = await this.cacheService.get(game.appId);
      if (cached) {
        results.set(game.appId, cached);
      }
    }

    // Fetch missing games
    const missing = games.filter(g => !results.has(g.appId));

    // Batch process with rate limiting
    for (const game of missing) {
      const data = await this.getGameData(game.title, game.appId);
      results.set(game.appId, data);
    }

    return Object.fromEntries(results);
  }

  async getCacheStats() {
    return this.cacheService.getStats();
  }
}
```

### Task 4: Cache Service
```typescript
// src/background/services/cache-service.ts
interface CacheEntry {
  data: any;
  timestamp: number;
  hits: number;
}

export class CacheService {
  private readonly CACHE_KEY = 'hltb_cache';
  private cache: Map<string, CacheEntry> = new Map();
  private cacheDuration: number = 7 * 24 * 60 * 60 * 1000; // 7 days

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

    // Check if expired
    if (Date.now() - entry.timestamp > this.cacheDuration) {
      this.cache.delete(key);
      await this.saveCache();
      return null;
    }

    // Update hit count
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

    // Limit cache size
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
    // Find least recently used entry
    let lruKey = '';
    let minHits = Infinity;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      const score = entry.hits + (Date.now() - entry.timestamp) / 1000000;
      if (score < minHits) {
        minHits = score;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  async getStats() {
    return {
      size: this.cache.size,
      hits: Array.from(this.cache.values()).reduce((sum, e) => sum + e.hits, 0),
      oldestEntry: Math.min(...Array.from(this.cache.values()).map(e => e.timestamp)),
      totalSize: JSON.stringify(Object.fromEntries(this.cache)).length
    };
  }
}
```

### Task 5: Queue Service
```typescript
// src/background/services/queue-service.ts
export class QueueService {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter(10, 60000); // 10 requests per minute
  }

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          await this.rateLimiter.wait();
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await task();
      }
    }

    this.processing = false;
  }

  flush() {
    // Process all remaining items immediately
    return Promise.all(this.queue.map(task => task()));
  }
}

class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,
    private windowMs: number
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async wait(): Promise<void> {
    this.refill();

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    // Calculate wait time
    const waitTime = this.windowMs - (Date.now() - this.lastRefill);
    await new Promise(resolve => setTimeout(resolve, waitTime));

    this.refill();
    this.tokens--;
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    if (elapsed >= this.windowMs) {
      this.tokens = this.maxTokens;
      this.lastRefill = now;
    }
  }
}
```

## Validation Loop

### Level 1: Unit Tests
```typescript
// tests/service-worker.test.ts
describe('Service Worker', () => {
  it('should handle fetchHLTB message', async () => {
    const response = await chrome.runtime.sendMessage({
      action: 'fetchHLTB',
      gameTitle: 'Portal 2',
      appId: '620'
    });

    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('mainStory');
  });

  it('should cache responses', async () => {
    // First request
    await chrome.runtime.sendMessage({
      action: 'fetchHLTB',
      gameTitle: 'Portal 2',
      appId: '620'
    });

    // Second request should be from cache
    const start = performance.now();
    await chrome.runtime.sendMessage({
      action: 'fetchHLTB',
      gameTitle: 'Portal 2',
      appId: '620'
    });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(10); // Cache hit should be fast
  });

  it('should handle rate limiting', async () => {
    const requests = Array(20).fill(0).map((_, i) =>
      chrome.runtime.sendMessage({
        action: 'fetchHLTB',
        gameTitle: `Game ${i}`,
        appId: `${i}`
      })
    );

    // Should not throw rate limit errors
    await expect(Promise.all(requests)).resolves.toBeDefined();
  });
});
```

### Level 2: Integration Tests
```bash
# Test service worker lifecycle
chrome.runtime.reload()
# Expected: Service worker restarts, cache persists

# Test message passing
chrome.runtime.sendMessage({ action: 'fetchHLTB', gameTitle: 'Hades' })
# Expected: Response within 2 seconds

# Test CORS handling
# Check network tab for HLTB requests
# Expected: Requests succeed from service worker
```

## Agent Task Assignments

### For `api-integration-specialist` Agent:
- Implement HLTB API integration
- Handle CORS and authentication
- Design fallback scraping logic
- Implement retry strategies

### For `performance-optimizer` Agent:
- Optimize cache algorithms
- Implement efficient queue processing
- Design memory management
- Create batch request optimization

### For `general-purpose` Agent:
- Implement message handling
- Create service worker lifecycle management
- Handle error states
- Implement logging system

## Anti-Patterns to Avoid
- ❌ Don't use XMLHttpRequest (use fetch)
- ❌ Don't store data in global variables
- ❌ Don't forget to return true in onMessage
- ❌ Don't make synchronous storage calls
- ❌ Don't ignore service worker termination
- ❌ Don't skip rate limiting
- ❌ Don't cache sensitive data
- ❌ Don't use timers for keep-alive (use alarms)
- ❌ Don't forget error boundaries
- ❌ Don't leak message channels

## Final Validation Checklist
- [ ] Service worker loads without errors
- [ ] Messages handled correctly
- [ ] CORS bypassed successfully
- [ ] Cache working with expiration
- [ ] Rate limiting prevents 429s
- [ ] Keep-alive maintains worker
- [ ] Memory usage acceptable
- [ ] Batch requests optimized
- [ ] Error handling comprehensive
- [ ] Tests pass with coverage
- [ ] No console errors
- [ ] Performance metrics met

---

## Confidence Score: 7/10
Good confidence due to:
- Clear service worker patterns
- Well-documented Chrome APIs
- Established caching strategies

Risk factors:
- HLTB API may change
- Service worker lifecycle complexity
- Rate limiting tuning required
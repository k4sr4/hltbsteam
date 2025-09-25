name: "HLTB Data Integration"
description: |

## Purpose
Implement robust HowLongToBeat data integration with multiple fallback strategies, including API calls, web scraping, and community databases to ensure reliable game completion time data.

## Core Principles
1. **Context is King**: Include complete HLTB API patterns and HTML structure
2. **Validation Loops**: Test with various game titles and edge cases
3. **Information Dense**: Use exact HLTB selectors and API payloads
4. **Progressive Success**: Try API first, then scraping, then fallbacks
5. **Reliability First**: Multiple strategies ensure data availability

---

## Goal
Create a comprehensive HLTB data fetching system that reliably retrieves game completion times through multiple methods, handles various response formats, and provides accurate data parsing.

## Why
- **No Official API**: HLTB doesn't provide public API, requiring creative solutions
- **Data Quality**: Users rely on accurate completion times for purchasing decisions
- **Reliability**: Single method failure shouldn't break the extension
- **Performance**: Efficient data retrieval improves user experience

## What
HLTB integration system providing:
- Multiple data fetching strategies
- HTML scraping with DOMParser
- API endpoint discovery and usage
- Response parsing and normalization
- Data validation and sanitization
- Fallback to cached community data
- Error recovery mechanisms
- Platform-specific time filtering
- DLC and expansion handling

### Success Criteria
- [ ] Data retrieved for 90%+ of games
- [ ] Response time < 2 seconds average
- [ ] Accurate time parsing (within 1 hour)
- [ ] Handles rate limiting gracefully
- [ ] Works with VPN/proxy users
- [ ] Parses all time categories correctly
- [ ] Handles missing data gracefully
- [ ] No false positive matches
- [ ] Respects robots.txt
- [ ] Implements exponential backoff

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Critical Resources
- url: https://howlongtobeat.com/
  why: Analyze current HTML structure
  action: Inspect search results and game pages

- url: https://github.com/ckatzorke/howlongtobeat
  why: Node.js HLTB scraper reference
  sections: Parsing logic and selectors

- url: https://developer.mozilla.org/en-US/docs/Web/API/DOMParser
  why: HTML parsing in service workers
  sections: parseFromString usage

- file: C:\steamhltb\HLTB_Steam_Extension_Design.md
  lines: 108-133, 425-443
  why: Data acquisition strategy and code examples

- url: https://github.com/ScrappyCocco/HowLongToBeat-PythonAPI
  why: Python implementation reference
  sections: Search payload structure

- url: https://www.scraperapi.com/blog/web-scraping-best-practices/
  why: Scraping best practices
  sections: Rate limiting, user agents
```

### HLTB HTML Structure (Current)
```html
<!-- Search Results Page -->
<div class="search_list_details">
  <div class="search_list_details_block">
    <div class="search_list_tidbit text_white shadow_text">
      <div class="search_list_tidbit_short">Main Story</div>
      <div class="search_list_tidbit_long">12½ Hours</div>
    </div>
    <div class="search_list_tidbit text_white shadow_text">
      <div class="search_list_tidbit_short">Main + Extras</div>
      <div class="search_list_tidbit_long">17 Hours</div>
    </div>
    <div class="search_list_tidbit text_white shadow_text">
      <div class="search_list_tidbit_short">Completionist</div>
      <div class="search_list_tidbit_long">21½ Hours</div>
    </div>
  </div>
</div>

<!-- Game Details Page -->
<div class="game_times">
  <li class="time_100">
    <h5>Main Story</h5>
    <div>12 Hours</div>
  </li>
  <li class="time_200">
    <h5>Main + Extras</h5>
    <div>17 Hours</div>
  </li>
  <li class="time_300">
    <h5>Completionist</h5>
    <div>21 Hours</div>
  </li>
</div>
```

### HLTB API Endpoints (Discovered)
```javascript
// Search endpoint (POST)
https://howlongtobeat.com/api/search

// Search payload structure
{
  "searchType": "games",
  "searchTerms": ["game title"],
  "searchPage": 1,
  "size": 20,
  "searchOptions": {
    "games": {
      "userId": 0,
      "platform": "",
      "sortCategory": "popular",
      "rangeCategory": "main",
      "rangeTime": { "min": 0, "max": 0 },
      "gameplay": { "perspective": "", "flow": "", "genre": "" },
      "modifier": ""
    },
    "users": { "sortCategory": "postcount" },
    "filter": "",
    "sort": 0,
    "randomizer": 0
  }
}

// Game detail endpoint (GET)
https://howlongtobeat.com/game/{gameId}

// Legacy search endpoint
https://howlongtobeat.com/search_results?page=1
POST with form data: queryString={title}&t=games&sorthead=popular
```

### Known Gotchas & Critical Information
```typescript
// CRITICAL: HLTB blocks requests without proper headers
// Must include Referer and User-Agent

// CRITICAL: Time format varies
// "12 Hours", "12½ Hours", "1½ - 2 Hours", "--"

// CRITICAL: Game IDs are not stable
// Same game may have different IDs over time

// CRITICAL: Search is fuzzy but inconsistent
// "CS:GO" won't find "Counter-Strike: Global Offensive"

// CRITICAL: Platform-specific times exist
// PC times may differ from console

// CRITICAL: Some games have ranges
// "20 - 25 Hours" needs parsing

// CRITICAL: DLC listed separately
// Need to filter or mark appropriately

// CRITICAL: Rate limiting is aggressive
// 429 errors after ~20 requests/minute

// CRITICAL: Cloudflare protection active
// May need to handle challenges

// CRITICAL: HTML structure changes periodically
// Need multiple selector strategies
```

## Implementation Blueprint

### Task 1: HLTB API Client
```typescript
// src/background/services/hltb-api-client.ts
export class HLTBApiClient {
  private readonly BASE_URL = 'https://howlongtobeat.com';
  private readonly SEARCH_ENDPOINT = '/api/search';
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  async searchGames(title: string): Promise<HLTBSearchResult[]> {
    const payload = this.buildSearchPayload(title);

    try {
      const response = await fetch(`${this.BASE_URL}${this.SEARCH_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer': this.BASE_URL,
          'User-Agent': this.USER_AGENT,
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': this.BASE_URL
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 429) {
        throw new RateLimitError('Rate limit exceeded');
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return this.parseSearchResults(data);

    } catch (error) {
      console.error('[HLTB] API search failed:', error);
      throw error;
    }
  }

  private buildSearchPayload(title: string) {
    return {
      searchType: 'games',
      searchTerms: [title],
      searchPage: 1,
      size: 20,
      searchOptions: {
        games: {
          userId: 0,
          platform: '', // Empty for all platforms
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
  }

  private parseSearchResults(data: any): HLTBSearchResult[] {
    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data.map((game: any) => ({
      gameId: game.game_id,
      gameName: game.game_name,
      gameImage: game.game_image,
      mainStory: this.parseTime(game.comp_main),
      mainExtra: this.parseTime(game.comp_plus),
      completionist: this.parseTime(game.comp_100),
      allStyles: this.parseTime(game.comp_all),
      platforms: game.profile_platform?.split(', ') || [],
      releaseDate: game.release_world,
      review_score: game.review_score,
      similarity: 1.0 // Will be calculated by matching algorithm
    }));
  }

  private parseTime(minutes: number): number | null {
    if (!minutes || minutes <= 0) return null;
    return Math.round(minutes / 60); // Convert to hours
  }
}
```

### Task 2: Web Scraper
```typescript
// src/background/services/hltb-scraper.ts
export class HLTBScraper {
  private readonly BASE_URL = 'https://howlongtobeat.com';

  async scrapeSearch(title: string): Promise<HLTBSearchResult[]> {
    try {
      // First, try the search page
      const searchUrl = `${this.BASE_URL}?q=${encodeURIComponent(title)}`;

      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Scraping failed: ${response.status}`);
      }

      const html = await response.text();
      return this.parseSearchHTML(html);

    } catch (error) {
      console.error('[HLTB] Scraping failed:', error);
      return [];
    }
  }

  private parseSearchHTML(html: string): HLTBSearchResult[] {
    // Parse HTML using DOMParser (available in service workers)
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const results: HLTBSearchResult[] = [];
    const gameCards = doc.querySelectorAll('.search_list_details');

    gameCards.forEach((card) => {
      const result = this.parseGameCard(card);
      if (result) {
        results.push(result);
      }
    });

    return results;
  }

  private parseGameCard(card: Element): HLTBSearchResult | null {
    try {
      // Extract game name
      const nameElement = card.querySelector('.search_list_details_block h3 a');
      const gameName = nameElement?.textContent?.trim();

      if (!gameName) return null;

      // Extract game ID from link
      const gameLink = nameElement?.getAttribute('href');
      const gameId = gameLink?.match(/game\/(\d+)/)?.[1];

      // Extract times
      const times = this.extractTimes(card);

      // Extract image
      const imgElement = card.querySelector('img');
      const gameImage = imgElement?.getAttribute('src');

      return {
        gameId: gameId || '',
        gameName,
        gameImage: gameImage || '',
        ...times,
        platforms: [], // Would need additional parsing
        releaseDate: null,
        review_score: null,
        similarity: 1.0
      };

    } catch (error) {
      console.error('[HLTB] Parse error:', error);
      return null;
    }
  }

  private extractTimes(card: Element) {
    const times = {
      mainStory: null as number | null,
      mainExtra: null as number | null,
      completionist: null as number | null,
      allStyles: null as number | null
    };

    const tidbits = card.querySelectorAll('.search_list_tidbit');

    tidbits.forEach((tidbit) => {
      const label = tidbit.querySelector('.search_list_tidbit_short')?.textContent?.trim();
      const value = tidbit.querySelector('.search_list_tidbit_long')?.textContent?.trim();

      if (!label || !value) return;

      const hours = this.parseTimeString(value);

      switch (label.toLowerCase()) {
        case 'main story':
          times.mainStory = hours;
          break;
        case 'main + extras':
        case 'main + extra':
          times.mainExtra = hours;
          break;
        case 'completionist':
          times.completionist = hours;
          break;
        case 'all styles':
          times.allStyles = hours;
          break;
      }
    });

    return times;
  }

  private parseTimeString(timeStr: string): number | null {
    if (!timeStr || timeStr === '--') return null;

    // Remove "Hours" suffix
    timeStr = timeStr.replace(/\s*Hours?/i, '').trim();

    // Handle ranges like "20 - 25"
    if (timeStr.includes('-')) {
      const parts = timeStr.split('-').map(p => p.trim());
      const values = parts.map(p => this.parseTimeValue(p)).filter(Boolean);
      if (values.length > 0) {
        // Return average of range
        return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
      }
    }

    return this.parseTimeValue(timeStr);
  }

  private parseTimeValue(value: string): number | null {
    // Handle fractions like "12½"
    value = value.replace('½', '.5').replace('¼', '.25').replace('¾', '.75');

    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : Math.round(parsed);
  }
}
```

### Task 3: Fallback Data Source
```typescript
// src/background/services/hltb-fallback.ts
export class HLTBFallback {
  private readonly COMMUNITY_DB_URL = 'https://raw.githubusercontent.com/username/hltb-db/main/games.json';
  private localDatabase: Map<string, HLTBData> = new Map();

  constructor() {
    this.loadLocalDatabase();
  }

  private async loadLocalDatabase() {
    try {
      // Load community-maintained database
      const response = await fetch(this.COMMUNITY_DB_URL);
      if (response.ok) {
        const data = await response.json();
        this.populateDatabase(data);
      }
    } catch (error) {
      console.log('[HLTB] Fallback database load failed:', error);
    }

    // Add common games as hardcoded fallback
    this.addCommonGames();
  }

  private populateDatabase(data: any[]) {
    data.forEach(game => {
      const key = this.normalizeTitle(game.title);
      this.localDatabase.set(key, {
        mainStory: game.mainStory,
        mainExtra: game.mainExtra,
        completionist: game.completionist,
        allStyles: game.allStyles
      });
    });
  }

  private addCommonGames() {
    // Popular Steam games with known times
    const commonGames = [
      { title: 'Portal', main: 3, extra: 4, complete: 5 },
      { title: 'Portal 2', main: 8, extra: 10, complete: 14 },
      { title: 'Half-Life 2', main: 13, extra: 15, complete: 18 },
      { title: 'Team Fortress 2', main: null, extra: null, complete: null },
      { title: 'Counter-Strike 2', main: null, extra: null, complete: null },
      { title: 'Hades', main: 22, extra: 45, complete: 95 },
      { title: 'Elden Ring', main: 60, extra: 100, complete: 130 },
      { title: 'The Witcher 3', main: 50, extra: 100, complete: 170 }
    ];

    commonGames.forEach(game => {
      const key = this.normalizeTitle(game.title);
      this.localDatabase.set(key, {
        mainStory: game.main,
        mainExtra: game.extra,
        completionist: game.complete,
        allStyles: game.extra
      });
    });
  }

  async searchFallback(title: string): Promise<HLTBData | null> {
    const normalized = this.normalizeTitle(title);

    // Direct match
    if (this.localDatabase.has(normalized)) {
      return this.localDatabase.get(normalized)!;
    }

    // Fuzzy match
    for (const [key, data] of this.localDatabase.entries()) {
      if (this.fuzzyMatch(normalized, key)) {
        return data;
      }
    }

    return null;
  }

  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private fuzzyMatch(str1: string, str2: string): boolean {
    // Simple fuzzy matching
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');

    // Check if all words from shorter string are in longer
    const [shorter, longer] = words1.length < words2.length
      ? [words1, words2]
      : [words2, words1];

    return shorter.every(word =>
      longer.some(w => w.includes(word) || word.includes(w))
    );
  }
}
```

### Task 4: Integrated Service
```typescript
// src/background/services/hltb-service-integrated.ts
export class HLTBIntegratedService {
  private apiClient: HLTBApiClient;
  private scraper: HLTBScraper;
  private fallback: HLTBFallback;
  private retryManager: RetryManager;

  constructor() {
    this.apiClient = new HLTBApiClient();
    this.scraper = new HLTBScraper();
    this.fallback = new HLTBFallback();
    this.retryManager = new RetryManager();
  }

  async getGameData(title: string, options: SearchOptions = {}): Promise<HLTBData | null> {
    console.log(`[HLTB] Searching for: ${title}`);

    // Try strategies in order
    const strategies = [
      () => this.tryAPI(title, options),
      () => this.tryScraping(title, options),
      () => this.tryFallback(title)
    ];

    for (const strategy of strategies) {
      try {
        const result = await this.retryManager.execute(strategy);
        if (result) {
          console.log('[HLTB] Data found via:', strategy.name);
          return result;
        }
      } catch (error) {
        console.error('[HLTB] Strategy failed:', error);
        continue;
      }
    }

    console.log('[HLTB] No data found for:', title);
    return null;
  }

  private async tryAPI(title: string, options: SearchOptions): Promise<HLTBData | null> {
    const results = await this.apiClient.searchGames(title);

    if (results.length === 0) return null;

    // Find best match (will be improved in matching PRD)
    const bestMatch = results[0];

    return {
      mainStory: bestMatch.mainStory,
      mainExtra: bestMatch.mainExtra,
      completionist: bestMatch.completionist,
      allStyles: bestMatch.allStyles
    };
  }

  private async tryScraping(title: string, options: SearchOptions): Promise<HLTBData | null> {
    const results = await this.scraper.scrapeSearch(title);

    if (results.length === 0) return null;

    const bestMatch = results[0];

    return {
      mainStory: bestMatch.mainStory,
      mainExtra: bestMatch.mainExtra,
      completionist: bestMatch.completionist,
      allStyles: bestMatch.allStyles
    };
  }

  private async tryFallback(title: string): Promise<HLTBData | null> {
    return this.fallback.searchFallback(title);
  }
}

class RetryManager {
  async execute<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (error instanceof RateLimitError) {
          // Exponential backoff for rate limits
          const delay = baseDelay * Math.pow(2, i);
          console.log(`[HLTB] Rate limited, waiting ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (i < maxRetries - 1) {
          // Regular retry with shorter delay
          await new Promise(resolve => setTimeout(resolve, baseDelay));
        }
      }
    }

    throw lastError;
  }
}

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}
```

## Validation Loop

### Level 1: Unit Tests
```typescript
// tests/hltb-integration.test.ts
describe('HLTB Integration', () => {
  it('should parse time strings correctly', () => {
    const scraper = new HLTBScraper();
    expect(scraper.parseTimeString('12 Hours')).toBe(12);
    expect(scraper.parseTimeString('12½ Hours')).toBe(13);
    expect(scraper.parseTimeString('20 - 25 Hours')).toBe(23);
    expect(scraper.parseTimeString('--')).toBeNull();
  });

  it('should handle API responses', async () => {
    const client = new HLTBApiClient();
    const results = await client.searchGames('Portal 2');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].gameName).toContain('Portal');
  });

  it('should fallback correctly', async () => {
    const service = new HLTBIntegratedService();

    // Mock API failure
    jest.spyOn(service.apiClient, 'searchGames').mockRejectedValue(new Error());

    const data = await service.getGameData('Portal 2');
    expect(data).not.toBeNull();
  });
});
```

### Level 2: Integration Tests
```bash
# Test various game titles
GAMES=("Portal 2" "Elden Ring" "Hades" "CS:GO" "The Witcher 3")

for game in "${GAMES[@]}"; do
  echo "Testing: $game"
  # Send request and verify response
  chrome.runtime.sendMessage({
    action: 'fetchHLTB',
    gameTitle: "$game"
  })
done
```

## Agent Task Assignments

### For `api-integration-specialist` Agent:
- Implement API client with proper headers
- Handle CORS and authentication
- Design retry logic
- Implement rate limiting

### For `general-purpose` Agent:
- Implement HTML parsing logic
- Create fallback database
- Handle edge cases
- Implement time string parsing

### For `performance-optimizer` Agent:
- Optimize request batching
- Implement efficient caching
- Reduce response parsing overhead

## Anti-Patterns to Avoid
- ❌ Don't make excessive requests
- ❌ Don't ignore robots.txt
- ❌ Don't skip user agent headers
- ❌ Don't parse HTML with regex
- ❌ Don't hardcode game IDs
- ❌ Don't ignore rate limits
- ❌ Don't cache failed requests
- ❌ Don't trust single data source
- ❌ Don't block on scraping
- ❌ Don't leak sensitive headers

## Final Validation Checklist
- [ ] API client working
- [ ] Scraper functioning
- [ ] Fallback database loaded
- [ ] Time parsing accurate
- [ ] Rate limiting effective
- [ ] Retry logic working
- [ ] Error handling comprehensive
- [ ] Headers properly set
- [ ] No CORS issues
- [ ] Tests passing
- [ ] Performance acceptable
- [ ] Respects robots.txt

---

## Confidence Score: 6/10
Moderate confidence due to:
- Multiple fallback strategies
- Reference implementations available
- Clear HTML structure

Risk factors:
- HLTB may change structure
- API endpoints may change
- Rate limiting uncertainty
- Cloudflare challenges
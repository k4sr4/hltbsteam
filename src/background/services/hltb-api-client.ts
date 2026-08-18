/**
 * Enhanced HLTB API Client
 * Implements robust error handling, rate limiting, and retry logic
 *
 * Live API flow (verified against howlongtobeat.com, July 2026):
 *   1. GET  /api/{endpoint}/init -> { token, hpKey, hpVal }   (hltb-auth-service)
 *   2. POST /api/{endpoint} with x-auth-token / x-hp-key / x-hp-val headers,
 *      the hpKey/hpVal pair echoed inside the JSON body, and a Referer header
 *      supplied via declarativeNetRequest (hltb-header-rules).
 * A 403 means the token expired (refresh + retry once); a 404 means HLTB
 * rotated the endpoint name (rediscover + retry once).
 */

import { hltbAuthService, HLTBAuth, HLTBAuthError } from './hltb-auth-service';
import { ensureHltbHeaderRules } from './hltb-header-rules';
// Static import (title-matcher has no dependency back on this module, so no
// cycle). A dynamic import() would emit an async webpack chunk that an MV3
// module service worker cannot load, silently breaking every live match.
import { titleMatcher } from './title-matcher';

// Custom Error Classes
export class RateLimitError extends Error {
  public readonly retryAfter: number;
  public readonly resetTime: Date;

  constructor(retryAfter: number = 60) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    this.resetTime = new Date(Date.now() + retryAfter * 1000);
  }
}

export class NetworkError extends Error {
  public readonly statusCode?: number;
  public readonly originalError?: Error;

  constructor(message: string, statusCode?: number, originalError?: Error) {
    super(message);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
}

// TypeScript Interfaces for HLTB API
export interface HLTBSearchRequest {
  searchType: 'games';
  searchTerms: string[];
  searchPage: number;
  size: number;
  searchOptions: {
    games: {
      userId: number;
      platform: string;
      sortCategory: 'popular' | 'rating' | 'name' | 'releaseDate';
      rangeCategory: 'main' | 'mainExtra' | 'completionist';
      rangeTime: {
        min: number | null;
        max: number | null;
      };
      gameplay: {
        perspective: string;
        flow: string;
        genre: string;
        difficulty: string;
      };
      rangeYear: {
        min: string;
        max: string;
      };
      modifier: string;
    };
    users: {
      sortCategory: 'postcount';
    };
    lists: {
      sortCategory: 'follows';
    };
    filter: string;
    sort: number;
    randomizer: number;
  };
  useCache: boolean;
  // The honeypot pair from init is echoed as an extra dynamic body field
  [hpKey: string]: unknown;
}

export interface HLTBGameData {
  game_id: number;
  game_name: string;
  game_name_date: number;
  game_alias: string;
  game_type: string;
  game_image: string;
  comp_lvl_combine: number;
  comp_lvl_sp: number;
  comp_lvl_co: number;
  comp_lvl_mp: number;
  comp_lvl_spd: number;
  comp_main: number;
  comp_plus: number;
  comp_100: number;
  comp_all: number;
  comp_main_count: number;
  comp_plus_count: number;
  comp_100_count: number;
  comp_all_count: number;
  invested_co: number;
  invested_mp: number;
  invested_co_count: number;
  invested_mp_count: number;
  count_comp: number;
  count_speedrun: number;
  count_backlog: number;
  count_review: number;
  review_score: number;
  count_playing: number;
  count_retired: number;
  release_world?: number;
}

export interface HLTBSearchResponse {
  color: string;
  title: string;
  category: string;
  pageCurrent: number;
  pageTotal: number;
  pageSize: number;
  data: HLTBGameData[];
}

export interface ParsedHLTBData {
  mainStory: number | null;
  mainExtra: number | null;
  completionist: number | null;
  allStyles: number | null;
  gameId: number;
  gameName: string;
  imageUrl?: string;
  /** True when HLTB marks the game as having no single-player mode */
  isMultiplayerOnly: boolean;
  /** Release year (release_world); 0 = announced/TBA, null = unknown */
  releaseYear: number | null;
  playerCounts: {
    main: number;
    extra: number;
    completionist: number;
    all: number;
  };
}

// Retry Manager for exponential backoff
export class RetryManager {
  private readonly maxRetries: number;
  private readonly baseDelay: number;
  private readonly maxDelay: number;
  private retryCount: Map<string, number> = new Map();
  private lastAttempt: Map<string, number> = new Map();

  constructor(maxRetries = 3, baseDelay = 1000, maxDelay = 30000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
  }

  async executeWithRetry<T>(
    key: string,
    operation: () => Promise<T>,
    isRetriableError?: (error: any) => boolean
  ): Promise<T> {
    const currentRetries = this.retryCount.get(key) || 0;

    try {
      const result = await operation();
      // Reset on success
      this.retryCount.delete(key);
      this.lastAttempt.delete(key);
      return result;
    } catch (error) {
      // Check if we should retry
      if (currentRetries >= this.maxRetries) {
        this.retryCount.delete(key);
        this.lastAttempt.delete(key);
        throw error;
      }

      // Check if error is retriable
      const shouldRetry = isRetriableError
        ? isRetriableError(error)
        : this.isDefaultRetriableError(error);

      if (!shouldRetry) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = this.calculateDelay(currentRetries);

      // Update retry count
      this.retryCount.set(key, currentRetries + 1);
      this.lastAttempt.set(key, Date.now());

      console.log(`[RetryManager] Attempt ${currentRetries + 1}/${this.maxRetries} for ${key}. Waiting ${delay}ms`);

      // Wait before retrying
      await this.delay(delay);

      // Recursive retry
      return this.executeWithRetry(key, operation, isRetriableError);
    }
  }

  private calculateDelay(retryCount: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = Math.min(
      this.baseDelay * Math.pow(2, retryCount),
      this.maxDelay
    );

    // Add jitter (0-25% of delay)
    const jitter = Math.random() * 0.25 * exponentialDelay;

    return Math.floor(exponentialDelay + jitter);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isDefaultRetriableError(error: any): boolean {
    // Network errors
    if (error instanceof NetworkError) {
      const statusCode = error.statusCode;
      // Retry on 5xx errors, 429 (rate limit), and network failures
      return !statusCode || statusCode >= 500 || statusCode === 429 || statusCode === 0;
    }

    // Rate limit errors: never retry — honor the server's window instead of
    // re-POSTing on exponential backoff (which ignores Retry-After). The
    // searchGames entry gate blocks further calls until the window passes.
    if (error instanceof RateLimitError) {
      return false;
    }

    // Auth/init failures (bad status, no token, discovery failed): non-retriable,
    // so a blocked IP or transient init error can't multiply the discovery scan.
    if (error instanceof HLTBAuthError) {
      return false;
    }

    // Generic network failures
    if (error.name === 'NetworkError' || error.name === 'FetchError' || error.name === 'AbortError') {
      return true;
    }

    return false;
  }

  reset(key?: string): void {
    if (key) {
      this.retryCount.delete(key);
      this.lastAttempt.delete(key);
    } else {
      this.retryCount.clear();
      this.lastAttempt.clear();
    }
  }
}

// Main HLTB API Client
export class HLTBApiClient {
  private readonly BASE_URL = 'https://howlongtobeat.com';
  private readonly RATE_LIMIT_KEY = 'hltb_rate_limit_until';
  private readonly retryManager: RetryManager;
  private rateLimitReset: Date | null = null;
  private rateLimitLoaded = false;

  constructor(
    private readonly options: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
      timeout?: number;
    } = {}
  ) {
    this.retryManager = new RetryManager(
      options.maxRetries || 3,
      options.baseDelay || 1000,
      options.maxDelay || 30000
    );
  }

  /**
   * Search for games on HLTB
   */
  async searchGames(gameTitle: string): Promise<ParsedHLTBData[]> {
    // Check rate limit (loading any window persisted before an SW restart)
    await this.loadRateLimit();
    if (this.rateLimitReset && this.rateLimitReset > new Date()) {
      const waitTime = Math.ceil((this.rateLimitReset.getTime() - Date.now()) / 1000);
      throw new RateLimitError(waitTime);
    }

    const searchPayload = this.buildSearchPayload(gameTitle);

    return this.retryManager.executeWithRetry(
      `search:${gameTitle}`,
      async () => {
        const response = await this.makeRequest(searchPayload);
        return this.parseResponse(response);
      }
    );
  }

  /**
   * Get data for a single game (best match)
   */
  async getGameData(gameTitle: string): Promise<ParsedHLTBData | null> {
    const results = await this.searchGames(gameTitle);

    if (!results || results.length === 0) {
      return null;
    }

    // Find best match using sophisticated title matching
    const bestMatch = await this.findBestMatch(gameTitle, results);
    return bestMatch;
  }

  /**
   * Build the search request payload matching HLTB's current client format
   */
  private buildSearchPayload(searchTerm: string): HLTBSearchRequest {
    return {
      searchType: 'games',
      searchTerms: searchTerm.trim().split(/\s+/).filter(term => term.length > 0),
      searchPage: 1,
      size: 20,
      searchOptions: {
        games: {
          userId: 0,
          platform: '',
          sortCategory: 'popular',
          rangeCategory: 'main',
          rangeTime: { min: null, max: null },
          gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
          rangeYear: { min: '', max: '' },
          modifier: ''
        },
        users: {
          sortCategory: 'postcount'
        },
        lists: {
          sortCategory: 'follows'
        },
        filter: '',
        sort: 0,
        randomizer: 0
      },
      useCache: true
    };
  }

  /**
   * Make the authenticated two-step request, refreshing credentials once on
   * 403 (expired token) or 404 (rotated endpoint name)
   */
  private async makeRequest(payload: HLTBSearchRequest): Promise<HLTBSearchResponse> {
    const controller = new AbortController();
    const timeout = this.options.timeout || 30000;

    // Abort covers the search POSTs; the race also bounds the auth/init phase,
    // whose fetches do not share this signal.
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new NetworkError('Request timeout'));
      }, timeout);
    });

    try {
      const response = await Promise.race([
        this.performAuthenticatedRequest(payload, controller.signal),
        timeoutPromise
      ]);

      clearTimeout(timeoutId);

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = this.parseRetryAfter(response.headers);
        this.rateLimitReset = new Date(Date.now() + retryAfter * 1000);
        await this.saveRateLimit(this.rateLimitReset);
        throw new RateLimitError(retryAfter);
      }

      // Handle other HTTP errors
      if (!response.ok) {
        throw new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      // Parse JSON response
      try {
        const data = await response.json();
        return data as HLTBSearchResponse;
      } catch (error) {
        throw new NetworkError(
          'Failed to parse response JSON',
          response.status,
          error as Error
        );
      }

    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError('Request timeout', undefined, error);
      }

      // Re-throw our custom errors (HLTBAuthError stays non-retriable)
      if (
        error instanceof RateLimitError ||
        error instanceof NetworkError ||
        error instanceof HLTBAuthError
      ) {
        throw error;
      }

      // Wrap unknown errors
      throw new NetworkError(
        'Network request failed',
        undefined,
        error as Error
      );
    }
  }

  /**
   * Acquire credentials and POST the search, refreshing once on 403/404
   */
  private async performAuthenticatedRequest(
    payload: HLTBSearchRequest,
    signal: AbortSignal
  ): Promise<Response> {
    await ensureHltbHeaderRules();

    let auth = await hltbAuthService.getAuth();
    let response = await this.postSearch(auth, payload, signal);

    if (response.status === 403) {
      console.warn('[HLTBApiClient] Search token expired, refreshing and retrying');
      auth = await hltbAuthService.getAuth(true);
      response = await this.postSearch(auth, payload, signal);
    } else if (response.status === 404) {
      console.warn('[HLTBApiClient] Search endpoint rotated, rediscovering and retrying');
      auth = await hltbAuthService.getAuth(true, true);
      response = await this.postSearch(auth, payload, signal);
    }

    return response;
  }

  /**
   * POST the search payload with auth headers and the honeypot body field
   */
  private postSearch(
    auth: HLTBAuth,
    payload: HLTBSearchRequest,
    signal: AbortSignal
  ): Promise<Response> {
    const body: HLTBSearchRequest = { ...payload };
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-auth-token': auth.token
    };

    if (auth.hpKey && auth.hpVal) {
      headers['x-hp-key'] = auth.hpKey;
      headers['x-hp-val'] = auth.hpVal;
      body[auth.hpKey] = auth.hpVal;
    }

    return fetch(`${this.BASE_URL}/api/${auth.endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    });
  }

  /**
   * Parse Retry-After header
   */
  private parseRetryAfter(headers: Headers): number {
    const retryAfter = headers.get('Retry-After');

    if (!retryAfter) {
      return 60; // Default to 60 seconds
    }

    // Check if it's a number of seconds
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds;
    }

    // Check if it's a date
    const retryDate = new Date(retryAfter);
    if (!isNaN(retryDate.getTime())) {
      const waitTime = Math.max(0, Math.ceil((retryDate.getTime() - Date.now()) / 1000));
      return waitTime;
    }

    return 60; // Default fallback
  }

  /**
   * Parse the API response into our data structure
   */
  private parseResponse(response: HLTBSearchResponse): ParsedHLTBData[] {
    if (!response.data || !Array.isArray(response.data)) {
      return [];
    }

    return response.data.map(game => this.parseGameData(game));
  }

  /**
   * Parse individual game data
   */
  private parseGameData(game: HLTBGameData): ParsedHLTBData {
    // Flag competitive/versus games that have no single-player mode — these
    // have no meaningful completion time (HLTB's comp_main for them is average
    // investment time, e.g. Dota 2 ~747h), so the UI shows a notice instead.
    // NB: co-op-only campaign games (comp_lvl_co === 1, comp_lvl_mp === 0, e.g.
    // It Takes Two / A Way Out) are deliberately NOT flagged — their comp_main
    // IS a real completion time and should be shown.
    const isMultiplayerOnly =
      game.comp_lvl_sp === 0 && game.comp_lvl_mp === 1;

    return {
      mainStory: this.parseTimeValue(game.comp_main),
      mainExtra: this.parseTimeValue(game.comp_plus),
      completionist: this.parseTimeValue(game.comp_100),
      allStyles: this.parseTimeValue(game.comp_all),
      gameId: game.game_id,
      gameName: game.game_name,
      imageUrl: game.game_image ? `https://howlongtobeat.com/games/${game.game_image}` : undefined,
      isMultiplayerOnly,
      releaseYear: typeof game.release_world === 'number' ? game.release_world : null,
      playerCounts: {
        main: game.comp_main_count || 0,
        extra: game.comp_plus_count || 0,
        completionist: game.comp_100_count || 0,
        all: game.comp_all_count || 0
      }
    };
  }

  /**
   * Parse time values from seconds to hours
   * HLTB API returns times in SECONDS
   */
  private parseTimeValue(seconds: number | string | undefined | null): number | null {
    if (seconds === undefined || seconds === null || seconds === 0) {
      return null;
    }

    let value: number;

    if (typeof seconds === 'string') {
      value = parseFloat(seconds);
      if (isNaN(value)) {
        return null;
      }
    } else {
      value = Number(seconds);
    }

    // Convert seconds to hours
    const hours = value / 3600;

    // Round to 1 decimal place for values under 10 hours, otherwise round to nearest integer
    if (hours < 10) {
      return Math.round(hours * 10) / 10;
    } else {
      return Math.round(hours);
    }
  }

  /**
   * Find the best matching game from results using sophisticated title matching
   */
  private async findBestMatch(searchTitle: string, results: ParsedHLTBData[]): Promise<ParsedHLTBData | null> {
    if (results.length === 0) {
      return null;
    }

    // Convert ParsedHLTBData to HLTBSearchResult format
    const searchResults = results.map(game => ({
      gameId: game.gameId,
      gameName: game.gameName,
      gameImage: game.gameImage,
      mainStory: game.mainStory,
      mainExtra: game.mainExtra,
      completionist: game.completionist,
      allStyles: game.allStyles
    }));

    // Use the sophisticated title matcher
    const matchResult = await titleMatcher.findBestMatch(searchTitle, searchResults);

    if (!matchResult || !matchResult.match) {
      console.log(`[HLTBApiClient] No match found for "${searchTitle}"`);
      return null;
    }

    if (matchResult.skip) {
      console.log(`[HLTBApiClient] Skipping "${searchTitle}": ${matchResult.reason}`);
      return null;
    }

    console.log(
      `[HLTBApiClient] Matched "${searchTitle}" -> "${matchResult.match.gameName}" ` +
      `(${(matchResult.confidence * 100).toFixed(1)}% via ${matchResult.method})`
    );

    // Find and return the original ParsedHLTBData
    return results.find(r => r.gameId === matchResult.match!.gameId) || null;
  }

  /**
   * Batch fetch multiple games with optimized requests
   */
  async batchFetch(
    games: Array<{ title: string; id: string }>
  ): Promise<Map<string, ParsedHLTBData | null>> {
    const results = new Map<string, ParsedHLTBData | null>();

    // Process in batches to avoid overwhelming the API
    const batchSize = 5;
    const batches = [];

    for (let i = 0; i < games.length; i += batchSize) {
      batches.push(games.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      // Process batch in parallel but with rate limit awareness
      const batchPromises = batch.map(async (game) => {
        try {
          const data = await this.getGameData(game.title);
          results.set(game.id, data);
        } catch (error) {
          console.error(`[HLTBApiClient] Failed to fetch data for ${game.title}:`, error);
          results.set(game.id, null);

          // If we hit rate limit, stop the batch
          if (error instanceof RateLimitError) {
            throw error;
          }
        }
      });

      try {
        await Promise.all(batchPromises);
      } catch (error) {
        // If rate limited, return partial results
        if (error instanceof RateLimitError) {
          console.warn('[HLTBApiClient] Rate limited during batch fetch');
          break;
        }
        throw error;
      }

      // Add small delay between batches
      if (batches.indexOf(batch) < batches.length - 1) {
        await this.delay(500);
      }
    }

    return results;
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear rate limit reset
   */
  clearRateLimit(): void {
    this.rateLimitReset = null;
    this.rateLimitLoaded = true;
    this.persistRateLimit(null);
  }

  /**
   * Load a rate-limit window persisted before a service-worker restart.
   * The MV3 worker is killed after ~30s idle, so an in-memory-only gate would
   * evaporate long before a typical Retry-After window expires.
   */
  private async loadRateLimit(): Promise<void> {
    if (this.rateLimitLoaded) return;
    this.rateLimitLoaded = true;
    try {
      const area = this.rateLimitStorage();
      if (!area) return;
      const stored = await area.get(this.RATE_LIMIT_KEY);
      const until = stored?.[this.RATE_LIMIT_KEY];
      if (typeof until === 'number' && until > Date.now()) {
        this.rateLimitReset = new Date(until);
      }
    } catch {
      // Storage unavailable — fall back to in-memory only
    }
  }

  private async saveRateLimit(reset: Date): Promise<void> {
    this.rateLimitLoaded = true;
    await this.persistRateLimit(reset.getTime());
  }

  private async persistRateLimit(until: number | null): Promise<void> {
    try {
      const area = this.rateLimitStorage();
      if (!area) return;
      if (until === null) {
        await area.remove(this.RATE_LIMIT_KEY);
      } else {
        await area.set({ [this.RATE_LIMIT_KEY]: until });
      }
    } catch {
      // Non-fatal
    }
  }

  private rateLimitStorage(): chrome.storage.StorageArea | null {
    if (typeof chrome === 'undefined' || !chrome.storage) return null;
    return (chrome.storage as any).session || chrome.storage.local || null;
  }

  /**
   * Reset retry manager state
   */
  resetRetries(key?: string): void {
    this.retryManager.reset(key);
  }
}

// Export a singleton instance for convenience
export const hltbApiClient = new HLTBApiClient({
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  timeout: 30000
});
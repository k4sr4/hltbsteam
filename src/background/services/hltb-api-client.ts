/**
 * Enhanced HLTB API Client
 * Implements robust error handling, rate limiting, and retry logic
 */

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
        min: number;
        max: number;
      };
      gameplay: {
        perspective: string;
        flow: string;
        genre: string;
      };
      modifier: string;
    };
    users: {
      sortCategory: 'postcount';
    };
    filter: string;
    sort: number;
    randomizer: number;
  };
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

    // Rate limit errors
    if (error instanceof RateLimitError) {
      return true;
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
  private readonly API_ENDPOINT = 'https://howlongtobeat.com/api/search';
  private readonly retryManager: RetryManager;
  private rateLimitReset: Date | null = null;

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
    // Check rate limit
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

    // Find best match
    const bestMatch = this.findBestMatch(gameTitle, results);
    return bestMatch;
  }

  /**
   * Build the search request payload
   */
  private buildSearchPayload(searchTerm: string): HLTBSearchRequest {
    return {
      searchType: 'games',
      searchTerms: searchTerm.split(' ').filter(term => term.length > 0),
      searchPage: 1,
      size: 20,
      searchOptions: {
        games: {
          userId: 0,
          platform: '',
          sortCategory: 'popular',
          rangeCategory: 'main',
          rangeTime: {
            min: 0,
            max: 0
          },
          gameplay: {
            perspective: '',
            flow: '',
            genre: ''
          },
          modifier: ''
        },
        users: {
          sortCategory: 'postcount'
        },
        filter: '',
        sort: 0,
        randomizer: 0
      }
    };
  }

  /**
   * Make the actual HTTP request with proper headers
   */
  private async makeRequest(payload: HLTBSearchRequest): Promise<HLTBSearchResponse> {
    const controller = new AbortController();
    const timeout = this.options.timeout || 30000;

    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://howlongtobeat.com',
          'Origin': 'https://howlongtobeat.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = this.parseRetryAfter(response.headers);
        this.rateLimitReset = new Date(Date.now() + retryAfter * 1000);
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

      // Re-throw our custom errors
      if (error instanceof RateLimitError || error instanceof NetworkError) {
        throw error;
      }

      // Wrap other errors
      throw new NetworkError(
        'Network request failed',
        undefined,
        error as Error
      );
    }
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
    return {
      mainStory: this.parseTimeValue(game.comp_main),
      mainExtra: this.parseTimeValue(game.comp_plus),
      completionist: this.parseTimeValue(game.comp_100),
      allStyles: this.parseTimeValue(game.comp_all),
      gameId: game.game_id,
      gameName: game.game_name,
      imageUrl: game.game_image ? `https://howlongtobeat.com/games/${game.game_image}` : undefined,
      playerCounts: {
        main: game.comp_main_count || 0,
        extra: game.comp_plus_count || 0,
        completionist: game.comp_100_count || 0,
        all: game.comp_all_count || 0
      }
    };
  }

  /**
   * Parse time values from minutes to hours
   * Handles various formats including fractions and ranges
   */
  private parseTimeValue(minutes: number | string | undefined | null): number | null {
    if (minutes === undefined || minutes === null || minutes === 0) {
      return null;
    }

    let value: number;

    if (typeof minutes === 'string') {
      // Handle fractional hours (e.g., "1½", "2.5")
      const cleaned = minutes.toString().replace(/[^\d.½¼¾]/g, '');

      // Convert special fractions
      const fractionMap: { [key: string]: number } = {
        '½': 0.5,
        '¼': 0.25,
        '¾': 0.75
      };

      let numericValue = cleaned;
      Object.keys(fractionMap).forEach(fraction => {
        numericValue = numericValue.replace(fraction, fractionMap[fraction].toString());
      });

      value = parseFloat(numericValue);

      // If parsing failed, return null
      if (isNaN(value)) {
        return null;
      }
    } else {
      value = Number(minutes);
    }

    // Convert minutes to hours and round
    const hours = value / 60;

    // Round to 1 decimal place for values under 10 hours, otherwise round to nearest integer
    if (hours < 10) {
      return Math.round(hours * 10) / 10;
    } else {
      return Math.round(hours);
    }
  }

  /**
   * Find the best matching game from results
   */
  private findBestMatch(searchTitle: string, results: ParsedHLTBData[]): ParsedHLTBData | null {
    if (results.length === 0) {
      return null;
    }

    const normalizedSearch = this.normalizeTitle(searchTitle);
    let bestMatch = results[0];
    let bestScore = 0;

    for (const game of results) {
      const normalizedGame = this.normalizeTitle(game.gameName);
      const score = this.calculateSimilarity(normalizedSearch, normalizedGame);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = game;
      }

      // Perfect match
      if (score === 1) {
        break;
      }
    }

    // Require at least 50% similarity
    if (bestScore < 0.5) {
      console.log(`[HLTBApiClient] No good match found for "${searchTitle}" (best score: ${bestScore})`);
      return null;
    }

    return bestMatch;
  }

  /**
   * Normalize game title for comparison
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')         // Normalize whitespace
      .trim();
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // Initialize first column
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    // Initialize first row
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // Substitution
            matrix[i][j - 1] + 1,      // Insertion
            matrix[i - 1][j] + 1       // Deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
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
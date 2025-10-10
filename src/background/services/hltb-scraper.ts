/**
 * HLTB Web Scraper - Fallback Implementation
 * Scrapes HLTB search results HTML when API fails
 * Service Worker compatible using DOMParser
 */

// Error Classes
export class ScrapingError extends Error {
  public readonly statusCode?: number;
  public readonly url?: string;

  constructor(message: string, statusCode?: number, url?: string) {
    super(message);
    this.name = 'ScrapingError';
    this.statusCode = statusCode;
    this.url = url;
  }
}

// Interfaces
export interface ScrapedGameData {
  id: string | null;
  name: string;
  image: string | null;
  mainStory: number | null;
  mainExtra: number | null;
  completionist: number | null;
  allStyles: number | null;
  url: string | null;
}

export interface ScrapingResult {
  games: ScrapedGameData[];
  totalResults: number;
  searchTerm: string;
  timestamp: number;
}

export class HLTBScraper {
  private readonly BASE_URL = 'https://howlongtobeat.com';
  private readonly SEARCH_URL = 'https://howlongtobeat.com/search_results';
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // Selectors based on HLTB HTML structure
  private readonly SELECTORS = {
    searchResults: '.search_list_details',
    gameCard: '.search_list_details_block',
    gameName: '.search_list_details_block h3 a',
    gameNameAlt: '.search_list_details_block .search_list_details_block_title',
    gameImage: 'img.search_list_image',
    gameLink: 'h3 a',
    timeContainer: '.search_list_tidbit',
    timeLabel: '.search_list_tidbit_short',
    timeValue: '.search_list_tidbit_long',
    noResults: '.search_list_no_results'
  };

  /**
   * Scrape HLTB search results for a game
   */
  async scrapeGameData(gameTitle: string): Promise<ScrapingResult | null> {
    console.log('[HLTB Scraper] Scraping data for:', gameTitle);

    try {
      const html = await this.fetchSearchResults(gameTitle);
      if (!html) {
        throw new ScrapingError('Failed to fetch HTML content');
      }

      const result = this.parseSearchResults(html, gameTitle);
      console.log(`[HLTB Scraper] Found ${result.games.length} games for "${gameTitle}"`);

      return result;
    } catch (error) {
      console.error('[HLTB Scraper] Error:', error);
      return null;
    }
  }

  /**
   * Fetch HTML from HLTB search endpoint
   */
  private async fetchSearchResults(gameTitle: string): Promise<string | null> {
    const searchUrl = `${this.SEARCH_URL}?page=1&length=20&sort=name&search=${encodeURIComponent(gameTitle)}`;

    try {
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0',
          'Referer': 'https://howlongtobeat.com/'
        }
      });

      if (!response.ok) {
        throw new ScrapingError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          searchUrl
        );
      }

      const html = await response.text();

      if (!html || html.length < 100) {
        throw new ScrapingError('Received empty or invalid HTML response');
      }

      return html;
    } catch (error) {
      if (error instanceof ScrapingError) {
        throw error;
      }
      throw new ScrapingError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        searchUrl
      );
    }
  }

  /**
   * Parse HTML search results using DOMParser
   */
  private parseSearchResults(html: string, searchTerm: string): ScrapingResult {
    // DOMParser is available in service workers
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Check for no results
    const noResults = doc.querySelector(this.SELECTORS.noResults);
    if (noResults) {
      console.log('[HLTB Scraper] No results found');
      return {
        games: [],
        totalResults: 0,
        searchTerm,
        timestamp: Date.now()
      };
    }

    // Find all game cards
    const gameCards = doc.querySelectorAll(this.SELECTORS.gameCard);
    console.log(`[HLTB Scraper] Found ${gameCards.length} game cards`);

    const games: ScrapedGameData[] = [];

    gameCards.forEach((card, index) => {
      try {
        const gameData = this.parseGameCard(card as Element);
        if (gameData) {
          games.push(gameData);
        }
      } catch (error) {
        console.warn(`[HLTB Scraper] Failed to parse game card ${index}:`, error);
      }
    });

    return {
      games,
      totalResults: games.length,
      searchTerm,
      timestamp: Date.now()
    };
  }

  /**
   * Parse individual game card element
   */
  private parseGameCard(card: Element): ScrapedGameData | null {
    try {
      // Extract game name
      const nameElement = card.querySelector(this.SELECTORS.gameName) ||
                         card.querySelector(this.SELECTORS.gameNameAlt);

      if (!nameElement) {
        console.warn('[HLTB Scraper] No game name found in card');
        return null;
      }

      const name = this.cleanText(nameElement.textContent || '');
      if (!name) {
        console.warn('[HLTB Scraper] Empty game name');
        return null;
      }

      // Extract game ID and URL from link
      const linkElement = card.querySelector(this.SELECTORS.gameLink) as HTMLAnchorElement;
      let id: string | null = null;
      let url: string | null = null;

      if (linkElement && linkElement.href) {
        url = this.normalizeUrl(linkElement.href);
        id = this.extractGameIdFromUrl(url);
      }

      // Extract image
      const imageElement = card.querySelector(this.SELECTORS.gameImage) as HTMLImageElement;
      let image: string | null = null;

      if (imageElement && imageElement.src) {
        image = this.normalizeUrl(imageElement.src);
      }

      // Extract completion times
      const times = this.parseCompletionTimes(card);

      return {
        id,
        name,
        image,
        url,
        ...times
      };
    } catch (error) {
      console.error('[HLTB Scraper] Error parsing game card:', error);
      return null;
    }
  }

  /**
   * Parse completion times from game card
   */
  private parseCompletionTimes(card: Element): {
    mainStory: number | null;
    mainExtra: number | null;
    completionist: number | null;
    allStyles: number | null;
  } {
    const times = {
      mainStory: null as number | null,
      mainExtra: null as number | null,
      completionist: null as number | null,
      allStyles: null as number | null
    };

    // Find all time containers
    const timeContainers = card.querySelectorAll(this.SELECTORS.timeContainer);

    timeContainers.forEach(container => {
      try {
        const labelElement = container.querySelector(this.SELECTORS.timeLabel);
        const valueElement = container.querySelector(this.SELECTORS.timeValue);

        if (!labelElement || !valueElement) {
          return;
        }

        const label = this.cleanText(labelElement.textContent || '').toLowerCase();
        const valueText = this.cleanText(valueElement.textContent || '');

        if (!label || !valueText) {
          return;
        }

        const hours = this.parseTimeString(valueText);

        // Map labels to time categories
        if (label.includes('main story') || label.includes('main')) {
          times.mainStory = hours;
        } else if (label.includes('main + extra') || label.includes('main+extra')) {
          times.mainExtra = hours;
        } else if (label.includes('completionist') || label.includes('100%')) {
          times.completionist = hours;
        } else if (label.includes('all styles') || label.includes('average')) {
          times.allStyles = hours;
        }
      } catch (error) {
        console.warn('[HLTB Scraper] Error parsing time container:', error);
      }
    });

    return times;
  }

  /**
   * Parse time string to hours (handles fractions, ranges, etc.)
   */
  private parseTimeString(timeStr: string): number | null {
    if (!timeStr || timeStr === '--' || timeStr === '-' || timeStr.toLowerCase() === 'n/a') {
      return null;
    }

    // Clean the string
    const cleaned = timeStr.toLowerCase().trim()
      .replace(/hours?/g, '')
      .replace(/hrs?/g, '')
      .replace(/h/g, '')
      .replace(/mins?/g, '')
      .replace(/m/g, '')
      .trim();

    if (!cleaned) {
      return null;
    }

    try {
      // Handle fractions (12½ → 12.5)
      let processed = cleaned.replace(/½/g, '.5')
                            .replace(/¼/g, '.25')
                            .replace(/¾/g, '.75')
                            .replace(/⅓/g, '.33')
                            .replace(/⅔/g, '.67');

      // Handle ranges (20 - 25 → take average)
      const rangeMatch = processed.match(/(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)/);
      if (rangeMatch) {
        const min = parseFloat(rangeMatch[1]);
        const max = parseFloat(rangeMatch[2]);
        if (!isNaN(min) && !isNaN(max)) {
          return Math.round((min + max) / 2);
        }
      }

      // Handle single number
      const numberMatch = processed.match(/(\d+(?:\.\d+)?)/);
      if (numberMatch) {
        const value = parseFloat(numberMatch[1]);
        if (!isNaN(value) && value > 0) {
          return Math.round(value);
        }
      }

      return null;
    } catch (error) {
      console.warn('[HLTB Scraper] Error parsing time string:', timeStr, error);
      return null;
    }
  }

  /**
   * Extract game ID from HLTB URL
   */
  private extractGameIdFromUrl(url: string): string | null {
    try {
      // HLTB URLs typically follow pattern: /game?id=12345
      const match = url.match(/[?&]id=(\d+)/);
      return match ? match[1] : null;
    } catch (error) {
      console.warn('[HLTB Scraper] Error extracting game ID from URL:', url, error);
      return null;
    }
  }

  /**
   * Normalize URLs to absolute format
   */
  private normalizeUrl(url: string): string {
    if (!url) return '';

    if (url.startsWith('//')) {
      return `https:${url}`;
    }

    if (url.startsWith('/')) {
      return `${this.BASE_URL}${url}`;
    }

    return url;
  }

  /**
   * Clean and sanitize text content
   */
  private cleanText(text: string): string {
    if (!text) return '';

    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim()
      .substring(0, 200); // Limit length for safety
  }

  /**
   * Find best matching game from scraped results
   */
  findBestMatch(searchTitle: string, games: ScrapedGameData[]): ScrapedGameData | null {
    if (!games || games.length === 0) {
      return null;
    }

    const normalizedSearch = this.normalizeTitle(searchTitle);
    let bestMatch = games[0];
    let bestScore = 0;

    for (const game of games) {
      const normalizedGame = this.normalizeTitle(game.name);
      const score = this.calculateSimilarity(normalizedSearch, normalizedGame);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = game;
      }
    }

    // Require minimum similarity score
    if (bestScore < 0.4) {
      console.log(`[HLTB Scraper] Best match score too low: ${bestScore} for "${searchTitle}"`);
      return null;
    }

    console.log(`[HLTB Scraper] Best match: "${bestMatch.name}" (score: ${bestScore.toFixed(2)})`);
    return bestMatch;
  }

  /**
   * Normalize title for comparison
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
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
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Validate scraped data structure
   */
  private validateGameData(data: ScrapedGameData): boolean {
    return !!(
      data &&
      typeof data.name === 'string' &&
      data.name.length > 0 &&
      data.name.length <= 200
    );
  }

  /**
   * Get scraper health status and statistics
   */
  async getScraperStatus(): Promise<{
    isHealthy: boolean;
    lastCheck: number;
    responseTime: number | null;
    error: string | null;
  }> {
    const startTime = Date.now();

    try {
      // Test scraper with a simple query
      const response = await fetch(`${this.BASE_URL}/search_results?search=portal`, {
        method: 'HEAD',
        headers: { 'User-Agent': this.USER_AGENT }
      });

      const responseTime = Date.now() - startTime;

      return {
        isHealthy: response.ok,
        lastCheck: Date.now(),
        responseTime,
        error: response.ok ? null : `HTTP ${response.status}`
      };
    } catch (error) {
      return {
        isHealthy: false,
        lastCheck: Date.now(),
        responseTime: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance for use across service worker
export const hltbScraper = new HLTBScraper();
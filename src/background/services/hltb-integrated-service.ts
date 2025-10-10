/**
 * HLTB Integrated Service
 *
 * Orchestrates multiple data acquisition strategies to ensure
 * reliable game completion time data with graceful fallbacks
 */

import { HLTBApiClient, RateLimitError, NetworkError } from './hltb-api-client';
import { hltbScraper, ScrapedGameData } from './hltb-scraper';
import { hltbFallback, HLTBData } from './hltb-fallback';
import { CacheService } from './cache-service';
import { QueueService } from './queue-service';

export interface SearchOptions {
  preferredPlatform?: string;
  skipCache?: boolean;
  skipApi?: boolean;
  skipScraping?: boolean;
  skipFallback?: boolean;
  timeout?: number;
}

export interface IntegratedHLTBData extends HLTBData {
  source: 'api' | 'scraper' | 'fallback' | 'cache';
  confidence: 'high' | 'medium' | 'low';
  retrievalTime: number;
}

export interface ServiceStats {
  apiAttempts: number;
  apiSuccesses: number;
  scraperAttempts: number;
  scraperSuccesses: number;
  fallbackAttempts: number;
  fallbackSuccesses: number;
  cacheHits: number;
  totalRequests: number;
  averageRetrievalTime: number;
}

/**
 * Main service class that integrates all HLTB data sources
 */
export class HLTBIntegratedService {
  private apiClient: HLTBApiClient;
  private cacheService: CacheService;
  private queueService: QueueService;

  // Statistics tracking
  private stats: ServiceStats = {
    apiAttempts: 0,
    apiSuccesses: 0,
    scraperAttempts: 0,
    scraperSuccesses: 0,
    fallbackAttempts: 0,
    fallbackSuccesses: 0,
    cacheHits: 0,
    totalRequests: 0,
    averageRetrievalTime: 0
  };

  private totalRetrievalTime = 0;

  constructor() {
    this.apiClient = new HLTBApiClient({
      maxRetries: 3,
      baseDelay: 1000,
      timeout: 10000
    });
    this.cacheService = new CacheService();
    this.queueService = new QueueService();
  }

  /**
   * Main entry point for getting game data
   * Tries strategies in order: Cache → API → Scraper → Fallback
   */
  async getGameData(
    title: string,
    appId?: string,
    options: SearchOptions = {}
  ): Promise<IntegratedHLTBData | null> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    console.log(`[HLTB Integrated] Searching for: ${title}`);

    try {
      // 1. Try Cache First
      if (!options.skipCache) {
        const cached = await this.tryCache(title, appId);
        if (cached) {
          this.updateRetrievalTime(Date.now() - startTime);
          return cached;
        }
      }

      // Queue the actual fetching to prevent overwhelming the service
      return await this.queueService.enqueue(async () => {
        let result: IntegratedHLTBData | null = null;

        // 2. Try API
        if (!options.skipApi) {
          result = await this.tryAPI(title, options);
          if (result) {
            await this.cacheResult(title, appId, result);
            this.updateRetrievalTime(Date.now() - startTime);
            return result;
          }
        }

        // 3. Try Web Scraping
        if (!options.skipScraping) {
          result = await this.tryScraping(title, options);
          if (result) {
            await this.cacheResult(title, appId, result);
            this.updateRetrievalTime(Date.now() - startTime);
            return result;
          }
        }

        // 4. Try Fallback Database
        if (!options.skipFallback) {
          result = await this.tryFallback(title);
          if (result) {
            await this.cacheResult(title, appId, result);
            this.updateRetrievalTime(Date.now() - startTime);
            return result;
          }
        }

        console.log(`[HLTB Integrated] No data found for: ${title}`);
        this.updateRetrievalTime(Date.now() - startTime);
        return null;
      });

    } catch (error) {
      console.error('[HLTB Integrated] Fatal error:', error);
      this.updateRetrievalTime(Date.now() - startTime);
      return null;
    }
  }

  /**
   * Try to get data from cache
   */
  private async tryCache(title: string, appId?: string): Promise<IntegratedHLTBData | null> {
    const cacheKey = appId || title;
    const sanitizedKey = cacheKey.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);

    const cached = await this.cacheService.get(sanitizedKey);
    if (cached) {
      console.log('[HLTB Integrated] Cache hit for:', title);
      this.stats.cacheHits++;

      // Ensure cached data has the extended properties
      if (!cached.source) {
        cached.source = 'cache';
      }
      if (!cached.confidence) {
        cached.confidence = 'medium';
      }
      if (!cached.retrievalTime) {
        cached.retrievalTime = 0;
      }

      return cached as IntegratedHLTBData;
    }

    return null;
  }

  /**
   * Try to get data from HLTB API
   */
  private async tryAPI(title: string, options: SearchOptions): Promise<IntegratedHLTBData | null> {
    console.log('[HLTB Integrated] Trying API for:', title);
    this.stats.apiAttempts++;

    try {
      const apiData = await this.apiClient.getGameData(title);

      if (apiData) {
        console.log('[HLTB Integrated] API success for:', title);
        this.stats.apiSuccesses++;

        return {
          ...apiData,
          source: 'api',
          confidence: 'high',
          retrievalTime: Date.now()
        };
      }

    } catch (error) {
      if (error instanceof RateLimitError) {
        console.warn('[HLTB Integrated] API rate limited, skipping API for future requests');
        // Could implement temporary API skip logic here
      } else if (error instanceof NetworkError) {
        console.warn('[HLTB Integrated] API network error:', error.message);
      } else {
        console.error('[HLTB Integrated] API error:', error);
      }
    }

    return null;
  }

  /**
   * Try to get data from web scraping
   */
  private async tryScraping(title: string, options: SearchOptions): Promise<IntegratedHLTBData | null> {
    console.log('[HLTB Integrated] Trying scraper for:', title);
    this.stats.scraperAttempts++;

    try {
      const scrapingResult = await hltbScraper.scrapeGameData(title);

      if (scrapingResult && scrapingResult.games.length > 0) {
        const bestMatch = await hltbScraper.findBestMatch(title, scrapingResult.games);

        if (bestMatch) {
          console.log('[HLTB Integrated] Scraper success for:', title);
          this.stats.scraperSuccesses++;

          return {
            mainStory: bestMatch.mainStory,
            mainExtra: bestMatch.mainExtra,
            completionist: bestMatch.completionist,
            allStyles: bestMatch.allStyles,
            source: 'scraper',
            confidence: 'medium',
            retrievalTime: Date.now()
          };
        }
      }

    } catch (error) {
      console.error('[HLTB Integrated] Scraper error:', error);
    }

    return null;
  }

  /**
   * Try to get data from fallback database
   */
  private async tryFallback(title: string): Promise<IntegratedHLTBData | null> {
    console.log('[HLTB Integrated] Trying fallback for:', title);
    this.stats.fallbackAttempts++;

    try {
      const fallbackData = await hltbFallback.searchFallback(title);

      if (fallbackData) {
        console.log('[HLTB Integrated] Fallback success for:', title);
        this.stats.fallbackSuccesses++;

        return {
          ...fallbackData,
          source: 'fallback',
          confidence: 'low',
          retrievalTime: Date.now()
        };
      }

    } catch (error) {
      console.error('[HLTB Integrated] Fallback error:', error);
    }

    return null;
  }

  /**
   * Cache the result for future use
   */
  private async cacheResult(
    title: string,
    appId: string | undefined,
    data: IntegratedHLTBData
  ): Promise<void> {
    const cacheKey = appId || title;
    const sanitizedKey = cacheKey.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);

    try {
      await this.cacheService.set(sanitizedKey, data);
      console.log(`[HLTB Integrated] Cached result for: ${title}`);
    } catch (error) {
      console.error('[HLTB Integrated] Cache write error:', error);
    }
  }

  /**
   * Update average retrieval time
   */
  private updateRetrievalTime(time: number): void {
    this.totalRetrievalTime += time;
    this.stats.averageRetrievalTime = Math.round(
      this.totalRetrievalTime / this.stats.totalRequests
    );
  }

  /**
   * Batch fetch multiple games efficiently
   */
  async batchFetch(
    games: Array<{ title: string; appId?: string }>,
    options: SearchOptions = {}
  ): Promise<Map<string, IntegratedHLTBData | null>> {
    const results = new Map<string, IntegratedHLTBData | null>();

    // Process in chunks to avoid overwhelming the services
    const chunkSize = 5;
    for (let i = 0; i < games.length; i += chunkSize) {
      const chunk = games.slice(i, i + chunkSize);

      const promises = chunk.map(game =>
        this.getGameData(game.title, game.appId, options)
          .then(data => ({ key: game.appId || game.title, data }))
      );

      const chunkResults = await Promise.allSettled(promises);

      for (const result of chunkResults) {
        if (result.status === 'fulfilled') {
          results.set(result.value.key, result.value.data);
        } else {
          console.error('[HLTB Integrated] Batch fetch error:', result.reason);
        }
      }

      // Small delay between chunks to avoid rate limiting
      if (i + chunkSize < games.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  /**
   * Get service statistics
   */
  getStats(): ServiceStats {
    return { ...this.stats };
  }

  /**
   * Reset service statistics
   */
  resetStats(): void {
    this.stats = {
      apiAttempts: 0,
      apiSuccesses: 0,
      scraperAttempts: 0,
      scraperSuccesses: 0,
      fallbackAttempts: 0,
      fallbackSuccesses: 0,
      cacheHits: 0,
      totalRequests: 0,
      averageRetrievalTime: 0
    };
    this.totalRetrievalTime = 0;
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<number> {
    const cleared = await this.cacheService.clear();
    console.log(`[HLTB Integrated] Cleared ${cleared} cache entries`);
    return cleared;
  }

  /**
   * Get comprehensive diagnostics
   */
  async getDiagnostics() {
    const [cacheStats, fallbackStats, scraperStatus] = await Promise.all([
      this.cacheService.getStats(),
      hltbFallback.getStats(),
      hltbScraper.getScraperStatus()
    ]);

    return {
      service: {
        stats: this.getStats(),
        successRates: {
          api: this.stats.apiAttempts > 0
            ? (this.stats.apiSuccesses / this.stats.apiAttempts * 100).toFixed(1) + '%'
            : 'N/A',
          scraper: this.stats.scraperAttempts > 0
            ? (this.stats.scraperSuccesses / this.stats.scraperAttempts * 100).toFixed(1) + '%'
            : 'N/A',
          fallback: this.stats.fallbackAttempts > 0
            ? (this.stats.fallbackSuccesses / this.stats.fallbackAttempts * 100).toFixed(1) + '%'
            : 'N/A',
          cacheHitRate: this.stats.totalRequests > 0
            ? (this.stats.cacheHits / this.stats.totalRequests * 100).toFixed(1) + '%'
            : 'N/A'
        }
      },
      cache: cacheStats,
      fallback: fallbackStats,
      scraper: scraperStatus
    };
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check if we're getting too many failures
    if (this.stats.apiAttempts > 10 && this.stats.apiSuccesses === 0) {
      issues.push('API is not responding');
    }

    if (this.stats.scraperAttempts > 10 && this.stats.scraperSuccesses === 0) {
      issues.push('Scraper is not working');
    }

    // Check average retrieval time
    if (this.stats.averageRetrievalTime > 5000) {
      issues.push(`Slow average retrieval time: ${this.stats.averageRetrievalTime}ms`);
    }

    // Check cache
    const cacheStats = await this.cacheService.getStats();
    if (cacheStats.size > 1000) {
      issues.push(`Cache is getting large: ${cacheStats.size} entries`);
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }
}

// Export singleton instance
export const hltbIntegratedService = new HLTBIntegratedService();
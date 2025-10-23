/**
 * HLTB Fallback Database Service
 *
 * Provides a local database of common game completion times
 * as a final fallback when API and scraping both fail
 *
 * Performance Optimizations:
 * - O(1) direct lookups using Map
 * - O(1) alias lookups using separate Map
 * - Optimized fuzzy matching with early exit
 * - Performance measurement and tracking
 * - Memory footprint monitoring
 */

import fallbackData from './fallback-data.json';
import { performanceMonitor } from '../../shared/performance-monitor';
import { memoizeWithLRU } from '../../shared/optimization-utils';

export interface HLTBData {
  mainStory: number | null;
  mainExtra: number | null;
  completionist: number | null;
  allStyles: number | null;
}

export interface FallbackGameEntry {
  title: string;
  aliases?: string[];
  data: HLTBData;
  confidence?: 'high' | 'medium' | 'low';
  lastUpdated?: string;
}

export interface DatabaseStats {
  totalGames: number;
  totalAliases: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  initializationTime: number;
  memoryUsage: number;
  averageLookupTime: number;
  cacheHitRate: number;
}

export class HLTBFallback {
  private readonly COMMUNITY_DB_URL = 'https://raw.githubusercontent.com/username/hltb-db/main/games.json';
  private localDatabase: Map<string, FallbackGameEntry> = new Map();
  private aliasMap: Map<string, string> = new Map(); // Maps aliases to primary keys

  // Performance tracking
  private initializationTime: number = 0;
  private lookupCount: number = 0;
  private totalLookupTime: number = 0;
  private cacheHits: number = 0;

  // Optimized normalize function with LRU cache
  private normalizeTitle: (title: string) => string;

  constructor() {
    // Memoize the normalize function with LRU cache (max 500 entries)
    this.normalizeTitle = memoizeWithLRU(
      (title: string) => this.normalizeInternal(title),
      500
    );

    this.initializeLocalDatabase();
    this.loadCommunityDatabase();
  }

  /**
   * Initialize with games from JSON database
   */
  private initializeLocalDatabase() {
    const startTime = performance.now();
    performanceMonitor.startTiming('database_initialization');

    const commonGames: FallbackGameEntry[] = fallbackData.games as FallbackGameEntry[];

    // Populate the database and alias map
    for (const game of commonGames) {
      const key = this.normalizeTitle(game.title);
      this.localDatabase.set(key, game);

      // Add aliases
      if (game.aliases) {
        for (const alias of game.aliases) {
          this.aliasMap.set(this.normalizeTitle(alias), key);
        }
      }
    }

    this.initializationTime = performanceMonitor.endTiming('database_initialization', {
      gameCount: this.localDatabase.size,
      aliasCount: this.aliasMap.size
    });

    // Take memory snapshot
    performanceMonitor.takeMemorySnapshot();

    const endTime = performance.now();
    const loadTime = endTime - startTime;

    console.log(`[HLTB Fallback] Initialized with ${this.localDatabase.size} games in ${loadTime.toFixed(2)}ms`);

    // Warn if initialization is slow (target: < 100ms)
    if (loadTime > 100) {
      console.warn(`[HLTB Fallback] Slow database initialization: ${loadTime.toFixed(2)}ms (target: < 100ms)`);
    }
  }

  /**
   * Load community-maintained database (if available)
   */
  private async loadCommunityDatabase() {
    try {
      const response = await fetch(this.COMMUNITY_DB_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        this.populateCommunityData(data);
        console.log('[HLTB Fallback] Community database loaded');
      }
    } catch (error) {
      // Community database is optional, fail silently
      console.log('[HLTB Fallback] Community database not available, using local data only');
    }
  }

  /**
   * Populate database with community data
   */
  private populateCommunityData(data: any[]) {
    if (!Array.isArray(data)) return;

    let added = 0;
    for (const game of data) {
      if (!game.title || !game.data) continue;

      const key = this.normalizeTitle(game.title);

      // Don't override high-confidence local data
      const existing = this.localDatabase.get(key);
      if (existing && existing.confidence === 'high') continue;

      this.localDatabase.set(key, {
        title: game.title,
        aliases: game.aliases || [],
        data: game.data,
        confidence: 'medium',
        lastUpdated: game.lastUpdated
      });

      added++;
    }

    console.log(`[HLTB Fallback] Added ${added} games from community database`);
  }

  /**
   * Search for game in fallback database
   */
  async searchFallback(title: string): Promise<HLTBData | null> {
    const startTime = performance.now();
    performanceMonitor.startTiming('database_lookup');

    const normalized = this.normalizeTitle(title);

    let result: HLTBData | null = null;
    let matchType = 'none';

    // Direct match (O(1) - fastest)
    if (this.localDatabase.has(normalized)) {
      result = this.localDatabase.get(normalized)!.data;
      matchType = 'direct';
      this.cacheHits++;
      console.log(`[HLTB Fallback] Direct match found for: ${title}`);
    }
    // Check aliases (O(1) - fast)
    else if (this.aliasMap.has(normalized)) {
      const primaryKey = this.aliasMap.get(normalized)!;
      result = this.localDatabase.get(primaryKey)!.data;
      matchType = 'alias';
      this.cacheHits++;
      console.log(`[HLTB Fallback] Alias match found for: ${title}`);
    }
    // Fuzzy match (O(n) - slower, optimized)
    else {
      const fuzzyMatch = this.findFuzzyMatch(normalized);
      if (fuzzyMatch) {
        result = fuzzyMatch;
        matchType = 'fuzzy';
        console.log(`[HLTB Fallback] Fuzzy match found for: ${title}`);
      } else {
        // Partial match (O(n) - slowest, last resort)
        const partialMatch = this.findPartialMatch(normalized);
        if (partialMatch) {
          result = partialMatch;
          matchType = 'partial';
          console.log(`[HLTB Fallback] Partial match found for: ${title}`);
        }
      }
    }

    const lookupTime = performanceMonitor.endTiming('database_lookup', {
      matchType,
      found: result !== null
    });

    // Track lookup statistics
    this.lookupCount++;
    this.totalLookupTime += lookupTime;

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Warn if lookup is slow for direct/alias matches (target: < 1ms)
    if ((matchType === 'direct' || matchType === 'alias') && duration > 1) {
      console.warn(`[HLTB Fallback] Slow ${matchType} match: ${duration.toFixed(2)}ms (target: < 1ms)`);
    }

    // Warn if fuzzy match is slow (target: < 15ms)
    if (matchType === 'fuzzy' && duration > 15) {
      console.warn(`[HLTB Fallback] Slow fuzzy match: ${duration.toFixed(2)}ms (target: < 15ms)`);
    }

    if (result === null) {
      console.log(`[HLTB Fallback] No match found for: ${title}`);
    }

    return result;
  }

  /**
   * Find fuzzy match using word overlap (optimized)
   */
  private findFuzzyMatch(normalized: string): HLTBData | null {
    const words = normalized.split(/\s+/).filter(w => w.length > 0);

    // Early exit if no words
    if (words.length === 0) {
      return null;
    }

    let bestMatch: FallbackGameEntry | null = null;
    let bestScore = 0;
    const minScore = 0.5; // Minimum threshold

    // Optimized loop with early exit
    for (const [key, entry] of this.localDatabase.entries()) {
      const keyWords = key.split(/\s+/);

      // Early exit: if title is too different in length, skip
      const lengthRatio = Math.min(words.length, keyWords.length) / Math.max(words.length, keyWords.length);
      if (lengthRatio < 0.3) {
        continue; // Too different in length
      }

      // Calculate word overlap score
      let matchedWords = 0;
      for (const word of words) {
        // Exact word match first (faster)
        if (keyWords.includes(word)) {
          matchedWords++;
        } else {
          // Partial word match (slower)
          if (keyWords.some(kw => kw.includes(word) || word.includes(kw))) {
            matchedWords++;
          }
        }
      }

      const score = matchedWords / Math.max(words.length, keyWords.length);

      // Update best match if score is better and meets threshold
      if (score > bestScore && score >= minScore) {
        bestScore = score;
        bestMatch = entry;

        // Early exit if perfect match found
        if (bestScore === 1.0) {
          break;
        }
      }
    }

    return bestMatch ? bestMatch.data : null;
  }

  /**
   * Find partial match (one title contains the other)
   */
  private findPartialMatch(normalized: string): HLTBData | null {
    // Check if normalized title is contained in any database entry
    for (const [key, entry] of this.localDatabase.entries()) {
      if (key.includes(normalized) || normalized.includes(key)) {
        // Prefer shorter matches (more specific)
        if (!normalized.includes(key) || key.length > normalized.length * 0.5) {
          return entry.data;
        }
      }
    }

    return null;
  }

  /**
   * Internal normalize function (called via memoized version)
   */
  private normalizeInternal(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ')         // Normalize spaces
      .trim();
  }

  /**
   * Get all available games (for debugging/testing)
   */
  getAvailableGames(): string[] {
    return Array.from(this.localDatabase.values()).map(entry => entry.title);
  }

  /**
   * Get database statistics (enhanced with performance metrics)
   */
  getStats(): DatabaseStats {
    const highConfidence = Array.from(this.localDatabase.values())
      .filter(e => e.confidence === 'high').length;
    const mediumConfidence = Array.from(this.localDatabase.values())
      .filter(e => e.confidence === 'medium').length;
    const lowConfidence = Array.from(this.localDatabase.values())
      .filter(e => e.confidence === 'low').length;

    // Calculate memory usage
    const memoryUsage = this.estimateMemoryUsage();

    // Calculate average lookup time
    const averageLookupTime = this.lookupCount > 0
      ? this.totalLookupTime / this.lookupCount
      : 0;

    // Calculate cache hit rate (direct + alias matches)
    const cacheHitRate = this.lookupCount > 0
      ? this.cacheHits / this.lookupCount
      : 0;

    return {
      totalGames: this.localDatabase.size,
      totalAliases: this.aliasMap.size,
      highConfidence,
      mediumConfidence,
      lowConfidence,
      initializationTime: this.initializationTime,
      memoryUsage,
      averageLookupTime,
      cacheHitRate
    };
  }

  /**
   * Estimate memory usage of the database
   */
  private estimateMemoryUsage(): number {
    // Rough estimation:
    // - Each Map entry: ~200 bytes overhead
    // - Each game entry: ~500 bytes (title, data, metadata)
    // - Each alias: ~100 bytes

    const mapOverhead = (this.localDatabase.size + this.aliasMap.size) * 200;
    const gameData = this.localDatabase.size * 500;
    const aliasData = this.aliasMap.size * 100;

    return mapOverhead + gameData + aliasData;
  }

  /**
   * Log performance report
   */
  logPerformance(): void {
    const stats = this.getStats();

    console.log('[HLTB Fallback] Performance Report:');
    console.log(`  Database Size: ${stats.totalGames} games, ${stats.totalAliases} aliases`);
    console.log(`  Initialization Time: ${stats.initializationTime.toFixed(2)}ms`);
    console.log(`  Memory Usage: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)}MB (estimated)`);
    console.log(`  Total Lookups: ${this.lookupCount}`);
    console.log(`  Average Lookup Time: ${stats.averageLookupTime.toFixed(2)}ms`);
    console.log(`  Cache Hit Rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);

    // Performance warnings
    if (stats.initializationTime > 100) {
      console.warn(`  WARNING: Initialization time exceeds target (100ms)`);
    }

    if (stats.memoryUsage > 50 * 1024 * 1024) {
      console.warn(`  WARNING: Memory usage exceeds target (50MB)`);
    }

    if (stats.averageLookupTime > 5) {
      console.warn(`  WARNING: Average lookup time is high (${stats.averageLookupTime.toFixed(2)}ms)`);
    }
  }

  /**
   * Reset performance counters
   */
  resetPerformanceCounters(): void {
    this.lookupCount = 0;
    this.totalLookupTime = 0;
    this.cacheHits = 0;
  }
}

// Export singleton instance
export const hltbFallback = new HLTBFallback();
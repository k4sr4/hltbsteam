/**
 * HLTB Fallback Database Service
 *
 * Provides a local database of common game completion times
 * as a final fallback when API and scraping both fail
 */

import fallbackData from './fallback-data.json';

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

export class HLTBFallback {
  private readonly COMMUNITY_DB_URL = 'https://raw.githubusercontent.com/username/hltb-db/main/games.json';
  private localDatabase: Map<string, FallbackGameEntry> = new Map();
  private aliasMap: Map<string, string> = new Map(); // Maps aliases to primary keys

  constructor() {
    this.initializeLocalDatabase();
    this.loadCommunityDatabase();
  }

  /**
   * Initialize with games from JSON database
   */
  private initializeLocalDatabase() {
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

    console.log(`[HLTB Fallback] Initialized with ${this.localDatabase.size} games`);
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
    const normalized = this.normalizeTitle(title);

    // Direct match
    if (this.localDatabase.has(normalized)) {
      console.log(`[HLTB Fallback] Direct match found for: ${title}`);
      return this.localDatabase.get(normalized)!.data;
    }

    // Check aliases
    if (this.aliasMap.has(normalized)) {
      const primaryKey = this.aliasMap.get(normalized)!;
      console.log(`[HLTB Fallback] Alias match found for: ${title}`);
      return this.localDatabase.get(primaryKey)!.data;
    }

    // Fuzzy match
    const fuzzyMatch = this.findFuzzyMatch(normalized);
    if (fuzzyMatch) {
      console.log(`[HLTB Fallback] Fuzzy match found for: ${title}`);
      return fuzzyMatch;
    }

    // Partial match
    const partialMatch = this.findPartialMatch(normalized);
    if (partialMatch) {
      console.log(`[HLTB Fallback] Partial match found for: ${title}`);
      return partialMatch;
    }

    console.log(`[HLTB Fallback] No match found for: ${title}`);
    return null;
  }

  /**
   * Find fuzzy match using word overlap
   */
  private findFuzzyMatch(normalized: string): HLTBData | null {
    const words = normalized.split(/\s+/);
    let bestMatch: FallbackGameEntry | null = null;
    let bestScore = 0;

    for (const [key, entry] of this.localDatabase.entries()) {
      const keyWords = key.split(/\s+/);

      // Calculate word overlap score
      let matchedWords = 0;
      for (const word of words) {
        if (keyWords.some(kw => kw.includes(word) || word.includes(kw))) {
          matchedWords++;
        }
      }

      const score = matchedWords / Math.max(words.length, keyWords.length);

      if (score > bestScore && score >= 0.5) {
        bestScore = score;
        bestMatch = entry;
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
   * Normalize title for matching
   */
  private normalizeTitle(title: string): string {
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
   * Get database statistics
   */
  getStats() {
    const highConfidence = Array.from(this.localDatabase.values())
      .filter(e => e.confidence === 'high').length;
    const mediumConfidence = Array.from(this.localDatabase.values())
      .filter(e => e.confidence === 'medium').length;
    const lowConfidence = Array.from(this.localDatabase.values())
      .filter(e => e.confidence === 'low').length;

    return {
      totalGames: this.localDatabase.size,
      totalAliases: this.aliasMap.size,
      highConfidence,
      mediumConfidence,
      lowConfidence
    };
  }
}

// Export singleton instance
export const hltbFallback = new HLTBFallback();
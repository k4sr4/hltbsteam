/**
 * HLTB Fallback Database Service
 *
 * Provides a local database of common game completion times
 * as a final fallback when API and scraping both fail
 */

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
   * Initialize with hardcoded popular Steam games
   */
  private initializeLocalDatabase() {
    const commonGames: FallbackGameEntry[] = [
      // Valve Games
      {
        title: 'Portal',
        aliases: ['portal 1'],
        data: { mainStory: 3, mainExtra: 4, completionist: 5, allStyles: 4 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },
      {
        title: 'Portal 2',
        aliases: ['portal two', 'portal ii'],
        data: { mainStory: 8, mainExtra: 10, completionist: 14, allStyles: 9 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },
      {
        title: 'Half-Life',
        aliases: ['halflife', 'half life'],
        data: { mainStory: 12, mainExtra: 13, completionist: 15, allStyles: 12 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },
      {
        title: 'Half-Life 2',
        aliases: ['halflife 2', 'half life 2', 'hl2'],
        data: { mainStory: 13, mainExtra: 15, completionist: 18, allStyles: 13 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },
      {
        title: 'Half-Life: Alyx',
        aliases: ['half life alyx', 'hl alyx', 'alyx'],
        data: { mainStory: 12, mainExtra: 13, completionist: 18, allStyles: 12 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },

      // Multiplayer Games (no completion times)
      {
        title: 'Team Fortress 2',
        aliases: ['tf2', 'team fortress two'],
        data: { mainStory: null, mainExtra: null, completionist: null, allStyles: null },
        confidence: 'high'
      },
      {
        title: 'Counter-Strike 2',
        aliases: ['cs2', 'cs 2', 'counterstrike 2'],
        data: { mainStory: null, mainExtra: null, completionist: null, allStyles: null },
        confidence: 'high'
      },
      {
        title: 'Counter-Strike: Global Offensive',
        aliases: ['csgo', 'cs go', 'cs:go'],
        data: { mainStory: null, mainExtra: null, completionist: null, allStyles: null },
        confidence: 'high'
      },
      {
        title: 'Dota 2',
        aliases: ['dota two'],
        data: { mainStory: null, mainExtra: null, completionist: null, allStyles: null },
        confidence: 'high'
      },

      // Popular Indies
      {
        title: 'Hades',
        aliases: ['hades 1'],
        data: { mainStory: 22, mainExtra: 45, completionist: 95, allStyles: 55 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },
      {
        title: 'Hades II',
        aliases: ['hades 2', 'hades two'],
        data: { mainStory: 15, mainExtra: 25, completionist: 50, allStyles: 30 },
        confidence: 'medium',
        lastUpdated: '2024-09'
      },
      {
        title: 'Hollow Knight',
        aliases: [],
        data: { mainStory: 27, mainExtra: 40, completionist: 63, allStyles: 42 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },
      {
        title: 'Celeste',
        aliases: [],
        data: { mainStory: 8, mainExtra: 12, completionist: 37, allStyles: 28 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },
      {
        title: 'Stardew Valley',
        aliases: [],
        data: { mainStory: 53, mainExtra: 95, completionist: 156, allStyles: 96 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },
      {
        title: 'Terraria',
        aliases: [],
        data: { mainStory: 50, mainExtra: 104, completionist: 215, allStyles: 115 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },

      // AAA Games
      {
        title: 'Elden Ring',
        aliases: [],
        data: { mainStory: 60, mainExtra: 100, completionist: 130, allStyles: 96 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },
      {
        title: 'The Witcher 3: Wild Hunt',
        aliases: ['witcher 3', 'the witcher three'],
        data: { mainStory: 50, mainExtra: 100, completionist: 170, allStyles: 101 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },
      {
        title: 'Red Dead Redemption 2',
        aliases: ['rdr2', 'red dead 2'],
        data: { mainStory: 50, mainExtra: 80, completionist: 180, allStyles: 80 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },
      {
        title: 'Grand Theft Auto V',
        aliases: ['gta 5', 'gta v', 'gtav'],
        data: { mainStory: 32, mainExtra: 48, completionist: 83, allStyles: 52 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },
      {
        title: 'Cyberpunk 2077',
        aliases: ['cyberpunk', 'cp2077'],
        data: { mainStory: 25, mainExtra: 60, completionist: 105, allStyles: 61 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },
      {
        title: 'Baldur\'s Gate 3',
        aliases: ['bg3', 'baldurs gate 3'],
        data: { mainStory: 75, mainExtra: 100, completionist: 200, allStyles: 107 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },

      // FromSoft Games
      {
        title: 'Dark Souls',
        aliases: ['dark souls 1', 'ds1'],
        data: { mainStory: 42, mainExtra: 60, completionist: 105, allStyles: 66 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },
      {
        title: 'Dark Souls II',
        aliases: ['dark souls 2', 'ds2'],
        data: { mainStory: 44, mainExtra: 70, completionist: 120, allStyles: 78 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },
      {
        title: 'Dark Souls III',
        aliases: ['dark souls 3', 'ds3'],
        data: { mainStory: 32, mainExtra: 48, completionist: 100, allStyles: 59 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },
      {
        title: 'Sekiro: Shadows Die Twice',
        aliases: ['sekiro'],
        data: { mainStory: 30, mainExtra: 40, completionist: 70, allStyles: 41 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },

      // Strategy Games
      {
        title: 'Civilization VI',
        aliases: ['civ 6', 'civ vi', 'civilization 6'],
        data: { mainStory: 22, mainExtra: 40, completionist: 220, allStyles: 81 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },
      {
        title: 'Total War: WARHAMMER III',
        aliases: ['total warhammer 3', 'tww3'],
        data: { mainStory: 32, mainExtra: 125, completionist: 280, allStyles: 180 },
        confidence: 'medium',
        lastUpdated: '2024-01'
      },

      // Roguelikes/Roguelites
      {
        title: 'The Binding of Isaac: Rebirth',
        aliases: ['binding of isaac rebirth', 'tboi rebirth'],
        data: { mainStory: 13, mainExtra: 50, completionist: 270, allStyles: 140 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },
      {
        title: 'Risk of Rain 2',
        aliases: ['ror2'],
        data: { mainStory: 10, mainExtra: 30, completionist: 120, allStyles: 59 },
        confidence: 'high',
        lastUpdated: '2024-01'
      },
      {
        title: 'Dead Cells',
        aliases: [],
        data: { mainStory: 14, mainExtra: 30, completionist: 83, allStyles: 46 },
        confidence: 'high',
        lastUpdated: '2024-01'
      }
    ];

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
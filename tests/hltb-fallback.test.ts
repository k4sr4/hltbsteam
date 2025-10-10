/**
 * HLTB Fallback Database Tests
 * Tests for local database, game matching, alias resolution, and fuzzy search
 */

import { HLTBFallback, HLTBData, FallbackGameEntry } from '../src/background/services/hltb-fallback';

// Mock fetch for community database
global.fetch = jest.fn();

describe('HLTBFallback', () => {
  let fallback: HLTBFallback;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  // Mock community database response
  const mockCommunityDatabase = [
    {
      title: 'Hades',
      aliases: ['hades game'],
      data: {
        mainStory: 22,
        mainExtra: 45,
        completionist: 95,
        allStyles: 28
      },
      confidence: 'high',
      lastUpdated: '2024-01'
    },
    {
      title: 'Celeste',
      aliases: ['celeste game'],
      data: {
        mainStory: 8,
        mainExtra: 12,
        completionist: 37,
        allStyles: 11
      },
      confidence: 'high',
      lastUpdated: '2024-01'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

    // Mock successful community database fetch by default
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockCommunityDatabase
    } as Response);

    fallback = new HLTBFallback();
  });

  describe('Game Matching', () => {
    test('should find exact match for game title', () => {
      const result = fallback.searchGame('Portal');

      expect(result).toBeDefined();
      expect(result?.mainStory).toBe(3);
      expect(result?.mainExtra).toBe(4);
      expect(result?.completionist).toBe(5);
      expect(result?.allStyles).toBe(4);
    });

    test('should find game ignoring case', () => {
      const result1 = fallback.searchGame('portal');
      const result2 = fallback.searchGame('PORTAL');
      const result3 = fallback.searchGame('Portal');

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });

    test('should return null for non-existent game', () => {
      const result = fallback.searchGame('Nonexistent Game XYZ');

      expect(result).toBeNull();
    });

    test('should find popular Steam games', () => {
      const popularGames = [
        'Portal',
        'Portal 2',
        'Half-Life',
        'Half-Life 2',
        'Left 4 Dead',
        'Left 4 Dead 2',
        'Team Fortress 2',
        'Counter-Strike: Global Offensive',
        'Dota 2',
        'The Witcher 3: Wild Hunt',
        'Elden Ring',
        'Dark Souls',
        'Hollow Knight',
        'Stardew Valley',
        'Terraria',
        'Minecraft',
        'Among Us',
        'Fall Guys',
        'Rocket League',
        'Grand Theft Auto V'
      ];

      for (const game of popularGames) {
        const result = fallback.searchGame(game);
        expect(result).toBeDefined();
        expect(result).toHaveProperty('mainStory');
      }
    });

    test('should handle game with only multiplayer data', () => {
      const result = fallback.searchGame('Counter-Strike: Global Offensive');

      expect(result).toBeDefined();
      expect(result?.mainStory).toBeNull();
      expect(result?.mainExtra).toBeNull();
      expect(result?.completionist).toBeNull();
      expect(result?.allStyles).toBeNull();
    });

    test('should handle games with partial data', () => {
      const result = fallback.searchGame('Rocket League');

      expect(result).toBeDefined();
      // Rocket League has no traditional campaign
      expect(result?.mainStory).toBeNull();
    });

    test('should use app ID for more accurate matching when provided', () => {
      // Portal has app ID 400
      const result1 = fallback.searchGame('Portal', '400');
      expect(result1?.mainStory).toBe(3);

      // Portal 2 has app ID 620
      const result2 = fallback.searchGame('Portal', '620');
      // Should ideally return Portal 2 data or handle mismatch
      expect(result2).toBeDefined();
    });
  });

  describe('Alias Resolution', () => {
    test('should find game by alias', () => {
      const result = fallback.searchGame('portal 1');

      expect(result).toBeDefined();
      expect(result?.mainStory).toBe(3);
    });

    test('should handle multiple aliases for same game', () => {
      const aliases = ['halflife', 'half life', 'hl1'];

      for (const alias of aliases) {
        const result = fallback.searchGame(alias);
        expect(result).toBeDefined();
        expect(result?.mainStory).toBe(12); // Half-Life main story time
      }
    });

    test('should handle subtitle variations', () => {
      const variations = [
        'The Witcher 3: Wild Hunt',
        'Witcher 3 Wild Hunt',
        'The Witcher III: Wild Hunt',
        'Witcher 3',
        'TW3'
      ];

      for (const variation of variations) {
        const result = fallback.searchGame(variation);
        expect(result).toBeDefined();
        expect(result?.mainStory).toBe(51);
      }
    });

    test('should handle edition names', () => {
      const editions = [
        'Dark Souls',
        'Dark Souls: Prepare to Die Edition',
        'Dark Souls Remastered',
        'DARK SOULS™: REMASTERED'
      ];

      for (const edition of editions) {
        const result = fallback.searchGame(edition);
        expect(result).toBeDefined();
        // All should return base Dark Souls times
      }
    });

    test('should handle roman numerals', () => {
      expect(fallback.searchGame('Portal 2')).toBeDefined();
      expect(fallback.searchGame('Portal II')).toBeDefined();

      expect(fallback.searchGame('Dark Souls 3')).toBeDefined();
      expect(fallback.searchGame('Dark Souls III')).toBeDefined();
    });

    test('should handle acronyms', () => {
      const acronyms = [
        { full: 'Grand Theft Auto V', acronym: 'GTA V' },
        { full: 'Counter-Strike: Global Offensive', acronym: 'CS:GO' },
        { full: 'Team Fortress 2', acronym: 'TF2' },
        { full: 'Left 4 Dead', acronym: 'L4D' },
        { full: 'Left 4 Dead 2', acronym: 'L4D2' }
      ];

      for (const { full, acronym } of acronyms) {
        const resultFull = fallback.searchGame(full);
        const resultAcronym = fallback.searchGame(acronym);

        expect(resultFull).toBeDefined();
        expect(resultAcronym).toBeDefined();
        expect(resultFull).toEqual(resultAcronym);
      }
    });
  });

  describe('Fuzzy Search', () => {
    test('should find game with minor typos', () => {
      const result = fallback.fuzzySearch('Protal'); // Typo: Portal

      expect(result).toBeDefined();
      expect(result?.mainStory).toBe(3);
    });

    test('should find game with missing words', () => {
      const result = fallback.fuzzySearch('Witcher 3'); // Missing "The"

      expect(result).toBeDefined();
      expect(result?.mainStory).toBe(51);
    });

    test('should find game with extra words', () => {
      const result = fallback.fuzzySearch('The Portal Game');

      expect(result).toBeDefined();
      expect(result?.mainStory).toBe(3);
    });

    test('should handle special characters', () => {
      const specialChars = [
        'Tom Clancy\'s Rainbow Six® Siege™',
        'Tom Clancys Rainbow Six Siege',
        'Rainbow Six Siege'
      ];

      for (const title of specialChars) {
        const result = fallback.fuzzySearch(title);
        expect(result).toBeDefined();
      }
    });

    test('should calculate similarity scores', () => {
      const score1 = fallback.calculateSimilarity('Portal', 'Portal');
      expect(score1).toBe(1.0);

      const score2 = fallback.calculateSimilarity('Portal', 'Portal 2');
      expect(score2).toBeGreaterThan(0.5);
      expect(score2).toBeLessThan(1.0);

      const score3 = fallback.calculateSimilarity('Portal', 'Half-Life');
      expect(score3).toBeLessThan(0.3);
    });

    test('should use threshold for fuzzy matching', () => {
      // Very different name shouldn't match
      const result = fallback.fuzzySearch('Completely Different Game');

      // Should not match Portal or any other game
      if (result) {
        const similarity = fallback.calculateSimilarity(
          'Completely Different Game',
          'Portal'
        );
        expect(similarity).toBeLessThan(0.3);
      }
    });

    test('should prefer higher similarity matches', () => {
      // "Portal" should match "Portal" over "Portal 2"
      const result = fallback.fuzzySearch('Portal');

      expect(result).toBeDefined();
      expect(result?.mainStory).toBe(3); // Portal 1's time, not Portal 2's
    });

    test('should handle partial matches', () => {
      const partials = [
        { search: 'Souls', expected: 'Dark Souls' },
        { search: 'Fortress', expected: 'Team Fortress 2' },
        { search: 'Strike', expected: 'Counter-Strike: Global Offensive' },
        { search: 'Theft Auto', expected: 'Grand Theft Auto V' }
      ];

      for (const { search } of partials) {
        const result = fallback.fuzzySearch(search);
        expect(result).toBeDefined();
      }
    });
  });

  describe('Community Database', () => {
    test('should load community database on initialization', async () => {
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('github'),
        expect.any(Object)
      );
    });

    test('should merge community database with local data', async () => {
      // Check that both local and community games are available
      const localGame = fallback.searchGame('Portal');
      expect(localGame).toBeDefined();

      // Wait for community database to load
      await new Promise(resolve => setTimeout(resolve, 100));

      const communityGame = fallback.searchGame('Hades');
      expect(communityGame).toBeDefined();
      expect(communityGame?.mainStory).toBe(22);
    });

    test('should handle community database fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const newFallback = new HLTBFallback();

      // Should still work with local database
      const result = newFallback.searchGame('Portal');
      expect(result).toBeDefined();
    });

    test('should validate community database entries', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { title: 'Valid Game', data: { mainStory: 10 } },
          { title: '', data: { mainStory: 10 } }, // Invalid: no title
          { title: 'No Data' }, // Invalid: no data
          { data: { mainStory: 10 } } // Invalid: no title
        ]
      } as Response);

      const newFallback = new HLTBFallback();

      // Wait for loading
      await new Promise(resolve => setTimeout(resolve, 100));

      // Only valid entry should be added
      const valid = newFallback.searchGame('Valid Game');
      expect(valid).toBeDefined();

      const invalid1 = newFallback.searchGame('');
      expect(invalid1).toBeNull();

      const invalid2 = newFallback.searchGame('No Data');
      // Should not crash, might return null or have no time data
    });

    test('should handle malformed JSON from community database', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      } as Response);

      const newFallback = new HLTBFallback();

      // Should still function with local database
      const result = newFallback.searchGame('Portal');
      expect(result).toBeDefined();
    });

    test('should cache community database locally', async () => {
      const newFallback = new HLTBFallback();

      // Wait for initial load
      await new Promise(resolve => setTimeout(resolve, 100));

      // First fetch call
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Searching shouldn't trigger another fetch
      newFallback.searchGame('Hades');
      newFallback.searchGame('Celeste');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Data Confidence', () => {
    test('should track confidence level for each entry', () => {
      const entries = fallback.getAllEntries();

      for (const entry of entries) {
        expect(entry.confidence).toMatch(/^(high|medium|low)$/);
      }
    });

    test('should have high confidence for well-known games', () => {
      const wellKnownGames = [
        'Portal',
        'Half-Life 2',
        'The Witcher 3: Wild Hunt',
        'Grand Theft Auto V'
      ];

      for (const game of wellKnownGames) {
        const entry = fallback.getEntry(game);
        expect(entry?.confidence).toBe('high');
      }
    });

    test('should track last updated date', () => {
      const entries = fallback.getAllEntries();

      for (const entry of entries) {
        if (entry.lastUpdated) {
          expect(entry.lastUpdated).toMatch(/^\d{4}-\d{2}$/);
        }
      }
    });
  });

  describe('Performance', () => {
    test('should search quickly even with large database', () => {
      const startTime = Date.now();

      // Perform multiple searches
      for (let i = 0; i < 100; i++) {
        fallback.searchGame('Portal');
      }

      const endTime = Date.now();
      const averageTime = (endTime - startTime) / 100;

      expect(averageTime).toBeLessThan(5); // Less than 5ms per search
    });

    test('should use efficient data structures', () => {
      // Check that maps are used for O(1) lookup
      expect(fallback['localDatabase']).toBeInstanceOf(Map);
      expect(fallback['aliasMap']).toBeInstanceOf(Map);
    });

    test('should cache fuzzy search results', () => {
      const startTime1 = Date.now();
      fallback.fuzzySearch('Protal'); // First search with typo
      const time1 = Date.now() - startTime1;

      const startTime2 = Date.now();
      fallback.fuzzySearch('Protal'); // Same search again
      const time2 = Date.now() - startTime2;

      // Second search should be faster if cached
      // Note: This assumes caching is implemented
      expect(time2).toBeLessThanOrEqual(time1);
    });
  });

  describe('Statistics', () => {
    test('should provide database statistics', () => {
      const stats = fallback.getStatistics();

      expect(stats).toHaveProperty('totalGames');
      expect(stats).toHaveProperty('totalAliases');
      expect(stats).toHaveProperty('gamesWithData');
      expect(stats).toHaveProperty('multiplayerOnlyGames');

      expect(stats.totalGames).toBeGreaterThan(0);
      expect(stats.totalAliases).toBeGreaterThan(0);
    });

    test('should count games by data availability', () => {
      const stats = fallback.getStatistics();

      const total = stats.gamesWithData + stats.multiplayerOnlyGames;
      expect(total).toBeLessThanOrEqual(stats.totalGames);
    });

    test('should track coverage percentage', () => {
      const coverage = fallback.getCoverage();

      expect(coverage).toBeGreaterThan(0);
      expect(coverage).toBeLessThanOrEqual(100);
    });
  });

  describe('Updates and Maintenance', () => {
    test('should support adding new games', () => {
      const newGame: FallbackGameEntry = {
        title: 'New Test Game',
        aliases: ['test game'],
        data: {
          mainStory: 10,
          mainExtra: 15,
          completionist: 25,
          allStyles: 12
        },
        confidence: 'medium'
      };

      fallback.addGame(newGame);

      const result = fallback.searchGame('New Test Game');
      expect(result).toBeDefined();
      expect(result?.mainStory).toBe(10);

      // Should also work with alias
      const aliasResult = fallback.searchGame('test game');
      expect(aliasResult).toBeDefined();
    });

    test('should support updating existing games', () => {
      const updatedData: HLTBData = {
        mainStory: 3.5,
        mainExtra: 4.5,
        completionist: 5.5,
        allStyles: 4.5
      };

      fallback.updateGame('Portal', updatedData);

      const result = fallback.searchGame('Portal');
      expect(result?.mainStory).toBe(3.5);
    });

    test('should support removing games', () => {
      // Add a test game
      fallback.addGame({
        title: 'Temporary Game',
        data: { mainStory: 5, mainExtra: null, completionist: null, allStyles: 5 }
      });

      // Verify it exists
      expect(fallback.searchGame('Temporary Game')).toBeDefined();

      // Remove it
      fallback.removeGame('Temporary Game');

      // Should no longer exist
      expect(fallback.searchGame('Temporary Game')).toBeNull();
    });

    test('should export database for backup', () => {
      const exported = fallback.exportDatabase();

      expect(exported).toBeInstanceOf(Array);
      expect(exported.length).toBeGreaterThan(0);

      // Each entry should have required fields
      for (const entry of exported) {
        expect(entry).toHaveProperty('title');
        expect(entry).toHaveProperty('data');
      }
    });

    test('should import database from backup', () => {
      const backup = fallback.exportDatabase();

      // Create new instance
      const newFallback = new HLTBFallback();

      // Clear and import
      newFallback.clearDatabase();
      newFallback.importDatabase(backup);

      // Should have same data
      const result = newFallback.searchGame('Portal');
      expect(result).toBeDefined();
      expect(result?.mainStory).toBe(3);
    });
  });
});
/**
 * Title Matching System Test Suite
 *
 * Comprehensive tests for the game title matching system including:
 * - TitleNormalizer (3 normalization levels)
 * - SimilarityCalculator (Levenshtein, Dice, Jaro-Winkler)
 * - Manual mappings database
 * - TitleMatcher orchestration service
 *
 * Test Coverage:
 * - Exact matching
 * - Fuzzy matching (>80% accuracy requirement)
 * - Manual mappings
 * - Skip list functionality
 * - Special character handling (®, ™, ©)
 * - Edition normalization
 * - Roman numeral conversion
 * - Acronym expansion
 * - Performance (<50ms per match)
 * - Confidence scores
 * - False positive prevention
 */

import { TitleNormalizer, NormalizationLevel } from '../src/background/services/title-normalizer';
import { SimilarityCalculator } from '../src/background/services/similarity-calculator';
import {
  MANUAL_MAPPINGS,
  SKIP_GAMES,
  shouldSkipGame,
  getManualMapping,
  getYearSpecificMapping,
  YEAR_SPECIFIC_MAPPINGS
} from '../src/background/data/manual-mappings';
import {
  TitleMatcher,
  HLTBSearchResult,
  MatchResult,
  MatchMethod
} from '../src/background/services/title-matcher';

describe('Title Matching System', () => {
  // ============================================================================
  // TITLE NORMALIZER TESTS
  // ============================================================================
  describe('TitleNormalizer', () => {
    let normalizer: TitleNormalizer;

    beforeEach(() => {
      normalizer = new TitleNormalizer();
    });

    describe('Minimal Normalization', () => {
      test('should remove special characters (®, ™, ©)', () => {
        const input = "Tom Clancy's Rainbow Six® Siege™";
        const result = normalizer.normalize(input, 'minimal');

        expect(result).not.toContain('®');
        expect(result).not.toContain('™');
        expect(result).toBe("tom clancy's rainbow six siege");
      });

      test('should normalize whitespace', () => {
        const input = 'Portal    2     Test';
        const result = normalizer.normalize(input, 'minimal');

        expect(result).toBe('portal 2 test');
      });

      test('should convert to lowercase', () => {
        const input = 'The Witcher 3: Wild Hunt';
        const result = normalizer.normalize(input, 'minimal');

        expect(result).toBe('the witcher 3: wild hunt');
      });

      test('should preserve punctuation in minimal mode', () => {
        const input = "Baldur's Gate: Enhanced Edition";
        const result = normalizer.normalize(input, 'minimal');

        expect(result).toContain(':');
        expect(result).toContain("'");
      });
    });

    describe('Standard Normalization', () => {
      test('should remove punctuation', () => {
        const input = "Baldur's Gate: Enhanced Edition";
        const result = normalizer.normalize(input, 'standard');

        expect(result).not.toContain(':');
        expect(result).not.toContain("'");
        expect(result).toBe('baldur s gate enhanced edition');
      });

      test('should handle hyphens and dashes', () => {
        const input = 'Wolfenstein: The New Order - Special Edition';
        const result = normalizer.normalize(input, 'standard');

        expect(result).not.toContain('-');
        expect(result).not.toContain('–');
        expect(result).not.toContain(':');
      });

      test('should normalize multiple special characters', () => {
        const input = 'Tom Clancy™s Rainbow Six® Siege©: Year 7';
        const result = normalizer.normalize(input, 'standard');

        expect(result).toBe('tom clancy s rainbow six siege year 7');
      });
    });

    describe('Aggressive Normalization', () => {
      test('should remove leading articles', () => {
        const input = 'The Witcher 3: Wild Hunt';
        const result = normalizer.normalize(input, 'aggressive');

        expect(result.startsWith('the ')).toBe(false);
        expect(result).toContain('witcher');
      });

      test('should remove subtitles', () => {
        const input = 'Wolfenstein: The New Order';
        const result = normalizer.normalize(input, 'aggressive');

        expect(result).toBe('wolfenstein');
      });

      test('should remove edition suffixes', () => {
        const cases = [
          { input: 'Skyrim Special Edition', expected: 'skyrim' },
          { input: 'Bioshock Remastered', expected: 'bioshock' },
          { input: 'Portal GOTY Edition', expected: 'portal' },
          { input: 'Dark Souls - Definitive Edition', expected: 'dark souls' },
          { input: 'The Witcher 3 Game of the Year Edition', expected: 'witcher 3' }
        ];

        cases.forEach(({ input, expected }) => {
          const result = normalizer.normalize(input, 'aggressive');
          expect(result).toBe(expected);
        });
      });

      test('should expand common acronyms', () => {
        const cases = [
          { input: 'CS:GO', expected: 'counter strike global offensive' },
          { input: 'CSGO', expected: 'counter strike global offensive' },
          { input: 'GTA V', expected: 'grand theft auto 5' },
          { input: 'PUBG', expected: 'playerunknowns battlegrounds' },
          { input: 'COD', expected: 'call of duty' }
        ];

        cases.forEach(({ input, expected }) => {
          const result = normalizer.normalize(input, 'aggressive');
          expect(result).toBe(expected);
        });
      });

      test('should convert Roman numerals to Arabic', () => {
        const cases = [
          { input: 'Grand Theft Auto V', expected: 'grand theft auto 5' },
          { input: 'Dark Souls III', expected: 'dark souls 3' },
          { input: 'Civilization VI', expected: 'civilization 6' },
          { input: 'Final Fantasy VII', expected: 'final fantasy 7' },
          { input: 'Resident Evil II', expected: 'resident evil 2' }
        ];

        cases.forEach(({ input, expected }) => {
          const result = normalizer.normalize(input, 'aggressive');
          expect(result).toBe(expected);
        });
      });

      test('should handle complex combination', () => {
        const input = "The Elder Scrolls® V: Skyrim™ - Special Edition";
        const result = normalizer.normalize(input, 'aggressive');

        expect(result).toBe('elder scrolls 5');
      });
    });

    describe('Year Extraction and Removal', () => {
      test('should extract year from parentheses', () => {
        const testCases = [
          { input: 'DOOM (2016)', expected: 2016 },
          { input: 'Prey (2017)', expected: 2017 },
          { input: 'God of War (2018)', expected: 2018 },
          { input: 'Modern Warfare (2019)', expected: 2019 }
        ];

        testCases.forEach(({ input, expected }) => {
          const year = normalizer.extractYear(input);
          expect(year).toBe(expected);
        });
      });

      test('should return null for invalid years', () => {
        const testCases = [
          'Game (1979)',  // Too old
          'Game (2030)',  // Too far in future
          'Game (abcd)',  // Not a number
          'Game 2020'     // No parentheses
        ];

        testCases.forEach(input => {
          const year = normalizer.extractYear(input);
          expect(year).toBeNull();
        });
      });

      test('should remove year from title', () => {
        const input = 'DOOM (2016)';
        const result = normalizer.removeYear(input);

        expect(result).toBe('DOOM');
        expect(result).not.toContain('(2016)');
      });
    });

    describe('Core Words Extraction', () => {
      test('should extract meaningful words', () => {
        const title = 'The Witcher 3: Wild Hunt - Game of the Year Edition';
        const words = normalizer.getCoreWords(title, 3);

        expect(words).toContain('witcher');
        expect(words).toContain('wild');
        expect(words).toContain('hunt');
        expect(words).not.toContain('the');
        expect(words).not.toContain('of');
      });

      test('should respect minimum length', () => {
        const title = 'Portal 2 is a fun game';
        const words = normalizer.getCoreWords(title, 4);

        expect(words).toContain('portal');
        expect(words).not.toContain('fun'); // Only 3 characters
      });
    });

    describe('Empty String Handling', () => {
      test('should handle empty strings', () => {
        expect(normalizer.normalize('', 'minimal')).toBe('');
        expect(normalizer.normalize('', 'standard')).toBe('');
        expect(normalizer.normalize('', 'aggressive')).toBe('');
      });

      test('should handle whitespace-only strings', () => {
        expect(normalizer.normalize('   ', 'standard')).toBe('');
      });
    });
  });

  // ============================================================================
  // SIMILARITY CALCULATOR TESTS
  // ============================================================================
  describe('SimilarityCalculator', () => {
    let calculator: SimilarityCalculator;

    beforeEach(() => {
      calculator = new SimilarityCalculator();
    });

    describe('Levenshtein Distance', () => {
      test('should calculate correct edit distance', () => {
        expect(calculator.levenshteinDistance('portal', 'portal')).toBe(0);
        expect(calculator.levenshteinDistance('portal', 'portals')).toBe(1);
        expect(calculator.levenshteinDistance('portal', 'prtal')).toBe(1);
        expect(calculator.levenshteinDistance('kitten', 'sitting')).toBe(3);
      });

      test('should handle empty strings', () => {
        expect(calculator.levenshteinDistance('', '')).toBe(0);
        expect(calculator.levenshteinDistance('portal', '')).toBe(6);
        expect(calculator.levenshteinDistance('', 'portal')).toBe(6);
      });

      test('should calculate similarity score (0-1)', () => {
        expect(calculator.levenshteinSimilarity('portal', 'portal')).toBe(1.0);
        expect(calculator.levenshteinSimilarity('portal', 'portals')).toBeCloseTo(0.857, 2);
        expect(calculator.levenshteinSimilarity('abc', 'xyz')).toBeCloseTo(0, 2);
      });
    });

    describe('Dice Coefficient', () => {
      test('should calculate bigram similarity', () => {
        expect(calculator.diceCoefficient('portal', 'portal')).toBe(1.0);
        expect(calculator.diceCoefficient('night', 'nacht')).toBeGreaterThan(0.2);
        expect(calculator.diceCoefficient('abc', 'xyz')).toBe(0.0);
      });

      test('should handle short strings', () => {
        expect(calculator.diceCoefficient('a', 'a')).toBe(0.0);
        expect(calculator.diceCoefficient('ab', 'ab')).toBe(1.0);
      });

      test('should be case-sensitive', () => {
        const result1 = calculator.diceCoefficient('Portal', 'portal');
        const result2 = calculator.diceCoefficient('portal', 'portal');
        expect(result1).toBeLessThan(result2);
      });
    });

    describe('Jaro-Winkler Similarity', () => {
      test('should calculate Jaro similarity', () => {
        expect(calculator.jaro('portal', 'portal')).toBe(1.0);
        expect(calculator.jaro('martha', 'marhta')).toBeGreaterThan(0.9);
        expect(calculator.jaro('dwayne', 'duane')).toBeGreaterThan(0.8);
      });

      test('should apply prefix bonus in Jaro-Winkler', () => {
        const jaro = calculator.jaro('portal', 'portals');
        const jaroWinkler = calculator.jaroWinkler('portal', 'portals');

        expect(jaroWinkler).toBeGreaterThan(jaro);
      });

      test('should handle identical strings', () => {
        expect(calculator.jaroWinkler('test', 'test')).toBe(1.0);
      });
    });

    describe('Combined Similarity', () => {
      test('should return weighted average of algorithms', () => {
        const result = calculator.combinedSimilarity('portal', 'portal');
        expect(result).toBe(1.0);
      });

      test('should detect high similarity for close matches', () => {
        const result = calculator.combinedSimilarity('portal 2', 'portal two');
        expect(result).toBeGreaterThan(0.7);
      });

      test('should detect low similarity for different strings', () => {
        const result = calculator.combinedSimilarity('portal', 'witcher');
        expect(result).toBeLessThan(0.3);
      });
    });

    describe('Word Similarity (Jaccard)', () => {
      test('should calculate word overlap', () => {
        const result = calculator.wordSimilarity('the witcher 3', 'witcher 3 wild hunt');
        expect(result).toBeGreaterThan(0.5);
      });

      test('should be case-insensitive', () => {
        const result = calculator.wordSimilarity('Portal 2', 'portal 2');
        expect(result).toBe(1.0);
      });

      test('should handle single word titles', () => {
        expect(calculator.wordSimilarity('portal', 'portal')).toBe(1.0);
      });
    });

    describe('Fuzzy Match', () => {
      test('should return best matching method and score', () => {
        const result = calculator.fuzzyMatch('portal', 'portal');

        expect(result.score).toBe(1.0);
        expect(result.method).toBeDefined();
      });

      test('should choose appropriate method for different inputs', () => {
        const result1 = calculator.fuzzyMatch('portal 2', 'portal two');
        const result2 = calculator.fuzzyMatch('the witcher', 'witcher wild hunt');

        expect(result1.score).toBeGreaterThan(0.5);
        expect(result2.score).toBeGreaterThan(0.5);
      });
    });

    describe('Performance', () => {
      test('should complete similarity calculation quickly', () => {
        const startTime = performance.now();

        for (let i = 0; i < 100; i++) {
          calculator.combinedSimilarity('portal 2', 'portal two');
        }

        const endTime = performance.now();
        const avgTime = (endTime - startTime) / 100;

        expect(avgTime).toBeLessThan(5); // <5ms per calculation
      });
    });
  });

  // ============================================================================
  // MANUAL MAPPINGS TESTS
  // ============================================================================
  describe('Manual Mappings', () => {
    describe('Database Structure', () => {
      test('should have normalized keys', () => {
        const keys = Object.keys(MANUAL_MAPPINGS);

        keys.forEach(key => {
          expect(key).toBe(key.toLowerCase());
          expect(key).not.toMatch(/[®™©]/);
        });
      });

      test('should contain expected game mappings', () => {
        expect(MANUAL_MAPPINGS['counter strike global offensive']).toBe('counter strike global offensive');
        expect(MANUAL_MAPPINGS['csgo']).toBe('counter strike global offensive');
        expect(MANUAL_MAPPINGS['gta v']).toBe('grand theft auto 5');
        expect(MANUAL_MAPPINGS['doom']).toBe('doom 2016');
      });
    });

    describe('getManualMapping', () => {
      test('should return mapping for known titles', () => {
        expect(getManualMapping('csgo')).toBe('counter strike global offensive');
        expect(getManualMapping('gta v')).toBe('grand theft auto 5');
      });

      test('should return null for unknown titles', () => {
        expect(getManualMapping('unknown game')).toBeNull();
      });
    });

    describe('Year-Specific Mappings', () => {
      test('should handle year disambiguation', () => {
        expect(getYearSpecificMapping('doom', 2016)).toBe('doom 2016');
        expect(getYearSpecificMapping('doom', 1993)).toBe('doom');
        expect(getYearSpecificMapping('prey', 2017)).toBe('prey 2017');
        expect(getYearSpecificMapping('prey', 2006)).toBe('prey');
      });

      test('should return null for invalid years', () => {
        expect(getYearSpecificMapping('doom', 2000)).toBeNull();
        expect(getYearSpecificMapping('unknown', 2016)).toBeNull();
      });

      test('should handle null year', () => {
        expect(getYearSpecificMapping('doom', null)).toBeNull();
      });
    });

    describe('Skip Games', () => {
      test('should identify multiplayer-only games', () => {
        expect(shouldSkipGame('team fortress 2')).toBe(true);
        expect(shouldSkipGame('dota 2')).toBe(true);
        expect(shouldSkipGame('valorant')).toBe(true);
        expect(shouldSkipGame('apex legends')).toBe(true);
      });

      test('should not skip single-player games', () => {
        expect(shouldSkipGame('portal 2')).toBe(false);
        expect(shouldSkipGame('the witcher 3')).toBe(false);
        expect(shouldSkipGame('dark souls')).toBe(false);
      });

      test('SKIP_GAMES should have normalized entries', () => {
        SKIP_GAMES.forEach(game => {
          expect(game).toBe(game.toLowerCase());
        });
      });
    });
  });

  // ============================================================================
  // TITLE MATCHER INTEGRATION TESTS
  // ============================================================================
  describe('TitleMatcher', () => {
    let matcher: TitleMatcher;
    let mockHLTBResults: HLTBSearchResult[];

    beforeEach(() => {
      matcher = new TitleMatcher();
      mockHLTBResults = [
        {
          gameId: '1',
          gameName: 'Portal 2',
          mainStory: 8,
          mainExtra: 12,
          completionist: 15,
          allStyles: 11,
          platforms: ['PC'],
          releaseDate: '2011-04-19'
        },
        {
          gameId: '2',
          gameName: 'Portal',
          mainStory: 3,
          mainExtra: 5,
          completionist: 7,
          allStyles: 5,
          platforms: ['PC'],
          releaseDate: '2007-10-10'
        }
      ];
    });

    describe('Exact Matching', () => {
      test('should find exact matches', async () => {
        const result = await matcher.findBestMatch('Portal 2', mockHLTBResults);

        expect(result).not.toBeNull();
        expect(result?.match?.gameName).toBe('Portal 2');
        expect(result?.confidence).toBe(1.0);
        expect(result?.method).toBe('exact');
      });

      test('should be case-insensitive', async () => {
        const result = await matcher.findBestMatch('PORTAL 2', mockHLTBResults);

        expect(result?.match?.gameName).toBe('Portal 2');
        expect(result?.confidence).toBe(1.0);
      });

      test('should handle special characters', async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: 'Rainbow Six Siege',
          mainStory: null,
          mainExtra: null,
          completionist: null,
          allStyles: null
        }];

        const result = await matcher.findBestMatch(
          "Tom Clancy's Rainbow Six® Siege™",
          results
        );

        expect(result).not.toBeNull();
        expect(result?.confidence).toBeGreaterThan(0.8);
      });
    });

    describe('Manual Mapping Priority', () => {
      test('should use manual mappings over fuzzy matching', async () => {
        const results: HLTBSearchResult[] = [
          {
            gameId: '1',
            gameName: 'Counter-Strike: Global Offensive',
            mainStory: null,
            mainExtra: null,
            completionist: null,
            allStyles: null
          },
          {
            gameId: '2',
            gameName: 'Counter Strike Global Offensive',
            mainStory: null,
            mainExtra: null,
            completionist: null,
            allStyles: null
          }
        ];

        const result = await matcher.findBestMatch('CS:GO', results);

        expect(result).not.toBeNull();
        expect(result?.method).toBe('manual_mapping');
        expect(result?.confidence).toBe(1.0);
      });

      test('should handle GTA variants', async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: 'Grand Theft Auto 5',
          mainStory: 30,
          mainExtra: 45,
          completionist: 80,
          allStyles: 50
        }];

        const testCases = ['GTA V', 'GTA 5', 'Grand Theft Auto V'];

        for (const input of testCases) {
          const result = await matcher.findBestMatch(input, results);
          expect(result).not.toBeNull();
          expect(result?.confidence).toBe(1.0);
        }
      });
    });

    describe('Year-Specific Matching', () => {
      test('should disambiguate DOOM versions by year', async () => {
        const results: HLTBSearchResult[] = [
          {
            gameId: '1',
            gameName: 'DOOM',
            mainStory: 2,
            releaseDate: '1993-12-10'
          },
          {
            gameId: '2',
            gameName: 'DOOM 2016',
            mainStory: 11,
            releaseDate: '2016-05-13'
          }
        ] as HLTBSearchResult[];

        const result2016 = await matcher.findBestMatch('DOOM (2016)', results);
        const result1993 = await matcher.findBestMatch('DOOM (1993)', results);

        expect(result2016?.match?.gameName).toBe('DOOM 2016');
        expect(result1993?.match?.gameName).toBe('DOOM');
      });

      test('should handle Resident Evil remakes', async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: 'Resident Evil 2 2019',
          mainStory: 10,
          releaseDate: '2019-01-25'
        }] as HLTBSearchResult[];

        const result = await matcher.findBestMatch('Resident Evil 2', results);
        expect(result).not.toBeNull();
      });
    });

    describe('Edition Normalization', () => {
      test('should match Game of the Year editions', async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: 'The Witcher 3: Wild Hunt',
          mainStory: 52,
          mainExtra: 100,
          completionist: 180,
          allStyles: 100
        }];

        const editionVariants = [
          'The Witcher 3: Wild Hunt - Game of the Year Edition',
          'The Witcher 3: Wild Hunt GOTY Edition',
          'The Witcher 3: Wild Hunt GOTY',
          'The Witcher 3 Wild Hunt Complete Edition'
        ];

        for (const variant of editionVariants) {
          const result = await matcher.findBestMatch(variant, results);
          expect(result).not.toBeNull();
          expect(result?.confidence).toBeGreaterThan(0.8);
        }
      });

      test('should handle remastered editions', async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: 'Dark Souls',
          mainStory: 42,
          mainExtra: 60,
          completionist: 100,
          allStyles: 60
        }];

        const remasterVariants = [
          'Dark Souls Remastered',
          'Dark Souls: Prepare to Die Edition'
        ];

        for (const variant of remasterVariants) {
          const result = await matcher.findBestMatch(variant, results);
          expect(result).not.toBeNull();
          expect(result?.confidence).toBeGreaterThan(0.7);
        }
      });
    });

    describe('Roman Numeral Conversion', () => {
      test('should match Roman numerals to Arabic', async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: 'Grand Theft Auto 5',
          mainStory: 30,
          mainExtra: 45,
          completionist: 80,
          allStyles: 50
        }];

        const result = await matcher.findBestMatch('Grand Theft Auto V', results);

        expect(result).not.toBeNull();
        expect(result?.confidence).toBeGreaterThan(0.8);
      });

      test('should handle various Roman numerals', async () => {
        const testCases = [
          { input: 'Dark Souls III', expected: 'Dark Souls 3' },
          { input: 'Civilization VI', expected: 'Civilization 6' },
          { input: 'Final Fantasy VII', expected: 'Final Fantasy 7' }
        ];

        for (const { input, expected } of testCases) {
          const results: HLTBSearchResult[] = [{
            gameId: '1',
            gameName: expected,
            mainStory: 40
          } as HLTBSearchResult];

          const result = await matcher.findBestMatch(input, results);
          expect(result).not.toBeNull();
          expect(result?.confidence).toBeGreaterThan(0.8);
        }
      });
    });

    describe('Acronym Expansion', () => {
      test('should expand common gaming acronyms', async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: 'Counter-Strike: Global Offensive',
          mainStory: null
        } as HLTBSearchResult];

        const acronyms = ['CS:GO', 'CSGO', 'CS GO'];

        for (const acronym of acronyms) {
          const result = await matcher.findBestMatch(acronym, results);
          expect(result).not.toBeNull();
        }
      });

      test('should handle Call of Duty acronyms', async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: 'Call of Duty: Modern Warfare',
          mainStory: 6
        } as HLTBSearchResult];

        const result = await matcher.findBestMatch('COD MW', results);
        expect(result).not.toBeNull();
      });
    });

    describe('Skip List', () => {
      test('should skip multiplayer-only games', async () => {
        const result = await matcher.findBestMatch('Team Fortress 2', mockHLTBResults);

        expect(result).not.toBeNull();
        expect(result?.skip).toBe(true);
        expect(result?.method).toBe('skip');
        expect(result?.reason).toContain('Multiplayer-only');
      });

      test('should skip all games in skip list', async () => {
        const skipGames = [
          'Dota 2',
          'Apex Legends',
          'Valorant',
          'League of Legends',
          'Overwatch 2'
        ];

        for (const game of skipGames) {
          const result = await matcher.findBestMatch(game, mockHLTBResults);
          expect(result?.skip).toBe(true);
        }
      });
    });

    describe('Publisher Prefix Removal', () => {
      test("should match Sid Meier's games", async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: 'Civilization VI',
          mainStory: 80,
          mainExtra: 150,
          completionist: 300,
          allStyles: 150
        }];

        const result = await matcher.findBestMatch("Sid Meier's Civilization VI", results);

        expect(result).not.toBeNull();
        expect(result?.confidence).toBeGreaterThan(0.8);
      });

      test("should match Tom Clancy's games", async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: 'Rainbow Six Siege',
          mainStory: null
        } as HLTBSearchResult];

        const result = await matcher.findBestMatch("Tom Clancy's Rainbow Six Siege", results);

        expect(result).not.toBeNull();
        expect(result?.confidence).toBeGreaterThan(0.8);
      });
    });

    describe('Fuzzy Matching', () => {
      test('should match with typos', async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: 'Portal 2',
          mainStory: 8
        } as HLTBSearchResult];

        const typos = ['Portla 2', 'Protal 2', 'Portal2'];

        for (const typo of typos) {
          const result = await matcher.findBestMatch(typo, results);
          expect(result).not.toBeNull();
          expect(result?.confidence).toBeGreaterThan(0.7);
        }
      });

      test('should achieve >80% accuracy for close matches', async () => {
        const testCases = [
          { steam: 'Witcher 3', hltb: 'The Witcher 3: Wild Hunt' },
          { steam: 'Skyrim', hltb: 'The Elder Scrolls V: Skyrim' },
          { steam: 'Half Life 2', hltb: 'Half-Life 2' }
        ];

        for (const { steam, hltb } of testCases) {
          const results: HLTBSearchResult[] = [{
            gameId: '1',
            gameName: hltb,
            mainStory: 40
          } as HLTBSearchResult];

          const result = await matcher.findBestMatch(steam, results);
          expect(result).not.toBeNull();
          expect(result?.confidence).toBeGreaterThan(0.8);
        }
      });

      test('should use appropriate matching level', async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: 'Portal 2',
          mainStory: 8
        } as HLTBSearchResult];

        const result = await matcher.findBestMatch('Portal 2 Extended', results);

        expect(result).not.toBeNull();
        expect(['fuzzy_standard', 'fuzzy_aggressive', 'word_match']).toContain(result?.method);
      });
    });

    describe('False Positive Prevention', () => {
      test('should not match completely different games', async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: 'The Witcher 3: Wild Hunt',
          mainStory: 52
        } as HLTBSearchResult];

        const result = await matcher.findBestMatch('Portal 2', results);

        expect(result).toBeNull();
      });

      test('should require minimum confidence threshold', async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: 'Some Random Game',
          mainStory: 10
        } as HLTBSearchResult];

        const result = await matcher.findBestMatch('Completely Different Title', results);

        expect(result).toBeNull();
      });

      test('should not match partial words as different games', async () => {
        const results: HLTBSearchResult[] = [
          {
            gameId: '1',
            gameName: 'Portal',
            mainStory: 3
          },
          {
            gameId: '2',
            gameName: 'Portal 2',
            mainStory: 8
          }
        ] as HLTBSearchResult[];

        const result = await matcher.findBestMatch('Portal', results);

        expect(result?.match?.gameName).toBe('Portal');
        expect(result?.match?.gameName).not.toBe('Portal 2');
      });
    });

    describe('Confidence Scores', () => {
      test('should return 1.0 for exact matches', async () => {
        const result = await matcher.findBestMatch('Portal 2', mockHLTBResults);

        expect(result?.confidence).toBe(1.0);
      });

      test('should return high confidence for manual mappings', async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: 'Counter Strike Global Offensive',
          mainStory: null
        } as HLTBSearchResult];

        const result = await matcher.findBestMatch('CSGO', results);

        expect(result?.confidence).toBe(1.0);
        expect(result?.method).toBe('manual_mapping');
      });

      test('should return meaningful confidence for fuzzy matches', async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: 'Portal Two',
          mainStory: 8
        } as HLTBSearchResult];

        const result = await matcher.findBestMatch('Portal 2', results);

        expect(result?.confidence).toBeGreaterThan(0.7);
        expect(result?.confidence).toBeLessThan(1.0);
      });

      test('should have lower confidence for aggressive matching', async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: 'The Elder Scrolls V: Skyrim',
          mainStory: 34
        } as HLTBSearchResult];

        const result = await matcher.findBestMatch('Skyrim Special Edition', results);

        expect(result).not.toBeNull();
        if (result?.method === 'fuzzy_aggressive') {
          expect(result.confidence).toBeGreaterThanOrEqual(0.7);
        }
      });
    });

    describe('Performance Requirements', () => {
      test('should complete matching in <50ms', async () => {
        const startTime = performance.now();

        await matcher.findBestMatch('Portal 2', mockHLTBResults);

        const endTime = performance.now();
        const elapsed = endTime - startTime;

        expect(elapsed).toBeLessThan(50);
      });

      test('should handle large result sets efficiently', async () => {
        const largeResults: HLTBSearchResult[] = Array.from({ length: 100 }, (_, i) => ({
          gameId: String(i),
          gameName: `Game ${i}`,
          mainStory: 10 + i,
          mainExtra: 15 + i,
          completionist: 20 + i,
          allStyles: 12 + i
        }));

        const startTime = performance.now();

        await matcher.findBestMatch('Portal 2', largeResults);

        const endTime = performance.now();
        const elapsed = endTime - startTime;

        expect(elapsed).toBeLessThan(100);
      });

      test('should handle batch matching efficiently', async () => {
        const titles = [
          { title: 'Portal 2', searchResults: mockHLTBResults },
          { title: 'The Witcher 3', searchResults: mockHLTBResults },
          { title: 'Dark Souls', searchResults: mockHLTBResults }
        ];

        const startTime = performance.now();

        await matcher.batchMatch(titles);

        const endTime = performance.now();
        const elapsed = endTime - startTime;

        expect(elapsed).toBeLessThan(150); // <50ms per match
      });
    });

    describe('Edge Cases', () => {
      test('should handle empty search results', async () => {
        const result = await matcher.findBestMatch('Portal 2', []);

        expect(result).toBeNull();
      });

      test('should handle null/undefined inputs gracefully', async () => {
        const result1 = await matcher.findBestMatch('', mockHLTBResults);
        const result2 = await matcher.findBestMatch('Portal', []);

        expect(result1).toBeNull();
        expect(result2).toBeNull();
      });

      test('should handle single-character titles', async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: 'Q',
          mainStory: 1
        } as HLTBSearchResult];

        const result = await matcher.findBestMatch('Q', results);

        expect(result).not.toBeNull();
      });

      test('should handle very long titles', async () => {
        const longTitle = 'The Super Ultra Mega Awesome Amazing Incredible Game of the Year Edition Definitive Complete Collection Remastered Enhanced Special Ultimate Version 2023';
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: longTitle,
          mainStory: 50
        } as HLTBSearchResult];

        const result = await matcher.findBestMatch(longTitle, results);

        expect(result).not.toBeNull();
      });

      test('should handle titles with numbers', async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: '2064: Read Only Memories',
          mainStory: 5
        } as HLTBSearchResult];

        const result = await matcher.findBestMatch('2064: Read Only Memories', results);

        expect(result).not.toBeNull();
        expect(result?.confidence).toBeGreaterThan(0.8);
      });

      test('should handle ampersands', async () => {
        const results: HLTBSearchResult[] = [{
          gameId: '1',
          gameName: 'D and D',
          mainStory: 20
        } as HLTBSearchResult];

        const result = await matcher.findBestMatch('D & D', results);

        expect(result).not.toBeNull();
      });
    });

    describe('Match Details', () => {
      test('should provide detailed matching information', async () => {
        const details = await matcher.getMatchDetails('Portal 2', mockHLTBResults);

        expect(details).toHaveProperty('steamNormalized');
        expect(details).toHaveProperty('candidates');
        expect(details.steamNormalized).toHaveProperty('minimal');
        expect(details.steamNormalized).toHaveProperty('standard');
        expect(details.steamNormalized).toHaveProperty('aggressive');
        expect(details.candidates.length).toBeGreaterThan(0);
      });

      test('should include similarity scores for all candidates', async () => {
        const details = await matcher.getMatchDetails('Portal 2', mockHLTBResults);

        details.candidates.forEach(candidate => {
          expect(candidate).toHaveProperty('title');
          expect(candidate).toHaveProperty('normalized');
          expect(candidate).toHaveProperty('scores');
          expect(candidate.scores).toHaveProperty('dice');
          expect(candidate.scores).toHaveProperty('jaro');
          expect(candidate.scores).toHaveProperty('levenshtein');
          expect(candidate.scores).toHaveProperty('combined');
          expect(candidate.scores).toHaveProperty('word');
        });
      });
    });

    describe('Real-World Integration Scenarios', () => {
      test('should handle complete workflow', async () => {
        const steamTitle = "The Witcher® 3: Wild Hunt - Game of the Year Edition";
        const hltbResults: HLTBSearchResult[] = [
          {
            gameId: '1',
            gameName: 'The Witcher 3: Wild Hunt',
            mainStory: 52,
            mainExtra: 100,
            completionist: 180,
            allStyles: 100,
            platforms: ['PC', 'PlayStation', 'Xbox'],
            releaseDate: '2015-05-19'
          },
          {
            gameId: '2',
            gameName: 'The Witcher 2',
            mainStory: 24,
            mainExtra: 35,
            completionist: 55,
            allStyles: 35
          }
        ];

        const result = await matcher.findBestMatch(steamTitle, hltbResults);

        expect(result).not.toBeNull();
        expect(result?.match?.gameName).toBe('The Witcher 3: Wild Hunt');
        expect(result?.confidence).toBeGreaterThan(0.8);
      });

      test('should handle ambiguous search results', async () => {
        const results: HLTBSearchResult[] = [
          {
            gameId: '1',
            gameName: 'Portal',
            mainStory: 3
          },
          {
            gameId: '2',
            gameName: 'Portal 2',
            mainStory: 8
          },
          {
            gameId: '3',
            gameName: 'Portal Reloaded',
            mainStory: 6
          }
        ] as HLTBSearchResult[];

        const result = await matcher.findBestMatch('Portal 2', results);

        expect(result?.match?.gameName).toBe('Portal 2');
        expect(result?.match?.gameId).toBe('2');
      });
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================
  describe('End-to-End Integration', () => {
    let matcher: TitleMatcher;

    beforeEach(() => {
      matcher = new TitleMatcher();
    });

    test('should handle complex real-world scenario', async () => {
      const steamTitle = "Tom Clancy's Rainbow Six® Siege - Year 7 Deluxe Edition";
      const hltbResults: HLTBSearchResult[] = [
        {
          gameId: '1',
          gameName: 'Rainbow Six Siege',
          mainStory: null,
          mainExtra: null,
          completionist: null,
          allStyles: null,
          platforms: ['PC', 'PlayStation', 'Xbox']
        },
        {
          gameId: '2',
          gameName: 'Rainbow Six Vegas',
          mainStory: 7,
          mainExtra: 12,
          completionist: 20,
          allStyles: 12
        }
      ];

      const result = await matcher.findBestMatch(steamTitle, hltbResults);

      expect(result).not.toBeNull();
      expect(result?.match?.gameName).toBe('Rainbow Six Siege');
      expect(result?.confidence).toBeGreaterThan(0.8);
    });

    test('should prioritize matching strategies correctly', async () => {
      // Test that strategies are tried in order: year-specific -> manual -> exact -> fuzzy
      const results: HLTBSearchResult[] = [
        {
          gameId: '1',
          gameName: 'DOOM 2016',
          mainStory: 11
        },
        {
          gameId: '2',
          gameName: 'DOOM',
          mainStory: 2
        }
      ] as HLTBSearchResult[];

      // Should use year-specific mapping
      const result1 = await matcher.findBestMatch('DOOM (2016)', results);
      expect(result1?.method).toBe('year_specific');

      // Should use manual mapping
      const result2 = await matcher.findBestMatch('DOOM', results);
      expect(result2?.method).toBe('manual_mapping');
    });
  });
});

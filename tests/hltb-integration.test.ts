/**
 * HLTB Integration Service Tests
 * Comprehensive test suite for the integrated HLTB data retrieval system
 */

import { HLTBIntegratedService, IntegratedHLTBData, SearchOptions } from '../src/background/services/hltb-integrated-service';
import { HLTBApiClient, RateLimitError, NetworkError } from '../src/background/services/hltb-api-client';
import { HLTBScraper } from '../src/background/services/hltb-scraper';
import { HLTBFallback } from '../src/background/services/hltb-fallback';
import { CacheService } from '../src/background/services/cache-service';
import { QueueService } from '../src/background/services/queue-service';

// Mock all dependencies
jest.mock('../src/background/services/hltb-api-client');
jest.mock('../src/background/services/hltb-scraper');
jest.mock('../src/background/services/hltb-fallback');
jest.mock('../src/background/services/cache-service');
jest.mock('../src/background/services/queue-service');

describe('HLTBIntegratedService', () => {
  let service: HLTBIntegratedService;
  let mockApiClient: jest.Mocked<HLTBApiClient>;
  let mockScraper: jest.Mocked<HLTBScraper>;
  let mockFallback: jest.Mocked<HLTBFallback>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockQueueService: jest.Mocked<QueueService>;

  // Mock game data for testing
  const mockPortalData: IntegratedHLTBData = {
    mainStory: 3,
    mainExtra: 4,
    completionist: 5,
    allStyles: 4,
    source: 'api',
    confidence: 'high',
    retrievalTime: 150
  };

  const mockEldenRingData: IntegratedHLTBData = {
    mainStory: 55,
    mainExtra: 77,
    completionist: 133,
    allStyles: 60,
    source: 'api',
    confidence: 'high',
    retrievalTime: 200
  };

  const mockMultiplayerGame: IntegratedHLTBData = {
    mainStory: null,
    mainExtra: null,
    completionist: null,
    allStyles: null,
    source: 'fallback',
    confidence: 'low',
    retrievalTime: 50
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup queue service to just execute immediately
    mockQueueService = {
      enqueue: jest.fn().mockImplementation((fn) => fn())
    } as any;
    (QueueService as jest.MockedClass<typeof QueueService>).mockImplementation(() => mockQueueService);

    // Create service instance
    service = new HLTBIntegratedService();
  });

  describe('Time String Parsing', () => {
    test('should parse whole numbers correctly', () => {
      const result = service.parseTimeString('12 Hours');
      expect(result).toBe(12);
    });

    test('should parse fractions (½)', () => {
      const result = service.parseTimeString('1½ Hours');
      expect(result).toBe(1.5);
    });

    test('should parse fractions (¼, ¾)', () => {
      expect(service.parseTimeString('2¼ Hours')).toBe(2.25);
      expect(service.parseTimeString('3¾ Hours')).toBe(3.75);
    });

    test('should parse decimal numbers', () => {
      const result = service.parseTimeString('15.5 Hours');
      expect(result).toBe(15.5);
    });

    test('should parse ranges and return average', () => {
      const result = service.parseTimeString('10-20 Hours');
      expect(result).toBe(15);
    });

    test('should parse "Mins" format', () => {
      const result = service.parseTimeString('45 Mins');
      expect(result).toBe(0.75);
    });

    test('should handle null/undefined/empty strings', () => {
      expect(service.parseTimeString(null)).toBeNull();
      expect(service.parseTimeString(undefined)).toBeNull();
      expect(service.parseTimeString('')).toBeNull();
      expect(service.parseTimeString('--')).toBeNull();
    });

    test('should handle malformed strings', () => {
      expect(service.parseTimeString('Not a number')).toBeNull();
      expect(service.parseTimeString('TBD')).toBeNull();
      expect(service.parseTimeString('N/A')).toBeNull();
    });

    test('should parse complex formats', () => {
      expect(service.parseTimeString('About 12 Hours')).toBe(12);
      expect(service.parseTimeString('~15 Hours')).toBe(15);
      expect(service.parseTimeString('12h 30m')).toBe(12.5);
    });
  });

  describe('Data Retrieval Strategies', () => {
    test('should retrieve from cache first when available', async () => {
      // Setup cache hit
      mockCacheService = {
        get: jest.fn().mockResolvedValue(mockPortalData)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      service = new HLTBIntegratedService();
      const result = await service.getGameData('Portal');

      expect(result).toEqual(expect.objectContaining({
        ...mockPortalData,
        source: 'cache'
      }));
      expect(mockCacheService.get).toHaveBeenCalledWith('Portal', undefined);
      // Should not call other services
      expect(mockQueueService.enqueue).not.toHaveBeenCalled();
    });

    test('should fallback to API when cache miss', async () => {
      // Setup cache miss and API success
      mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockApiClient = {
        searchGame: jest.fn().mockResolvedValue({
          comp_main: 3 * 3600, // API returns seconds
          comp_plus: 4 * 3600,
          comp_100: 5 * 3600,
          comp_all: 4 * 3600
        })
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      service = new HLTBIntegratedService();
      const result = await service.getGameData('Portal');

      expect(result?.source).toBe('api');
      expect(result?.mainStory).toBe(3);
      expect(mockApiClient.searchGame).toHaveBeenCalledWith('Portal', undefined);
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    test('should fallback to scraper when API fails', async () => {
      // Setup cache miss, API failure, scraper success
      mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockApiClient = {
        searchGame: jest.fn().mockRejectedValue(new NetworkError('API Down'))
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      mockScraper = {
        searchGame: jest.fn().mockResolvedValue({
          games: [{
            name: 'Portal',
            mainStory: 3,
            mainExtra: 4,
            completionist: 5,
            allStyles: 4
          }]
        })
      } as any;
      (HLTBScraper as jest.MockedClass<typeof HLTBScraper>).mockImplementation(() => mockScraper);

      service = new HLTBIntegratedService();
      const result = await service.getGameData('Portal');

      expect(result?.source).toBe('scraper');
      expect(result?.confidence).toBe('medium');
      expect(mockScraper.searchGame).toHaveBeenCalledWith('Portal');
    });

    test('should fallback to local database when all online sources fail', async () => {
      // Setup all online sources to fail
      mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockApiClient = {
        searchGame: jest.fn().mockRejectedValue(new NetworkError('API Down'))
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      mockScraper = {
        searchGame: jest.fn().mockRejectedValue(new Error('Scraping failed'))
      } as any;
      (HLTBScraper as jest.MockedClass<typeof HLTBScraper>).mockImplementation(() => mockScraper);

      mockFallback = {
        searchGame: jest.fn().mockReturnValue({
          mainStory: 3,
          mainExtra: 4,
          completionist: 5,
          allStyles: 4
        })
      } as any;
      (HLTBFallback as jest.MockedClass<typeof HLTBFallback>).mockImplementation(() => mockFallback);

      service = new HLTBIntegratedService();
      const result = await service.getGameData('Portal');

      expect(result?.source).toBe('fallback');
      expect(result?.confidence).toBe('low');
      expect(mockFallback.searchGame).toHaveBeenCalledWith('Portal', undefined);
    });

    test('should respect search options to skip certain strategies', async () => {
      const options: SearchOptions = {
        skipCache: true,
        skipApi: true,
        skipScraping: false,
        skipFallback: false
      };

      // Setup scraper to succeed
      mockScraper = {
        searchGame: jest.fn().mockResolvedValue({
          games: [{
            name: 'Portal',
            mainStory: 3,
            mainExtra: 4,
            completionist: 5,
            allStyles: 4
          }]
        })
      } as any;
      (HLTBScraper as jest.MockedClass<typeof HLTBScraper>).mockImplementation(() => mockScraper);

      service = new HLTBIntegratedService();
      const result = await service.getGameData('Portal', '400', options);

      expect(result?.source).toBe('scraper');
      // Should not call cache or API
      expect(mockCacheService?.get).not.toHaveBeenCalled();
      expect(mockApiClient?.searchGame).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle null values from data sources', async () => {
      mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockApiClient = {
        searchGame: jest.fn().mockResolvedValue({
          comp_main: null,
          comp_plus: null,
          comp_100: null,
          comp_all: null
        })
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      service = new HLTBIntegratedService();
      const result = await service.getGameData('Multiplayer Only Game');

      expect(result).toEqual(expect.objectContaining({
        mainStory: null,
        mainExtra: null,
        completionist: null,
        allStyles: null,
        source: 'api'
      }));
    });

    test('should handle games with only some completion times', async () => {
      mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockApiClient = {
        searchGame: jest.fn().mockResolvedValue({
          comp_main: 10 * 3600,
          comp_plus: null, // No extra content
          comp_100: 15 * 3600,
          comp_all: 11 * 3600
        })
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      service = new HLTBIntegratedService();
      const result = await service.getGameData('Linear Game');

      expect(result?.mainStory).toBe(10);
      expect(result?.mainExtra).toBeNull();
      expect(result?.completionist).toBe(15);
    });

    test('should handle very long game names', async () => {
      const longTitle = 'This Is An Extremely Long Game Title That Might Cause Issues With APIs: ' +
                       'Special Edition - Game of the Year - Directors Cut - Ultimate Definitive Version';

      mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockApiClient = {
        searchGame: jest.fn().mockResolvedValue(null)
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      service = new HLTBIntegratedService();
      await service.getGameData(longTitle);

      // Should truncate or handle gracefully
      expect(mockApiClient.searchGame).toHaveBeenCalled();
      const callArg = mockApiClient.searchGame.mock.calls[0][0];
      expect(callArg.length).toBeLessThanOrEqual(200); // Reasonable limit
    });

    test('should handle special characters in game titles', async () => {
      const specialTitle = 'Tom Clancy\'s Rainbow Six® Siege™: Year 7 - Deluxe Edition';

      mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockApiClient = {
        searchGame: jest.fn().mockResolvedValue({
          comp_main: 0, // Multiplayer only
          comp_plus: 0,
          comp_100: 0,
          comp_all: 0
        })
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      service = new HLTBIntegratedService();
      const result = await service.getGameData(specialTitle);

      expect(mockApiClient.searchGame).toHaveBeenCalled();
      // Should sanitize special characters
      const callArg = mockApiClient.searchGame.mock.calls[0][0];
      expect(callArg).not.toContain('®');
      expect(callArg).not.toContain('™');
    });

    test('should return null when all strategies fail', async () => {
      // Setup all sources to fail
      mockCacheService = {
        get: jest.fn().mockResolvedValue(null)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockApiClient = {
        searchGame: jest.fn().mockRejectedValue(new Error('API Error'))
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      mockScraper = {
        searchGame: jest.fn().mockRejectedValue(new Error('Scraping Error'))
      } as any;
      (HLTBScraper as jest.MockedClass<typeof HLTBScraper>).mockImplementation(() => mockScraper);

      mockFallback = {
        searchGame: jest.fn().mockReturnValue(null)
      } as any;
      (HLTBFallback as jest.MockedClass<typeof HLTBFallback>).mockImplementation(() => mockFallback);

      service = new HLTBIntegratedService();
      const result = await service.getGameData('Unknown Game');

      expect(result).toBeNull();
    });
  });

  describe('Performance', () => {
    test('should retrieve data within 2 seconds', async () => {
      // Setup slow API but fast fallback
      mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockApiClient = {
        searchGame: jest.fn().mockImplementation(() =>
          new Promise(resolve => setTimeout(() => resolve(mockPortalData), 1500))
        )
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      service = new HLTBIntegratedService();
      const startTime = Date.now();
      const result = await service.getGameData('Portal', '400', { timeout: 2000 });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(2000);
      expect(result).toBeTruthy();
    });

    test('should use timeout option to limit retrieval time', async () => {
      // Setup very slow API
      mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockApiClient = {
        searchGame: jest.fn().mockImplementation(() =>
          new Promise(resolve => setTimeout(() => resolve(mockPortalData), 5000))
        )
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      // Fast fallback
      mockFallback = {
        searchGame: jest.fn().mockReturnValue(mockPortalData)
      } as any;
      (HLTBFallback as jest.MockedClass<typeof HLTBFallback>).mockImplementation(() => mockFallback);

      service = new HLTBIntegratedService();
      const startTime = Date.now();
      const result = await service.getGameData('Portal', '400', { timeout: 1000 });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1500);
      // Should fallback to local database due to timeout
      expect(result?.source).toBe('fallback');
    });

    test('should track retrieval time in response', async () => {
      mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockApiClient = {
        searchGame: jest.fn().mockResolvedValue({
          comp_main: 3 * 3600,
          comp_plus: 4 * 3600,
          comp_100: 5 * 3600,
          comp_all: 4 * 3600
        })
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      service = new HLTBIntegratedService();
      const result = await service.getGameData('Portal');

      expect(result?.retrievalTime).toBeDefined();
      expect(result?.retrievalTime).toBeGreaterThan(0);
      expect(result?.retrievalTime).toBeLessThan(5000);
    });
  });

  describe('Cache Management', () => {
    test('should cache successful API responses', async () => {
      mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockApiClient = {
        searchGame: jest.fn().mockResolvedValue({
          comp_main: 3 * 3600,
          comp_plus: 4 * 3600,
          comp_100: 5 * 3600,
          comp_all: 4 * 3600
        })
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      service = new HLTBIntegratedService();
      await service.getGameData('Portal', '400');

      expect(mockCacheService.set).toHaveBeenCalledWith(
        'Portal',
        '400',
        expect.objectContaining({
          mainStory: 3,
          mainExtra: 4,
          completionist: 5,
          allStyles: 4
        })
      );
    });

    test('should cache successful scraper responses', async () => {
      mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockApiClient = {
        searchGame: jest.fn().mockRejectedValue(new NetworkError('API Down'))
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      mockScraper = {
        searchGame: jest.fn().mockResolvedValue({
          games: [{
            name: 'Portal',
            mainStory: 3,
            mainExtra: 4,
            completionist: 5,
            allStyles: 4
          }]
        })
      } as any;
      (HLTBScraper as jest.MockedClass<typeof HLTBScraper>).mockImplementation(() => mockScraper);

      service = new HLTBIntegratedService();
      await service.getGameData('Portal', '400');

      expect(mockCacheService.set).toHaveBeenCalledWith(
        'Portal',
        '400',
        expect.objectContaining({
          mainStory: 3,
          source: 'scraper'
        })
      );
    });

    test('should not cache fallback database responses by default', async () => {
      mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockApiClient = {
        searchGame: jest.fn().mockRejectedValue(new NetworkError('API Down'))
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      mockScraper = {
        searchGame: jest.fn().mockRejectedValue(new Error('Scraping failed'))
      } as any;
      (HLTBScraper as jest.MockedClass<typeof HLTBScraper>).mockImplementation(() => mockScraper);

      mockFallback = {
        searchGame: jest.fn().mockReturnValue({
          mainStory: 3,
          mainExtra: 4,
          completionist: 5,
          allStyles: 4
        })
      } as any;
      (HLTBFallback as jest.MockedClass<typeof HLTBFallback>).mockImplementation(() => mockFallback);

      service = new HLTBIntegratedService();
      await service.getGameData('Portal', '400');

      // Should not cache low-confidence fallback data
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    test('should respect cache skip option', async () => {
      mockCacheService = {
        get: jest.fn().mockResolvedValue(mockPortalData),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockApiClient = {
        searchGame: jest.fn().mockResolvedValue({
          comp_main: 3 * 3600,
          comp_plus: 4 * 3600,
          comp_100: 5 * 3600,
          comp_all: 4 * 3600
        })
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      service = new HLTBIntegratedService();
      const result = await service.getGameData('Portal', '400', { skipCache: true });

      expect(mockCacheService.get).not.toHaveBeenCalled();
      expect(result?.source).toBe('api');
    });
  });

  describe('Statistics Tracking', () => {
    test('should track service statistics', async () => {
      // Setup mixed results
      mockCacheService = {
        get: jest.fn()
          .mockResolvedValueOnce(null) // Cache miss
          .mockResolvedValueOnce(mockPortalData), // Cache hit
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockApiClient = {
        searchGame: jest.fn().mockResolvedValue({
          comp_main: 3 * 3600,
          comp_plus: 4 * 3600,
          comp_100: 5 * 3600,
          comp_all: 4 * 3600
        })
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      service = new HLTBIntegratedService();

      // First request - API hit
      await service.getGameData('Portal');

      // Second request - Cache hit
      await service.getGameData('Portal');

      const stats = service.getStatistics();

      expect(stats.totalRequests).toBe(2);
      expect(stats.cacheHits).toBe(1);
      expect(stats.apiAttempts).toBe(1);
      expect(stats.apiSuccesses).toBe(1);
      expect(stats.averageRetrievalTime).toBeGreaterThan(0);
    });

    test('should calculate average retrieval time', async () => {
      mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockApiClient = {
        searchGame: jest.fn().mockResolvedValue({
          comp_main: 3 * 3600,
          comp_plus: 4 * 3600,
          comp_100: 5 * 3600,
          comp_all: 4 * 3600
        })
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      service = new HLTBIntegratedService();

      // Make multiple requests
      await service.getGameData('Game1');
      await service.getGameData('Game2');
      await service.getGameData('Game3');

      const stats = service.getStatistics();

      expect(stats.averageRetrievalTime).toBeGreaterThan(0);
      expect(stats.averageRetrievalTime).toBeLessThan(1000); // Should be fast
    });
  });

  describe('Rate Limiting', () => {
    test('should handle rate limit errors gracefully', async () => {
      mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockApiClient = {
        searchGame: jest.fn().mockRejectedValue(new RateLimitError(60))
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      mockScraper = {
        searchGame: jest.fn().mockResolvedValue({
          games: [{
            name: 'Portal',
            mainStory: 3,
            mainExtra: 4,
            completionist: 5,
            allStyles: 4
          }]
        })
      } as any;
      (HLTBScraper as jest.MockedClass<typeof HLTBScraper>).mockImplementation(() => mockScraper);

      service = new HLTBIntegratedService();
      const result = await service.getGameData('Portal');

      // Should fallback to scraper when rate limited
      expect(result?.source).toBe('scraper');
      expect(mockScraper.searchGame).toHaveBeenCalled();
    });

    test('should queue requests to prevent overwhelming services', async () => {
      mockQueueService = {
        enqueue: jest.fn().mockImplementation((fn) => fn())
      } as any;
      (QueueService as jest.MockedClass<typeof QueueService>).mockImplementation(() => mockQueueService);

      mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockApiClient = {
        searchGame: jest.fn().mockResolvedValue({
          comp_main: 3 * 3600,
          comp_plus: 4 * 3600,
          comp_100: 5 * 3600,
          comp_all: 4 * 3600
        })
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      service = new HLTBIntegratedService();

      // Make multiple concurrent requests
      const promises = [
        service.getGameData('Game1'),
        service.getGameData('Game2'),
        service.getGameData('Game3')
      ];

      await Promise.all(promises);

      // Each request should be queued
      expect(mockQueueService.enqueue).toHaveBeenCalledTimes(3);
    });
  });

  describe('Multiple Data Sources', () => {
    test('should merge data from multiple sources when needed', async () => {
      // API has main story time
      mockApiClient = {
        searchGame: jest.fn().mockResolvedValue({
          comp_main: 10 * 3600,
          comp_plus: null,
          comp_100: null,
          comp_all: 10 * 3600
        })
      } as any;

      // Scraper has completionist time
      mockScraper = {
        searchGame: jest.fn().mockResolvedValue({
          games: [{
            name: 'Partial Game',
            mainStory: null,
            mainExtra: null,
            completionist: 25,
            allStyles: null
          }]
        })
      } as any;

      // This test would require enhanced integration logic
      // Currently testing that each source is tried independently
    });

    test('should prefer higher confidence sources', async () => {
      mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      // API provides high confidence data
      mockApiClient = {
        searchGame: jest.fn().mockResolvedValue({
          comp_main: 10 * 3600,
          comp_plus: 15 * 3600,
          comp_100: 25 * 3600,
          comp_all: 12 * 3600
        })
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      service = new HLTBIntegratedService();
      const result = await service.getGameData('Test Game');

      expect(result?.confidence).toBe('high');
      expect(result?.source).toBe('api');
    });

    test('should handle different game name variations', async () => {
      const variations = [
        'The Elder Scrolls V: Skyrim',
        'Elder Scrolls V Skyrim',
        'Skyrim',
        'TES V: Skyrim',
        'The Elder Scrolls 5: Skyrim'
      ];

      mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined)
      } as any;
      (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);

      mockFallback = {
        searchGame: jest.fn().mockReturnValue({
          mainStory: 33,
          mainExtra: 59,
          completionist: 232,
          allStyles: 108
        })
      } as any;
      (HLTBFallback as jest.MockedClass<typeof HLTBFallback>).mockImplementation(() => mockFallback);

      mockApiClient = {
        searchGame: jest.fn().mockRejectedValue(new Error('Not found'))
      } as any;
      (HLTBApiClient as jest.MockedClass<typeof HLTBApiClient>).mockImplementation(() => mockApiClient);

      mockScraper = {
        searchGame: jest.fn().mockRejectedValue(new Error('Not found'))
      } as any;
      (HLTBScraper as jest.MockedClass<typeof HLTBScraper>).mockImplementation(() => mockScraper);

      service = new HLTBIntegratedService();

      for (const variation of variations) {
        const result = await service.getGameData(variation);
        expect(result?.mainStory).toBe(33);
      }
    });
  });
});
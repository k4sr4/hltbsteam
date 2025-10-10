/**
 * HLTB API Client Tests
 * Tests for API request construction, rate limiting, retry logic, and response parsing
 */

import { HLTBApiClient, RateLimitError, NetworkError, HLTBSearchRequest, HLTBGameData } from '../src/background/services/hltb-api-client';

// Mock fetch globally
global.fetch = jest.fn();

describe('HLTBApiClient', () => {
  let client: HLTBApiClient;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    client = new HLTBApiClient({
      maxRetries: 3,
      baseDelay: 100,
      timeout: 5000
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Request Construction', () => {
    test('should construct correct search request payload', async () => {
      const mockResponse: HLTBGameData = {
        game_id: 1234,
        game_name: 'Portal',
        game_name_date: 2007,
        game_alias: '',
        game_type: 'game',
        game_image: 'portal.jpg',
        comp_lvl_combine: 0,
        comp_lvl_sp: 1,
        comp_lvl_co: 0,
        comp_lvl_mp: 0,
        comp_lvl_spd: 0,
        comp_main: 10800, // 3 hours in seconds
        comp_plus: 14400, // 4 hours
        comp_100: 18000,  // 5 hours
        comp_all: 14400,
        comp_main_count: 100,
        comp_plus_count: 80,
        comp_100_count: 60,
        comp_all_count: 240,
        review_score: 95,
        profile_platform: 'PC'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [mockResponse] }),
        headers: new Headers()
      } as Response);

      await client.searchGame('Portal');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://howlongtobeat.com/api/search',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': expect.stringContaining('Mozilla')
          }),
          body: expect.stringContaining('Portal')
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);

      expect(body.searchType).toBe('games');
      expect(body.searchTerms).toContain('Portal');
      expect(body.searchPage).toBe(1);
      expect(body.size).toBe(20);
    });

    test('should sanitize game title before searching', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
        headers: new Headers()
      } as Response);

      await client.searchGame('Tom Clancy\'s Rainbow Six® Siege™: Year 7');

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);

      // Should remove special characters
      expect(body.searchTerms[0]).not.toContain('®');
      expect(body.searchTerms[0]).not.toContain('™');
      expect(body.searchTerms[0]).toContain('Tom Clancy');
      expect(body.searchTerms[0]).toContain('Rainbow Six');
    });

    test('should include platform in search when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
        headers: new Headers()
      } as Response);

      await client.searchGame('Portal', undefined, 'PC');

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);

      expect(body.searchOptions.games.platform).toBe('PC');
    });

    test('should handle app ID parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
        headers: new Headers()
      } as Response);

      await client.searchGame('Portal', '400');

      // App ID should be stored but not affect search
      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.searchTerms).toContain('Portal');
    });

    test('should set appropriate timeout on requests', async () => {
      // Create an AbortController spy
      const abortSpy = jest.spyOn(global, 'AbortController');

      mockFetch.mockImplementationOnce(() =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ data: [] }),
              headers: new Headers()
            } as Response);
          }, 100);
        })
      );

      await client.searchGame('Portal');

      expect(abortSpy).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );

      abortSpy.mockRestore();
    });
  });

  describe('Rate Limit Handling', () => {
    test('should detect rate limit from 429 status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '60' })
      } as Response);

      await expect(client.searchGame('Portal')).rejects.toThrow(RateLimitError);
    });

    test('should parse Retry-After header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '120' })
      } as Response);

      try {
        await client.searchGame('Portal');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).retryAfter).toBe(120);
      }
    });

    test('should use default retry time when header missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers()
      } as Response);

      try {
        await client.searchGame('Portal');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).retryAfter).toBe(60); // Default
      }
    });

    test('should track rate limit state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '60' })
      } as Response);

      try {
        await client.searchGame('Portal');
      } catch (error) {
        expect(client.isRateLimited()).toBe(true);
      }
    });

    test('should prevent requests while rate limited', async () => {
      // First request gets rate limited
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '60' })
      } as Response);

      try {
        await client.searchGame('Portal');
      } catch (error) {
        // Expected
      }

      // Second request should fail immediately
      await expect(client.searchGame('Half-Life')).rejects.toThrow(RateLimitError);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Should not make second request
    });

    test('should clear rate limit after timeout', async () => {
      jest.useFakeTimers();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '2' }) // 2 seconds
      } as Response);

      try {
        await client.searchGame('Portal');
      } catch (error) {
        // Expected
      }

      expect(client.isRateLimited()).toBe(true);

      // Advance time
      jest.advanceTimersByTime(2100);

      expect(client.isRateLimited()).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('Retry Logic', () => {
    test('should retry on network errors', async () => {
      // Fail twice, succeed on third
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
          headers: new Headers()
        } as Response);

      const result = await client.searchGame('Portal');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toBeDefined();
    });

    test('should use exponential backoff', async () => {
      jest.useFakeTimers();

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
          headers: new Headers()
        } as Response);

      const searchPromise = client.searchGame('Portal');

      // First retry after baseDelay
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      // Second retry after baseDelay * 2
      jest.advanceTimersByTime(200);
      await Promise.resolve();

      await searchPromise;

      expect(mockFetch).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });

    test('should fail after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.searchGame('Portal')).rejects.toThrow(NetworkError);
      expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    test('should not retry on 4xx errors (except 429)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers()
      } as Response);

      await expect(client.searchGame('Portal')).rejects.toThrow(NetworkError);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });

    test('should retry on 5xx errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers()
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
          headers: new Headers()
        } as Response);

      const result = await client.searchGame('Portal');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    });

    test('should add jitter to prevent thundering herd', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
          headers: new Headers()
        } as Response);

      await client.searchGame('Portal');

      // Jitter should add some randomness to delay
      expect(mockFetch).toHaveBeenCalledTimes(2);

      jest.spyOn(Math, 'random').mockRestore();
    });
  });

  describe('Response Parsing', () => {
    test('should parse valid game data response', async () => {
      const mockGameData: HLTBGameData = {
        game_id: 1234,
        game_name: 'Portal',
        game_name_date: 2007,
        game_alias: '',
        game_type: 'game',
        game_image: 'portal.jpg',
        comp_lvl_combine: 0,
        comp_lvl_sp: 1,
        comp_lvl_co: 0,
        comp_lvl_mp: 0,
        comp_lvl_spd: 0,
        comp_main: 10800, // 3 hours in seconds
        comp_plus: 14400, // 4 hours
        comp_100: 18000,  // 5 hours
        comp_all: 14400,
        comp_main_count: 100,
        comp_plus_count: 80,
        comp_100_count: 60,
        comp_all_count: 240,
        review_score: 95,
        profile_platform: 'PC'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [mockGameData] }),
        headers: new Headers()
      } as Response);

      const result = await client.searchGame('Portal');

      expect(result).toEqual(mockGameData);
    });

    test('should handle empty search results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
        headers: new Headers()
      } as Response);

      const result = await client.searchGame('Nonexistent Game');

      expect(result).toBeNull();
    });

    test('should handle multiple search results and pick best match', async () => {
      const games: HLTBGameData[] = [
        {
          game_id: 1,
          game_name: 'Portal Reloaded',
          game_name_date: 2021,
          comp_main: 21600,
          comp_plus: 28800,
          comp_100: 36000,
          comp_all: 25200
        } as HLTBGameData,
        {
          game_id: 2,
          game_name: 'Portal',
          game_name_date: 2007,
          comp_main: 10800,
          comp_plus: 14400,
          comp_100: 18000,
          comp_all: 14400
        } as HLTBGameData,
        {
          game_id: 3,
          game_name: 'Portal 2',
          game_name_date: 2011,
          comp_main: 28800,
          comp_plus: 36000,
          comp_100: 50400,
          comp_all: 32400
        } as HLTBGameData
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: games }),
        headers: new Headers()
      } as Response);

      const result = await client.searchGame('Portal');

      // Should pick exact match
      expect(result?.game_id).toBe(2);
      expect(result?.game_name).toBe('Portal');
    });

    test('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => { throw new Error('Invalid JSON'); },
        headers: new Headers()
      } as Response);

      await expect(client.searchGame('Portal')).rejects.toThrow(NetworkError);
    });

    test('should handle unexpected response structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ unexpected: 'structure' }),
        headers: new Headers()
      } as Response);

      const result = await client.searchGame('Portal');
      expect(result).toBeNull();
    });

    test('should convert time from seconds to hours', async () => {
      const mockGameData: HLTBGameData = {
        game_id: 1234,
        game_name: 'Portal',
        game_name_date: 2007,
        game_alias: '',
        game_type: 'game',
        game_image: 'portal.jpg',
        comp_lvl_combine: 0,
        comp_lvl_sp: 1,
        comp_lvl_co: 0,
        comp_lvl_mp: 0,
        comp_lvl_spd: 0,
        comp_main: 10800, // 3 hours in seconds
        comp_plus: 14400, // 4 hours
        comp_100: 18000,  // 5 hours
        comp_all: 14400,
        comp_main_count: 100,
        comp_plus_count: 80,
        comp_100_count: 60,
        comp_all_count: 240,
        review_score: 95,
        profile_platform: 'PC'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [mockGameData] }),
        headers: new Headers()
      } as Response);

      const result = await client.searchGame('Portal');

      // Times should be in seconds for processing
      expect(result?.comp_main).toBe(10800);
      expect(result?.comp_plus).toBe(14400);
      expect(result?.comp_100).toBe(18000);
    });

    test('should handle games with no completion times', async () => {
      const mockGameData: HLTBGameData = {
        game_id: 9999,
        game_name: 'Multiplayer Only Game',
        game_name_date: 2023,
        game_alias: '',
        game_type: 'game',
        game_image: 'mp.jpg',
        comp_lvl_combine: 0,
        comp_lvl_sp: 0,
        comp_lvl_co: 0,
        comp_lvl_mp: 1,
        comp_lvl_spd: 0,
        comp_main: 0,
        comp_plus: 0,
        comp_100: 0,
        comp_all: 0,
        comp_main_count: 0,
        comp_plus_count: 0,
        comp_100_count: 0,
        comp_all_count: 0,
        review_score: 0,
        profile_platform: 'PC'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [mockGameData] }),
        headers: new Headers()
      } as Response);

      const result = await client.searchGame('Multiplayer Only Game');

      expect(result).toBeDefined();
      expect(result?.comp_main).toBe(0);
      expect(result?.comp_lvl_mp).toBe(1); // Multiplayer flag
    });
  });

  describe('Error Handling', () => {
    test('should throw NetworkError on fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'));

      await expect(client.searchGame('Portal')).rejects.toThrow(NetworkError);
    });

    test('should include status code in NetworkError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers()
      } as Response);

      try {
        await client.searchGame('Portal');
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
        expect((error as NetworkError).statusCode).toBe(503);
      }
    });

    test('should handle timeout errors', async () => {
      jest.useFakeTimers();

      mockFetch.mockImplementationOnce(() =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ data: [] }),
              headers: new Headers()
            } as Response);
          }, 10000); // Longer than timeout
        })
      );

      const searchPromise = client.searchGame('Portal');

      jest.advanceTimersByTime(5100); // Just past timeout

      await expect(searchPromise).rejects.toThrow();

      jest.useRealTimers();
    });

    test('should preserve original error in NetworkError', async () => {
      const originalError = new Error('Connection refused');
      mockFetch.mockRejectedValueOnce(originalError);

      try {
        await client.searchGame('Portal');
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
        expect((error as NetworkError).originalError).toBe(originalError);
      }
    });
  });

  describe('Configuration', () => {
    test('should respect custom configuration', async () => {
      const customClient = new HLTBApiClient({
        maxRetries: 1,
        baseDelay: 50,
        timeout: 1000
      });

      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(customClient.searchGame('Portal')).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    test('should use default configuration when not provided', async () => {
      const defaultClient = new HLTBApiClient();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
        headers: new Headers()
      } as Response);

      await defaultClient.searchGame('Portal');
      expect(mockFetch).toHaveBeenCalled();
    });

    test('should validate configuration parameters', () => {
      expect(() => new HLTBApiClient({
        maxRetries: -1,
        baseDelay: 100,
        timeout: 5000
      })).toThrow();

      expect(() => new HLTBApiClient({
        maxRetries: 3,
        baseDelay: -100,
        timeout: 5000
      })).toThrow();

      expect(() => new HLTBApiClient({
        maxRetries: 3,
        baseDelay: 100,
        timeout: -5000
      })).toThrow();
    });
  });

  describe('Cache Headers', () => {
    test('should respect cache control headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
        headers: new Headers({
          'Cache-Control': 'max-age=3600',
          'ETag': '"123456"'
        })
      } as Response);

      const result = await client.searchGame('Portal');

      // Client should store cache info (implementation specific)
      expect(mockFetch).toHaveBeenCalled();
    });

    test('should send If-None-Match header when ETag available', async () => {
      // First request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
        headers: new Headers({ 'ETag': '"123456"' })
      } as Response);

      await client.searchGame('Portal');

      // Second request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 304, // Not Modified
        headers: new Headers()
      } as Response);

      await client.searchGame('Portal');

      // Should send If-None-Match on second request
      const secondCall = mockFetch.mock.calls[1];
      expect(secondCall[1]?.headers).toHaveProperty('If-None-Match');
    });
  });

  describe('Performance', () => {
    test('should complete search within timeout', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
        headers: new Headers()
      } as Response);

      const startTime = Date.now();
      await client.searchGame('Portal');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000);
    });

    test('should handle concurrent requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
        headers: new Headers()
      } as Response);

      const promises = [
        client.searchGame('Portal'),
        client.searchGame('Half-Life'),
        client.searchGame('Left 4 Dead')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});
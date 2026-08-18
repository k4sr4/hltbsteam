/**
 * HLTB API Client Tests
 * Tests the authenticated two-step search flow: init token fetch, search POST,
 * token refresh on 403, endpoint rediscovery on 404, rate limiting, parsing.
 */

import { HLTBApiClient, RateLimitError, NetworkError } from '../src/background/services/hltb-api-client';
import { hltbAuthService, HLTBAuthError } from '../src/background/services/hltb-auth-service';
import { resetHltbHeaderRules } from '../src/background/services/hltb-header-rules';

// Mock fetch globally
global.fetch = jest.fn();

const AUTH_BODY = {
  token: 'test-token-abc',
  hpKey: 'ign_12345678',
  hpVal: 'deadbeef00112233'
};

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: new Headers(headers),
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as unknown as Response;
}

function textResponse(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: new Headers(),
    json: async () => JSON.parse(body),
    text: async () => body
  } as unknown as Response;
}

function makeGame(overrides: Record<string, unknown> = {}) {
  return {
    game_id: 68151,
    game_name: 'Elden Ring',
    game_name_date: 0,
    game_alias: '',
    game_type: 'game',
    game_image: '68151_Elden_Ring.jpg',
    comp_main: 216000,   // 60 hours in seconds
    comp_plus: 364272,
    comp_100: 488947,
    comp_all: 379633,
    comp_main_count: 1723,
    comp_plus_count: 4930,
    comp_100_count: 3855,
    comp_all_count: 10508,
    review_score: 93,
    ...overrides
  };
}

describe('HLTBApiClient', () => {
  let client: HLTBApiClient;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    hltbAuthService.reset();
    resetHltbHeaderRules();
    client = new HLTBApiClient({
      maxRetries: 0,
      baseDelay: 10,
      timeout: 5000
    });
  });

  /** Route fetches: init GET -> auth body, search POST -> provided responses in order */
  function routeFetch(searchResponses: Response[], initResponse?: Response) {
    let searchCall = 0;
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/init?t=')) {
        return initResponse || jsonResponse(200, AUTH_BODY);
      }
      const response = searchResponses[Math.min(searchCall, searchResponses.length - 1)];
      searchCall++;
      return response;
    });
  }

  describe('Authenticated request flow', () => {
    test('fetches an init token then POSTs the search with auth headers', async () => {
      routeFetch([jsonResponse(200, { data: [makeGame()] })]);

      const results = await client.searchGames('Elden Ring');

      expect(results).toHaveLength(1);

      const initCall = mockFetch.mock.calls.find(c => String(c[0]).includes('/init?t='));
      expect(initCall).toBeDefined();
      expect(String(initCall![0])).toMatch(/^https:\/\/howlongtobeat\.com\/api\/bleed\/init\?t=\d+$/);

      const searchCall = mockFetch.mock.calls.find(c => String(c[0]) === 'https://howlongtobeat.com/api/bleed');
      expect(searchCall).toBeDefined();
      const init = searchCall![1] as RequestInit;
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>)['x-auth-token']).toBe(AUTH_BODY.token);
      expect((init.headers as Record<string, string>)['x-hp-key']).toBe(AUTH_BODY.hpKey);
      expect((init.headers as Record<string, string>)['x-hp-val']).toBe(AUTH_BODY.hpVal);
    });

    test('echoes the honeypot pair inside the request body', async () => {
      routeFetch([jsonResponse(200, { data: [makeGame()] })]);

      await client.searchGames('Elden Ring');

      const searchCall = mockFetch.mock.calls.find(c => String(c[0]) === 'https://howlongtobeat.com/api/bleed');
      const body = JSON.parse((searchCall![1] as RequestInit).body as string);
      expect(body[AUTH_BODY.hpKey]).toBe(AUTH_BODY.hpVal);
    });

    test('reuses the cached token across searches', async () => {
      routeFetch([jsonResponse(200, { data: [makeGame()] })]);

      await client.searchGames('Elden Ring');
      await client.searchGames('Hades');

      const initCalls = mockFetch.mock.calls.filter(c => String(c[0]).includes('/init?t='));
      expect(initCalls).toHaveLength(1);
    });

    test('builds the current HLTB payload shape', async () => {
      routeFetch([jsonResponse(200, { data: [makeGame()] })]);

      await client.searchGames('  Elden   Ring  ');

      const searchCall = mockFetch.mock.calls.find(c => String(c[0]) === 'https://howlongtobeat.com/api/bleed');
      const body = JSON.parse((searchCall![1] as RequestInit).body as string);

      expect(body.searchType).toBe('games');
      expect(body.searchTerms).toEqual(['Elden', 'Ring']);
      expect(body.searchPage).toBe(1);
      expect(body.size).toBe(20);
      expect(body.useCache).toBe(true);
      expect(body.searchOptions.games).toMatchObject({
        userId: 0,
        platform: '',
        sortCategory: 'popular',
        rangeCategory: 'main',
        rangeTime: { min: null, max: null },
        gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
        rangeYear: { min: '', max: '' },
        modifier: ''
      });
      expect(body.searchOptions.users).toEqual({ sortCategory: 'postcount' });
      expect(body.searchOptions.lists).toEqual({ sortCategory: 'follows' });
    });

    test('refreshes the token and retries once on 403', async () => {
      routeFetch([
        jsonResponse(403, { message: 'Forbidden' }),
        jsonResponse(200, { data: [makeGame()] })
      ]);

      const results = await client.searchGames('Elden Ring');

      expect(results).toHaveLength(1);
      const initCalls = mockFetch.mock.calls.filter(c => String(c[0]).includes('/init?t='));
      const searchCalls = mockFetch.mock.calls.filter(c => String(c[0]) === 'https://howlongtobeat.com/api/bleed');
      expect(initCalls).toHaveLength(2);
      expect(searchCalls).toHaveLength(2);
    });

    test('rediscovers the endpoint and retries once on 404', async () => {
      const homepage = '<script src="/_next/static/chunks/abc123.js" defer></script>';
      const chunk = 'let x=await fetch(`/api/seek/init?t=${Date.now()}`);';

      let bleedSearches = 0;
      mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === 'https://howlongtobeat.com/') return textResponse(200, homepage);
        if (url.endsWith('/abc123.js')) return textResponse(200, chunk);
        if (url.includes('/api/bleed/init')) return jsonResponse(200, AUTH_BODY);
        if (url.includes('/api/seek/init')) return jsonResponse(200, AUTH_BODY);
        if (url === 'https://howlongtobeat.com/api/bleed') {
          bleedSearches++;
          return jsonResponse(404, { message: 'Not found' });
        }
        if (url === 'https://howlongtobeat.com/api/seek') {
          return jsonResponse(200, { data: [makeGame()] });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });

      const results = await client.searchGames('Elden Ring');

      expect(results).toHaveLength(1);
      expect(bleedSearches).toBe(1);
      expect(mockFetch.mock.calls.some(c => String(c[0]) === 'https://howlongtobeat.com/api/seek')).toBe(true);
    });
  });

  describe('Response parsing', () => {
    test('converts completion times from seconds to hours', async () => {
      routeFetch([jsonResponse(200, {
        data: [makeGame({ comp_main: 216000, comp_plus: 36000, comp_100: 5400, comp_all: 0 })]
      })]);

      const results = await client.searchGames('Elden Ring');

      expect(results[0].mainStory).toBe(60);
      expect(results[0].mainExtra).toBe(10);
      expect(results[0].completionist).toBe(1.5);
      expect(results[0].allStyles).toBeNull();
    });

    test('returns empty array when the API reports no results', async () => {
      routeFetch([jsonResponse(200, { data: [] })]);

      const results = await client.searchGames('Nonexistent Game XYZ');
      expect(results).toEqual([]);
    });

    test('getGameData returns null when nothing matches', async () => {
      routeFetch([jsonResponse(200, { data: [] })]);

      const data = await client.getGameData('Nonexistent Game XYZ');
      expect(data).toBeNull();
    });

    test('getGameData returns the best title match', async () => {
      routeFetch([jsonResponse(200, {
        data: [
          makeGame({ game_id: 1, game_name: 'Elden Ring: Nightreign' }),
          makeGame({ game_id: 2, game_name: 'Elden Ring' })
        ]
      })]);

      const data = await client.getGameData('Elden Ring');

      expect(data).not.toBeNull();
      expect(data!.gameName).toBe('Elden Ring');
    });
  });

  describe('Game classification', () => {
    test('flags multiplayer-only games (no single-player level, has versus)', async () => {
      routeFetch([jsonResponse(200, {
        data: [makeGame({ comp_lvl_sp: 0, comp_lvl_mp: 1, comp_lvl_co: 0 })]
      })]);
      const [g] = await client.searchGames('Counter-Strike 2');
      expect(g.isMultiplayerOnly).toBe(true);
    });

    test('does NOT flag co-op-only campaign games (their comp_main is a real completion time)', async () => {
      // It Takes Two / A Way Out style: no solo, co-op campaign with a real ~14h time
      routeFetch([jsonResponse(200, {
        data: [makeGame({ comp_lvl_sp: 0, comp_lvl_co: 1, comp_lvl_mp: 0, comp_main: 50400 })]
      })]);
      const [g] = await client.searchGames('It Takes Two');
      expect(g.isMultiplayerOnly).toBe(false);
      expect(g.mainStory).toBe(14);
    });

    test('flags versus games that also have co-op (no solo) as multiplayer-only', async () => {
      // Dota 2 style: comp_lvl_sp=0, co=1, mp=1 -> versus present -> notice
      routeFetch([jsonResponse(200, {
        data: [makeGame({ comp_lvl_sp: 0, comp_lvl_co: 1, comp_lvl_mp: 1 })]
      })]);
      const [g] = await client.searchGames('Dota 2');
      expect(g.isMultiplayerOnly).toBe(true);
    });

    test('does not flag single-player games', async () => {
      routeFetch([jsonResponse(200, {
        data: [makeGame({ comp_lvl_sp: 1, comp_lvl_mp: 0, comp_lvl_co: 0 })]
      })]);
      const [g] = await client.searchGames('Hades');
      expect(g.isMultiplayerOnly).toBe(false);
    });

    test('does not flag an unreleased single-player game (zero times, sp level present)', async () => {
      routeFetch([jsonResponse(200, {
        data: [makeGame({
          comp_lvl_sp: 1, comp_lvl_mp: 0, comp_lvl_co: 0,
          comp_main: 0, comp_plus: 0, comp_100: 0, release_world: 2999
        })]
      })]);
      const [g] = await client.searchGames('The Elder Scrolls VI');
      expect(g.isMultiplayerOnly).toBe(false);
      expect(g.mainStory).toBeNull();
      expect(g.releaseYear).toBe(2999);
    });

    test('carries the release year through parsing', async () => {
      routeFetch([jsonResponse(200, { data: [makeGame({ release_world: 2020 })] })]);
      const [g] = await client.searchGames('Hades');
      expect(g.releaseYear).toBe(2020);
    });

    test('release year is null when HLTB omits it', async () => {
      routeFetch([jsonResponse(200, { data: [makeGame()] })]);
      const [g] = await client.searchGames('Portal 2');
      expect(g.releaseYear).toBeNull();
    });
  });

  describe('Error handling', () => {
    test('throws RateLimitError with Retry-After on 429', async () => {
      routeFetch([jsonResponse(429, { message: 'Too many requests' }, { 'Retry-After': '120' })]);

      try {
        await client.searchGames('Elden Ring');
        fail('expected RateLimitError');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).retryAfter).toBe(120);
      }
    });

    test('short-circuits requests while rate limited', async () => {
      routeFetch([jsonResponse(429, { message: 'Too many requests' }, { 'Retry-After': '120' })]);

      await expect(client.searchGames('Elden Ring')).rejects.toThrow(RateLimitError);
      mockFetch.mockClear();

      await expect(client.searchGames('Elden Ring')).rejects.toThrow(RateLimitError);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('throws NetworkError on server errors', async () => {
      routeFetch([jsonResponse(500, { message: 'Internal error' })]);

      await expect(client.searchGames('Elden Ring')).rejects.toThrow(NetworkError);
    });

    test('surfaces auth init failures as a non-retriable HLTBAuthError', async () => {
      let initCalls = 0;
      mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/init?t=')) { initCalls++; return jsonResponse(500, {}); }
        if (url === 'https://howlongtobeat.com/') return textResponse(500, '');
        throw new Error(`Unexpected fetch: ${url}`);
      });

      // maxRetries: 2 here to prove the auth error is NOT retried
      const retryClient = new HLTBApiClient({ maxRetries: 2, baseDelay: 5, timeout: 5000 });
      await expect(retryClient.searchGames('Elden Ring')).rejects.toThrow(HLTBAuthError);
      // A 500 on init is not a 404, so no discovery scan and no retry burst
      expect(initCalls).toBe(1);
    });
  });
});

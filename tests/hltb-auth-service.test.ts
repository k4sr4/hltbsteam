/**
 * HLTB Auth Service Tests
 * Tests token acquisition, caching, storage persistence, concurrent dedupe,
 * and endpoint rediscovery from HLTB's script bundles.
 */

import { HLTBAuthService } from '../src/background/services/hltb-auth-service';

global.fetch = jest.fn();

const AUTH_BODY = {
  token: 'token-xyz',
  hpKey: 'ign_aabbccdd',
  hpVal: '0011223344556677'
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: new Headers(),
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

describe('HLTBAuthService', () => {
  let service: HLTBAuthService;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    (chrome.storage.session.get as jest.Mock).mockResolvedValue({});
    service = new HLTBAuthService();
  });

  test('fetches and parses the auth bundle from the init endpoint', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, AUTH_BODY));

    const auth = await service.getAuth();

    expect(auth.token).toBe(AUTH_BODY.token);
    expect(auth.hpKey).toBe(AUTH_BODY.hpKey);
    expect(auth.hpVal).toBe(AUTH_BODY.hpVal);
    expect(auth.endpoint).toBe('bleed');
    expect(String(mockFetch.mock.calls[0][0])).toMatch(
      /^https:\/\/howlongtobeat\.com\/api\/bleed\/init\?t=\d+$/
    );
  });

  test('persists the auth bundle to chrome.storage.session', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, AUTH_BODY));

    await service.getAuth();

    expect(chrome.storage.session.set).toHaveBeenCalledWith(
      expect.objectContaining({
        hltb_auth: expect.objectContaining({ token: AUTH_BODY.token, endpoint: 'bleed' })
      })
    );
  });

  test('reuses a fresh auth bundle from storage without fetching', async () => {
    (chrome.storage.session.get as jest.Mock).mockResolvedValue({
      hltb_auth: { ...AUTH_BODY, endpoint: 'bleed', fetchedAt: Date.now() }
    });

    const auth = await service.getAuth();

    expect(auth.token).toBe(AUTH_BODY.token);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('ignores a stale auth bundle from storage', async () => {
    (chrome.storage.session.get as jest.Mock).mockResolvedValue({
      hltb_auth: { ...AUTH_BODY, token: 'stale', endpoint: 'bleed', fetchedAt: Date.now() - 60 * 60 * 1000 }
    });
    mockFetch.mockResolvedValue(jsonResponse(200, AUTH_BODY));

    const auth = await service.getAuth();

    expect(auth.token).toBe(AUTH_BODY.token);
    expect(mockFetch).toHaveBeenCalled();
  });

  test('deduplicates concurrent refreshes into one init request', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, AUTH_BODY));

    const [a, b, c] = await Promise.all([service.getAuth(), service.getAuth(), service.getAuth()]);

    expect(a.token).toBe(AUTH_BODY.token);
    expect(b.token).toBe(AUTH_BODY.token);
    expect(c.token).toBe(AUTH_BODY.token);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('rediscovers the endpoint from site bundles when init fails', async () => {
    const homepage =
      '<script src="/_next/static/chunks/turbo1.js" defer></script>' +
      '<script src="/_next/static/chunks/turbo2.js" defer></script>';
    const chunkWithEndpoint = 'ei=async()=>{let e=await fetch(`/api/seek/init?t=${Date.now()}`);}';

    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/bleed/init')) return jsonResponse(404, {});
      if (url === 'https://howlongtobeat.com/') return textResponse(200, homepage);
      if (url.endsWith('/turbo1.js')) return textResponse(200, 'no endpoint here');
      if (url.endsWith('/turbo2.js')) return textResponse(200, chunkWithEndpoint);
      if (url.includes('/api/seek/init')) return jsonResponse(200, AUTH_BODY);
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const auth = await service.getAuth();

    expect(auth.endpoint).toBe('seek');
    expect(auth.token).toBe(AUTH_BODY.token);
  });

  test('throws when no endpoint can be discovered', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/init?t=')) return jsonResponse(404, {});
      if (url === 'https://howlongtobeat.com/') return textResponse(200, '<html>no scripts</html>');
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await expect(service.getAuth()).rejects.toThrow(/discover/i);
  });

  test('throws when init returns no token', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/init?t=')) return jsonResponse(200, { nope: true });
      if (url === 'https://howlongtobeat.com/') return textResponse(200, '<html></html>');
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await expect(service.getAuth()).rejects.toThrow(/token/i);
  });
});

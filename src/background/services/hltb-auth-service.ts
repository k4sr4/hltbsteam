/**
 * HLTB Auth Service
 *
 * HowLongToBeat's search API requires a short-lived auth token obtained from
 * GET /api/{endpoint}/init?t={now}, which returns { token, hpKey, hpVal }.
 * The token is bound to the caller's IP + User-Agent, and the hpKey/hpVal
 * honeypot pair must be echoed back both as headers and inside the POST body.
 *
 * The endpoint name itself ("bleed" as of July 2026) rotates periodically.
 * A 404 on init means the name rotated: we rediscover it by scanning the
 * site's Next.js chunk bundles for the "/api/<name>/init?t=" fetch call.
 * Any other init failure (403/429/500/timeout) is surfaced as an HLTBAuthError
 * and NOT treated as rotation, so a transient blip never triggers the scan.
 *
 * The token is cached in memory and in chrome.storage.session (memory-backed,
 * cleared on browser close, not exposed to content scripts) so it survives
 * service-worker restarts without persisting the caller's IP/UA to disk.
 */

/** Non-retriable auth/init failure (bad status, no token, discovery failed). */
export class HLTBAuthError extends Error {
  public readonly statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'HLTBAuthError';
    this.statusCode = statusCode;
  }
}

export interface HLTBAuth {
  token: string;
  hpKey: string | null;
  hpVal: string | null;
  endpoint: string;
  fetchedAt: number;
}

const BASE_URL = 'https://howlongtobeat.com';
const DEFAULT_ENDPOINT = 'bleed';
const STORAGE_KEY = 'hltb_auth';
const ENDPOINT_NAME_PATTERN = /^[a-z0-9_-]{2,32}$/i;
// Proactive refresh window; expired tokens are also handled reactively via 403 retry
const SOFT_TTL_MS = 10 * 60 * 1000;
const MAX_CHUNKS_TO_SCAN = 40;
// Per-fetch ceiling so a stalled connection can never pin refreshPromise
const FETCH_TIMEOUT_MS = 8000;

export class HLTBAuthService {
  private auth: HLTBAuth | null = null;
  private refreshPromise: Promise<HLTBAuth> | null = null;

  /**
   * Get a usable auth bundle. Refreshes when missing or stale.
   * @param forceRefresh  discard any cached token (use after a 403)
   * @param rediscoverEndpoint  re-scan HLTB's JS for the endpoint name (use after a 404)
   */
  async getAuth(forceRefresh = false, rediscoverEndpoint = false): Promise<HLTBAuth> {
    if (!forceRefresh && !rediscoverEndpoint) {
      if (this.isFresh(this.auth)) {
        return this.auth!;
      }

      const stored = await this.loadFromStorage();
      if (this.isFresh(stored)) {
        this.auth = stored;
        return stored!;
      }
    }

    // Deduplicate concurrent refreshes
    if (!this.refreshPromise) {
      this.refreshPromise = this.refresh(rediscoverEndpoint).finally(() => {
        this.refreshPromise = null;
      });
    }

    return this.refreshPromise;
  }

  /** Current endpoint name without triggering any network activity. */
  getKnownEndpoint(): string {
    return this.auth?.endpoint || DEFAULT_ENDPOINT;
  }

  /** Reset in-memory state (used by tests and cache clearing). */
  reset(): void {
    this.auth = null;
    this.refreshPromise = null;
  }

  private isFresh(auth: HLTBAuth | null | undefined): boolean {
    return !!auth?.token && Date.now() - auth.fetchedAt < SOFT_TTL_MS;
  }

  private async refresh(rediscoverEndpoint: boolean): Promise<HLTBAuth> {
    let endpoint = rediscoverEndpoint
      ? await this.discoverEndpoint()
      : this.auth?.endpoint || (await this.loadFromStorage())?.endpoint || DEFAULT_ENDPOINT;

    let response = await this.fetchInit(endpoint);

    // A 404 means HLTB rotated the endpoint name — rediscover once and retry.
    // Any other failure is transient/authz and must NOT trigger the heavy scan.
    if (response.status === 404 && !rediscoverEndpoint) {
      console.warn(`[HLTB Auth] init 404 on /api/${endpoint}/, rediscovering endpoint`);
      const discovered = await this.discoverEndpoint();
      if (discovered !== endpoint) {
        endpoint = discovered;
        response = await this.fetchInit(endpoint);
      }
    }

    if (!response.ok) {
      throw new HLTBAuthError(`HLTB auth init failed with status ${response.status}`, response.status);
    }

    const body = await response.json();
    if (!body || typeof body.token !== 'string' || body.token.length === 0) {
      throw new HLTBAuthError('HLTB auth init returned no token');
    }

    const auth: HLTBAuth = {
      token: body.token,
      hpKey: typeof body.hpKey === 'string' ? body.hpKey : null,
      hpVal: typeof body.hpVal === 'string' ? body.hpVal : null,
      endpoint,
      fetchedAt: Date.now()
    };

    this.auth = auth;
    await this.saveToStorage(auth);
    console.log('[HLTB Auth] Token refreshed for endpoint:', endpoint);
    return auth;
  }

  private fetchInit(endpoint: string): Promise<Response> {
    return this.fetchWithTimeout(`${BASE_URL}/api/${endpoint}/init?t=${Date.now()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
  }

  /**
   * Scan the HLTB homepage's script bundles for the current search endpoint.
   * The client code contains: fetch(`/api/<name>/init?t=${Date.now()}`)
   * Resolves on the FIRST chunk that yields a valid name and aborts the rest.
   */
  private async discoverEndpoint(): Promise<string> {
    const homeResponse = await this.fetchWithTimeout(`${BASE_URL}/`, {
      headers: { 'Accept': 'text/html' }
    });

    if (!homeResponse.ok) {
      throw new HLTBAuthError(`HLTB homepage fetch failed with status ${homeResponse.status}`, homeResponse.status);
    }

    const html = await homeResponse.text();
    const initPattern = /\/api\/([a-z0-9_-]{2,32})\/init\?t=/i;

    const scriptUrls: string[] = [];
    const srcPattern = /src="(\/_next\/[^"]+?\.js)"/g;
    let match: RegExpExecArray | null;
    while ((match = srcPattern.exec(html)) !== null && scriptUrls.length < MAX_CHUNKS_TO_SCAN) {
      if (!scriptUrls.includes(match[1])) {
        scriptUrls.push(match[1]);
      }
    }

    if (scriptUrls.length === 0) {
      throw new HLTBAuthError('Could not discover HLTB API endpoint: no script bundles found');
    }

    return new Promise<string>((resolve, reject) => {
      const controller = new AbortController();
      let remaining = scriptUrls.length;
      let settled = false;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        controller.abort();
        fn();
      };

      for (const src of scriptUrls) {
        this.fetchWithTimeout(`${BASE_URL}${src}`, {}, controller.signal)
          .then(async (res) => {
            if (!res.ok) throw new Error(`chunk ${res.status}`);
            const text = await res.text();
            const found = initPattern.exec(text);
            if (found && ENDPOINT_NAME_PATTERN.test(found[1])) {
              console.log('[HLTB Auth] Discovered endpoint:', found[1]);
              finish(() => resolve(found[1]));
            }
          })
          .catch(() => { /* ignore individual chunk failures/aborts */ })
          .finally(() => {
            if (--remaining === 0) {
              finish(() => reject(new HLTBAuthError('Could not discover HLTB API endpoint from site bundles')));
            }
          });
      }
    });
  }

  /**
   * fetch() with an internal timeout so a stalled response can never leave
   * refreshPromise pending. An external signal (from discovery) is chained in.
   */
  private async fetchWithTimeout(url: string, init: RequestInit = {}, externalSignal?: AbortSignal): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new HLTBAuthError(`HLTB auth request timed out or aborted: ${url}`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }

  private storageArea(): chrome.storage.StorageArea | null {
    // storage.session: memory-backed, cleared on browser close, TRUSTED_CONTEXTS
    // only — a better fit than storage.local for an ephemeral IP/UA-bearing token.
    if (typeof chrome === 'undefined' || !chrome.storage) return null;
    return (chrome.storage as any).session || chrome.storage.local || null;
  }

  private async loadFromStorage(): Promise<HLTBAuth | null> {
    try {
      const area = this.storageArea();
      if (!area) return null;
      const stored = await area.get(STORAGE_KEY);
      const auth = stored?.[STORAGE_KEY];
      if (auth && typeof auth.token === 'string' && ENDPOINT_NAME_PATTERN.test(auth.endpoint || '')) {
        return auth as HLTBAuth;
      }
    } catch {
      // Storage unavailable (e.g. tests) — treat as cache miss
    }
    return null;
  }

  private async saveToStorage(auth: HLTBAuth): Promise<void> {
    try {
      await this.storageArea()?.set({ [STORAGE_KEY]: auth });
    } catch {
      // Non-fatal: worst case we re-init after the next worker restart
    }
  }
}

export const hltbAuthService = new HLTBAuthService();

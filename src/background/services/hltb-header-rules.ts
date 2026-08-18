/**
 * HLTB Header Rules
 *
 * HowLongToBeat's API returns 403 for any request without a Referer header,
 * and service workers cannot set Referer via fetch() (forbidden header).
 * A declarativeNetRequest session rule sets Referer/Origin on our requests
 * to howlongtobeat.com/api/* instead.
 *
 * The rule is scoped to tabId -1 (TAB_ID_NONE) so it ONLY rewrites headers on
 * requests that originate from the extension's service worker — never on
 * fetch/XHR issued by web-page JavaScript. Without that scope the rule would
 * also spoof Referer/Origin for requests initiated by Steam pages (the
 * extension holds host permissions for both Steam and HLTB), letting hostile
 * Steam-origin script forge same-origin HLTB API calls from the user's IP.
 */

const RULE_ID = 91001;
// chrome.tabs.TAB_ID_NONE — requests not associated with any tab (i.e. the
// service worker's own fetches). Only valid in session-scoped rules.
const TAB_ID_NONE = -1;

let installPromise: Promise<boolean> | null = null;

/**
 * Idempotently install the header rule. Never rejects; returns whether the
 * rule is active. Failed installs are retried on the next call.
 */
export function ensureHltbHeaderRules(): Promise<boolean> {
  if (!installPromise) {
    installPromise = installRules().catch((error) => {
      console.warn('[HLTB] Failed to install header rules:', error);
      installPromise = null;
      return false;
    });
  }
  return installPromise;
}

/** Reset memoized state (used by tests). */
export function resetHltbHeaderRules(): void {
  installPromise = null;
}

async function installRules(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest?.updateSessionRules) {
    return false;
  }

  const rule = {
    id: RULE_ID,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [
        { header: 'Referer', operation: 'set', value: 'https://howlongtobeat.com/' },
        { header: 'Origin', operation: 'set', value: 'https://howlongtobeat.com' }
      ]
    },
    condition: {
      urlFilter: '||howlongtobeat.com/api/',
      resourceTypes: ['xmlhttprequest'],
      // Restrict to the extension's own background requests, not Steam-page fetches
      tabIds: [TAB_ID_NONE]
    }
  } as unknown as chrome.declarativeNetRequest.Rule;

  // Session rules survive service-worker restarts within a browser session,
  // so remove-then-add atomically to avoid duplicate-id errors.
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [RULE_ID],
    addRules: [rule]
  });

  return true;
}

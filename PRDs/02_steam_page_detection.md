name: "Steam Page Detection"
description: |

## Purpose
Implement robust detection of Steam game pages, extract game information accurately, and handle Steam's dynamic content loading to ensure the extension activates on the correct pages.

## Core Principles
1. **Context is King**: Include Steam DOM structure patterns and selectors
2. **Validation Loops**: Test on various Steam page types and navigation patterns
3. **Information Dense**: Use exact Steam HTML selectors and attributes
4. **Progressive Success**: Basic detection first, then handle edge cases
5. **Performance First**: Minimize DOM queries and observer overhead

---

## Goal
Create a content script that reliably detects Steam game pages, extracts game metadata (title, app ID), and handles Steam's single-page application navigation patterns.

## Why
- **User Experience**: Extension should only activate on relevant pages
- **Performance**: Avoid unnecessary processing on non-game pages
- **Accuracy**: Correct game identification is critical for HLTB matching
- **Reliability**: Must handle Steam's dynamic content updates

## What
Page detection system providing:
- Steam game page identification
- Game title extraction with fallbacks
- Steam App ID extraction
- Dynamic navigation detection
- Page type classification
- Store vs Community page handling
- Wishlist and bundle detection
- DLC vs base game differentiation

### Success Criteria
- [ ] Detects 100% of Steam game pages
- [ ] Zero false positives on non-game pages
- [ ] Extracts correct game title 95%+ of the time
- [ ] Handles dynamic navigation without reload
- [ ] Works on both store and community pages
- [ ] Identifies DLC vs base games
- [ ] Performance impact < 10ms
- [ ] No memory leaks from observers
- [ ] Works with Steam's A/B testing layouts
- [ ] Handles logged out users

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Critical Documentation
- url: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
  why: For detecting Steam's dynamic content changes
  sections: Performance considerations, disconnect patterns

- url: https://store.steampowered.com/app/730/
  why: Example Steam store page structure
  action: Inspect DOM structure for selectors

- url: https://steamcommunity.com/app/730
  why: Example Steam community page structure
  action: Compare with store page structure

- file: C:\steamhltb\HLTB_Steam_Extension_Design.md
  lines: 64-72, 410-424
  why: Content script requirements and game title extraction

- url: https://developer.chrome.com/docs/extensions/mv3/content_scripts/
  why: Content script best practices
  sections: Isolated worlds, script injection timing

- url: https://steamdb.info/
  why: Understanding Steam App ID patterns
  action: Research app ID formats and edge cases
```

### Steam Page URL Patterns
```javascript
// Store pages
https://store.steampowered.com/app/{appId}/{gameName}/
https://store.steampowered.com/app/{appId}/

// Community pages
https://steamcommunity.com/app/{appId}
https://steamcommunity.com/app/{appId}/discussions/

// Special pages (should be ignored)
https://store.steampowered.com/bundle/{bundleId}/
https://store.steampowered.com/sub/{subId}/
https://store.steampowered.com/dlc/{appId}/
https://store.steampowered.com/franchise/{franchiseName}/

// Wishlist (potential future feature)
https://store.steampowered.com/wishlist/
```

### Known Steam DOM Selectors
```javascript
// Game title selectors (in order of reliability)
meta[property="og:title"]                    // Most reliable
.apphub_AppName                             // Store page title
.apphub_HeaderStandardTop .apphub_AppName   // Community page title
#appHubAppName                               // Alternative selector
h1[itemprop="name"]                         // Structured data
title                                        // Fallback: page title

// App ID extraction
link[rel="canonical"]                       // href contains /app/{id}/
meta[property="og:url"]                     // Contains app ID
.apphub_AppIcon img                         // src contains /apps/{id}/
div[data-appid]                             // Direct app ID attribute

// Page type indicators
.game_page_background                       // Store game page
.apphub_Header                              // Community page
.bundle_page_background                     // Bundle (not a game)
.dlc_page_background                        // DLC page
.franchise_page_background                  // Franchise page

// Dynamic content containers
#game_highlights                            // Main content area
.apphub_Content                             // Community content
#tabletGrid                                 // Store page grid
```

### Known Gotchas & Edge Cases
```typescript
// CRITICAL: Steam uses Prototype.js which modifies native objects
// Test carefully for conflicts with modern JavaScript

// CRITICAL: Steam loads content dynamically on navigation
// URL changes without page reload - must use MutationObserver

// CRITICAL: Game titles may contain special characters
// "Tom Clancy's Rainbow Six® Siege" needs normalization

// CRITICAL: Some pages have multiple app IDs
// DLC pages reference both DLC and base game IDs

// CRITICAL: Steam A/B tests different layouts
// Selectors may vary between users

// CRITICAL: Community pages load asynchronously
// Title may not be immediately available

// CRITICAL: Free games may have different structure
// "Free to Play" badge changes layout

// CRITICAL: Adult content warning pages
// Actual game content behind age gate

// CRITICAL: Regional restrictions
// "Not available in your region" pages
```

## Implementation Blueprint

### Task 1: Core Detection Module
```typescript
// src/content/detectors/steam-detector.ts
interface GameInfo {
  appId: string;
  title: string;
  type: 'store' | 'community';
  isDLC: boolean;
  isBundle: boolean;
}

export class SteamPageDetector {
  private static readonly STORE_GAME_URL_PATTERN = /^https:\/\/store\.steampowered\.com\/app\/(\d+)/;
  private static readonly COMMUNITY_URL_PATTERN = /^https:\/\/steamcommunity\.com\/app\/(\d+)/;

  static isGamePage(): boolean {
    const url = window.location.href;
    return !!(
      this.STORE_GAME_URL_PATTERN.test(url) ||
      this.COMMUNITY_URL_PATTERN.test(url)
    );
  }

  static extractAppId(): string | null {
    // Method 1: URL parsing
    const url = window.location.href;
    const storeMatch = url.match(this.STORE_GAME_URL_PATTERN);
    if (storeMatch) return storeMatch[1];

    const communityMatch = url.match(this.COMMUNITY_URL_PATTERN);
    if (communityMatch) return communityMatch[1];

    // Method 2: Canonical link
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      const href = canonical.getAttribute('href');
      const match = href?.match(/\/app\/(\d+)/);
      if (match) return match[1];
    }

    // Method 3: Data attribute
    const appElement = document.querySelector('[data-appid]');
    if (appElement) {
      return appElement.getAttribute('data-appid');
    }

    return null;
  }

  static extractGameTitle(): string | null {
    // Priority order for title extraction
    const strategies = [
      // 1. Open Graph meta tag (most reliable)
      () => {
        const ogTitle = document.querySelector('meta[property="og:title"]');
        return ogTitle?.getAttribute('content') || null;
      },

      // 2. App hub name (store pages)
      () => {
        const appName = document.querySelector('.apphub_AppName');
        return appName?.textContent?.trim() || null;
      },

      // 3. Community page header
      () => {
        const communityTitle = document.querySelector('.apphub_HeaderStandardTop .apphub_AppName');
        return communityTitle?.textContent?.trim() || null;
      },

      // 4. Alternative app hub ID
      () => {
        const altName = document.querySelector('#appHubAppName');
        return altName?.textContent?.trim() || null;
      },

      // 5. Structured data
      () => {
        const itemProp = document.querySelector('h1[itemprop="name"]');
        return itemProp?.textContent?.trim() || null;
      },

      // 6. Page title fallback
      () => {
        const title = document.title;
        if (title.includes(' on Steam')) {
          return title.split(' on Steam')[0].trim();
        }
        if (title.includes(' - Steam Community')) {
          return title.split(' - Steam Community')[0].trim();
        }
        return null;
      }
    ];

    for (const strategy of strategies) {
      const title = strategy();
      if (title) {
        // Clean up title
        return this.normalizeTitle(title);
      }
    }

    return null;
  }

  static normalizeTitle(title: string): string {
    return title
      .replace(/[®™©]/g, '')           // Remove trademark symbols
      .replace(/\s+/g, ' ')             // Normalize whitespace
      .replace(/^Save \d+% on /, '')   // Remove sale text
      .replace(/ on Steam$/, '')        // Remove suffix
      .trim();
  }

  static detectPageType(): 'store' | 'community' | null {
    if (window.location.hostname === 'store.steampowered.com') {
      return 'store';
    }
    if (window.location.hostname === 'steamcommunity.com') {
      return 'community';
    }
    return null;
  }

  static isDLCPage(): boolean {
    // Check URL
    if (window.location.pathname.includes('/dlc/')) {
      return true;
    }

    // Check page class
    if (document.querySelector('.dlc_page_background')) {
      return true;
    }

    // Check breadcrumbs
    const breadcrumb = document.querySelector('.breadcrumbs');
    if (breadcrumb?.textContent?.includes('Downloadable Content')) {
      return true;
    }

    return false;
  }

  static isBundlePage(): boolean {
    return !!(
      window.location.pathname.includes('/bundle/') ||
      document.querySelector('.bundle_page_background')
    );
  }

  static async getGameInfo(): Promise<GameInfo | null> {
    if (!this.isGamePage()) {
      return null;
    }

    const appId = this.extractAppId();
    const title = this.extractGameTitle();

    if (!appId || !title) {
      return null;
    }

    return {
      appId,
      title,
      type: this.detectPageType() || 'store',
      isDLC: this.isDLCPage(),
      isBundle: this.isBundlePage()
    };
  }
}
```

### Task 2: Dynamic Navigation Handler
```typescript
// src/content/navigation-observer.ts
export class NavigationObserver {
  private observer: MutationObserver | null = null;
  private lastUrl: string = '';
  private callbacks: Set<(url: string) => void> = new Set();

  start() {
    this.lastUrl = window.location.href;

    // Watch for URL changes
    this.observer = new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== this.lastUrl) {
        this.lastUrl = currentUrl;
        this.notifyCallbacks(currentUrl);
      }
    });

    // Observe with minimal performance impact
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });

    // Also listen for popstate (back/forward navigation)
    window.addEventListener('popstate', () => {
      if (window.location.href !== this.lastUrl) {
        this.lastUrl = window.location.href;
        this.notifyCallbacks(window.location.href);
      }
    });
  }

  stop() {
    this.observer?.disconnect();
    this.observer = null;
    this.callbacks.clear();
  }

  onNavigate(callback: (url: string) => void) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyCallbacks(url: string) {
    this.callbacks.forEach(callback => {
      try {
        callback(url);
      } catch (error) {
        console.error('Navigation callback error:', error);
      }
    });
  }
}
```

### Task 3: Wait for Element Utility
```typescript
// src/content/utils/dom-utils.ts
export async function waitForElement(
  selector: string,
  timeout: number = 5000
): Promise<Element | null> {
  // Check if already exists
  const existing = document.querySelector(selector);
  if (existing) return existing;

  return new Promise((resolve) => {
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Timeout
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

export function onElementAdded(
  selector: string,
  callback: (element: Element) => void
): () => void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.matches(selector)) {
              callback(element);
            }
            element.querySelectorAll(selector).forEach(callback);
          }
        });
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  return () => observer.disconnect();
}
```

### Task 4: Integration with Content Script
```typescript
// src/content/content.ts (enhanced)
import { SteamPageDetector } from './detectors/steam-detector';
import { NavigationObserver } from './navigation-observer';
import { waitForElement } from './utils/dom-utils';

class HLTBExtension {
  private navigationObserver: NavigationObserver;
  private currentGameInfo: GameInfo | null = null;

  constructor() {
    this.navigationObserver = new NavigationObserver();
  }

  async init() {
    console.log('[HLTB] Initializing extension...');

    // Start navigation observer
    this.navigationObserver.start();
    this.navigationObserver.onNavigate((url) => {
      console.log('[HLTB] Navigation detected:', url);
      this.handlePageChange();
    });

    // Initial page check
    await this.handlePageChange();
  }

  private async handlePageChange() {
    // Clear previous state
    this.cleanup();

    // Check if game page
    const gameInfo = await SteamPageDetector.getGameInfo();

    if (!gameInfo) {
      console.log('[HLTB] Not a game page, skipping');
      return;
    }

    console.log('[HLTB] Game detected:', gameInfo);
    this.currentGameInfo = gameInfo;

    // Skip DLC and bundles for now
    if (gameInfo.isDLC || gameInfo.isBundle) {
      console.log('[HLTB] DLC or bundle page, skipping');
      return;
    }

    // Wait for page to fully load if needed
    if (gameInfo.type === 'community') {
      await waitForElement('.apphub_AppName', 3000);
    }

    // Process game page
    await this.processGamePage(gameInfo);
  }

  private async processGamePage(gameInfo: GameInfo) {
    // Check if extension is enabled
    const { enabled } = await chrome.storage.local.get(['enabled']);
    if (!enabled) {
      console.log('[HLTB] Extension disabled');
      return;
    }

    // Send message to background for HLTB data
    chrome.runtime.sendMessage(
      {
        action: 'fetchHLTB',
        gameTitle: gameInfo.title,
        appId: gameInfo.appId
      },
      (response) => {
        if (response?.success) {
          console.log('[HLTB] Data received:', response.data);
          // UI injection will happen in next PRD
        }
      }
    );
  }

  private cleanup() {
    // Remove any injected UI elements
    document.querySelectorAll('.hltb-container').forEach(el => el.remove());
    this.currentGameInfo = null;
  }

  destroy() {
    this.navigationObserver.stop();
    this.cleanup();
  }
}

// Initialize extension
const extension = new HLTBExtension();
extension.init().catch(console.error);

// Cleanup on unload
window.addEventListener('unload', () => {
  extension.destroy();
});
```

## Validation Loop

### Level 1: Unit Tests
```typescript
// tests/steam-detector.test.ts
describe('SteamPageDetector', () => {
  it('should detect store game pages', () => {
    window.location.href = 'https://store.steampowered.com/app/730/Counter-Strike_2/';
    expect(SteamPageDetector.isGamePage()).toBe(true);
  });

  it('should detect community pages', () => {
    window.location.href = 'https://steamcommunity.com/app/730';
    expect(SteamPageDetector.isGamePage()).toBe(true);
  });

  it('should not detect bundle pages', () => {
    window.location.href = 'https://store.steampowered.com/bundle/123/';
    expect(SteamPageDetector.isGamePage()).toBe(false);
  });

  it('should extract app ID from URL', () => {
    window.location.href = 'https://store.steampowered.com/app/730/';
    expect(SteamPageDetector.extractAppId()).toBe('730');
  });

  it('should normalize game titles', () => {
    const title = 'Tom Clancy\'s Rainbow Six® Siege';
    expect(SteamPageDetector.normalizeTitle(title))
      .toBe('Tom Clancy\'s Rainbow Six Siege');
  });
});
```

### Level 2: Integration Tests
```bash
# Test on various Steam pages
TEST_URLS=(
  "https://store.steampowered.com/app/730/"          # CS2
  "https://store.steampowered.com/app/570/"          # Dota 2
  "https://store.steampowered.com/app/1245620/"      # Elden Ring
  "https://steamcommunity.com/app/730"               # CS2 Community
  "https://store.steampowered.com/bundle/232/"       # Valve Complete Bundle
  "https://store.steampowered.com/dlc/1245620/"      # Elden Ring DLC
)

for url in "${TEST_URLS[@]}"; do
  echo "Testing: $url"
  # Load extension and verify detection
done
```

### Level 3: Performance Tests
```typescript
// tests/performance.test.ts
describe('Performance', () => {
  it('should detect page in < 10ms', () => {
    const start = performance.now();
    SteamPageDetector.isGamePage();
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(10);
  });

  it('should not leak memory with observers', async () => {
    const initialMemory = performance.memory.usedJSHeapSize;

    // Create and destroy multiple observers
    for (let i = 0; i < 100; i++) {
      const observer = new NavigationObserver();
      observer.start();
      observer.stop();
    }

    // Force garbage collection if available
    if (global.gc) global.gc();

    await new Promise(resolve => setTimeout(resolve, 100));
    const finalMemory = performance.memory.usedJSHeapSize;

    // Should not leak more than 1MB
    expect(finalMemory - initialMemory).toBeLessThan(1024 * 1024);
  });
});
```

## Agent Task Assignments

### For `general-purpose` Agent:
- Implement core detection logic
- Create navigation observer
- Write DOM utility functions
- Handle edge cases

### For `component-architect` Agent:
- Design detector class architecture
- Plan state management for navigation
- Define interfaces for game info
- Structure content script organization

### For `ux-designer` Agent (Next PRDs):
- Identify optimal injection points
- Plan loading state indicators
- Design error state displays

### For `test-strategy-architect` Agent:
- Create comprehensive test suite
- Design page navigation tests
- Plan performance benchmarks

## Anti-Patterns to Avoid
- ❌ Don't use setInterval for checking URL changes
- ❌ Don't observe document.body before it exists
- ❌ Don't create multiple MutationObservers for same purpose
- ❌ Don't forget to disconnect observers
- ❌ Don't use querySelector excessively
- ❌ Don't assume elements exist immediately
- ❌ Don't hardcode Steam's HTML structure
- ❌ Don't ignore memory cleanup
- ❌ Don't block on element waiting
- ❌ Don't parse HTML with regex

## Final Validation Checklist
- [ ] Detects all Steam game pages correctly
- [ ] Extracts app ID from multiple sources
- [ ] Extracts game title with fallbacks
- [ ] Handles dynamic navigation
- [ ] Differentiates DLC from base games
- [ ] No false positives on non-game pages
- [ ] Performance impact < 10ms
- [ ] No memory leaks
- [ ] Works when logged out
- [ ] Handles all Steam languages
- [ ] Cleans up on page navigation
- [ ] Tests pass with 100% coverage

---

## Confidence Score: 8/10
High confidence due to:
- Well-understood Steam DOM structure
- Clear URL patterns for detection
- Multiple fallback strategies

Risk factors:
- Steam layout A/B testing
- Dynamic content loading timing
- Potential Steam structure changes
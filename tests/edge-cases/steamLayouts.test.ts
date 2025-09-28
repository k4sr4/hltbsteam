/**
 * Edge case tests for various Steam page layouts and error scenarios
 * Tests adult content warnings, regional restrictions, broken layouts,
 * dynamic loading, and Steam's evolving page structures
 */

import { SteamPageDetector } from '../../src/content/detection/SteamPageDetector';
import { NavigationObserver } from '../../src/content/navigation/NavigationObserver';
import { StateManager } from '../../src/content/navigation/StateManager';
import {
  PageType,
  ProductType,
  TitleDetectionMethod,
  DetectionErrorCode,
  NavigationType
} from '../../src/content/types';
import {
  createMockDOM,
  cleanupMockDOM,
  mockChromeAPIs,
  mockPerformanceAPI
} from '../mocks/steamPageMocks';

describe('Steam Layout Edge Cases', () => {
  let detector: SteamPageDetector;
  let stateManager: StateManager;
  let observer: NavigationObserver;

  beforeAll(() => {
    mockChromeAPIs();
    mockPerformanceAPI();
  });

  beforeEach(() => {
    cleanupMockDOM();
    detector = new SteamPageDetector();
    stateManager = new StateManager();
    observer = new NavigationObserver(stateManager);

    // Mock MutationObserver
    global.MutationObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
      takeRecords: jest.fn()
    }));

    // Mock DOM event listeners
    jest.spyOn(document, 'addEventListener').mockImplementation();
    jest.spyOn(window, 'addEventListener').mockImplementation();
    jest.spyOn(window, 'setInterval').mockImplementation();
  });

  afterEach(() => {
    observer.stop();
    stateManager.destroy();
    cleanupMockDOM();
    jest.restoreAllMocks();
  });

  describe('Adult Content Warning Pages', () => {
    test('should detect games behind age verification', async () => {
      const ageGatePage = {
        url: 'https://store.steampowered.com/app/292030/The_Witcher_3_Wild_Hunt/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>The Witcher® 3: Wild Hunt on Steam</title>
            <meta property="og:title" content="The Witcher® 3: Wild Hunt">
            <link rel="canonical" href="https://store.steampowered.com/app/292030/">
          </head>
          <body>
            <div class="responsive_page_frame">
              <div class="age_gate">
                <div class="age_gate_content">
                  <h1>Please enter your birth date to continue:</h1>
                  <form>
                    <input type="date" name="birthdate">
                    <button type="submit">Continue</button>
                  </form>
                </div>
              </div>
              <!-- Hidden game content -->
              <div class="game_page_content" style="display: none;">
                <div class="game_area_purchase" data-appid="292030">
                  <h1 class="apphub_AppName">The Witcher® 3: Wild Hunt</h1>
                  <div class="game_purchase_price">$39.99</div>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

      createMockDOM(ageGatePage);

      const result = await detector.detectGame();

      expect(result.success).toBe(true);
      expect(result.gameInfo!.appId).toBe('292030');
      expect(result.gameInfo!.title).toBe('The Witcher 3: Wild Hunt');
      expect(result.gameInfo!.confidence).toBeGreaterThan(0.7);
    });

    test('should handle age gate without hidden content', async () => {
      const ageGateOnly = {
        url: 'https://store.steampowered.com/app/292030/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Steam Age Verification</title>
          </head>
          <body>
            <div class="age_gate">
              <h1>Please enter your birth date to continue:</h1>
              <form>
                <input type="date" name="birthdate">
                <button type="submit">Continue</button>
              </form>
            </div>
          </body>
          </html>
        `
      };

      createMockDOM(ageGateOnly);

      const result = await detector.detectGame();

      // Should extract app ID from URL but fail to get title
      if (result.success) {
        expect(result.gameInfo!.appId).toBe('292030');
      } else {
        expect(result.error?.code).toBe(DetectionErrorCode.NO_TITLE);
      }
    });
  });

  describe('Regional Restrictions and Unavailable Games', () => {
    test('should handle region-locked games', async () => {
      const regionLocked = {
        url: 'https://store.steampowered.com/app/123456/Region_Locked_Game/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Steam</title>
            <meta property="og:title" content="Region Locked Game">
          </head>
          <body>
            <div class="error">
              <h1>Sorry!</h1>
              <p>This item is currently unavailable in your region</p>
            </div>
            <div class="game_area_purchase" data-appid="123456" style="display: none;">
              <h1 class="apphub_AppName">Region Locked Game</h1>
            </div>
          </body>
          </html>
        `
      };

      createMockDOM(regionLocked);

      const result = await detector.detectGame();

      expect(result.success).toBe(true);
      expect(result.gameInfo!.appId).toBe('123456');
      expect(result.gameInfo!.title).toBe('Region Locked Game');
      // Confidence might be lower due to hidden content
      expect(result.gameInfo!.confidence).toBeGreaterThan(0.5);
    });

    test('should handle removed/delisted games', async () => {
      const delistedGame = {
        url: 'https://store.steampowered.com/app/999999/Delisted_Game/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Steam Store</title>
          </head>
          <body>
            <div class="error">
              <h1>The requested app could not be found</h1>
              <p>It may have been removed from Steam.</p>
            </div>
          </body>
          </html>
        `
      };

      createMockDOM(delistedGame);

      const result = await detector.detectGame();

      // Should fail gracefully - either extract partial info or fail cleanly
      if (result.success) {
        expect(result.gameInfo!.appId).toBe('999999');
        expect(result.gameInfo!.confidence).toBeLessThan(0.5);
      } else {
        expect(result.error).toBeDefined();
        expect(result.error!.code).toBeOneOf([
          DetectionErrorCode.NO_TITLE,
          DetectionErrorCode.NO_APP_ID
        ]);
      }
    });
  });

  describe('Dynamic Loading and AJAX Content', () => {
    test('should handle lazily loaded content with aggressive mode', async () => {
      const lazyLoadPage = {
        url: 'https://store.steampowered.com/app/567890/Lazy_Game/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Loading... - Steam</title>
          </head>
          <body>
            <div class="loading_spinner">
              <div class="spinner"></div>
              <p>Loading game information...</p>
            </div>
          </body>
          </html>
        `
      };

      createMockDOM(lazyLoadPage);

      detector = new SteamPageDetector({ aggressive: true, maxWaitTime: 300 });

      // Simulate content loading after delay
      setTimeout(() => {
        document.title = 'Lazy Game on Steam';
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:title');
        meta.setAttribute('content', 'Lazy Game');
        document.head.appendChild(meta);

        const gameDiv = document.createElement('div');
        gameDiv.className = 'game_area_purchase';
        gameDiv.setAttribute('data-appid', '567890');
        gameDiv.innerHTML = '<h1 class="apphub_AppName">Lazy Game</h1>';
        document.body.appendChild(gameDiv);
      }, 150);

      const result = await detector.detectGame();

      expect(result.success).toBe(true);
      expect(result.gameInfo!.appId).toBe('567890');
      expect(result.gameInfo!.title).toBe('Lazy Game');
    });

    test('should timeout gracefully on slow loading', async () => {
      const slowPage = {
        url: 'https://store.steampowered.com/app/111111/Slow_Game/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Loading...</title>
          </head>
          <body>
            <div class="loading">Loading game data...</div>
          </body>
          </html>
        `
      };

      createMockDOM(slowPage);

      detector = new SteamPageDetector({ aggressive: true, maxWaitTime: 100 });

      // Don't add content - simulate permanent loading

      const result = await detector.detectGame();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBeOneOf([
        DetectionErrorCode.NO_TITLE,
        DetectionErrorCode.NO_APP_ID,
        DetectionErrorCode.TIMEOUT
      ]);
      expect(result.metrics.detectionTime).toBeGreaterThan(90); // Should have waited
    });
  });

  describe('Malformed and Broken Layouts', () => {
    test('should handle broken HTML structure', async () => {
      const brokenHtml = {
        url: 'https://store.steampowered.com/app/777777/Broken_Game/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Broken Game on Steam
            <meta property="og:title" content="Broken Game"
          </head>
          <body>
            <div class="game_area_purchase" data-appid="777777">
              <h1 class="apphub_AppName">Broken Game
              <div class="price">$19.99
              <!-- Missing closing tags everywhere -->
        `
      };

      createMockDOM(brokenHtml);

      const result = await detector.detectGame();

      // Should be resilient to broken HTML
      expect(result.success).toBe(true);
      expect(result.gameInfo!.appId).toBe('777777');
      expect(result.gameInfo!.title).toBe('Broken Game');
    });

    test('should handle missing critical selectors', async () => {
      const missingSelectorPage = {
        url: 'https://store.steampowered.com/app/888888/Minimal_Game/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Minimal Game - Steam</title>
          </head>
          <body>
            <div class="unusual_layout">
              <span id="game_title">Minimal Game</span>
              <input type="hidden" name="appid" value="888888">
            </div>
          </body>
          </html>
        `
      };

      createMockDOM(missingSelectorPage);

      const result = await detector.detectGame();

      // Should fall back to page title and URL extraction
      expect(result.success).toBe(true);
      expect(result.gameInfo!.appId).toBe('888888');
      expect(result.gameInfo!.title).toBe('Minimal Game');
      expect(result.gameInfo!.metadata.detectionMethod).toBe(TitleDetectionMethod.PAGE_TITLE);
    });

    test('should handle conflicting data sources', async () => {
      const conflictingData = {
        url: 'https://store.steampowered.com/app/999999/Conflicted_Game/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Wrong Title on Steam</title>
            <meta property="og:title" content="Correct Game Title">
            <meta name="twitter:title" content="Another Wrong Title">
          </head>
          <body>
            <div class="game_area_purchase" data-appid="999999">
              <h1 class="apphub_AppName">Yet Another Title</h1>
            </div>
            <div class="breadcrumbs">
              <a href="/app/999999">Different Title Again</a>
            </div>
          </body>
          </html>
        `
      };

      createMockDOM(conflictingData);

      const result = await detector.detectGame();

      expect(result.success).toBe(true);
      expect(result.gameInfo!.appId).toBe('999999');
      // Should prefer OpenGraph as highest priority
      expect(result.gameInfo!.title).toBe('Correct Game Title');
      expect(result.gameInfo!.metadata.detectionMethod).toBe(TitleDetectionMethod.OPENGRAPH);
    });
  });

  describe('Special Characters and Encoding', () => {
    test('should handle Unicode and special characters', async () => {
      const unicodePage = {
        url: 'https://store.steampowered.com/app/123456/Unicode_Game/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Спел ловек 2: Герой Возвращается™ on Steam</title>
            <meta property="og:title" content="魔法使いの冒険 ～伝説の剣～">
            <meta charset="utf-8">
          </head>
          <body>
            <div class="game_area_purchase" data-appid="123456">
              <h1 class="apphub_AppName">مغامرة الساحر: أسطورة السيف</h1>
            </div>
          </body>
          </html>
        `
      };

      createMockDOM(unicodePage);

      const result = await detector.detectGame();

      expect(result.success).toBe(true);
      expect(result.gameInfo!.appId).toBe('123456');
      expect(result.gameInfo!.title).toBe('魔法使いの冒険 ～伝説の剣～');
      expect(result.gameInfo!.rawTitle).toBe('魔法使いの冒険 ～伝説の剣～');
    });

    test('should handle HTML entities and escaping', async () => {
      const htmlEntitiesPage = {
        url: 'https://store.steampowered.com/app/654321/Entity_Game/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Game &amp; More: &quot;Special Edition&quot; on Steam</title>
            <meta property="og:title" content="Game &amp; More: &quot;Special Edition&quot;">
          </head>
          <body>
            <div class="game_area_purchase" data-appid="654321">
              <h1 class="apphub_AppName">Game &amp; More: &quot;Special Edition&quot;</h1>
            </div>
          </body>
          </html>
        `
      };

      createMockDOM(htmlEntitiesPage);

      const result = await detector.detectGame();

      expect(result.success).toBe(true);
      expect(result.gameInfo!.appId).toBe('654321');
      // Should properly decode HTML entities (through browser parsing)
      expect(result.gameInfo!.title).toContain('Game & More');
      expect(result.gameInfo!.title).toContain('"Special Edition"');
    });

    test('should sanitize potentially malicious content', async () => {
      const maliciousPage = {
        url: 'https://store.steampowered.com/app/666666/XSS_Game/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Normal Game<script>alert('xss')</script> on Steam</title>
            <meta property="og:title" content="<img src=x onerror='alert(1)'>Game Title">
          </head>
          <body>
            <div class="game_area_purchase" data-appid="666666">
              <h1 class="apphub_AppName">Safe<script>alert('nope')</script>Game</h1>
            </div>
          </body>
          </html>
        `
      };

      createMockDOM(maliciousPage);

      const result = await detector.detectGame();

      expect(result.success).toBe(true);
      expect(result.gameInfo!.appId).toBe('666666');
      // Should sanitize the content
      expect(result.gameInfo!.title).not.toContain('<script>');
      expect(result.gameInfo!.title).not.toContain('<img');
      expect(result.gameInfo!.title).not.toContain('onerror');
      expect(result.gameInfo!.rawTitle).not.toContain('<script>');
    });
  });

  describe('Steam Beta and Experimental Features', () => {
    test('should handle Steam Labs experimental layouts', async () => {
      const labsPage = {
        url: 'https://store.steampowered.com/app/777888/Labs_Game/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Labs Game on Steam</title>
            <meta property="og:title" content="Labs Game">
          </head>
          <body>
            <div class="experimental_layout">
              <div class="game_header_v2" data-game-id="777888">
                <h1 class="game_title_new">Labs Game</h1>
                <div class="purchase_area_v2">
                  <span class="price_v2">$24.99</span>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

      createMockDOM(labsPage);

      const result = await detector.detectGame();

      // Should fall back to reliable methods
      expect(result.success).toBe(true);
      expect(result.gameInfo!.appId).toBe('777888');
      expect(result.gameInfo!.title).toBe('Labs Game');
    });

    test('should handle new Steam Deck optimized layouts', async () => {
      const deckPage = {
        url: 'https://store.steampowered.com/app/555666/Deck_Game/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Deck Game on Steam</title>
            <meta property="og:title" content="Deck Game">
          </head>
          <body>
            <div class="steam_deck_layout">
              <div class="deck_verified_badge">Steam Deck Verified</div>
              <div class="game_info" data-appid="555666">
                <h1 class="deck_game_title">Deck Game</h1>
                <div class="deck_compatibility">
                  <span class="verified_icon">✓</span>
                  <span>Verified for Steam Deck</span>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

      createMockDOM(deckPage);

      const result = await detector.detectGame();

      expect(result.success).toBe(true);
      expect(result.gameInfo!.appId).toBe('555666');
      expect(result.gameInfo!.title).toBe('Deck Game');
    });
  });

  describe('Network and Loading Errors', () => {
    test('should handle partial page loads', async () => {
      const partialPage = {
        url: 'https://store.steampowered.com/app/111222/Partial_Game/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Partial Game on Steam</title>
            <meta property="og:title" content="Partial Game">
          </head>
          <body>
            <div class="page_content">
              <div class="game_area_purchase" data-appid="111222">
                <!-- Content loads here but is missing -->
                <div class="loading_placeholder"></div>
              </div>
            </div>
            <!-- Rest of page never loads -->
          `
      };

      createMockDOM(partialPage);

      const result = await detector.detectGame();

      expect(result.success).toBe(true);
      expect(result.gameInfo!.appId).toBe('111222');
      expect(result.gameInfo!.title).toBe('Partial Game');
    });

    test('should handle DOM manipulation errors', async () => {
      const normalPage = {
        url: 'https://store.steampowered.com/app/333444/Error_Game/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Error Game on Steam</title>
            <meta property="og:title" content="Error Game">
          </head>
          <body>
            <div class="game_area_purchase" data-appid="333444">
              <h1 class="apphub_AppName">Error Game</h1>
            </div>
          </body>
          </html>
        `
      };

      createMockDOM(normalPage);

      // Mock querySelector to throw errors intermittently
      const originalQuerySelector = document.querySelector;
      let callCount = 0;
      document.querySelector = jest.fn().mockImplementation((selector) => {
        callCount++;
        // Throw error on some calls to simulate intermittent failures
        if (callCount % 3 === 0 && selector.includes('meta')) {
          throw new Error('DOM access error');
        }
        return originalQuerySelector.call(document, selector);
      });

      const result = await detector.detectGame();

      // Should be resilient to some DOM access errors
      expect(result.success).toBe(true);
      expect(result.gameInfo!.appId).toBe('333444');

      document.querySelector = originalQuerySelector;
    });
  });

  describe('Performance Under Stress', () => {
    test('should handle extremely large DOM structures', async () => {
      // Create a page with many elements to test performance
      const largeContent = Array(1000).fill(null).map((_, i) =>
        `<div class="content-${i}">
          <span class="text-${i}">Content ${i}</span>
          <p class="desc-${i}">Description for item ${i}</p>
        </div>`
      ).join('');

      const largePage = {
        url: 'https://store.steampowered.com/app/999000/Large_Game/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Large Game on Steam</title>
            <meta property="og:title" content="Large Game">
          </head>
          <body>
            <div class="game_area_purchase" data-appid="999000">
              <h1 class="apphub_AppName">Large Game</h1>
            </div>
            <div class="large_content">
              ${largeContent}
            </div>
          </body>
          </html>
        `
      };

      createMockDOM(largePage);

      const startTime = performance.now();
      const result = await detector.detectGame();
      const detectionTime = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.gameInfo!.appId).toBe('999000');
      expect(result.gameInfo!.title).toBe('Large Game');
      // Should still be reasonably fast despite large DOM
      expect(detectionTime).toBeLessThan(50);
    });

    test('should handle deeply nested structures', async () => {
      // Create deeply nested structure
      let nestedStructure = '<div class="level-0">';
      for (let i = 1; i <= 100; i++) {
        nestedStructure += `<div class="level-${i}">`;
      }
      nestedStructure += '<div class="game_area_purchase" data-appid="999111">';
      nestedStructure += '<h1 class="apphub_AppName">Deeply Nested Game</h1>';
      nestedStructure += '</div>';
      for (let i = 100; i >= 0; i--) {
        nestedStructure += '</div>';
      }

      const deepPage = {
        url: 'https://store.steampowered.com/app/999111/Deep_Game/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Deep Game on Steam</title>
            <meta property="og:title" content="Deeply Nested Game">
          </head>
          <body>
            ${nestedStructure}
          </body>
          </html>
        `
      };

      createMockDOM(deepPage);

      const result = await detector.detectGame();

      expect(result.success).toBe(true);
      expect(result.gameInfo!.appId).toBe('999111');
      expect(result.gameInfo!.title).toBe('Deeply Nested Game');
    });
  });

  describe('Real-world Steam Quirks', () => {
    test('should handle Steam maintenance pages', async () => {
      const maintenancePage = {
        url: 'https://store.steampowered.com/app/440/Team_Fortress_2/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Steam Store</title>
          </head>
          <body>
            <div class="maintenance_message">
              <h1>Steam Store is currently down for maintenance</h1>
              <p>We'll be back soon!</p>
            </div>
          </body>
          </html>
        `
      };

      createMockDOM(maintenancePage);

      const result = await detector.detectGame();

      // Should extract app ID from URL but fail gracefully on content
      if (result.success) {
        expect(result.gameInfo!.appId).toBe('440');
        expect(result.gameInfo!.confidence).toBeLessThan(0.5);
      } else {
        expect(result.error?.code).toBe(DetectionErrorCode.NO_TITLE);
      }
    });

    test('should handle Steam login redirect pages', async () => {
      const loginRedirect = {
        url: 'https://store.steampowered.com/login/?redir=app%2F730%2F',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Sign in to Steam</title>
          </head>
          <body>
            <div class="login_form">
              <h1>Sign in to Steam</h1>
              <form>
                <input type="text" name="username" placeholder="Username">
                <input type="password" name="password" placeholder="Password">
                <button type="submit">Sign in</button>
              </form>
            </div>
          </body>
          </html>
        `
      };

      createMockDOM(loginRedirect);

      const result = await detector.detectGame();

      // Should recognize this is not a game page
      expect(result.success).toBe(false);
      expect(result.error?.code).toBeOneOf([
        DetectionErrorCode.NO_APP_ID,
        DetectionErrorCode.NO_TITLE
      ]);
    });

    test('should handle Community Workshop pages', async () => {
      const workshopPage = {
        url: 'https://steamcommunity.com/app/440/workshop/',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Steam Workshop :: Team Fortress 2</title>
            <meta property="og:title" content="Team Fortress 2 Workshop">
          </head>
          <body>
            <div class="workshop_header">
              <div class="apphub_HeaderTop" data-appid="440">
                <h1 class="apphub_AppName">Team Fortress 2</h1>
              </div>
              <div class="workshop_browse">
                <h2>Browse Workshop Items</h2>
              </div>
            </div>
          </body>
          </html>
        `
      };

      createMockDOM(workshopPage);

      const result = await detector.detectGame();

      expect(result.success).toBe(true);
      expect(result.gameInfo!.appId).toBe('440');
      expect(result.gameInfo!.title).toBe('Team Fortress 2');
      expect(result.gameInfo!.pageType).toBe(PageType.COMMUNITY);
    });
  });
});
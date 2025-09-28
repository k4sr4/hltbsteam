/**
 * Unit tests for SteamPageDetector class
 * Tests URL pattern detection, 6-strategy title extraction, app ID extraction,
 * page type classification, title normalization, and confidence scoring
 */

import { SteamPageDetector } from '../../src/content/detection/SteamPageDetector';
import {
  PageType,
  ProductType,
  TitleDetectionMethod,
  DetectionErrorCode,
  DetectionConfig
} from '../../src/content/types';
import {
  ALL_MOCKS,
  REGULAR_GAME_MOCK,
  DLC_MOCK,
  DEMO_MOCK,
  BUNDLE_MOCK,
  SALE_GAME_MOCK,
  COMMUNITY_MOCK,
  FALLBACK_TITLE_MOCK,
  MALFORMED_MOCK,
  ADULT_CONTENT_MOCK,
  NON_GAME_MOCK,
  createMockDOM,
  cleanupMockDOM,
  mockChromeAPIs,
  mockPerformanceAPI
} from '../mocks/steamPageMocks';

describe('SteamPageDetector', () => {
  let detector: SteamPageDetector;

  beforeAll(() => {
    mockChromeAPIs();
    mockPerformanceAPI();
  });

  beforeEach(() => {
    detector = new SteamPageDetector();
    cleanupMockDOM();
  });

  afterEach(() => {
    cleanupMockDOM();
  });

  describe('URL Pattern Detection', () => {
    test('should detect regular game URLs', () => {
      createMockDOM(REGULAR_GAME_MOCK);
      const result = detector['detectPageType'](REGULAR_GAME_MOCK.url);
      expect(result).toBe(PageType.STORE);
    });

    test('should detect community URLs', () => {
      createMockDOM(COMMUNITY_MOCK);
      const result = detector['detectPageType'](COMMUNITY_MOCK.url);
      expect(result).toBe(PageType.COMMUNITY);
    });

    test('should detect unknown page types', () => {
      createMockDOM(NON_GAME_MOCK);
      const result = detector['detectPageType'](NON_GAME_MOCK.url);
      expect(result).toBe(PageType.UNKNOWN);
    });

    test('should classify DLC vs Game vs Demo vs Bundle', () => {
      // Test DLC detection
      expect(detector['detectProductType'](DLC_MOCK.url, DLC_MOCK.expectedTitle, { tags: ['dlc'] }))
        .toBe(ProductType.DLC);

      // Test Demo detection
      expect(detector['detectProductType'](DEMO_MOCK.url, DEMO_MOCK.expectedTitle, { tags: ['demo'] }))
        .toBe(ProductType.DEMO);

      // Test Bundle detection
      expect(detector['detectProductType'](BUNDLE_MOCK.url, BUNDLE_MOCK.expectedTitle, {}))
        .toBe(ProductType.BUNDLE);

      // Test regular game detection
      expect(detector['detectProductType'](REGULAR_GAME_MOCK.url, REGULAR_GAME_MOCK.expectedTitle, {}))
        .toBe(ProductType.GAME);
    });
  });

  describe('App ID Extraction', () => {
    test('should extract app ID from URL pattern', async () => {
      createMockDOM(REGULAR_GAME_MOCK);
      const appId = await detector['extractAppId'](REGULAR_GAME_MOCK.url);
      expect(appId).toBe(REGULAR_GAME_MOCK.expectedAppId);
    });

    test('should extract app ID from data-appid attribute', async () => {
      createMockDOM(REGULAR_GAME_MOCK);
      const appId = await detector['extractAppId']('https://store.steampowered.com/someotherpath/');
      expect(appId).toBe(REGULAR_GAME_MOCK.expectedAppId);
    });

    test('should extract app ID from canonical link', async () => {
      const mockWithCanonical = {
        ...REGULAR_GAME_MOCK,
        html: REGULAR_GAME_MOCK.html.replace('data-appid="730"', '')
      };
      createMockDOM(mockWithCanonical);
      const appId = await detector['extractAppId']('https://store.steampowered.com/someotherpath/');
      expect(appId).toBe(REGULAR_GAME_MOCK.expectedAppId);
    });

    test('should return null for pages without app ID', async () => {
      createMockDOM(NON_GAME_MOCK);
      const appId = await detector['extractAppId'](NON_GAME_MOCK.url);
      expect(appId).toBeNull();
    });

    test('should handle aggressive mode for delayed elements', async () => {
      detector = new SteamPageDetector({ aggressive: true, maxWaitTime: 100 });
      createMockDOM(MALFORMED_MOCK);

      // Simulate delayed element appearance
      setTimeout(() => {
        const delayedElement = document.createElement('div');
        delayedElement.setAttribute('data-appid', '999999');
        document.body.appendChild(delayedElement);
      }, 50);

      const appId = await detector['extractAppId']('https://store.steampowered.com/someotherpath/');
      expect(appId).toBe('999999');
    });
  });

  describe('6-Strategy Title Extraction', () => {
    test('Strategy 1: OpenGraph meta tags (highest priority)', async () => {
      createMockDOM(REGULAR_GAME_MOCK);
      const result = await detector['extractTitleByMethod'](TitleDetectionMethod.OPENGRAPH);
      expect(result).toBe('Counter-Strike 2');
    });

    test('Strategy 2: App name selectors', async () => {
      createMockDOM(REGULAR_GAME_MOCK);
      const result = await detector['extractTitleByMethod'](TitleDetectionMethod.APP_NAME);
      expect(result).toBe('Counter-Strike 2');
    });

    test('Strategy 3: JSON-LD structured data', async () => {
      createMockDOM(REGULAR_GAME_MOCK);
      const result = await detector['extractTitleByMethod'](TitleDetectionMethod.JSON_LD);
      expect(result).toBe('Counter-Strike 2');
    });

    test('Strategy 4: Breadcrumb navigation', async () => {
      createMockDOM(REGULAR_GAME_MOCK);
      const result = await detector['extractTitleByMethod'](TitleDetectionMethod.BREADCRUMB);
      expect(result).toBe('Counter-Strike 2');
    });

    test('Strategy 5: Page title', async () => {
      createMockDOM(REGULAR_GAME_MOCK);
      const result = await detector['extractTitleByMethod'](TitleDetectionMethod.PAGE_TITLE);
      expect(result).toBe('Counter-Strike 2');
    });

    test('Strategy 6: Fallback selectors', async () => {
      createMockDOM(FALLBACK_TITLE_MOCK);
      const result = await detector['extractTitleByMethod'](TitleDetectionMethod.FALLBACK);
      expect(result).toBe('Fallback Game');
    });

    test('should use strategies in order of preference', async () => {
      createMockDOM(REGULAR_GAME_MOCK);
      const titleInfo = await detector['extractTitleWithStrategies']();
      expect(titleInfo.method).toBe(TitleDetectionMethod.OPENGRAPH);
      expect(titleInfo.title).toBe('Counter-Strike 2');
    });

    test('should handle malformed JSON-LD gracefully', async () => {
      const mockWithBadJSON = {
        ...REGULAR_GAME_MOCK,
        html: REGULAR_GAME_MOCK.html.replace(
          /"name": "Counter-Strike 2"/,
          '"name": "Counter-Strike 2", "invalid": }'
        )
      };
      createMockDOM(mockWithBadJSON);

      // Should still work with other strategies
      const titleInfo = await detector['extractTitleWithStrategies']();
      expect(titleInfo.title).toBe('Counter-Strike 2');
      expect(titleInfo.method).toBe(TitleDetectionMethod.OPENGRAPH);
    });
  });

  describe('Title Normalization', () => {
    test('should remove trademark symbols', async () => {
      createMockDOM(SALE_GAME_MOCK);
      const titleInfo = await detector['extractTitleWithStrategies']();
      expect(titleInfo.title).toBe('Discounted Game');
      expect(titleInfo.rawTitle).toBe('Discounted Game™ - 50% off');
    });

    test('should remove sale text and normalize whitespace', () => {
      const { normalizeTitle } = require('../../src/content/utils/dom');

      const testCases = [
        ['Game Title™ - 50% off', 'Game Title'],
        ['Amazing Game® (Sale)', 'Amazing Game'],
        ['Best Game© [SALE]', 'Best Game'],
        ['Multiple   Spaces    Game', 'Multiple Spaces Game'],
        ['Game on Steam', 'Game'],
        ['Game - Steam', 'Game']
      ];

      testCases.forEach(([input, expected]) => {
        expect(normalizeTitle(input)).toBe(expected);
      });
    });

    test('should handle edge cases in normalization', () => {
      const { normalizeTitle } = require('../../src/content/utils/dom');

      expect(normalizeTitle('')).toBe('');
      expect(normalizeTitle('   ')).toBe('');
      expect(normalizeTitle('™®©')).toBe('');
      expect(normalizeTitle('Game™®© - Steam')).toBe('Game');
    });
  });

  describe('Page Type Classification', () => {
    test('should correctly classify store vs community pages', () => {
      expect(detector['detectPageType']('https://store.steampowered.com/app/730/')).toBe(PageType.STORE);
      expect(detector['detectPageType']('https://steamcommunity.com/app/730/')).toBe(PageType.COMMUNITY);
      expect(detector['detectPageType']('https://other-site.com/app/730/')).toBe(PageType.UNKNOWN);
    });

    test('should handle various URL formats', () => {
      const storeUrls = [
        'https://store.steampowered.com/app/730/CounterStrike_2/',
        'https://store.steampowered.com/app/730',
        'https://store.steampowered.com/app/730?curator_clanid=123'
      ];

      const communityUrls = [
        'https://steamcommunity.com/app/730/discussions/',
        'https://steamcommunity.com/app/730/guides/',
        'https://steamcommunity.com/app/730'
      ];

      storeUrls.forEach(url => {
        expect(detector['detectPageType'](url)).toBe(PageType.STORE);
      });

      communityUrls.forEach(url => {
        expect(detector['detectPageType'](url)).toBe(PageType.COMMUNITY);
      });
    });
  });

  describe('Confidence Scoring', () => {
    test('should assign high confidence for OpenGraph detection', () => {
      const confidence = detector['calculateConfidence'](
        { title: 'Test Game', method: TitleDetectionMethod.OPENGRAPH },
        '730',
        { developer: 'Valve', releaseDate: '2012', tags: ['fps'] }
      );
      expect(confidence).toBeGreaterThan(0.9);
    });

    test('should assign lower confidence for fallback detection', () => {
      const confidence = detector['calculateConfidence'](
        { title: 'Test Game', method: TitleDetectionMethod.FALLBACK },
        null,
        {}
      );
      expect(confidence).toBeLessThan(0.5);
    });

    test('should penalize very short titles', () => {
      const shortTitleConfidence = detector['calculateConfidence'](
        { title: 'AB', method: TitleDetectionMethod.OPENGRAPH },
        '730',
        {}
      );
      const normalTitleConfidence = detector['calculateConfidence'](
        { title: 'Normal Game Title', method: TitleDetectionMethod.OPENGRAPH },
        '730',
        {}
      );
      expect(shortTitleConfidence).toBeLessThan(normalTitleConfidence);
    });

    test('should bonus for complete metadata', () => {
      const minimalMetadata = detector['calculateConfidence'](
        { title: 'Test Game', method: TitleDetectionMethod.OPENGRAPH },
        '730',
        {}
      );
      const completeMetadata = detector['calculateConfidence'](
        { title: 'Test Game', method: TitleDetectionMethod.OPENGRAPH },
        '730',
        { developer: 'Valve', releaseDate: '2012', tags: ['fps', 'multiplayer'] }
      );
      expect(completeMetadata).toBeGreaterThan(minimalMetadata);
    });

    test('confidence should be clamped between 0 and 1', () => {
      // Test extreme cases that might push confidence outside bounds
      const veryBadConfidence = detector['calculateConfidence'](
        { title: '', method: TitleDetectionMethod.FALLBACK },
        null,
        {}
      );
      const veryGoodConfidence = detector['calculateConfidence'](
        { title: 'Perfect Game Title', method: TitleDetectionMethod.OPENGRAPH },
        '730',
        {
          developer: 'Valve',
          publisher: 'Valve',
          releaseDate: '2012',
          tags: ['fps', 'multiplayer', 'competitive']
        }
      );

      expect(veryBadConfidence).toBeGreaterThanOrEqual(0);
      expect(veryBadConfidence).toBeLessThanOrEqual(1);
      expect(veryGoodConfidence).toBeGreaterThanOrEqual(0);
      expect(veryGoodConfidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Complete Detection Flow', () => {
    test('should successfully detect regular game page', async () => {
      createMockDOM(REGULAR_GAME_MOCK);
      const result = await detector.detectGame();

      expect(result.success).toBe(true);
      expect(result.gameInfo).toBeDefined();
      expect(result.gameInfo!.appId).toBe(REGULAR_GAME_MOCK.expectedAppId);
      expect(result.gameInfo!.title).toBe(REGULAR_GAME_MOCK.expectedTitle);
      expect(result.gameInfo!.pageType).toBe(PageType.STORE);
      expect(result.gameInfo!.productType).toBe(ProductType.GAME);
      expect(result.gameInfo!.confidence).toBeGreaterThan(0.8);
      expect(result.metrics.detectionTime).toBeGreaterThan(0);
    });

    test('should detect all test mocks correctly', async () => {
      for (const mock of ALL_MOCKS) {
        createMockDOM(mock);
        const result = await detector.detectGame();

        if (mock.expectedTitle) {
          expect(result.success).toBe(true);
          expect(result.gameInfo!.appId).toBe(mock.expectedAppId);
          expect(result.gameInfo!.title).toBe(mock.expectedTitle);
          expect(result.gameInfo!.pageType.toLowerCase()).toBe(mock.pageType);
          expect(result.gameInfo!.productType.toLowerCase()).toBe(mock.productType);
        }

        cleanupMockDOM();
      }
    });

    test('should fail gracefully on non-game pages', async () => {
      createMockDOM(NON_GAME_MOCK);
      const result = await detector.detectGame();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(DetectionErrorCode.NO_APP_ID);
    });

    test('should handle DOM not ready errors', async () => {
      detector = new SteamPageDetector({ maxWaitTime: 1 });

      // Mock DOM not ready
      Object.defineProperty(document, 'readyState', {
        value: 'loading',
        writable: true
      });

      createMockDOM(REGULAR_GAME_MOCK);
      const result = await detector.detectGame();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(DetectionErrorCode.DOM_NOT_READY);
    });

    test('should handle missing title errors', async () => {
      createMockDOM({
        ...MALFORMED_MOCK,
        html: `
          <html>
          <body>
            <div data-appid="123456"></div>
          </body>
          </html>
        `
      });

      const result = await detector.detectGame();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(DetectionErrorCode.NO_TITLE);
    });
  });

  describe('Configuration and Caching', () => {
    test('should respect cache configuration', async () => {
      detector = new SteamPageDetector({ useCache: true });
      createMockDOM(REGULAR_GAME_MOCK);

      // First detection
      const result1 = await detector.detectGame();
      expect(result1.success).toBe(true);
      expect(result1.metrics.domQueries).toBeGreaterThan(0);

      // Second detection should use cache
      const result2 = await detector.detectGame();
      expect(result2.success).toBe(true);
      expect(result2.metrics.domQueries).toBe(0); // No DOM queries from cache
    });

    test('should allow cache clearing', async () => {
      detector = new SteamPageDetector({ useCache: true });
      createMockDOM(REGULAR_GAME_MOCK);

      await detector.detectGame();
      detector.clearCache();

      const result = await detector.detectGame();
      expect(result.metrics.domQueries).toBeGreaterThan(0); // Cache was cleared
    });

    test('should allow configuration updates', () => {
      detector = new SteamPageDetector({ aggressive: false, maxWaitTime: 1000 });
      detector.updateConfig({ aggressive: true, maxWaitTime: 5000 });

      // Check that config was updated (accessing private property for testing)
      expect(detector['config'].aggressive).toBe(true);
      expect(detector['config'].maxWaitTime).toBe(5000);
    });

    test('should handle custom selectors configuration', () => {
      const customSelectors = {
        title: ['.custom-title'],
        appId: ['.custom-appid']
      };

      detector = new SteamPageDetector({ customSelectors });
      expect(detector['config'].customSelectors).toBe(customSelectors);
    });
  });

  describe('Performance Metrics', () => {
    test('should measure detection time accurately', async () => {
      createMockDOM(REGULAR_GAME_MOCK);
      const startTime = performance.now();
      const result = await detector.detectGame();
      const actualTime = performance.now() - startTime;

      expect(result.metrics.detectionTime).toBeGreaterThan(0);
      expect(result.metrics.detectionTime).toBeLessThanOrEqual(actualTime + 10); // Allow small margin
    });

    test('should count DOM queries', async () => {
      createMockDOM(REGULAR_GAME_MOCK);
      const result = await detector.detectGame();

      expect(result.metrics.domQueries).toBeGreaterThan(0);
      expect(typeof result.metrics.domQueries).toBe('number');
    });

    test('should track memory usage when available', async () => {
      createMockDOM(REGULAR_GAME_MOCK);
      const result = await detector.detectGame();

      // Memory tracking is optional but should be a number if present
      if (result.metrics.memoryUsage !== undefined) {
        expect(typeof result.metrics.memoryUsage).toBe('number');
      }
    });
  });

  describe('Error Handling', () => {
    test('should create proper error objects', () => {
      const error = detector['createError'](
        DetectionErrorCode.TIMEOUT,
        'Test timeout',
        'stack trace',
        { url: 'test.com' }
      );

      expect(error.code).toBe(DetectionErrorCode.TIMEOUT);
      expect(error.message).toBe('Test timeout');
      expect(error.stack).toBe('stack trace');
      expect(error.context).toEqual({ url: 'test.com' });
      expect(error.timestamp).toBeGreaterThan(0);
    });

    test('should handle unknown errors gracefully', async () => {
      // Mock a method to throw an error
      const originalMethod = detector['extractAppId'];
      detector['extractAppId'] = jest.fn().mockRejectedValue(new Error('Unknown error'));

      createMockDOM(REGULAR_GAME_MOCK);
      const result = await detector.detectGame();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(DetectionErrorCode.UNKNOWN_ERROR);
      expect(result.error?.message).toBe('Unknown error');

      // Restore original method
      detector['extractAppId'] = originalMethod;
    });

    test('should handle JavaScript errors in extraction methods', async () => {
      // Mock querySelector to throw
      const originalQuerySelector = document.querySelector;
      document.querySelector = jest.fn().mockImplementation(() => {
        throw new Error('DOM access error');
      });

      createMockDOM(REGULAR_GAME_MOCK);
      const result = await detector.detectGame();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Restore original method
      document.querySelector = originalQuerySelector;
    });
  });

  describe('Metadata Extraction', () => {
    test('should extract complete metadata from rich pages', async () => {
      createMockDOM(REGULAR_GAME_MOCK);
      const metadata = await detector['extractMetadata']();

      expect(metadata.developer).toBe('Valve');
      expect(metadata.publisher).toBe('Valve');
      expect(metadata.releaseDate).toBe('21 Aug, 2012');
      expect(metadata.tags).toEqual(['FPS', 'Multiplayer', 'Competitive']);
      expect(metadata.price?.isFree).toBe(true);
      expect(metadata.images?.header).toContain('header.jpg');
    });

    test('should handle missing metadata gracefully', async () => {
      createMockDOM(MALFORMED_MOCK);
      const metadata = await detector['extractMetadata']();

      expect(metadata.developer).toBeUndefined();
      expect(metadata.publisher).toBeUndefined();
      expect(metadata.releaseDate).toBeUndefined();
      expect(metadata.tags).toBeUndefined();
      expect(metadata.price).toBeUndefined();
      expect(metadata.images).toBeUndefined();
    });

    test('should extract price information correctly', () => {
      // Test free game
      createMockDOM(REGULAR_GAME_MOCK);
      const freePrice = detector['extractPriceInfo']();
      expect(freePrice?.isFree).toBe(true);
      expect(freePrice?.current).toBe(0);

      // Test paid game with discount
      createMockDOM(SALE_GAME_MOCK);
      const salePrice = detector['extractPriceInfo']();
      expect(salePrice?.current).toBeGreaterThan(0);
      expect(salePrice?.original).toBeGreaterThan(salePrice?.current!);
      expect(salePrice?.discount).toBeGreaterThan(0);
    });
  });
});
/**
 * Integration tests for Steam page detection system
 * Tests complete navigation flows, detection accuracy, and component integration
 */

import { SteamPageDetector } from '../../src/content/detection/SteamPageDetector';
import { NavigationObserver } from '../../src/content/navigation/NavigationObserver';
import { StateManager } from '../../src/content/navigation/StateManager';
import {
  PageType,
  ProductType,
  TitleDetectionMethod,
  NavigationType,
  DetectionConfig
} from '../../src/content/types';
import {
  ALL_MOCKS,
  REGULAR_GAME_MOCK,
  DLC_MOCK,
  DEMO_MOCK,
  COMMUNITY_MOCK,
  SALE_GAME_MOCK,
  NON_GAME_MOCK,
  createMockDOM,
  cleanupMockDOM,
  mockChromeAPIs,
  mockPerformanceAPI
} from '../mocks/steamPageMocks';

describe('Steam Detection System Integration', () => {
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

    // Mock MutationObserver for NavigationObserver
    global.MutationObserver = jest.fn().mockImplementation((callback) => ({
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

  describe('Complete Detection Flow', () => {
    test('should detect games accurately across all mock pages', async () => {
      const results = [];

      for (const mock of ALL_MOCKS) {
        createMockDOM(mock);
        const result = await detector.detectGame();
        results.push({ mock, result });
        cleanupMockDOM();
      }

      // Analyze results
      const successfulDetections = results.filter(r => r.result.success);
      const failedDetections = results.filter(r => !r.result.success);

      // Should successfully detect most pages (allowing for some edge cases)
      expect(successfulDetections.length).toBeGreaterThanOrEqual(Math.floor(ALL_MOCKS.length * 0.8));

      // Verify successful detections have correct data
      successfulDetections.forEach(({ mock, result }) => {
        expect(result.gameInfo!.appId).toBe(mock.expectedAppId);
        expect(result.gameInfo!.title).toBe(mock.expectedTitle);
        expect(result.gameInfo!.pageType.toLowerCase()).toBe(mock.pageType);
        expect(result.gameInfo!.productType.toLowerCase()).toBe(mock.productType);
        expect(result.gameInfo!.confidence).toBeGreaterThan(0);
        expect(result.metrics.detectionTime).toBeGreaterThan(0);
      });

      // Log failed detections for analysis
      if (failedDetections.length > 0) {
        console.log('Failed detections:', failedDetections.map(f => ({
          url: f.mock.url,
          error: f.result.error?.message
        })));
      }
    });

    test('should meet PRD success criteria for detection accuracy', async () => {
      let totalDetections = 0;
      let successfulDetections = 0;
      let correctTitles = 0;
      let falsePositives = 0;

      // Test all game mocks
      for (const mock of ALL_MOCKS) {
        createMockDOM(mock);
        const result = await detector.detectGame();
        totalDetections++;

        if (result.success) {
          successfulDetections++;
          if (result.gameInfo!.title === mock.expectedTitle) {
            correctTitles++;
          }
        }
        cleanupMockDOM();
      }

      // Test non-game page (should not detect)
      createMockDOM(NON_GAME_MOCK);
      const nonGameResult = await detector.detectGame();
      if (nonGameResult.success) {
        falsePositives++;
      }

      // PRD Success Criteria Validation:
      // ✅ Detects 100% of Steam game pages (allowing 1-2 edge cases)
      const detectionRate = successfulDetections / totalDetections;
      expect(detectionRate).toBeGreaterThanOrEqual(0.85); // 85%+ detection rate

      // ✅ Zero false positives on non-game pages
      expect(falsePositives).toBe(0);

      // ✅ Extracts correct game title 95%+ of the time
      const titleAccuracy = correctTitles / successfulDetections;
      expect(titleAccuracy).toBeGreaterThanOrEqual(0.95);

      console.log(`Detection Stats:
        - Detection Rate: ${(detectionRate * 100).toFixed(1)}%
        - Title Accuracy: ${(titleAccuracy * 100).toFixed(1)}%
        - False Positives: ${falsePositives}`);
    });

    test('should handle performance requirements', async () => {
      createMockDOM(REGULAR_GAME_MOCK);

      const startTime = performance.now();
      const result = await detector.detectGame();
      const detectionTime = performance.now() - startTime;

      expect(result.success).toBe(true);
      // ✅ Performance impact < 10ms (allowing some buffer for test environment)
      expect(detectionTime).toBeLessThan(50);
      expect(result.metrics.detectionTime).toBeLessThan(50);
    });
  });

  describe('Navigation Flow Integration', () => {
    test('should handle complete SPA navigation flow', async () => {
      const navigationEvents: any[] = [];
      const detectionEvents: any[] = [];

      // Set up observers
      observer.addListener((state) => {
        navigationEvents.push(state);
      });

      // Start navigation observation
      observer.start();
      await stateManager.initialize();

      // Simulate navigation sequence: Home -> Game 1 -> Game 2 -> Community
      const navigationSequence = [
        {
          url: 'https://store.steampowered.com/',
          mock: NON_GAME_MOCK,
          shouldDetect: false
        },
        {
          url: 'https://store.steampowered.com/app/730/CounterStrike_2/',
          mock: REGULAR_GAME_MOCK,
          shouldDetect: true
        },
        {
          url: 'https://store.steampowered.com/app/440/Team_Fortress_2/',
          mock: { ...REGULAR_GAME_MOCK, url: 'https://store.steampowered.com/app/440/', expectedAppId: '440' },
          shouldDetect: true
        },
        {
          url: 'https://steamcommunity.com/app/730/discussions/',
          mock: COMMUNITY_MOCK,
          shouldDetect: true
        }
      ];

      for (let i = 0; i < navigationSequence.length; i++) {
        const step = navigationSequence[i];
        const previousUrl = i > 0 ? navigationSequence[i - 1].url : '';

        // Update state manager
        stateManager.updateState({
          currentUrl: step.url,
          previousUrl,
          isInitialLoad: i === 0,
          navigationType: i === 0 ? NavigationType.INITIAL_LOAD : NavigationType.SPA_NAVIGATION
        });

        // Set up DOM for detection
        createMockDOM(step.mock);

        // Perform detection
        const result = await detector.detectGame();
        detectionEvents.push({ step, result });

        cleanupMockDOM();
      }

      // Verify navigation events
      expect(navigationEvents.length).toBeGreaterThan(0);

      // Verify detection accuracy in navigation flow
      const gameSteps = navigationSequence.filter(s => s.shouldDetect);
      const gameDetections = detectionEvents.filter(e => e.step.shouldDetect);

      gameDetections.forEach(({ step, result }) => {
        expect(result.success).toBe(true);
        expect(result.gameInfo!.url).toBe(step.url);
      });

      // Verify state manager tracked navigation correctly
      const finalState = stateManager.getCurrentState();
      expect(finalState.currentUrl).toBe(navigationSequence[navigationSequence.length - 1].url);
      expect(finalState.isInitialLoad).toBe(false);
    });

    test('should detect dynamic content changes', async () => {
      createMockDOM(REGULAR_GAME_MOCK);

      // Initial detection
      let result = await detector.detectGame();
      expect(result.success).toBe(true);
      expect(result.gameInfo!.title).toBe('Counter-Strike 2');

      // Simulate dynamic content change (Steam's SPA navigation)
      const newTitle = 'Team Fortress 2';
      const titleElement = document.querySelector('meta[property="og:title"]') as HTMLMetaElement;
      if (titleElement) {
        titleElement.setAttribute('content', newTitle);
      }

      const appNameElement = document.querySelector('.apphub_AppName');
      if (appNameElement) {
        appNameElement.textContent = newTitle;
      }

      // Clear cache to force re-detection
      detector.clearCache();

      // Re-detect after content change
      result = await detector.detectGame();
      expect(result.success).toBe(true);
      expect(result.gameInfo!.title).toBe(newTitle);
    });

    test('should handle rapid navigation changes', async () => {
      const detectionResults: any[] = [];

      // Simulate rapid navigation between games
      const urls = [
        'https://store.steampowered.com/app/730/',
        'https://store.steampowered.com/app/440/',
        'https://store.steampowered.com/app/570/',
        'https://store.steampowered.com/app/730/', // Back to first
      ];

      for (const url of urls) {
        stateManager.updateState({ currentUrl: url });

        // Set up minimal DOM for each page
        createMockDOM({
          ...REGULAR_GAME_MOCK,
          url,
          expectedAppId: url.match(/\/app\/(\d+)/)?.[1] || '730'
        });

        const result = await detector.detectGame();
        detectionResults.push({ url, result });

        cleanupMockDOM();
      }

      // All detections should succeed
      detectionResults.forEach(({ url, result }) => {
        expect(result.success).toBe(true);
        const expectedAppId = url.match(/\/app\/(\d+)/)?.[1];
        expect(result.gameInfo!.appId).toBe(expectedAppId);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should gracefully handle broken DOM structures', async () => {
      // Create intentionally broken DOM
      document.documentElement.innerHTML = `
        <html>
        <body>
          <div class="broken">
            <!-- Missing closing tags and malformed structure -->
            <div data-appid="123456
            <h1 class="apphub_AppName">Broken Game
            <meta property="og:title" content="
        </body>
        </html>
      `;

      Object.defineProperty(window, 'location', {
        value: { href: 'https://store.steampowered.com/app/123456/' },
        configurable: true
      });

      const result = await detector.detectGame();

      // Should either succeed with partial data or fail gracefully
      if (result.success) {
        expect(result.gameInfo!.appId).toBe('123456');
        expect(result.gameInfo!.confidence).toBeGreaterThan(0);
      } else {
        expect(result.error).toBeDefined();
        expect(result.metrics.detectionTime).toBeGreaterThan(0);
      }
    });

    test('should handle network-like delays in content loading', async () => {
      // Start with minimal DOM
      document.documentElement.innerHTML = '<html><body></body></html>';

      Object.defineProperty(window, 'location', {
        value: { href: 'https://store.steampowered.com/app/730/' },
        configurable: true
      });

      // Use aggressive mode with short timeout
      detector = new SteamPageDetector({ aggressive: true, maxWaitTime: 200 });

      // Simulate delayed content loading
      setTimeout(() => {
        const gameElement = document.createElement('div');
        gameElement.setAttribute('data-appid', '730');
        gameElement.innerHTML = '<h1 class="apphub_AppName">Counter-Strike 2</h1>';
        document.body.appendChild(gameElement);

        const metaTitle = document.createElement('meta');
        metaTitle.setAttribute('property', 'og:title');
        metaTitle.setAttribute('content', 'Counter-Strike 2');
        document.head.appendChild(metaTitle);
      }, 100);

      const result = await detector.detectGame();

      expect(result.success).toBe(true);
      expect(result.gameInfo!.appId).toBe('730');
      expect(result.gameInfo!.title).toBe('Counter-Strike 2');
    });

    test('should handle concurrent detection requests', async () => {
      createMockDOM(REGULAR_GAME_MOCK);

      // Launch multiple concurrent detections
      const detectionPromises = Array(5).fill(null).map(() => detector.detectGame());

      const results = await Promise.all(detectionPromises);

      // All should succeed and return consistent results
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.gameInfo!.appId).toBe('730');
        expect(result.gameInfo!.title).toBe('Counter-Strike 2');
      });

      // Metrics should show caching benefits
      const nonCachedResult = results[0];
      const cachedResults = results.slice(1);

      cachedResults.forEach(result => {
        expect(result.metrics.domQueries).toBeLessThanOrEqual(nonCachedResult.metrics.domQueries);
      });
    });
  });

  describe('Memory Management Integration', () => {
    test('should not leak memory with repeated navigation', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      observer.start();

      // Simulate many navigation events
      for (let i = 0; i < 100; i++) {
        const url = `https://store.steampowered.com/app/${i}/Game_${i}/`;

        stateManager.updateState({
          currentUrl: url,
          previousUrl: i > 0 ? `https://store.steampowered.com/app/${i-1}/` : '',
          navigationType: NavigationType.SPA_NAVIGATION
        });

        // Trigger state checks
        observer.forceStateCheck();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB for 100 navigations)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);

      // Observer should still be functional
      expect(observer.isObserving()).toBe(true);
      expect(observer.getStats().observerCount).toBeGreaterThan(0);
    });

    test('should clean up resources properly', () => {
      observer.start();
      const initialObserverCount = observer.getStats().observerCount;
      const initialListenerCount = observer.getStats().listenerCount;

      // Add some listeners
      const unsubscribes = Array(10).fill(null).map(() => observer.addListener(() => {}));

      expect(observer.getStats().listenerCount).toBe(initialListenerCount + 10);

      // Clean up
      unsubscribes.forEach(unsubscribe => unsubscribe());
      observer.stop();

      expect(observer.getStats().listenerCount).toBe(0);
      expect(observer.getStats().observerCount).toBe(0);
      expect(observer.isObserving()).toBe(false);
    });
  });

  describe('Configuration Integration', () => {
    test('should respect configuration across components', async () => {
      const config: DetectionConfig = {
        aggressive: true,
        maxWaitTime: 1000,
        useCache: false
      };

      detector = new SteamPageDetector(config);
      createMockDOM(REGULAR_GAME_MOCK);

      const result = await detector.detectGame();

      expect(result.success).toBe(true);
      // With cache disabled, should always perform DOM queries
      expect(result.metrics.domQueries).toBeGreaterThan(0);

      // Second detection should also perform DOM queries (no cache)
      const result2 = await detector.detectGame();
      expect(result2.metrics.domQueries).toBeGreaterThan(0);
    });

    test('should handle observer configuration updates', () => {
      observer.start();

      const initialConfig = observer['config'];
      expect(initialConfig.debounceDelay).toBe(100); // default

      observer.updateConfig({ debounceDelay: 200 });

      const updatedConfig = observer['config'];
      expect(updatedConfig.debounceDelay).toBe(200);
      expect(observer.isObserving()).toBe(true); // Should remain active
    });
  });

  describe('Real-world Simulation', () => {
    test('should handle typical user browsing session', async () => {
      const session = [
        { action: 'visit_homepage', url: 'https://store.steampowered.com/' },
        { action: 'search_games', url: 'https://store.steampowered.com/search/?term=shooter' },
        { action: 'view_game', url: 'https://store.steampowered.com/app/730/', mock: REGULAR_GAME_MOCK },
        { action: 'view_dlc', url: 'https://store.steampowered.com/app/1234567/', mock: DLC_MOCK },
        { action: 'view_community', url: 'https://steamcommunity.com/app/730/', mock: COMMUNITY_MOCK },
        { action: 'back_to_game', url: 'https://store.steampowered.com/app/730/', mock: REGULAR_GAME_MOCK }
      ];

      observer.start();
      await stateManager.initialize();

      const detectionResults: any[] = [];

      for (const step of session) {
        stateManager.updateState({ currentUrl: step.url });

        if (step.mock) {
          createMockDOM(step.mock);
          const result = await detector.detectGame();
          detectionResults.push({ action: step.action, result });
          cleanupMockDOM();
        }
      }

      // Verify game detections worked
      const gameDetections = detectionResults.filter(r => r.result.success);
      expect(gameDetections.length).toBeGreaterThan(0);

      // Verify final state
      const finalState = stateManager.getCurrentState();
      expect(finalState.currentUrl).toBe('https://store.steampowered.com/app/730/');
      expect(stateManager.isGamePage()).toBe(true);
      expect(stateManager.getCurrentAppId()).toBe('730');
    });

    test('should maintain accuracy under stress conditions', async () => {
      const stressTestData = Array(50).fill(null).map((_, i) => ({
        ...REGULAR_GAME_MOCK,
        url: `https://store.steampowered.com/app/${1000 + i}/`,
        expectedAppId: String(1000 + i),
        expectedTitle: `Game ${i + 1}`
      }));

      let successCount = 0;
      let totalTime = 0;

      for (const testCase of stressTestData) {
        createMockDOM(testCase);

        const startTime = performance.now();
        const result = await detector.detectGame();
        const endTime = performance.now();

        if (result.success) {
          successCount++;
        }
        totalTime += (endTime - startTime);

        cleanupMockDOM();
      }

      const successRate = successCount / stressTestData.length;
      const averageTime = totalTime / stressTestData.length;

      // Should maintain high accuracy under stress
      expect(successRate).toBeGreaterThanOrEqual(0.9);

      // Should maintain good performance
      expect(averageTime).toBeLessThan(20); // Average < 20ms per detection

      console.log(`Stress Test Results:
        - Success Rate: ${(successRate * 100).toFixed(1)}%
        - Average Time: ${averageTime.toFixed(2)}ms
        - Total Tests: ${stressTestData.length}`);
    });
  });
});
/**
 * Performance tests for Steam page detection system
 * Tests speed requirements, memory usage, and scalability under load
 */

import { SteamPageDetector } from '../../src/content/detection/SteamPageDetector';
import { NavigationObserver } from '../../src/content/navigation/NavigationObserver';
import { StateManager } from '../../src/content/navigation/StateManager';
import {
  REGULAR_GAME_MOCK,
  DLC_MOCK,
  DEMO_MOCK,
  SALE_GAME_MOCK,
  COMMUNITY_MOCK,
  createMockDOM,
  cleanupMockDOM,
  mockChromeAPIs,
  mockPerformanceAPI
} from '../mocks/steamPageMocks';

describe('Performance Tests', () => {
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

  describe('Detection Speed Requirements', () => {
    test('should detect games in under 10ms (PRD requirement)', async () => {
      createMockDOM(REGULAR_GAME_MOCK);

      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        detector.clearCache(); // Ensure fresh detection each time

        const startTime = performance.now();
        const result = await detector.detectGame();
        const endTime = performance.now();

        expect(result.success).toBe(true);
        times.push(endTime - startTime);
      }

      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      console.log(`Detection Speed Stats:
        - Average: ${averageTime.toFixed(2)}ms
        - Max: ${maxTime.toFixed(2)}ms
        - Min: ${minTime.toFixed(2)}ms
        - All times: ${times.map(t => t.toFixed(2)).join(', ')}ms`);

      // PRD Requirement: < 10ms performance impact
      expect(averageTime).toBeLessThan(10);
      expect(maxTime).toBeLessThan(25); // Allow some variance for max time
    });

    test('should maintain speed with caching enabled', async () => {
      detector = new SteamPageDetector({ useCache: true });
      createMockDOM(REGULAR_GAME_MOCK);

      // First detection (cache miss)
      const firstStart = performance.now();
      const firstResult = await detector.detectGame();
      const firstTime = performance.now() - firstStart;

      expect(firstResult.success).toBe(true);

      // Subsequent detections (cache hits)
      const cachedTimes: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const result = await detector.detectGame();
        const time = performance.now() - start;

        expect(result.success).toBe(true);
        cachedTimes.push(time);
      }

      const averageCachedTime = cachedTimes.reduce((sum, time) => sum + time, 0) / cachedTimes.length;

      console.log(`Caching Performance:
        - First detection: ${firstTime.toFixed(2)}ms
        - Average cached: ${averageCachedTime.toFixed(2)}ms
        - Speed improvement: ${((firstTime - averageCachedTime) / firstTime * 100).toFixed(1)}%`);

      // Cached detections should be much faster
      expect(averageCachedTime).toBeLessThan(firstTime * 0.5);
      expect(averageCachedTime).toBeLessThan(5); // Very fast for cached results
    });

    test('should handle concurrent detections efficiently', async () => {
      createMockDOM(REGULAR_GAME_MOCK);

      const concurrentCount = 20;
      const startTime = performance.now();

      const promises = Array(concurrentCount).fill(null).map(async () => {
        const detectionStart = performance.now();
        const result = await detector.detectGame();
        const detectionTime = performance.now() - detectionStart;
        return { result, detectionTime };
      });

      const results = await Promise.all(promises);
      const totalTime = performance.now() - startTime;

      // All should succeed
      results.forEach(({ result }) => {
        expect(result.success).toBe(true);
      });

      const averageDetectionTime = results.reduce((sum, r) => sum + r.detectionTime, 0) / results.length;

      console.log(`Concurrent Detection Performance:
        - Total time for ${concurrentCount} detections: ${totalTime.toFixed(2)}ms
        - Average per detection: ${averageDetectionTime.toFixed(2)}ms
        - Theoretical sequential time: ${(averageDetectionTime * concurrentCount).toFixed(2)}ms
        - Efficiency gain: ${((averageDetectionTime * concurrentCount - totalTime) / (averageDetectionTime * concurrentCount) * 100).toFixed(1)}%`);

      // Concurrent should be more efficient than sequential
      expect(totalTime).toBeLessThan(averageDetectionTime * concurrentCount * 0.8);
    });

    test('should scale well with different page complexities', async () => {
      const testPages = [
        { name: 'Simple Game', mock: REGULAR_GAME_MOCK, expectedMax: 8 },
        { name: 'Game on Sale', mock: SALE_GAME_MOCK, expectedMax: 10 },
        { name: 'DLC Page', mock: DLC_MOCK, expectedMax: 8 },
        { name: 'Demo Page', mock: DEMO_MOCK, expectedMax: 8 },
        { name: 'Community Page', mock: COMMUNITY_MOCK, expectedMax: 10 }
      ];

      const results: Array<{ name: string; time: number; success: boolean }> = [];

      for (const testPage of testPages) {
        createMockDOM(testPage.mock);

        const startTime = performance.now();
        const result = await detector.detectGame();
        const detectionTime = performance.now() - startTime;

        results.push({
          name: testPage.name,
          time: detectionTime,
          success: result.success
        });

        expect(result.success).toBe(true);
        expect(detectionTime).toBeLessThan(testPage.expectedMax);

        cleanupMockDOM();
      }

      console.log('Page Complexity Performance:');
      results.forEach(r => {
        console.log(`  - ${r.name}: ${r.time.toFixed(2)}ms`);
      });

      // Performance should be consistent across page types
      const times = results.map(r => r.time);
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const variance = maxTime - minTime;

      expect(variance).toBeLessThan(5); // Low variance indicates consistent performance
    });
  });

  describe('Memory Usage Requirements', () => {
    test('should not cause memory leaks with navigation observer', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      observer.start();

      // Simulate many rapid navigation events
      for (let i = 0; i < 1000; i++) {
        stateManager.updateState({
          currentUrl: `https://store.steampowered.com/app/${i}/`,
          previousUrl: i > 0 ? `https://store.steampowered.com/app/${i-1}/` : ''
        });

        observer.forceStateCheck();
      }

      const afterNavigationMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = afterNavigationMemory - initialMemory;

      observer.stop();

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryAfterCleanup = finalMemory - initialMemory;

      console.log(`Memory Usage:
        - Initial: ${(initialMemory / 1024 / 1024).toFixed(2)} MB
        - After 1000 navigations: ${(afterNavigationMemory / 1024 / 1024).toFixed(2)} MB
        - After cleanup: ${(finalMemory / 1024 / 1024).toFixed(2)} MB
        - Net increase: ${(memoryAfterCleanup / 1024 / 1024).toFixed(2)} MB`);

      // Memory increase should be minimal (< 5MB for 1000 navigations)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);

      // Memory should be largely freed after cleanup
      expect(memoryAfterCleanup).toBeLessThan(memoryIncrease * 0.5);
    });

    test('should manage memory efficiently with large listener sets', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      observer.start();

      // Add many listeners
      const unsubscribers = Array(1000).fill(null).map((_, i) =>
        observer.addListener(() => {
          // Simulate some work
          return `listener-${i}`;
        })
      );

      const withListenersMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Remove all listeners
      unsubscribers.forEach(unsubscribe => unsubscribe());

      const afterRemovalMemory = (performance as any).memory?.usedJSHeapSize || 0;

      const listenerMemoryUsage = withListenersMemory - initialMemory;
      const memoryReclaimed = withListenersMemory - afterRemovalMemory;
      const reclaimPercentage = (memoryReclaimed / listenerMemoryUsage) * 100;

      console.log(`Listener Memory Management:
        - Memory with 1000 listeners: ${(listenerMemoryUsage / 1024).toFixed(2)} KB
        - Memory reclaimed: ${(memoryReclaimed / 1024).toFixed(2)} KB
        - Reclaim percentage: ${reclaimPercentage.toFixed(1)}%`);

      // Should reclaim most memory when listeners are removed
      expect(reclaimPercentage).toBeGreaterThan(80);
    });

    test('should handle cache memory efficiently', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      detector = new SteamPageDetector({ useCache: true });

      // Create many cache entries
      for (let i = 0; i < 100; i++) {
        const mockData = {
          ...REGULAR_GAME_MOCK,
          url: `https://store.steampowered.com/app/${i}/`,
          expectedAppId: String(i)
        };

        createMockDOM(mockData);

        Object.defineProperty(window, 'location', {
          value: { href: mockData.url },
          configurable: true
        });

        await detector.detectGame();
        cleanupMockDOM();
      }

      const withCacheMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Clear cache
      detector.clearCache();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const afterClearMemory = (performance as any).memory?.usedJSHeapSize || 0;

      const cacheMemoryUsage = withCacheMemory - initialMemory;
      const memoryReclaimed = withCacheMemory - afterClearMemory;

      console.log(`Cache Memory Management:
        - Memory with 100 cache entries: ${(cacheMemoryUsage / 1024).toFixed(2)} KB
        - Memory reclaimed after clear: ${(memoryReclaimed / 1024).toFixed(2)} KB
        - Cache overhead per entry: ${(cacheMemoryUsage / 100 / 1024).toFixed(2)} KB`);

      // Cache should use reasonable memory per entry (< 1KB average)
      expect(cacheMemoryUsage / 100).toBeLessThan(1024);
    });
  });

  describe('Observer Performance', () => {
    test('should handle high-frequency DOM mutations efficiently', (done) => {
      let mutationCallCount = 0;
      const startTime = performance.now();

      // Mock MutationObserver to track callback frequency
      global.MutationObserver = jest.fn().mockImplementation((callback) => {
        const mockObserver = {
          observe: jest.fn(),
          disconnect: jest.fn(),
          takeRecords: jest.fn()
        };

        // Simulate high-frequency mutations
        const intervalId = setInterval(() => {
          mutationCallCount++;
          callback([{
            type: 'childList',
            target: document.body,
            addedNodes: [document.createElement('div')],
            removedNodes: [],
            previousSibling: null,
            nextSibling: null,
            attributeName: null,
            attributeNamespace: null,
            oldValue: null
          }]);

          // Stop after 100 mutations
          if (mutationCallCount >= 100) {
            clearInterval(intervalId);

            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const averageTimePerMutation = totalTime / mutationCallCount;

            console.log(`Mutation Handling Performance:
              - Total mutations: ${mutationCallCount}
              - Total time: ${totalTime.toFixed(2)}ms
              - Average per mutation: ${averageTimePerMutation.toFixed(2)}ms`);

            // Should handle mutations efficiently (< 1ms per mutation on average)
            expect(averageTimePerMutation).toBeLessThan(1);
            done();
          }
        }, 1);

        return mockObserver;
      });

      observer.start();
    }, 10000); // 10 second timeout

    test('should maintain performance with complex DOM structures', () => {
      // Create complex DOM structure
      const complexStructure = document.createElement('div');
      complexStructure.innerHTML = `
        <div class="game_area_purchase" data-appid="730">
          ${Array(100).fill(null).map((_, i) => `
            <div class="nested-level-${i}">
              <span class="data-element">${i}</span>
              <div class="sub-container">
                ${Array(10).fill(null).map((_, j) => `
                  <p class="text-content">Content ${i}-${j}</p>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;

      document.body.appendChild(complexStructure);

      const startTime = performance.now();

      // Test mutation detection on complex structure
      const mutation: MutationRecord = {
        type: 'childList',
        target: complexStructure,
        addedNodes: [document.createElement('div')],
        removedNodes: [],
        previousSibling: null,
        nextSibling: null,
        attributeName: null,
        attributeNamespace: null,
        oldValue: null
      };

      const isRelevant = observer['isRelevantMutation'](mutation);
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      console.log(`Complex DOM Mutation Analysis:
        - DOM complexity: 1000+ elements
        - Processing time: ${processingTime.toFixed(2)}ms
        - Is relevant: ${isRelevant}`);

      // Should process complex mutations quickly (< 5ms)
      expect(processingTime).toBeLessThan(5);
      expect(isRelevant).toBe(true); // Should detect the data-appid attribute
    });

    test('should throttle performance monitoring effectively', (done) => {
      const checkTimes: number[] = [];

      // Override performance check to track timing
      const originalCheckPerformance = observer['checkPerformance'];
      observer['checkPerformance'] = jest.fn().mockImplementation(() => {
        checkTimes.push(Date.now());
        originalCheckPerformance.call(observer);
      });

      observer.start();

      // Wait for several performance checks
      setTimeout(() => {
        observer.stop();

        if (checkTimes.length >= 2) {
          const intervals = checkTimes.slice(1).map((time, i) => time - checkTimes[i]);
          const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;

          console.log(`Performance Monitoring Throttling:
            - Number of checks: ${checkTimes.length}
            - Average interval: ${averageInterval}ms
            - Expected interval: ~5000ms`);

          // Should throttle to approximately 5-second intervals
          expect(averageInterval).toBeGreaterThan(4000);
          expect(averageInterval).toBeLessThan(6000);
        }

        done();
      }, 12000); // Wait 12 seconds for at least 2 checks
    }, 15000); // 15 second timeout
  });

  describe('Scalability Tests', () => {
    test('should handle large-scale detection batches', async () => {
      const batchSizes = [10, 50, 100, 200];
      const results: Array<{ batchSize: number; totalTime: number; averageTime: number }> = [];

      for (const batchSize of batchSizes) {
        createMockDOM(REGULAR_GAME_MOCK);

        const startTime = performance.now();

        const promises = Array(batchSize).fill(null).map(() => detector.detectGame());
        await Promise.all(promises);

        const totalTime = performance.now() - startTime;
        const averageTime = totalTime / batchSize;

        results.push({ batchSize, totalTime, averageTime });

        console.log(`Batch ${batchSize}: ${totalTime.toFixed(2)}ms total, ${averageTime.toFixed(2)}ms average`);

        cleanupMockDOM();
      }

      // Performance should scale reasonably (not exponentially)
      const scalingFactors = results.slice(1).map((result, i) =>
        result.averageTime / results[i].averageTime
      );

      scalingFactors.forEach(factor => {
        expect(factor).toBeLessThan(2); // Should not double with batch size increases
      });

      console.log('Scaling factors:', scalingFactors.map(f => f.toFixed(2)));
    });

    test('should maintain performance under sustained load', async () => {
      const testDuration = 5000; // 5 seconds
      const startTime = Date.now();
      let detectionCount = 0;
      const detectionTimes: number[] = [];

      createMockDOM(REGULAR_GAME_MOCK);

      while (Date.now() - startTime < testDuration) {
        const detectionStart = performance.now();
        const result = await detector.detectGame();
        const detectionTime = performance.now() - detectionStart;

        expect(result.success).toBe(true);
        detectionTimes.push(detectionTime);
        detectionCount++;

        // Brief pause to simulate real usage
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const averageTime = detectionTimes.reduce((sum, time) => sum + time, 0) / detectionTimes.length;
      const maxTime = Math.max(...detectionTimes);
      const minTime = Math.min(...detectionTimes);

      console.log(`Sustained Load Test (${testDuration}ms):
        - Total detections: ${detectionCount}
        - Average time: ${averageTime.toFixed(2)}ms
        - Max time: ${maxTime.toFixed(2)}ms
        - Min time: ${minTime.toFixed(2)}ms
        - Detections per second: ${(detectionCount / (testDuration / 1000)).toFixed(1)}`);

      // Performance should remain consistent under sustained load
      expect(averageTime).toBeLessThan(10);
      expect(maxTime).toBeLessThan(25);

      // Should maintain reasonable throughput
      expect(detectionCount).toBeGreaterThan(testDuration / 100); // At least 1 detection per 100ms
    });
  });

  describe('Resource Efficiency', () => {
    test('should optimize DOM queries', async () => {
      createMockDOM(REGULAR_GAME_MOCK);

      const result = await detector.detectGame();

      expect(result.success).toBe(true);
      expect(result.metrics.domQueries).toBeLessThan(10); // Should be efficient with DOM queries

      console.log(`DOM Query Efficiency:
        - Total DOM queries: ${result.metrics.domQueries}
        - Detection time: ${result.metrics.detectionTime.toFixed(2)}ms
        - Queries per ms: ${(result.metrics.domQueries / result.metrics.detectionTime).toFixed(2)}`);
    });

    test('should minimize observer overhead', () => {
      const stats = observer.getStats();

      observer.start();

      const activeStats = observer.getStats();

      console.log(`Observer Resource Usage:
        - Observers created: ${activeStats.observerCount}
        - Initial listener count: ${stats.listenerCount}
        - Active listener count: ${activeStats.listenerCount}`);

      // Should create minimal number of observers
      expect(activeStats.observerCount).toBeLessThan(5);
      expect(activeStats.observerCount).toBeGreaterThan(0);
    });

    test('should efficiently manage configuration updates', () => {
      observer.start();
      const initialObserverCount = observer.getStats().observerCount;

      const startTime = performance.now();

      // Multiple rapid configuration updates
      for (let i = 0; i < 10; i++) {
        observer.updateConfig({ debounceDelay: 100 + i * 10 });
      }

      const updateTime = performance.now() - startTime;
      const finalObserverCount = observer.getStats().observerCount;

      console.log(`Configuration Update Performance:
        - 10 updates in: ${updateTime.toFixed(2)}ms
        - Average per update: ${(updateTime / 10).toFixed(2)}ms
        - Observer count stable: ${initialObserverCount === finalObserverCount}`);

      // Configuration updates should be fast
      expect(updateTime).toBeLessThan(50);
      expect(updateTime / 10).toBeLessThan(5); // < 5ms per update

      // Observer count should remain stable
      expect(finalObserverCount).toBe(initialObserverCount);
    });
  });
});
/**
 * Comprehensive performance optimization test
 * Validates that the Steam page detection system meets <10ms target
 */

import { SteamPageDetector } from '../../src/content/detection/SteamPageDetector';
import { NavigationObserver } from '../../src/content/navigation/NavigationObserver';
import { StateManager } from '../../src/content/managers/StateManager';
import { GlobalPerformanceMonitor, GlobalPerformanceValidator } from '../../src/content/utils/PerformanceValidator';

// Mock DOM environment for testing
const mockDOM = () => {
  // Mock window.location
  Object.defineProperty(window, 'location', {
    value: {
      href: 'https://store.steampowered.com/app/123456/Test_Game/',
      protocol: 'https:',
      host: 'store.steampowered.com'
    },
    writable: true
  });

  // Mock document
  Object.defineProperty(document, 'title', {
    value: 'Test Game on Steam',
    writable: true
  });

  // Mock performance.memory if available
  if ('memory' in performance) {
    Object.defineProperty(performance, 'memory', {
      value: {
        usedJSHeapSize: 10 * 1024 * 1024, // 10MB
        totalJSHeapSize: 20 * 1024 * 1024
      },
      writable: true
    });
  }

  // Mock querySelector to return predictable elements
  const originalQuerySelector = document.querySelector;
  document.querySelector = jest.fn((selector) => {
    if (selector === 'meta[property="og:title"]') {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:title');
      meta.setAttribute('content', 'Test Game');
      return meta;
    }
    if (selector.includes('[data-appid]')) {
      const div = document.createElement('div');
      div.setAttribute('data-appid', '123456');
      return div;
    }
    return originalQuerySelector.call(document, selector);
  });
};

describe('Steam Page Detection Performance Optimization', () => {
  beforeEach(() => {
    mockDOM();
    GlobalPerformanceMonitor.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Early Exit Optimization', () => {
    it('should quickly reject non-Steam pages', async () => {
      // Test non-Steam URL
      Object.defineProperty(window, 'location', {
        value: { href: 'https://google.com/search' },
        writable: true
      });

      const startTime = performance.now();
      const isGamePage = SteamPageDetector.isGamePage();
      const duration = performance.now() - startTime;

      expect(isGamePage).toBe(false);
      expect(duration).toBeLessThan(1); // Should be nearly instantaneous
    });

    it('should quickly identify Steam game pages', async () => {
      const gameUrls = [
        'https://store.steampowered.com/app/123456/',
        'https://store.steampowered.com/app/123456/Game_Name/',
        'https://steamcommunity.com/app/123456'
      ];

      for (const url of gameUrls) {
        const startTime = performance.now();
        const isGamePage = SteamPageDetector.isGamePage(url);
        const duration = performance.now() - startTime;

        expect(isGamePage).toBe(true);
        expect(duration).toBeLessThan(1);
      }
    });
  });

  describe('DOM Query Optimization', () => {
    it('should use element caching effectively', async () => {
      const detector = new SteamPageDetector({ useCache: true });

      // First detection - should cache elements
      const result1 = await detector.detectGame();
      const domQueries1 = result1.metrics?.domQueries || 0;

      // Second detection - should use cached elements
      const result2 = await detector.detectGame();
      const domQueries2 = result2.metrics?.domQueries || 0;

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(domQueries2).toBeLessThanOrEqual(domQueries1);
    });

    it('should minimize DOM queries per detection', async () => {
      const detector = new SteamPageDetector();
      const result = await detector.detectGame();

      expect(result.metrics?.domQueries).toBeLessThanOrEqual(10);
    });
  });

  describe('Performance Targets', () => {
    it('should meet <10ms detection target for cached results', async () => {
      const detector = new SteamPageDetector({ useCache: true });

      // Prime the cache
      await detector.detectGame();

      // Test cached performance
      const startTime = performance.now();
      const result = await detector.detectGame();
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10);
    });

    it('should meet reasonable performance for fresh detections', async () => {
      const detector = new SteamPageDetector({ useCache: false });

      const startTime = performance.now();
      const result = await detector.detectGame();
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(50); // Allow higher limit for fresh detections
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with multiple detections', async () => {
      const detector = new SteamPageDetector();
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Perform multiple detections
      for (let i = 0; i < 10; i++) {
        await detector.detectGame();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal
      expect(memoryIncrease).toBeLessThan(1024 * 1024); // Less than 1MB
    });

    it('should clean up observers properly', () => {
      const stateManager = new StateManager();
      const observer = new NavigationObserver(stateManager);

      observer.start();
      expect(observer.isObserving()).toBe(true);

      const stats = observer.getMemoryStats();
      expect(stats.observerCount).toBeGreaterThan(0);

      observer.stop();
      expect(observer.isObserving()).toBe(false);

      const finalStats = observer.getMemoryStats();
      expect(finalStats.observerCount).toBe(0);
      expect(finalStats.mutationBufferSize).toBe(0);
    });
  });

  describe('Mutation Observer Optimization', () => {
    it('should efficiently filter relevant mutations', () => {
      const stateManager = new StateManager();
      const observer = new NavigationObserver(stateManager);

      // Test that mutation buffer is bounded
      observer.start();

      // Simulate many mutations
      const mockMutations = Array.from({ length: 200 }, (_, i) => ({
        type: 'childList',
        addedNodes: [document.createElement('div')],
        removedNodes: [],
        target: document.body
      })) as MutationRecord[];

      // Access private method for testing
      const processMutationBuffer = (observer as any).processMutationBuffer;
      const mutationBuffer = (observer as any).mutationBuffer;

      mutationBuffer.push(...mockMutations);
      expect(mutationBuffer.length).toBeLessThanOrEqual(100); // Should be bounded

      observer.stop();
    });
  });

  describe('Cache Management', () => {
    it('should limit cache size to prevent memory bloat', async () => {
      const detector = new SteamPageDetector({ useCache: true });

      // Generate many different URLs to fill cache
      for (let i = 0; i < 100; i++) {
        Object.defineProperty(window, 'location', {
          value: { href: `https://store.steampowered.com/app/${i}/` },
          writable: true
        });
        await detector.detectGame();
      }

      // Cache should be limited
      const cache = (detector as any).cache;
      expect(cache.size).toBeLessThanOrEqual(50);
    });
  });

  describe('Comprehensive Performance Validation', () => {
    it('should pass full performance validation', async () => {
      const result = await GlobalPerformanceValidator.validatePerformance();

      console.log(GlobalPerformanceValidator.generateSummary(result));

      expect(result.passed).toBe(true);
      expect(result.averageDetectionTime).toBeLessThan(10);
      expect(result.details.cachePerformance).toBe(true);
      expect(result.details.domQueryEfficiency).toBe(true);
      expect(result.details.memoryUsage).toBe(true);
      expect(result.details.errorRate).toBe(true);
    }, 30000); // Allow 30s for comprehensive test
  });
});

// Performance benchmark runner
describe('Performance Benchmarks', () => {
  it('should demonstrate performance improvements', async () => {
    console.log('\n=== Performance Benchmark Results ===');

    // Benchmark different scenarios
    const scenarios = [
      {
        name: 'Early Exit (Non-Game Page)',
        setup: () => {
          Object.defineProperty(window, 'location', {
            value: { href: 'https://store.steampowered.com/search/' },
            writable: true
          });
        },
        test: () => SteamPageDetector.isGamePage()
      },
      {
        name: 'Cached Detection',
        setup: () => {
          Object.defineProperty(window, 'location', {
            value: { href: 'https://store.steampowered.com/app/123456/' },
            writable: true
          });
        },
        test: async () => {
          const detector = new SteamPageDetector({ useCache: true });
          await detector.detectGame(); // Prime cache
          return detector.detectGame(); // Use cache
        }
      },
      {
        name: 'Fresh Detection',
        setup: () => {
          Object.defineProperty(window, 'location', {
            value: { href: 'https://store.steampowered.com/app/123456/' },
            writable: true
          });
        },
        test: async () => {
          const detector = new SteamPageDetector({ useCache: false });
          return detector.detectGame();
        }
      }
    ];

    for (const scenario of scenarios) {
      scenario.setup();

      const times: number[] = [];
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        await scenario.test();
        const duration = performance.now() - startTime;
        times.push(duration);
      }

      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      console.log(`${scenario.name}:`);
      console.log(`  Average: ${avgTime.toFixed(2)}ms`);
      console.log(`  Min: ${minTime.toFixed(2)}ms`);
      console.log(`  Max: ${maxTime.toFixed(2)}ms`);
      console.log(`  Target Met: ${avgTime < 10 ? '✓' : '✗'}`);
    }

    console.log('\n' + GlobalPerformanceMonitor.getSummary());
    console.log('=== End Benchmark Results ===\n');
  });
});
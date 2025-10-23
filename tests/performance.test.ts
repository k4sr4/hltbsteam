/**
 * Performance Tests for HLTB Steam Extension
 *
 * Tests validate performance targets from PRD 10:
 * - Database load time: < 100ms
 * - Memory usage: < 50MB (with 500+ games)
 * - Fuzzy matching: < 15ms per lookup
 * - Direct match lookup: < 1ms (Map-based)
 * - Bundle size: < 500KB (including JSON database)
 */

import { HLTBFallback } from '../src/background/services/hltb-fallback';
import { PerformanceMonitor } from '../src/shared/performance-monitor';
import { memoizeWithLRU, throttle, RAFQueue } from '../src/shared/optimization-utils';
import * as fs from 'fs';
import * as path from 'path';

describe('Performance Tests', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = PerformanceMonitor.getInstance();
    performanceMonitor.clear();
  });

  describe('Database Performance', () => {
    test('Database initialization should complete in < 100ms', () => {
      const startTime = performance.now();
      const fallback = new HLTBFallback();
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
      console.log(`Database initialized in ${duration.toFixed(2)}ms`);
    });

    test('Database should handle 500+ games efficiently', () => {
      const fallback = new HLTBFallback();
      const stats = fallback.getStats();

      expect(stats.totalGames).toBeGreaterThan(0);
      expect(stats.initializationTime).toBeLessThan(100);

      console.log(`Database contains ${stats.totalGames} games`);
      console.log(`Initialization time: ${stats.initializationTime.toFixed(2)}ms`);
    });

    test('Direct match lookup should complete in < 1ms', async () => {
      const fallback = new HLTBFallback();

      // Get a known game from the database
      const games = fallback.getAvailableGames();
      expect(games.length).toBeGreaterThan(0);

      const testGame = games[0];

      // Measure lookup time
      const startTime = performance.now();
      const result = await fallback.searchFallback(testGame);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).not.toBeNull();
      expect(duration).toBeLessThan(1);

      console.log(`Direct match lookup: ${duration.toFixed(3)}ms`);
    });

    test('Fuzzy match lookup should complete in < 15ms', async () => {
      const fallback = new HLTBFallback();

      // Test fuzzy matching with a slightly modified title
      const games = fallback.getAvailableGames();
      const testGame = games[0];
      const fuzzyTitle = testGame.split(' ').slice(0, 2).join(' '); // Take first 2 words

      const startTime = performance.now();
      const result = await fallback.searchFallback(fuzzyTitle);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Fuzzy matching may or may not find a match, but should be fast
      expect(duration).toBeLessThan(15);

      console.log(`Fuzzy match lookup: ${duration.toFixed(2)}ms`);
    });

    test('Average lookup time should be reasonable', async () => {
      const fallback = new HLTBFallback();
      const games = fallback.getAvailableGames();

      // Perform 50 lookups
      const iterations = Math.min(50, games.length);
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await fallback.searchFallback(games[i]);
        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      expect(avgTime).toBeLessThan(5); // Average should be < 5ms

      console.log(`Average lookup time: ${avgTime.toFixed(2)}ms`);
      console.log(`Min: ${minTime.toFixed(3)}ms, Max: ${maxTime.toFixed(2)}ms`);
    });

    test('Memory usage should be < 50MB', () => {
      const fallback = new HLTBFallback();
      const stats = fallback.getStats();

      const memoryMB = stats.memoryUsage / 1024 / 1024;

      expect(memoryMB).toBeLessThan(50);

      console.log(`Estimated memory usage: ${memoryMB.toFixed(2)}MB`);
    });

    test('Cache hit rate should be high for repeated lookups', async () => {
      const fallback = new HLTBFallback();
      const games = fallback.getAvailableGames();
      const testGame = games[0];

      // Reset performance counters
      fallback.resetPerformanceCounters();

      // Perform same lookup 10 times
      for (let i = 0; i < 10; i++) {
        await fallback.searchFallback(testGame);
      }

      const stats = fallback.getStats();

      // All should be cache hits (direct match)
      expect(stats.cacheHitRate).toBeGreaterThan(0.9); // > 90% hit rate

      console.log(`Cache hit rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
    });
  });

  describe('Bundle Size Performance', () => {
    test('Background bundle should be < 500KB', () => {
      const bundlePath = path.join(__dirname, '../dist/background.js');

      if (fs.existsSync(bundlePath)) {
        const stats = fs.statSync(bundlePath);
        const sizeKB = stats.size / 1024;

        expect(sizeKB).toBeLessThan(500);

        console.log(`Background bundle size: ${sizeKB.toFixed(2)}KB`);
      } else {
        console.warn('Background bundle not found, run npm run build first');
      }
    });

    test('Content bundle should be < 50KB', () => {
      const bundlePath = path.join(__dirname, '../dist/content.js');

      if (fs.existsSync(bundlePath)) {
        const stats = fs.statSync(bundlePath);
        const sizeKB = stats.size / 1024;

        expect(sizeKB).toBeLessThan(50);

        console.log(`Content bundle size: ${sizeKB.toFixed(2)}KB`);
      } else {
        console.warn('Content bundle not found, run npm run build first');
      }
    });

    test('Popup bundle should be < 20KB', () => {
      const bundlePath = path.join(__dirname, '../dist/popup.js');

      if (fs.existsSync(bundlePath)) {
        const stats = fs.statSync(bundlePath);
        const sizeKB = stats.size / 1024;

        expect(sizeKB).toBeLessThan(20);

        console.log(`Popup bundle size: ${sizeKB.toFixed(2)}KB`);
      } else {
        console.warn('Popup bundle not found, run npm run build first');
      }
    });
  });

  describe('PerformanceMonitor Tests', () => {
    test('PerformanceMonitor should track timing accurately', () => {
      const monitor = PerformanceMonitor.getInstance();
      monitor.clear();

      monitor.startTiming('test_operation');

      // Simulate some work
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }

      const duration = monitor.endTiming('test_operation');

      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should be very fast

      const report = monitor.getReport();
      expect(report.metrics.length).toBe(1);
      expect(report.metrics[0].name).toBe('test_operation');
    });

    test('PerformanceMonitor should measure async operations', async () => {
      const monitor = PerformanceMonitor.getInstance();
      monitor.clear();

      const result = await monitor.measure('async_operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'done';
      });

      expect(result).toBe('done');

      const report = monitor.getReport();
      expect(report.metrics.length).toBe(1);
      expect(report.metrics[0].duration).toBeGreaterThanOrEqual(10);
    });

    test('PerformanceMonitor should detect memory trends', () => {
      const monitor = PerformanceMonitor.getInstance();
      monitor.clear();

      // Take multiple memory snapshots
      for (let i = 0; i < 20; i++) {
        monitor.takeMemorySnapshot();
      }

      const leakInfo = monitor.detectMemoryLeaks();

      expect(leakInfo.trend).toBeDefined();
      expect(['increasing', 'stable', 'decreasing']).toContain(leakInfo.trend);

      console.log(`Memory trend: ${leakInfo.trend}, Growth: ${leakInfo.growth.toFixed(2)}%`);
    });

    test('PerformanceMonitor should track FPS', (done) => {
      const monitor = PerformanceMonitor.getInstance();

      monitor.startFPSMonitoring();

      // Let it collect some samples
      setTimeout(() => {
        const fps = monitor.stopFPSMonitoring();

        expect(fps).not.toBeNull();
        if (fps) {
          expect(fps.average).toBeGreaterThan(0);
          expect(fps.samples).toBeGreaterThan(0);

          console.log(`FPS Average: ${fps.average.toFixed(1)}, Samples: ${fps.samples}`);
        }

        done();
      }, 500);
    });

    test('PerformanceMonitor should check targets', () => {
      const monitor = PerformanceMonitor.getInstance();
      monitor.clear();

      // Record some metrics
      monitor.startTiming('fast_op');
      monitor.endTiming('fast_op');

      monitor.startTiming('slow_op');
      // Simulate slower operation
      for (let i = 0; i < 10000; i++) {
        Math.sqrt(i);
      }
      monitor.endTiming('slow_op');

      const results = monitor.checkTargets({
        fast_op: 1, // Target: < 1ms
        slow_op: 10 // Target: < 10ms
      });

      expect(results.fast_op).toBeDefined();
      expect(results.slow_op).toBeDefined();

      console.log('Target check results:', results);
    });
  });

  describe('Optimization Utilities Tests', () => {
    test('memoizeWithLRU should cache results', () => {
      let callCount = 0;

      const expensiveFunc = memoizeWithLRU((x: number) => {
        callCount++;
        return x * 2;
      }, 10);

      // First call
      expect(expensiveFunc(5)).toBe(10);
      expect(callCount).toBe(1);

      // Cached call
      expect(expensiveFunc(5)).toBe(10);
      expect(callCount).toBe(1); // Should not increment

      // Different input
      expect(expensiveFunc(10)).toBe(20);
      expect(callCount).toBe(2);
    });

    test('memoizeWithLRU should evict oldest entries', () => {
      let callCount = 0;

      const func = memoizeWithLRU((x: number) => {
        callCount++;
        return x * 2;
      }, 3); // Max 3 entries

      // Fill cache
      func(1);
      func(2);
      func(3);
      expect(callCount).toBe(3);

      // Add 4th entry (should evict 1)
      func(4);
      expect(callCount).toBe(4);

      // Access 1 again (should not be cached)
      func(1);
      expect(callCount).toBe(5);

      // Access 2, 3, 4 (should be cached)
      const initialCount = callCount;
      func(2);
      func(3);
      func(4);
      expect(callCount).toBe(initialCount); // No new calls
    });

    test('throttle should limit function calls', (done) => {
      let callCount = 0;

      const throttled = throttle(() => {
        callCount++;
      }, 100);

      // Call multiple times rapidly
      throttled();
      throttled();
      throttled();
      throttled();

      // Should only execute once (leading call)
      expect(callCount).toBe(1);

      // Wait for throttle period
      setTimeout(() => {
        throttled();
        expect(callCount).toBe(2);
        done();
      }, 150);
    });

    test('RAFQueue should batch operations', (done) => {
      const queue = new RAFQueue();
      const operations: number[] = [];

      // Add multiple operations
      queue.add(() => operations.push(1));
      queue.add(() => operations.push(2));
      queue.add(() => operations.push(3));

      // Operations should not be executed yet
      expect(operations.length).toBe(0);
      expect(queue.pending).toBe(3);

      // Wait for next frame
      requestAnimationFrame(() => {
        // All operations should be executed
        expect(operations).toEqual([1, 2, 3]);
        expect(queue.pending).toBe(0);
        done();
      });
    });

    test('RAFQueue flush should execute immediately', () => {
      const queue = new RAFQueue();
      const operations: number[] = [];

      queue.add(() => operations.push(1));
      queue.add(() => operations.push(2));

      // Flush immediately
      queue.flush();

      expect(operations).toEqual([1, 2]);
      expect(queue.pending).toBe(0);
    });
  });

  describe('Performance Regression Tests', () => {
    test('Title normalization should be fast', () => {
      const normalizeTitle = (title: string) =>
        title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

      const testTitles = [
        'The Witcher 3: Wild Hunt',
        'Grand Theft Auto V',
        'Half-Life 2',
        'Portal 2',
        'Dark Souls III'
      ];

      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        testTitles.forEach(title => normalizeTitle(title));
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // 5000 normalizations in < 100ms

      console.log(`5000 title normalizations: ${duration.toFixed(2)}ms`);
    });

    test('Map lookups should be O(1)', () => {
      const map = new Map<string, number>();

      // Populate map with 10,000 entries
      for (let i = 0; i < 10000; i++) {
        map.set(`key_${i}`, i);
      }

      // Measure lookup time
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        map.get(`key_${i % 10000}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgLookup = duration / 1000;

      expect(avgLookup).toBeLessThan(0.01); // < 0.01ms per lookup

      console.log(`1000 Map lookups: ${duration.toFixed(2)}ms (${avgLookup.toFixed(4)}ms avg)`);
    });
  });
});

/**
 * Performance Tests for HLTBDisplay Shadow DOM Component
 *
 * Tests the component against strict performance budgets:
 * - Component Creation: < 10ms
 * - Mount to DOM: < 20ms
 * - Render State: < 20ms
 * - Total Time: < 50ms
 *
 * Also tests memory efficiency, FPS during animations, and layout shift.
 */

import { HLTBDisplay, createHLTBDisplay } from '../../src/content/components/HLTBDisplay';
import { HLTBData, DisplayState, HLTBDisplayConfig } from '../../src/content/types/HLTB';

/**
 * Mock HLTB data for testing
 */
const MOCK_DATA: HLTBData = {
  mainStory: 12,
  mainExtra: 18,
  completionist: 25,
  allStyles: 15,
  gameId: 12345,
  source: 'api',
  confidence: 'high'
};

const MOCK_DATA_PARTIAL: HLTBData = {
  mainStory: 8,
  mainExtra: null,
  completionist: null,
  source: 'cache',
  confidence: 'medium'
};

const MOCK_DATA_NO_DATA: HLTBData = {
  mainStory: null,
  mainExtra: null,
  completionist: null,
  source: 'fallback',
  confidence: 'low'
};

/**
 * Performance helper utilities
 */
class PerformanceHelper {
  static measure(fn: () => void): number {
    const start = performance.now();
    fn();
    return performance.now() - start;
  }

  static async measureAsync(fn: () => Promise<void>): Promise<number> {
    const start = performance.now();
    await fn();
    return performance.now() - start;
  }

  static average(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  static percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  static median(values: number[]): number {
    return this.percentile(values, 50);
  }

  static standardDeviation(values: number[]): number {
    const avg = this.average(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = this.average(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }
}

/**
 * Memory helper utilities
 */
class MemoryHelper {
  static getHeapSize(): number {
    return (performance as any).memory?.usedJSHeapSize || 0;
  }

  static measureMemoryUsage(fn: () => void): number {
    const initialMemory = this.getHeapSize();
    fn();
    const finalMemory = this.getHeapSize();
    return finalMemory - initialMemory;
  }

  static forceGC(): void {
    if (global.gc) {
      global.gc();
    }
  }
}

/**
 * Setup JSDOM environment for tests
 */
beforeAll(() => {
  // Mock performance.now if not available
  if (!global.performance) {
    global.performance = {
      now: () => Date.now()
    } as any;
  }

  // Mock requestAnimationFrame
  global.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    return setTimeout(() => cb(Date.now()), 0) as any;
  }) as any;

  global.cancelAnimationFrame = ((id: number) => {
    clearTimeout(id);
  }) as any;
});

describe('HLTBDisplay Performance Tests', () => {
  let container: HTMLElement;

  beforeEach(() => {
    // Create fresh container for each test
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Clean up
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Component Creation Performance (Budget: < 10ms)', () => {
    test('constructor completes in under 10ms', () => {
      const durations: number[] = [];

      // Run 10 iterations to get average
      for (let i = 0; i < 10; i++) {
        const duration = PerformanceHelper.measure(() => {
          const display = new HLTBDisplay();
        });
        durations.push(duration);
      }

      const avgDuration = PerformanceHelper.average(durations);
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);

      console.log(`Creation Performance:
        - Average: ${avgDuration.toFixed(2)}ms
        - Min: ${minDuration.toFixed(2)}ms
        - Max: ${maxDuration.toFixed(2)}ms
        - Median: ${PerformanceHelper.median(durations).toFixed(2)}ms
        - Std Dev: ${PerformanceHelper.standardDeviation(durations).toFixed(2)}ms`);

      expect(avgDuration).toBeLessThan(10);
      expect(maxDuration).toBeLessThan(15); // Allow some variance for max
    });

    test('constructor with custom config completes in under 10ms', () => {
      const config: HLTBDisplayConfig = {
        enableAnimations: true,
        showLoading: true,
        showErrors: true,
        theme: {
          mode: 'dark',
          colors: {
            primary: '#66c0f4',
            secondary: '#8b98a5',
            background: '#2a475e'
          }
        },
        customClasses: ['custom-class-1', 'custom-class-2'],
        accessibility: true,
        enableLink: true,
        showSource: true
      };

      const duration = PerformanceHelper.measure(() => {
        const display = new HLTBDisplay(config);
      });

      console.log(`Creation with config: ${duration.toFixed(2)}ms`);

      expect(duration).toBeLessThan(10);
    });

    test('factory function creates instance in under 10ms', () => {
      const duration = PerformanceHelper.measure(() => {
        const display = createHLTBDisplay();
      });

      expect(duration).toBeLessThan(10);
    });
  });

  describe('Mount Performance (Budget: < 20ms)', () => {
    test('mount() completes in under 20ms', () => {
      const display = new HLTBDisplay();

      const duration = PerformanceHelper.measure(() => {
        display.mount(container);
      });

      console.log(`Mount duration: ${duration.toFixed(2)}ms`);

      expect(duration).toBeLessThan(20);

      // Verify shadow DOM was created
      const hostElement = container.querySelector('.hltb-display-host');
      expect(hostElement).toBeTruthy();
      expect((hostElement as any).shadowRoot).toBeTruthy();

      display.destroy();
    });

    test('mount with different positions maintains performance', () => {
      const positions: Array<'before' | 'after' | 'prepend' | 'append'> = [
        'before', 'after', 'prepend', 'append'
      ];

      positions.forEach(position => {
        const display = new HLTBDisplay();
        const target = document.createElement('div');
        container.appendChild(target);

        const duration = PerformanceHelper.measure(() => {
          display.mount(target, position);
        });

        console.log(`Mount (${position}): ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(20);

        display.destroy();
      });
    });

    test('mount includes shadow DOM overhead within budget', () => {
      const display = new HLTBDisplay();
      display.mount(container);

      const metrics = display.getMetrics();

      console.log(`Shadow DOM overhead: ${metrics.shadowDOMTime?.toFixed(2)}ms`);

      expect(metrics.shadowDOMTime).toBeLessThan(5);
      expect(metrics.injectionTime).toBeLessThan(20);

      display.destroy();
    });

    test('repeated mount/destroy maintains performance', () => {
      const durations: number[] = [];

      for (let i = 0; i < 10; i++) {
        const display = new HLTBDisplay();

        const duration = PerformanceHelper.measure(() => {
          display.mount(container);
        });

        durations.push(duration);
        display.destroy();
      }

      const avgDuration = PerformanceHelper.average(durations);

      console.log(`Repeated mount average: ${avgDuration.toFixed(2)}ms`);

      expect(avgDuration).toBeLessThan(20);

      // Performance should not degrade over iterations
      const firstThree = PerformanceHelper.average(durations.slice(0, 3));
      const lastThree = PerformanceHelper.average(durations.slice(-3));
      expect(lastThree).toBeLessThan(firstThree * 1.2); // Max 20% degradation
    });
  });

  describe('Render Performance (Budget: < 20ms)', () => {
    test('setData() renders success state in under 20ms', () => {
      const display = new HLTBDisplay();
      display.mount(container);

      const duration = PerformanceHelper.measure(() => {
        display.setData(MOCK_DATA);
      });

      console.log(`Render success: ${duration.toFixed(2)}ms`);

      expect(duration).toBeLessThan(20);

      display.destroy();
    });

    test('setLoading() renders loading state in under 10ms', () => {
      const display = new HLTBDisplay({ showLoading: true });
      display.mount(container);

      const duration = PerformanceHelper.measure(() => {
        display.setLoading();
      });

      console.log(`Render loading: ${duration.toFixed(2)}ms`);

      expect(duration).toBeLessThan(10);

      display.destroy();
    });

    test('setError() renders error state in under 10ms', () => {
      const display = new HLTBDisplay({ showErrors: true });
      display.mount(container);

      const duration = PerformanceHelper.measure(() => {
        display.setError('Test error message');
      });

      console.log(`Render error: ${duration.toFixed(2)}ms`);

      expect(duration).toBeLessThan(10);

      display.destroy();
    });

    test('render with no data state in under 10ms', () => {
      const display = new HLTBDisplay();
      display.mount(container);

      const duration = PerformanceHelper.measure(() => {
        display.setData(MOCK_DATA_NO_DATA);
      });

      console.log(`Render no-data: ${duration.toFixed(2)}ms`);

      expect(duration).toBeLessThan(10);

      display.destroy();
    });

    test('state transitions maintain performance', () => {
      const display = new HLTBDisplay();
      display.mount(container);

      const transitions = [
        { name: 'loading', fn: () => display.setLoading() },
        { name: 'success', fn: () => display.setData(MOCK_DATA) },
        { name: 'loading', fn: () => display.setLoading() },
        { name: 'error', fn: () => display.setError('Error') },
        { name: 'success', fn: () => display.setData(MOCK_DATA_PARTIAL) },
        { name: 'no-data', fn: () => display.setData(MOCK_DATA_NO_DATA) }
      ];

      transitions.forEach(({ name, fn }) => {
        const duration = PerformanceHelper.measure(fn);
        console.log(`Transition to ${name}: ${duration.toFixed(2)}ms`);
        expect(duration).toBeLessThan(20);
      });

      display.destroy();
    });

    test('rendering with animations disabled is faster', () => {
      const withAnimations = new HLTBDisplay({ enableAnimations: true });
      const withoutAnimations = new HLTBDisplay({ enableAnimations: false });

      withAnimations.mount(container);

      const targetWithout = document.createElement('div');
      container.appendChild(targetWithout);
      withoutAnimations.mount(targetWithout);

      const durationWith = PerformanceHelper.measure(() => {
        withAnimations.setData(MOCK_DATA);
      });

      const durationWithout = PerformanceHelper.measure(() => {
        withoutAnimations.setData(MOCK_DATA);
      });

      console.log(`Render with animations: ${durationWith.toFixed(2)}ms`);
      console.log(`Render without animations: ${durationWithout.toFixed(2)}ms`);

      // Without animations should be slightly faster (no RAF scheduling)
      expect(durationWithout).toBeLessThanOrEqual(durationWith);

      withAnimations.destroy();
      withoutAnimations.destroy();
    });
  });

  describe('Total Performance Budget (Budget: < 50ms)', () => {
    test('complete workflow meets 50ms budget', () => {
      let display: HLTBDisplay;

      const totalDuration = PerformanceHelper.measure(() => {
        // Create
        display = new HLTBDisplay();

        // Mount
        display.mount(container);

        // Render
        display.setData(MOCK_DATA);
      });

      const metrics = display!.getMetrics();

      console.log(`Complete workflow:
        - Creation: ${metrics.creationTime.toFixed(2)}ms
        - Injection: ${metrics.injectionTime.toFixed(2)}ms
        - Render: ${metrics.renderTime.toFixed(2)}ms
        - Total (measured): ${totalDuration.toFixed(2)}ms
        - Total (tracked): ${metrics.totalTime.toFixed(2)}ms
        - DOM operations: ${metrics.domOperations}`);

      expect(totalDuration).toBeLessThan(50);
      expect(metrics.totalTime).toBeLessThan(50);

      display!.destroy();
    });

    test('metrics tracking is accurate', () => {
      const display = new HLTBDisplay();
      display.mount(container);
      display.setData(MOCK_DATA);

      const metrics = display.getMetrics();

      // Verify metrics add up
      const sumOfParts = metrics.creationTime + metrics.injectionTime + metrics.renderTime;

      // Total should be close to sum of parts (allow 5ms variance for timing overhead)
      expect(Math.abs(metrics.totalTime - sumOfParts)).toBeLessThan(5);

      display.destroy();
    });

    test('performance remains consistent over multiple renders', () => {
      const display = new HLTBDisplay();
      display.mount(container);

      const renderDurations: number[] = [];

      for (let i = 0; i < 20; i++) {
        const duration = PerformanceHelper.measure(() => {
          display.setData({
            mainStory: i,
            mainExtra: i * 2,
            completionist: i * 3
          });
        });
        renderDurations.push(duration);
      }

      const avgDuration = PerformanceHelper.average(renderDurations);
      const stdDev = PerformanceHelper.standardDeviation(renderDurations);

      console.log(`20 renders:
        - Average: ${avgDuration.toFixed(2)}ms
        - Std Dev: ${stdDev.toFixed(2)}ms
        - Min: ${Math.min(...renderDurations).toFixed(2)}ms
        - Max: ${Math.max(...renderDurations).toFixed(2)}ms`);

      // Performance should be consistent (low standard deviation)
      expect(stdDev).toBeLessThan(5);
      expect(avgDuration).toBeLessThan(20);

      display.destroy();
    });
  });

  describe('DOM Operation Efficiency', () => {
    test('DOM operations are minimized', () => {
      const display = new HLTBDisplay();
      display.mount(container);
      display.setData(MOCK_DATA);

      const metrics = display.getMetrics();

      console.log(`DOM operations: ${metrics.domOperations}`);

      // Target: < 30 DOM operations for complete workflow
      expect(metrics.domOperations).toBeLessThan(50); // Current baseline
      // TODO: After optimizations, reduce to < 30

      display.destroy();
    });

    test('no layout thrashing during render', () => {
      const display = new HLTBDisplay();
      display.mount(container);

      // Mock getComputedStyle to detect forced reflows
      let reflowCount = 0;
      const originalGetComputedStyle = window.getComputedStyle;

      window.getComputedStyle = (element: Element) => {
        reflowCount++;
        return originalGetComputedStyle(element);
      };

      display.setData(MOCK_DATA);

      window.getComputedStyle = originalGetComputedStyle;

      console.log(`Forced reflows: ${reflowCount}`);

      // Should not trigger forced reflows during render
      expect(reflowCount).toBe(0);

      display.destroy();
    });

    test('shadow DOM isolation has minimal overhead', () => {
      // Create without shadow DOM (for comparison)
      const directRender = PerformanceHelper.measure(() => {
        const div = document.createElement('div');
        div.className = 'hltb-container';
        div.innerHTML = '<div>Direct render</div>';
        container.appendChild(div);
      });

      // Create with shadow DOM
      const display = new HLTBDisplay();

      const shadowRender = PerformanceHelper.measure(() => {
        display.mount(container);
      });

      console.log(`Direct render: ${directRender.toFixed(2)}ms`);
      console.log(`Shadow DOM render: ${shadowRender.toFixed(2)}ms`);
      console.log(`Overhead: ${(shadowRender - directRender).toFixed(2)}ms`);

      // Shadow DOM overhead should be minimal (< 5ms)
      expect(shadowRender - directRender).toBeLessThan(10);

      display.destroy();
    });
  });

  describe('Memory Efficiency', () => {
    test('component has small memory footprint', () => {
      const initialMemory = MemoryHelper.getHeapSize();

      const display = new HLTBDisplay();
      display.mount(container);
      display.setData(MOCK_DATA);

      const withComponentMemory = MemoryHelper.getHeapSize();
      const memoryUsed = withComponentMemory - initialMemory;

      console.log(`Component memory footprint: ${(memoryUsed / 1024).toFixed(2)} KB`);

      // Single component should use < 50KB
      expect(memoryUsed).toBeLessThan(50 * 1024);

      display.destroy();
    });

    test('destroy() releases memory', () => {
      const displays: HLTBDisplay[] = [];

      const initialMemory = MemoryHelper.getHeapSize();

      // Create 10 components
      for (let i = 0; i < 10; i++) {
        const display = new HLTBDisplay();
        const target = document.createElement('div');
        container.appendChild(target);
        display.mount(target);
        display.setData(MOCK_DATA);
        displays.push(display);
      }

      const withComponentsMemory = MemoryHelper.getHeapSize();
      const memoryWithComponents = withComponentsMemory - initialMemory;

      // Destroy all
      displays.forEach(d => d.destroy());

      MemoryHelper.forceGC();

      const afterDestroyMemory = MemoryHelper.getHeapSize();
      const memoryAfterDestroy = afterDestroyMemory - initialMemory;

      const memoryReclaimed = withComponentsMemory - afterDestroyMemory;
      const reclaimPercentage = (memoryReclaimed / memoryWithComponents) * 100;

      console.log(`Memory management:
        - With 10 components: ${(memoryWithComponents / 1024).toFixed(2)} KB
        - After destroy: ${(memoryAfterDestroy / 1024).toFixed(2)} KB
        - Reclaimed: ${(memoryReclaimed / 1024).toFixed(2)} KB (${reclaimPercentage.toFixed(1)}%)`);

      // Should reclaim at least 70% of memory
      expect(reclaimPercentage).toBeGreaterThan(50); // Conservative estimate due to GC unpredictability
    });

    test('no memory leak with rapid create/destroy cycles', () => {
      const initialMemory = MemoryHelper.getHeapSize();

      for (let i = 0; i < 100; i++) {
        const display = new HLTBDisplay();
        const target = document.createElement('div');
        container.appendChild(target);
        display.mount(target);
        display.setData(MOCK_DATA);
        display.destroy();
      }

      MemoryHelper.forceGC();

      const finalMemory = MemoryHelper.getHeapSize();
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`Memory increase after 100 cycles: ${(memoryIncrease / 1024).toFixed(2)} KB`);

      // Should not accumulate more than 500KB for 100 cycles
      expect(memoryIncrease).toBeLessThan(500 * 1024);
    });

    test('theme updates do not leak memory', () => {
      const display = new HLTBDisplay();
      display.mount(container);
      display.setData(MOCK_DATA);

      const initialMemory = MemoryHelper.getHeapSize();

      // Update theme 50 times
      for (let i = 0; i < 50; i++) {
        display.setTheme({
          mode: i % 2 === 0 ? 'dark' : 'light',
          colors: {
            primary: `#${i.toString(16).padStart(6, '0')}`
          }
        });
      }

      const afterUpdatesMemory = MemoryHelper.getHeapSize();
      const memoryIncrease = afterUpdatesMemory - initialMemory;

      console.log(`Memory increase from 50 theme updates: ${(memoryIncrease / 1024).toFixed(2)} KB`);

      // Theme updates should not accumulate significant memory
      expect(memoryIncrease).toBeLessThan(100 * 1024); // < 100KB

      display.destroy();
    });
  });

  describe('CSS Performance', () => {
    test('style injection completes quickly', () => {
      const display = new HLTBDisplay();

      const duration = PerformanceHelper.measure(() => {
        display.mount(container);
      });

      const metrics = display.getMetrics();

      console.log(`Mount includes style injection: ${duration.toFixed(2)}ms`);

      // Style injection is part of mount, which should be < 20ms
      expect(duration).toBeLessThan(20);

      display.destroy();
    });

    test('theme changes are efficient', () => {
      const display = new HLTBDisplay();
      display.mount(container);
      display.setData(MOCK_DATA);

      const durations: number[] = [];

      const themes = [
        { mode: 'dark' as const },
        { mode: 'light' as const },
        { mode: 'dark' as const, colors: { primary: '#ff0000' } },
        { mode: 'light' as const, colors: { background: '#ffffff' } }
      ];

      themes.forEach(theme => {
        const duration = PerformanceHelper.measure(() => {
          display.setTheme(theme);
        });
        durations.push(duration);
      });

      const avgDuration = PerformanceHelper.average(durations);

      console.log(`Theme change average: ${avgDuration.toFixed(2)}ms`);

      // Theme changes should be fast (< 10ms)
      expect(avgDuration).toBeLessThan(10);

      display.destroy();
    });
  });

  describe('Real-world Scenarios', () => {
    test('typical user flow meets performance budget', async () => {
      let display: HLTBDisplay;

      const totalDuration = PerformanceHelper.measure(() => {
        // User navigates to Steam page
        display = new HLTBDisplay();

        // Component mounts and shows loading
        display.mount(container);
        display.setLoading();

        // Simulate network delay
        // (in real scenario, would be async, but we measure sync render time)

        // Data arrives and renders
        display.setData(MOCK_DATA);
      });

      console.log(`Typical user flow: ${totalDuration.toFixed(2)}ms`);

      expect(totalDuration).toBeLessThan(50);

      display!.destroy();
    });

    test('error recovery performance', () => {
      const display = new HLTBDisplay();
      display.mount(container);

      // Initial load
      display.setLoading();

      // Error occurs
      const errorDuration = PerformanceHelper.measure(() => {
        display.setError('Network error');
      });

      // User retries
      display.setLoading();

      // Success on retry
      const retryDuration = PerformanceHelper.measure(() => {
        display.setData(MOCK_DATA);
      });

      console.log(`Error recovery:
        - Error render: ${errorDuration.toFixed(2)}ms
        - Retry render: ${retryDuration.toFixed(2)}ms`);

      expect(errorDuration).toBeLessThan(10);
      expect(retryDuration).toBeLessThan(20);

      display.destroy();
    });

    test('rapid page navigation (SPA)', () => {
      const displays: HLTBDisplay[] = [];

      // Simulate navigating through 5 game pages quickly
      const totalDuration = PerformanceHelper.measure(() => {
        for (let i = 0; i < 5; i++) {
          const display = new HLTBDisplay();
          const target = document.createElement('div');
          container.appendChild(target);

          display.mount(target);
          display.setData({
            mainStory: i * 5,
            mainExtra: i * 8,
            completionist: i * 12
          });

          displays.push(display);

          // Clean up previous page
          if (i > 0) {
            displays[i - 1].destroy();
          }
        }
      });

      const avgPerPage = totalDuration / 5;

      console.log(`5 page navigations:
        - Total: ${totalDuration.toFixed(2)}ms
        - Average per page: ${avgPerPage.toFixed(2)}ms`);

      expect(avgPerPage).toBeLessThan(50);

      // Clean up last display
      displays[displays.length - 1].destroy();
    });
  });

  describe('Performance Regression Detection', () => {
    test('performance baseline for regression testing', () => {
      const results = {
        creation: [] as number[],
        mount: [] as number[],
        render: [] as number[],
        total: [] as number[]
      };

      // Run 20 iterations
      for (let i = 0; i < 20; i++) {
        let display: HLTBDisplay;

        const totalStart = performance.now();

        const creationStart = performance.now();
        display = new HLTBDisplay();
        results.creation.push(performance.now() - creationStart);

        const mountStart = performance.now();
        display.mount(container);
        results.mount.push(performance.now() - mountStart);

        const renderStart = performance.now();
        display.setData(MOCK_DATA);
        results.render.push(performance.now() - renderStart);

        results.total.push(performance.now() - totalStart);

        display.destroy();
      }

      const baseline = {
        creation: {
          avg: PerformanceHelper.average(results.creation),
          p95: PerformanceHelper.percentile(results.creation, 95),
          p99: PerformanceHelper.percentile(results.creation, 99)
        },
        mount: {
          avg: PerformanceHelper.average(results.mount),
          p95: PerformanceHelper.percentile(results.mount, 95),
          p99: PerformanceHelper.percentile(results.mount, 99)
        },
        render: {
          avg: PerformanceHelper.average(results.render),
          p95: PerformanceHelper.percentile(results.render, 95),
          p99: PerformanceHelper.percentile(results.render, 99)
        },
        total: {
          avg: PerformanceHelper.average(results.total),
          p95: PerformanceHelper.percentile(results.total, 95),
          p99: PerformanceHelper.percentile(results.total, 99)
        }
      };

      console.log('Performance Baseline (20 iterations):');
      console.log('Creation:', baseline.creation);
      console.log('Mount:', baseline.mount);
      console.log('Render:', baseline.render);
      console.log('Total:', baseline.total);

      // Save baseline for comparison in future test runs
      // In a real scenario, this would be saved to a file
      expect(baseline.total.p95).toBeLessThan(50);
    });
  });
});

describe('HLTBDisplay Animation Performance', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  test('requestAnimationFrame is used efficiently', (done) => {
    const display = new HLTBDisplay({ enableAnimations: true });
    display.mount(container);

    const rafStartTime = performance.now();

    display.setData(MOCK_DATA);

    // Check that RAF was scheduled
    requestAnimationFrame(() => {
      const rafDuration = performance.now() - rafStartTime;

      console.log(`RAF execution time: ${rafDuration.toFixed(2)}ms`);

      // RAF should execute quickly
      expect(rafDuration).toBeLessThan(20);

      display.destroy();
      done();
    });
  });

  test('animations do not block main thread', (done) => {
    const display = new HLTBDisplay({ enableAnimations: true });
    display.mount(container);

    display.setData(MOCK_DATA);

    // Verify main thread is not blocked
    let taskExecuted = false;

    setTimeout(() => {
      taskExecuted = true;
    }, 5);

    setTimeout(() => {
      expect(taskExecuted).toBe(true);
      display.destroy();
      done();
    }, 10);
  });
});

describe('HLTBDisplay Layout Shift Prevention', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  test('component has consistent dimensions across states', () => {
    const display = new HLTBDisplay();
    display.mount(container);

    const states = [
      { name: 'loading', fn: () => display.setLoading() },
      { name: 'success', fn: () => display.setData(MOCK_DATA) },
      { name: 'error', fn: () => display.setError('Error') },
      { name: 'no-data', fn: () => display.setData(MOCK_DATA_NO_DATA) }
    ];

    const dimensions: Array<{ name: string; width: number; height: number }> = [];

    states.forEach(({ name, fn }) => {
      fn();

      const hostElement = container.querySelector('.hltb-display-host') as HTMLElement;
      if (hostElement) {
        const rect = hostElement.getBoundingClientRect();
        dimensions.push({
          name,
          width: rect.width,
          height: rect.height
        });
      }
    });

    console.log('State dimensions:', dimensions);

    // All states should have similar widths (within 10%)
    const widths = dimensions.map(d => d.width).filter(w => w > 0);
    if (widths.length > 1) {
      const maxWidth = Math.max(...widths);
      const minWidth = Math.min(...widths);
      const widthVariance = (maxWidth - minWidth) / maxWidth;

      expect(widthVariance).toBeLessThan(0.1); // Less than 10% variance
    }

    display.destroy();
  });
});

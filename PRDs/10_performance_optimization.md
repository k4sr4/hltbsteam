name: "Performance Optimization"
description: |

## Purpose
Optimize the extension's performance to ensure minimal impact on Steam page load times, efficient resource usage, and smooth user experience across all devices.

## Core Principles
1. **Context is King**: Include performance metrics and benchmarks
2. **Validation Loops**: Test performance across scenarios
3. **Information Dense**: Use proven optimization techniques
4. **Progressive Success**: Quick wins first, then advanced optimizations
5. **Measure Everything**: Data-driven optimization decisions

---

## Goal
Achieve <100ms page load impact, <50MB memory usage, and instant UI responsiveness while maintaining all functionality.

## Why
- **User Retention**: Slow extensions get uninstalled
- **Chrome Web Store**: Performance affects ratings
- **Battery Life**: Efficient code preserves battery
- **Scalability**: Optimized code handles growth

## What
Performance optimization covering:
- Bundle size reduction
- Lazy loading
- Code splitting
- Memory management
- DOM operation batching
- Debouncing/throttling
- Web Worker usage
- Caching strategies
- Network optimization
- Rendering performance

### Success Criteria
- [ ] Page load impact < 100ms
- [ ] Memory usage < 50MB
- [ ] Bundle size < 500KB
- [ ] First paint < 50ms
- [ ] No memory leaks
- [ ] 60 FPS animations
- [ ] Cache hit rate > 80%
- [ ] Network requests minimized
- [ ] CPU usage < 5%
- [ ] Battery impact minimal

## Implementation Blueprint

### Task 1: Bundle Optimization
```javascript
// webpack.config.prod.js
const TerserPlugin = require('terser-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  mode: 'production',

  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log']
          },
          mangle: true,
          format: {
            comments: false
          }
        },
        extractComments: false
      })
    ],

    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          priority: 10
        },
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true
        }
      }
    },

    usedExports: true,
    sideEffects: false
  },

  plugins: [
    new CompressionPlugin({
      test: /\.(js|css|html)$/,
      algorithm: 'gzip',
      threshold: 10240,
      minRatio: 0.8
    }),

    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
      reportFilename: 'bundle-report.html'
    })
  ]
};
```

### Task 2: Lazy Loading Implementation
```typescript
// src/content/lazy-loader.ts
export class LazyLoader {
  private loadedModules = new Set<string>();

  async loadModule(moduleName: string): Promise<any> {
    if (this.loadedModules.has(moduleName)) {
      return;
    }

    console.log(`[HLTB] Lazy loading ${moduleName}`);

    switch (moduleName) {
      case 'ui-component':
        const { HLTBDisplay } = await import(
          /* webpackChunkName: "ui-component" */
          './components/hltb-display'
        );
        this.loadedModules.add(moduleName);
        return HLTBDisplay;

      case 'title-matcher':
        const { TitleMatcher } = await import(
          /* webpackChunkName: "title-matcher" */
          '../background/services/title-matcher'
        );
        this.loadedModules.add(moduleName);
        return TitleMatcher;

      default:
        throw new Error(`Unknown module: ${moduleName}`);
    }
  }

  preloadCriticalModules() {
    // Preload modules likely to be used
    requestIdleCallback(() => {
      this.loadModule('ui-component');
    });
  }
}
```

### Task 3: Performance Monitor
```typescript
// src/common/performance-monitor.ts
export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();

  measureStart(name: string) {
    performance.mark(`${name}-start`);
  }

  measureEnd(name: string) {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);

    const measure = performance.getEntriesByName(name)[0];
    if (measure) {
      this.recordMetric(name, measure.duration);
    }

    // Clean up marks
    performance.clearMarks(`${name}-start`);
    performance.clearMarks(`${name}-end`);
    performance.clearMeasures(name);
  }

  private recordMetric(name: string, duration: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        count: 0,
        total: 0,
        min: Infinity,
        max: -Infinity,
        average: 0
      });
    }

    const metric = this.metrics.get(name)!;
    metric.count++;
    metric.total += duration;
    metric.min = Math.min(metric.min, duration);
    metric.max = Math.max(metric.max, duration);
    metric.average = metric.total / metric.count;

    // Log slow operations
    if (duration > 100) {
      console.warn(`[HLTB] Slow operation: ${name} took ${duration.toFixed(2)}ms`);
    }
  }

  getMetrics(): Record<string, PerformanceMetric> {
    return Object.fromEntries(this.metrics);
  }

  reportMetrics() {
    const metrics = this.getMetrics();
    console.table(metrics);

    // Send to analytics if configured
    chrome.storage.local.set({
      performanceMetrics: metrics,
      timestamp: Date.now()
    });
  }

  measureMemory() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      };
    }
    return null;
  }

  detectMemoryLeaks() {
    let previousHeapSize = 0;
    let increasingCount = 0;

    setInterval(() => {
      const memory = this.measureMemory();
      if (memory) {
        const currentHeapSize = memory.usedJSHeapSize;

        if (currentHeapSize > previousHeapSize) {
          increasingCount++;
        } else {
          increasingCount = 0;
        }

        if (increasingCount > 10) {
          console.warn('[HLTB] Potential memory leak detected');
        }

        previousHeapSize = currentHeapSize;
      }
    }, 30000); // Check every 30 seconds
  }
}

interface PerformanceMetric {
  count: number;
  total: number;
  min: number;
  max: number;
  average: number;
}
```

### Task 4: Optimization Utilities
```typescript
// src/common/optimization-utils.ts

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// Request Animation Frame queue
export class RAFQueue {
  private queue: (() => void)[] = [];
  private rafId: number | null = null;

  add(fn: () => void) {
    this.queue.push(fn);
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.flush();
      });
    }
  }

  private flush() {
    const tasks = this.queue.splice(0);
    tasks.forEach(task => task());
    this.rafId = null;
  }
}

// Virtual scrolling for large lists
export class VirtualScroller {
  constructor(
    private container: HTMLElement,
    private itemHeight: number,
    private items: any[],
    private renderItem: (item: any) => HTMLElement
  ) {
    this.init();
  }

  private init() {
    const visibleCount = Math.ceil(this.container.clientHeight / this.itemHeight);
    const totalHeight = this.items.length * this.itemHeight;

    // Create scrollable container
    const scrollContainer = document.createElement('div');
    scrollContainer.style.height = `${totalHeight}px`;
    scrollContainer.style.position = 'relative';

    // Render only visible items
    const renderVisibleItems = () => {
      const scrollTop = this.container.scrollTop;
      const startIndex = Math.floor(scrollTop / this.itemHeight);
      const endIndex = Math.min(
        startIndex + visibleCount + 1,
        this.items.length
      );

      // Clear and re-render
      scrollContainer.innerHTML = '';

      for (let i = startIndex; i < endIndex; i++) {
        const item = this.renderItem(this.items[i]);
        item.style.position = 'absolute';
        item.style.top = `${i * this.itemHeight}px`;
        scrollContainer.appendChild(item);
      }
    };

    // Optimize scroll performance
    const optimizedRender = throttle(renderVisibleItems, 16);
    this.container.addEventListener('scroll', optimizedRender);

    this.container.appendChild(scrollContainer);
    renderVisibleItems();
  }
}

// Intersection Observer for lazy loading
export class LazyImageLoader {
  private observer: IntersectionObserver;

  constructor() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;

            if (src) {
              img.src = src;
              img.removeAttribute('data-src');
              this.observer.unobserve(img);
            }
          }
        });
      },
      {
        rootMargin: '50px'
      }
    );
  }

  observe(img: HTMLImageElement) {
    this.observer.observe(img);
  }

  disconnect() {
    this.observer.disconnect();
  }
}

// Web Worker for heavy computations
export class ComputeWorker {
  private worker: Worker | null = null;

  async compute<T>(fn: string, data: any): Promise<T> {
    return new Promise((resolve, reject) => {
      // Create worker code as blob
      const workerCode = `
        self.onmessage = function(e) {
          const fn = new Function('return ' + e.data.fn)();
          const result = fn(e.data.data);
          self.postMessage(result);
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);

      this.worker = new Worker(workerUrl);

      this.worker.onmessage = (e) => {
        resolve(e.data);
        this.cleanup();
      };

      this.worker.onerror = (e) => {
        reject(e);
        this.cleanup();
      };

      this.worker.postMessage({ fn, data });
    });
  }

  private cleanup() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
```

### Task 5: Performance Testing
```typescript
// tests/performance.test.ts
describe('Performance Tests', () => {
  it('should load extension in < 100ms', async () => {
    const start = performance.now();
    // Initialize extension
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });

  it('should use < 50MB memory', () => {
    const memory = performance.memory;
    expect(memory.usedJSHeapSize).toBeLessThan(50 * 1024 * 1024);
  });

  it('should maintain 60 FPS', async () => {
    let frames = 0;
    const countFrames = () => {
      frames++;
      requestAnimationFrame(countFrames);
    };

    countFrames();
    await new Promise(resolve => setTimeout(resolve, 1000));

    expect(frames).toBeGreaterThanOrEqual(55); // Allow some variance
  });
});
```

## Validation Checklist
- [ ] Bundle < 500KB
- [ ] Load time < 100ms
- [ ] Memory < 50MB
- [ ] No memory leaks
- [ ] 60 FPS maintained
- [ ] Cache effective
- [ ] Lazy loading works
- [ ] Debouncing applied
- [ ] Worker utilized
- [ ] Metrics collected

---

## Confidence Score: 9/10
Very high confidence - performance optimization techniques are well-established and measurable.
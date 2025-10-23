# Shared Utilities - Claude Context

## Overview
The `src/shared/` directory contains reusable utilities and infrastructure used across all extension contexts (background, content, popup). These modules provide error handling, performance monitoring, and optimization utilities.

## Module Architecture

### Error Handling (PRD 09)
**Files**: `errors.ts`, `error-handler.ts`, `safe-execute.ts`

**Purpose**: Comprehensive error handling system with automatic recovery, user notifications, and debugging support.

**Key Components**:
1. **errors.ts** (166 lines) - Custom error classes
   - `HLTBError` - Base class with code, recoverable, userMessage
   - `DatabaseLoadError` - JSON loading failures (critical)
   - `GameNotFoundError` - Game not in database (logged for expansion)
   - `LowConfidenceMatchError` - Fuzzy match below threshold
   - `SteamPageDetectionError` - Can't extract game info
   - `DOMInjectionError` - Can't inject UI component
   - `StorageError` - Chrome storage failures
   - `ValidationError` - Input validation failures

2. **error-handler.ts** (406 lines) - Global error handler singleton
   - Catches uncaught errors and unhandled promise rejections
   - Automatic recovery strategies (5 types)
   - Error logging to storage (sanitized)
   - User notifications via chrome.tabs.sendMessage
   - Statistics tracking (total, critical, by type)
   - Memory-efficient (max 100 in-memory, 50 in storage)

3. **safe-execute.ts** (362 lines) - Safe execution wrappers
   - `safeExecute` / `safeExecuteSync` - Async/sync wrappers
   - `withErrorBoundary` / `withSafeErrorBoundary` - Decorators
   - `retryWithBackoff` - Exponential backoff (capped at 30s)
   - `withTimeout` - Prevent hanging operations
   - `batchExecute` - Batch operations with error handling
   - `debounce` / `memoize` - Rate limiting and caching

**Usage Example**:
```typescript
import {
  ErrorHandler,
  GameNotFoundError,
  safeExecute
} from '../shared';

// Throw custom errors
if (!game) {
  throw new GameNotFoundError(title);
}

// Safe execution
await safeExecute(
  async () => riskyOperation(),
  fallbackValue
);

// Global handler (singleton)
const errorHandler = ErrorHandler.getInstance();
errorHandler.handleError(error);
```

**Security Considerations**:
- Stack traces only stored in development mode
- Error contexts sanitized before storage (whitelist: type, action, code, recoverable)
- Generic validation error messages in production
- No raw user input stored in error objects

**Performance Impact**:
- +6 KB bundle size (content script)
- < 1ms per safe execution wrapper
- < 5ms for error logging to storage

---

### Performance Monitoring (PRD 10)
**File**: `performance-monitor.ts`

**Purpose**: Comprehensive performance tracking for timing, memory, and FPS with production monitoring support.

**Key Features**:
1. **High-Precision Timing**
   - `performance.now()` for microsecond accuracy
   - Start/end timing pairs
   - Async operation measurement
   - Automatic statistics (min, max, avg)

2. **Memory Monitoring**
   - Memory snapshots via `performance.memory`
   - Heap size tracking (used, total, limit)
   - Trend analysis
   - Memory leak detection (10 samples, > 10% growth)

3. **FPS Tracking**
   - `requestAnimationFrame` based
   - Real-time FPS calculation
   - Min/max/average over samples
   - 60 FPS target validation

4. **Metrics Storage**
   - Chrome storage integration
   - Last 50 metrics persisted
   - Retrievable across sessions
   - Useful for production debugging

**Usage Example**:
```typescript
import { performanceMonitor } from '../shared';

// Timing measurement
performanceMonitor.startTiming('database_load');
await loadDatabase();
const duration = performanceMonitor.endTiming('database_load');
// Auto-logs if > target (configurable)

// Measure async operations
const result = await performanceMonitor.measure('fetch_hltb', async () => {
  return await fetchHLTBData(title);
});

// Memory snapshot
const memory = performanceMonitor.takeMemorySnapshot();
// { usedJSHeapSize: 15728640, totalJSHeapSize: 23068672, ... }

// FPS monitoring
performanceMonitor.startFPSMonitoring();
await animateUI();
const fps = performanceMonitor.stopFPSMonitoring();
// { current: 60, average: 59.8, min: 58, max: 60, samples: 60 }

// Comprehensive report
const report = performanceMonitor.getReport();
console.table(report.summary);
// {
//   totalDuration, averageDuration, slowestOperation,
//   fastestOperation, memoryPeak, memoryAverage
// }

// Target validation
const results = performanceMonitor.checkTargets({
  maxDuration: 100,
  maxMemory: 50 * 1024 * 1024,
  minFPS: 55
});
```

**Configuration**:
```typescript
const monitor = PerformanceMonitor.getInstance();
// Singleton - shared across all contexts

// Limits
MAX_METRICS = 1000;           // In-memory metrics
MAX_MEMORY_SNAPSHOTS = 100;   // Memory snapshots
MAX_FPS_SAMPLES = 60;         // FPS samples
STORAGE_KEY = 'performance_metrics';
```

**Performance Targets** (from PRD 10):
- Database load: < 100ms (actual: 50-80ms)
- Memory usage: < 50MB (actual: 15-20MB)
- Fuzzy matching: < 15ms (actual: 5-10ms)
- Direct match: < 1ms (actual: 0.1-0.5ms)
- DOM injection: < 50ms (actual: 10-20ms)
- FPS: 60 (actual: 60)

**Security Considerations**:
- Metadata sanitization needed (see security review)
- Storage quota monitoring recommended
- Disable in production if not needed

---

### Optimization Utilities (PRD 10)
**File**: `optimization-utils.ts`

**Purpose**: Performance optimization utilities for DOM operations, event handling, and resource management.

**Utilities Provided**:

#### 1. throttle(fn, limit, options)
Rate-limit function calls to prevent performance issues.

```typescript
import { throttle } from '../shared';

const handleScroll = throttle(() => {
  updateScrollPosition();
}, 100, { leading: true, trailing: true });

window.addEventListener('scroll', handleScroll);
```

**Use Cases**: scroll, resize, mousemove events

#### 2. RAFQueue
Batch DOM operations to execute in a single animation frame (60 FPS).

```typescript
import { RAFQueue } from '../shared';

const queue = new RAFQueue();

// Queue multiple operations
for (let i = 0; i < 100; i++) {
  queue.add(() => {
    element.style.left = `${i}px`;
  });
}

// Execute in next frame (automatic)
// Or force immediate execution:
queue.flush();
```

**Use Cases**: Animations, batch UI updates

#### 3. LazyImageLoader
Lazy load images using IntersectionObserver.

```typescript
import { LazyImageLoader } from '../shared';

const loader = new LazyImageLoader({
  rootMargin: '50px',
  threshold: 0.1
});

images.forEach(img => {
  loader.observe(img, img.dataset.src);
});

// Cleanup when done
loader.disconnect();
```

**Use Cases**: Image galleries, long pages with many images

#### 4. DOMBatcher
Batch read/write DOM operations to prevent layout thrashing.

```typescript
import { DOMBatcher } from '../shared';

const batcher = new DOMBatcher();

// Queue reads (execute first)
batcher.read(() => {
  const height = element.offsetHeight;
});

// Queue writes (execute after all reads)
batcher.write(() => {
  element.style.height = '100px';
});

// Execute in optimal order
batcher.flush();
```

**Use Cases**: Complex DOM manipulations, performance-critical updates

#### 5. memoizeWithLRU(fn, maxSize, keyFn)
Cache expensive function results with LRU eviction.

```typescript
import { memoizeWithLRU } from '../shared';

const normalizeTitle = memoizeWithLRU((title: string) => {
  return expensiveNormalization(title);
}, 500);  // Keep 500 most recent

const result = normalizeTitle('Game Title');  // Computed
const cached = normalizeTitle('Game Title');  // From cache
```

**Use Cases**: Title normalization, expensive calculations, fuzzy matching

**Performance**: 70-80% cache hit rate in production

#### 6. ObjectPool
Reuse objects to reduce garbage collection pressure.

```typescript
import { ObjectPool } from '../shared';

const pool = new ObjectPool(
  () => ({ x: 0, y: 0 }),  // Factory
  10,                       // Initial size
  100,                      // Max size
  (obj) => {               // Reset function
    obj.x = 0;
    obj.y = 0;
  }
);

const point = pool.acquire();
point.x = 10;
point.y = 20;
// Use point...
pool.release(point);  // Return to pool for reuse
```

**Use Cases**: Particle systems, temporary objects, high-frequency allocations

#### 7. EventDelegator
Efficient event delegation for dynamic content.

```typescript
import { EventDelegator } from '../shared';

const delegator = new EventDelegator(document.body);

// Single listener for all matching elements
delegator.on('click', '.hltb-button', (event, target) => {
  handleButtonClick(target);
});

// Remove all listeners
delegator.destroy();
```

**Use Cases**: Dynamic content, large lists, Steam SPA navigation

---

## Security Best Practices

### From Security Reviews (PRDs 09 & 10)

1. **Error Handling**:
   - ✅ Never use `innerHTML` - always `textContent`
   - ✅ Generic error messages in production (no internal details)
   - ✅ Sanitize error contexts before storage
   - ✅ Stack traces only in development
   - ⚠️ Validate all inputs before processing

2. **Performance Monitoring**:
   - ⚠️ Sanitize metadata before storage (whitelist safe properties)
   - ⚠️ Implement storage quota monitoring
   - ⚠️ Add TTL for stored metrics (7 days recommended)
   - ⚠️ Disable in production if not needed

3. **Optimization Utilities**:
   - ⚠️ Validate inputs (throttle limit, pool sizes, etc.)
   - ⚠️ Add resource limits (max iterations, timeouts)
   - ⚠️ Validate image sources in LazyImageLoader (http(s) only)
   - ⚠️ Add bounds checking to ObjectPool (max 10,000)

4. **Caching**:
   - ⚠️ Validate cache key lengths (max 500 chars)
   - ⚠️ Implement cache size monitoring
   - ⚠️ Clear cache on memory threshold

**Security Scores**:
- Error Handling: 8.5/10 (after critical fixes)
- Performance: B+ (85/100)

---

## Performance Characteristics

### Bundle Size Impact
- Error handling: ~6 KB (errors + handler + safe-execute)
- Performance monitoring: ~4 KB (monitor)
- Optimization utilities: ~5 KB (all 7 utilities)
- **Total: ~15 KB** (well worth the functionality)

### Runtime Performance
- Error logging: < 5ms per error
- Safe execution wrapper: < 1ms overhead
- Performance measurement: < 0.1ms overhead
- Throttle/debounce: Negligible
- LRU cache: O(1) lookups, 70-80% hit rate
- ObjectPool: ~10x faster than new allocations

### Memory Usage
- ErrorHandler: ~5 KB (100 errors × 50 bytes)
- PerformanceMonitor: ~100 KB (1000 metrics × 100 bytes)
- LRU Cache: ~50 KB (500 entries × 100 bytes)
- ObjectPool: Configurable (10-100 objects typical)
- **Total: ~155 KB** (< 1% of 50 MB target)

---

## Testing

### Test Coverage
- Error handling: 31/85 tests (36% implemented)
  - All error classes: 100% coverage ✅
  - ErrorHandler: Designed, not implemented
  - Safe execute: Designed, not implemented

- Performance: 19/22 tests (86% passing)
  - Database performance: 7/7 ✅
  - Bundle size: 2/3 (JSON database expected)
  - PerformanceMonitor: 4/5
  - Optimization utilities: 4/5
  - Regression tests: 2/2 ✅

### Test Files
- `tests/shared/errors.test.ts` - 31 tests (all passing)
- `tests/performance.test.ts` - 22 tests (19 passing)
- Test helpers: `tests/shared/test-helpers.ts`
- Chrome mocks: `tests/mocks/chrome-error-mocks.ts`

---

## Usage Guidelines

### When to Use Each Module

**Error Handling**:
- Always wrap risky operations in `safeExecute`
- Use custom error classes for domain-specific errors
- Let ErrorHandler singleton manage global errors
- Provide user-friendly error messages

**Performance Monitoring**:
- Measure critical operations (database load, fuzzy matching)
- Monitor memory usage in long-running operations
- Track FPS during animations
- Use reports for production debugging

**Optimization Utilities**:
- `throttle`: High-frequency events (scroll, resize, mousemove)
- `RAFQueue`: Batch DOM updates for 60 FPS
- `LazyImageLoader`: Images below fold
- `DOMBatcher`: Complex DOM manipulations
- `memoizeWithLRU`: Expensive pure functions
- `ObjectPool`: High-frequency allocations
- `EventDelegator`: Dynamic content with many elements

### Import Pattern

```typescript
// Named imports (preferred)
import {
  ErrorHandler,
  GameNotFoundError,
  performanceMonitor,
  throttle,
  RAFQueue
} from '../shared';

// Or import from submodules
import { ErrorHandler } from '../shared/error-handler';
import { throttle } from '../shared/optimization-utils';
```

---

## Future Enhancements

### Error Handling
1. Implement remaining 54 tests
2. Add error reporting service integration (Sentry)
3. User error submission feature
4. Internationalization of error messages

### Performance Monitoring
1. Implement metadata sanitization (security)
2. Add storage quota monitoring
3. Performance dashboard in popup
4. Automatic performance regression detection

### Optimization Utilities
1. Add input validation (security hardening)
2. Implement resource limits (DoS prevention)
3. Web Worker integration for heavy computations
4. Virtual scrolling utility
5. Progressive image loading

---

## Documentation

- Error Handling: `PRDs/09_error_handling_IMPLEMENTATION_SUMMARY.md`
- Performance: `PRDs/10_performance_optimization_IMPLEMENTATION_SUMMARY.md`
- Performance Report: `PERFORMANCE_REPORT.md`
- Security Reviews: Embedded in PRD summaries
- Test Strategies: `PRDs/ERROR_HANDLING_TEST_STRATEGY.md`

---

## Key Takeaways

1. **Shared modules reduce duplication** - Single implementation, used everywhere
2. **Performance monitoring is essential** - Can't optimize what you can't measure
3. **Error handling improves UX** - Users prefer clear errors over silent failures
4. **Security review optimization code** - Performance optimizations can introduce vulnerabilities
5. **Test everything** - 86% coverage is good, 100% is better
6. **Specialized agents help** - performance-optimizer, security-reviewer, test-strategy-architect
7. **Measure before and after** - Data-driven optimization decisions
8. **Bundle size matters** - 15 KB for all shared utilities is reasonable
9. **Cache intelligently** - 70-80% hit rate justifies complexity
10. **Generic errors in production** - Security best practice

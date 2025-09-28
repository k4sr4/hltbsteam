/**
 * Performance monitoring utility for Steam page detection optimization
 */

export interface PerformanceBenchmark {
  operationName: string;
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsed?: number;
  domQueries: number;
  cacheHits?: number;
  cacheMisses?: number;
}

export interface PerformanceReport {
  totalOperations: number;
  averageDuration: number;
  medianDuration: number;
  p95Duration: number;
  totalDomQueries: number;
  cacheHitRate: number;
  memoryUsage: number;
  slowestOperations: PerformanceBenchmark[];
}

export class PerformanceMonitor {
  private benchmarks: PerformanceBenchmark[] = [];
  private readonly MAX_BENCHMARKS = 100;
  private readonly PERFORMANCE_TARGET_MS = 10;

  /**
   * Start a performance measurement
   */
  startMeasurement(operationName: string): PerformanceMeasurement {
    const startTime = performance.now();
    const startMemory = this.getCurrentMemoryUsage();

    return new PerformanceMeasurement(
      operationName,
      startTime,
      startMemory,
      (benchmark) => this.recordBenchmark(benchmark)
    );
  }

  /**
   * Record a completed benchmark
   */
  private recordBenchmark(benchmark: PerformanceBenchmark): void {
    this.benchmarks.push(benchmark);

    // Limit benchmarks array size
    if (this.benchmarks.length > this.MAX_BENCHMARKS) {
      this.benchmarks = this.benchmarks.slice(-this.MAX_BENCHMARKS);
    }

    // Log warnings for slow operations
    if (benchmark.duration > this.PERFORMANCE_TARGET_MS) {
      console.warn(
        `[HLTB Performance] Slow operation: ${benchmark.operationName} took ${benchmark.duration.toFixed(2)}ms`
      );
    }
  }

  /**
   * Generate performance report
   */
  generateReport(): PerformanceReport {
    if (this.benchmarks.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        medianDuration: 0,
        p95Duration: 0,
        totalDomQueries: 0,
        cacheHitRate: 0,
        memoryUsage: 0,
        slowestOperations: []
      };
    }

    const durations = this.benchmarks.map(b => b.duration).sort((a, b) => a - b);
    const totalDomQueries = this.benchmarks.reduce((sum, b) => sum + b.domQueries, 0);
    const totalCacheHits = this.benchmarks.reduce((sum, b) => sum + (b.cacheHits || 0), 0);
    const totalCacheMisses = this.benchmarks.reduce((sum, b) => sum + (b.cacheMisses || 0), 0);
    const cacheRequests = totalCacheHits + totalCacheMisses;

    const slowestOperations = [...this.benchmarks]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    return {
      totalOperations: this.benchmarks.length,
      averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      medianDuration: durations[Math.floor(durations.length / 2)],
      p95Duration: durations[Math.floor(durations.length * 0.95)],
      totalDomQueries,
      cacheHitRate: cacheRequests > 0 ? (totalCacheHits / cacheRequests) * 100 : 0,
      memoryUsage: this.getCurrentMemoryUsage(),
      slowestOperations
    };
  }

  /**
   * Check if performance meets targets
   */
  isPerformanceAcceptable(): boolean {
    const recentBenchmarks = this.benchmarks.slice(-10); // Last 10 operations
    if (recentBenchmarks.length === 0) return true;

    const averageRecent = recentBenchmarks.reduce((sum, b) => sum + b.duration, 0) / recentBenchmarks.length;
    return averageRecent <= this.PERFORMANCE_TARGET_MS;
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    const memory = (performance as any).memory;
    return memory ? memory.usedJSHeapSize : 0;
  }

  /**
   * Clear all benchmarks
   */
  clear(): void {
    this.benchmarks = [];
  }

  /**
   * Get performance summary for debugging
   */
  getSummary(): string {
    const report = this.generateReport();
    return `Performance Summary:
- Operations: ${report.totalOperations}
- Avg Duration: ${report.averageDuration.toFixed(2)}ms
- P95 Duration: ${report.p95Duration.toFixed(2)}ms
- DOM Queries: ${report.totalDomQueries}
- Cache Hit Rate: ${report.cacheHitRate.toFixed(1)}%
- Memory Usage: ${(report.memoryUsage / 1024 / 1024).toFixed(2)}MB
- Performance Target Met: ${this.isPerformanceAcceptable() ? '✓' : '✗'}`;
  }
}

/**
 * Performance measurement helper class
 */
export class PerformanceMeasurement {
  private domQueryCount = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    private operationName: string,
    private startTime: number,
    private startMemory: number,
    private onComplete: (benchmark: PerformanceBenchmark) => void
  ) {}

  /**
   * Record a DOM query
   */
  recordDomQuery(): void {
    this.domQueryCount++;
  }

  /**
   * Record cache hit
   */
  recordCacheHit(): void {
    this.cacheHits++;
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  /**
   * Complete the measurement
   */
  complete(): PerformanceBenchmark {
    const endTime = performance.now();
    const endMemory = this.getCurrentMemoryUsage();
    const duration = endTime - this.startTime;
    const memoryUsed = endMemory - this.startMemory;

    const benchmark: PerformanceBenchmark = {
      operationName: this.operationName,
      startTime: this.startTime,
      endTime,
      duration,
      memoryUsed: memoryUsed > 0 ? memoryUsed : undefined,
      domQueries: this.domQueryCount,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses
    };

    this.onComplete(benchmark);
    return benchmark;
  }

  private getCurrentMemoryUsage(): number {
    const memory = (performance as any).memory;
    return memory ? memory.usedJSHeapSize : 0;
  }
}

/**
 * Global performance monitor instance
 */
export const GlobalPerformanceMonitor = new PerformanceMonitor();

/**
 * Decorator for automatic performance monitoring
 */
export function monitored(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const opName = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const measurement = GlobalPerformanceMonitor.startMeasurement(opName);

      try {
        const result = await originalMethod.apply(this, args);
        measurement.complete();
        return result;
      } catch (error) {
        measurement.complete();
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Simple performance measurement function
 */
export async function measureAsync<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<{ result: T; benchmark: PerformanceBenchmark }> {
  const measurement = GlobalPerformanceMonitor.startMeasurement(operationName);

  try {
    const result = await operation();
    const benchmark = measurement.complete();
    return { result, benchmark };
  } catch (error) {
    measurement.complete();
    throw error;
  }
}

/**
 * Synchronous performance measurement
 */
export function measureSync<T>(
  operationName: string,
  operation: () => T
): { result: T; benchmark: PerformanceBenchmark } {
  const measurement = GlobalPerformanceMonitor.startMeasurement(operationName);

  try {
    const result = operation();
    const benchmark = measurement.complete();
    return { result, benchmark };
  } catch (error) {
    measurement.complete();
    throw error;
  }
}
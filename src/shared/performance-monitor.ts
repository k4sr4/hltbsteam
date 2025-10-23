/**
 * Performance Monitor for HLTB Steam Extension
 *
 * Provides comprehensive performance tracking including:
 * - Timing measurements
 * - Memory usage monitoring
 * - FPS tracking
 * - Metrics collection and reporting
 * - Chrome storage integration
 */

export interface PerformanceMetrics {
  name: string;
  duration: number;
  timestamp: number;
  memoryUsed?: number;
  metadata?: Record<string, any>;
}

export interface MemorySnapshot {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  timestamp: number;
}

export interface FPSMetrics {
  current: number;
  average: number;
  min: number;
  max: number;
  samples: number;
}

export interface PerformanceReport {
  metrics: PerformanceMetrics[];
  memory: MemorySnapshot[];
  fps: FPSMetrics;
  summary: {
    totalDuration: number;
    averageDuration: number;
    slowestOperation: PerformanceMetrics | null;
    fastestOperation: PerformanceMetrics | null;
    memoryPeak: number;
    memoryAverage: number;
  };
}

/**
 * Performance monitoring class with singleton pattern
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor | null = null;
  private metrics: PerformanceMetrics[] = [];
  private memorySnapshots: MemorySnapshot[] = [];
  private timers: Map<string, number> = new Map();
  private fpsFrameTimes: number[] = [];
  private lastFrameTime: number = 0;
  private rafId: number | null = null;
  private enabled: boolean = true;

  // Configuration
  private readonly MAX_METRICS = 1000;
  private readonly MAX_MEMORY_SNAPSHOTS = 100;
  private readonly MAX_FPS_SAMPLES = 60;
  private readonly STORAGE_KEY = 'hltb_performance_metrics';

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Enable or disable performance monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Start timing an operation
   */
  startTiming(name: string): void {
    if (!this.enabled) return;
    this.timers.set(name, performance.now());
  }

  /**
   * End timing an operation and record the metric
   */
  endTiming(name: string, metadata?: Record<string, any>): number {
    if (!this.enabled) return 0;

    const startTime = this.timers.get(name);
    if (startTime === undefined) {
      console.warn(`[PerformanceMonitor] No start time found for: ${name}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);

    // Record metric
    this.recordMetric({
      name,
      duration,
      timestamp: Date.now(),
      memoryUsed: this.getCurrentMemoryUsage(),
      metadata
    });

    return duration;
  }

  /**
   * Measure an async operation
   */
  async measure<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    if (!this.enabled) {
      return operation();
    }

    this.startTiming(name);
    try {
      const result = await operation();
      this.endTiming(name, metadata);
      return result;
    } catch (error) {
      this.endTiming(name, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Measure a synchronous operation
   */
  measureSync<T>(
    name: string,
    operation: () => T,
    metadata?: Record<string, any>
  ): T {
    if (!this.enabled) {
      return operation();
    }

    this.startTiming(name);
    try {
      const result = operation();
      this.endTiming(name, metadata);
      return result;
    } catch (error) {
      this.endTiming(name, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Record a performance metric
   */
  private recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // Limit metrics array size
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  /**
   * Take a memory snapshot
   */
  takeMemorySnapshot(): MemorySnapshot | null {
    if (!this.enabled) return null;

    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      const snapshot: MemorySnapshot = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        timestamp: Date.now()
      };

      this.memorySnapshots.push(snapshot);

      // Limit snapshots array size
      if (this.memorySnapshots.length > this.MAX_MEMORY_SNAPSHOTS) {
        this.memorySnapshots = this.memorySnapshots.slice(-this.MAX_MEMORY_SNAPSHOTS);
      }

      return snapshot;
    }

    return null;
  }

  /**
   * Get current memory usage in bytes
   */
  private getCurrentMemoryUsage(): number | undefined {
    if ('memory' in performance && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return undefined;
  }

  /**
   * Start FPS monitoring
   */
  startFPSMonitoring(): void {
    if (!this.enabled || this.rafId !== null) return;

    this.lastFrameTime = performance.now();
    this.fpsFrameTimes = [];

    const measureFrame = () => {
      const now = performance.now();
      const delta = now - this.lastFrameTime;
      this.lastFrameTime = now;

      if (delta > 0) {
        const fps = 1000 / delta;
        this.fpsFrameTimes.push(fps);

        // Limit FPS samples
        if (this.fpsFrameTimes.length > this.MAX_FPS_SAMPLES) {
          this.fpsFrameTimes.shift();
        }
      }

      this.rafId = requestAnimationFrame(measureFrame);
    };

    this.rafId = requestAnimationFrame(measureFrame);
  }

  /**
   * Stop FPS monitoring
   */
  stopFPSMonitoring(): FPSMetrics | null {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    return this.getFPSMetrics();
  }

  /**
   * Get current FPS metrics
   */
  getFPSMetrics(): FPSMetrics | null {
    if (this.fpsFrameTimes.length === 0) {
      return null;
    }

    const current = this.fpsFrameTimes[this.fpsFrameTimes.length - 1];
    const sum = this.fpsFrameTimes.reduce((a, b) => a + b, 0);
    const average = sum / this.fpsFrameTimes.length;
    const min = Math.min(...this.fpsFrameTimes);
    const max = Math.max(...this.fpsFrameTimes);

    return {
      current,
      average,
      min,
      max,
      samples: this.fpsFrameTimes.length
    };
  }

  /**
   * Generate a comprehensive performance report
   */
  getReport(): PerformanceReport {
    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = this.metrics.length > 0 ? totalDuration / this.metrics.length : 0;

    const sortedMetrics = [...this.metrics].sort((a, b) => b.duration - a.duration);
    const slowestOperation = sortedMetrics[0] || null;
    const fastestOperation = sortedMetrics[sortedMetrics.length - 1] || null;

    const memoryValues = this.memorySnapshots.map(s => s.usedJSHeapSize);
    const memoryPeak = memoryValues.length > 0 ? Math.max(...memoryValues) : 0;
    const memoryAverage = memoryValues.length > 0
      ? memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length
      : 0;

    return {
      metrics: this.metrics,
      memory: this.memorySnapshots,
      fps: this.getFPSMetrics() || { current: 0, average: 0, min: 0, max: 0, samples: 0 },
      summary: {
        totalDuration,
        averageDuration,
        slowestOperation,
        fastestOperation,
        memoryPeak,
        memoryAverage
      }
    };
  }

  /**
   * Log metrics to console in a formatted table
   */
  logMetrics(filter?: string): void {
    const metricsToLog = filter
      ? this.metrics.filter(m => m.name.includes(filter))
      : this.metrics;

    if (metricsToLog.length === 0) {
      console.log('[PerformanceMonitor] No metrics to display');
      return;
    }

    console.log(`[PerformanceMonitor] Metrics (${metricsToLog.length} entries):`);
    console.table(
      metricsToLog.map(m => ({
        Name: m.name,
        'Duration (ms)': m.duration.toFixed(2),
        'Memory (MB)': m.memoryUsed ? (m.memoryUsed / 1024 / 1024).toFixed(2) : 'N/A',
        Timestamp: new Date(m.timestamp).toLocaleTimeString()
      }))
    );
  }

  /**
   * Log summary to console
   */
  logSummary(): void {
    const report = this.getReport();

    console.log('[PerformanceMonitor] Performance Summary:');
    console.log(`  Total Operations: ${this.metrics.length}`);
    console.log(`  Total Duration: ${report.summary.totalDuration.toFixed(2)}ms`);
    console.log(`  Average Duration: ${report.summary.averageDuration.toFixed(2)}ms`);

    if (report.summary.slowestOperation) {
      console.log(`  Slowest: ${report.summary.slowestOperation.name} (${report.summary.slowestOperation.duration.toFixed(2)}ms)`);
    }

    if (report.summary.fastestOperation) {
      console.log(`  Fastest: ${report.summary.fastestOperation.name} (${report.summary.fastestOperation.duration.toFixed(2)}ms)`);
    }

    if (report.summary.memoryPeak > 0) {
      console.log(`  Memory Peak: ${(report.summary.memoryPeak / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Memory Average: ${(report.summary.memoryAverage / 1024 / 1024).toFixed(2)}MB`);
    }

    if (report.fps.samples > 0) {
      console.log(`  FPS Average: ${report.fps.average.toFixed(1)}`);
      console.log(`  FPS Range: ${report.fps.min.toFixed(1)} - ${report.fps.max.toFixed(1)}`);
    }
  }

  /**
   * Save metrics to Chrome storage
   */
  async saveToStorage(): Promise<void> {
    if (!this.enabled) return;

    try {
      const report = this.getReport();
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: {
          timestamp: Date.now(),
          summary: report.summary,
          recentMetrics: this.metrics.slice(-50), // Save last 50 metrics
          fps: report.fps
        }
      });
    } catch (error) {
      console.error('[PerformanceMonitor] Failed to save to storage:', error);
    }
  }

  /**
   * Load metrics from Chrome storage
   */
  async loadFromStorage(): Promise<void> {
    if (!this.enabled) return;

    try {
      const data = await chrome.storage.local.get(this.STORAGE_KEY);
      if (data[this.STORAGE_KEY]) {
        const stored = data[this.STORAGE_KEY];
        console.log('[PerformanceMonitor] Loaded previous session metrics:', stored);
      }
    } catch (error) {
      console.error('[PerformanceMonitor] Failed to load from storage:', error);
    }
  }

  /**
   * Clear all collected metrics
   */
  clear(): void {
    this.metrics = [];
    this.memorySnapshots = [];
    this.timers.clear();
    this.fpsFrameTimes = [];

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Get metrics by name pattern
   */
  getMetricsByName(pattern: string): PerformanceMetrics[] {
    return this.metrics.filter(m => m.name.includes(pattern));
  }

  /**
   * Get average duration for a specific metric name
   */
  getAverageDuration(name: string): number {
    const matching = this.metrics.filter(m => m.name === name);
    if (matching.length === 0) return 0;

    const total = matching.reduce((sum, m) => sum + m.duration, 0);
    return total / matching.length;
  }

  /**
   * Check if performance targets are met
   */
  checkTargets(targets: { [name: string]: number }): { [name: string]: boolean } {
    const results: { [name: string]: boolean } = {};

    for (const [name, maxDuration] of Object.entries(targets)) {
      const avgDuration = this.getAverageDuration(name);
      results[name] = avgDuration <= maxDuration;
    }

    return results;
  }

  /**
   * Detect potential memory leaks
   */
  detectMemoryLeaks(): {
    detected: boolean;
    trend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
    growth: number;
  } {
    if (this.memorySnapshots.length < 10) {
      return { detected: false, trend: 'unknown', growth: 0 };
    }

    // Calculate linear regression trend
    const recent = this.memorySnapshots.slice(-20);
    const firstHalf = recent.slice(0, 10);
    const secondHalf = recent.slice(10);

    const firstAvg = firstHalf.reduce((sum, s) => sum + s.usedJSHeapSize, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, s) => sum + s.usedJSHeapSize, 0) / secondHalf.length;

    const growth = secondAvg - firstAvg;
    const growthPercent = (growth / firstAvg) * 100;

    let trend: 'increasing' | 'stable' | 'decreasing';
    if (growthPercent > 5) {
      trend = 'increasing';
    } else if (growthPercent < -5) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    // Memory leak detection: > 10% growth over recent samples
    const detected = growthPercent > 10;

    return { detected, trend, growth: growthPercent };
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

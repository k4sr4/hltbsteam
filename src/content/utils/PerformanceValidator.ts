/**
 * Performance validation utility to ensure <10ms detection target is met
 */

import { SteamPageDetector } from '../detection/SteamPageDetector';
import { GlobalPerformanceMonitor, PerformanceReport } from './PerformanceMonitor';

export interface ValidationResult {
  passed: boolean;
  averageDetectionTime: number;
  maxDetectionTime: number;
  targetTime: number;
  totalTests: number;
  passedTests: number;
  details: {
    cachePerformance: boolean;
    domQueryEfficiency: boolean;
    memoryUsage: boolean;
    errorRate: boolean;
  };
  recommendations: string[];
}

export class PerformanceValidator {
  private readonly TARGET_DETECTION_TIME = 10; // 10ms target
  private readonly MAX_MEMORY_INCREASE = 5 * 1024 * 1024; // 5MB
  private readonly MAX_ERROR_RATE = 0.05; // 5%

  /**
   * Run comprehensive performance validation
   */
  async validatePerformance(): Promise<ValidationResult> {
    console.log('[HLTB Performance] Starting performance validation...');

    // Clear existing benchmarks
    GlobalPerformanceMonitor.clear();

    const detector = new SteamPageDetector({
      maxWaitTime: 3000,
      aggressive: false,
      useCache: true
    });

    // Test scenarios
    const scenarios = [
      { name: 'Steam Store Game Page', url: 'https://store.steampowered.com/app/123456/' },
      { name: 'Steam Community Game Page', url: 'https://steamcommunity.com/app/123456' },
      { name: 'Non-Game Page', url: 'https://store.steampowered.com/search/' },
      { name: 'Cache Hit Test', url: 'https://store.steampowered.com/app/123456/' }, // Repeat for cache
    ];

    const results: { success: boolean; duration: number; fromCache: boolean }[] = [];
    let errors = 0;

    for (const scenario of scenarios) {
      try {
        // Simulate different URLs
        Object.defineProperty(window, 'location', {
          value: { href: scenario.url },
          writable: true
        });

        const startTime = performance.now();
        const result = await detector.detectGame();
        const duration = performance.now() - startTime;

        results.push({
          success: result.success,
          duration,
          fromCache: duration < 1 // Assume cache if very fast
        });

        console.log(`[HLTB Performance] ${scenario.name}: ${duration.toFixed(2)}ms`);
      } catch (error) {
        errors++;
        console.error(`[HLTB Performance] Error in ${scenario.name}:`, error);
      }
    }

    // Analyze results
    const successfulResults = results.filter(r => r.success);
    const averageTime = successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length;
    const maxTime = Math.max(...successfulResults.map(r => r.duration));
    const errorRate = errors / scenarios.length;

    // Get performance report
    const report = GlobalPerformanceMonitor.generateReport();

    // Validate individual performance aspects
    const validation = {
      cachePerformance: this.validateCachePerformance(report),
      domQueryEfficiency: this.validateDomQueryEfficiency(report),
      memoryUsage: this.validateMemoryUsage(),
      errorRate: errorRate <= this.MAX_ERROR_RATE
    };

    const passed = averageTime <= this.TARGET_DETECTION_TIME &&
                   maxTime <= this.TARGET_DETECTION_TIME * 2 &&
                   Object.values(validation).every(v => v);

    const recommendations = this.generateRecommendations(validation, report, averageTime);

    return {
      passed,
      averageDetectionTime: averageTime,
      maxDetectionTime: maxTime,
      targetTime: this.TARGET_DETECTION_TIME,
      totalTests: scenarios.length,
      passedTests: scenarios.length - errors,
      details: validation,
      recommendations
    };
  }

  /**
   * Validate cache performance
   */
  private validateCachePerformance(report: PerformanceReport): boolean {
    // Cache hit rate should be > 50% after initial page load
    return report.cacheHitRate > 50 || report.totalOperations < 5;
  }

  /**
   * Validate DOM query efficiency
   */
  private validateDomQueryEfficiency(report: PerformanceReport): boolean {
    // Average DOM queries per operation should be reasonable
    const avgQueriesPerOp = report.totalDomQueries / Math.max(report.totalOperations, 1);
    return avgQueriesPerOp <= 10; // Max 10 DOM queries per detection
  }

  /**
   * Validate memory usage
   */
  private validateMemoryUsage(): boolean {
    const memory = (performance as any).memory;
    if (!memory) return true; // Can't validate if memory API unavailable

    // Memory increase should be reasonable
    return memory.usedJSHeapSize < this.MAX_MEMORY_INCREASE;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    validation: ValidationResult['details'],
    report: PerformanceReport,
    averageTime: number
  ): string[] {
    const recommendations: string[] = [];

    if (averageTime > this.TARGET_DETECTION_TIME) {
      recommendations.push(`Detection time (${averageTime.toFixed(2)}ms) exceeds target (${this.TARGET_DETECTION_TIME}ms)`);
    }

    if (!validation.cachePerformance) {
      recommendations.push(`Cache hit rate (${report.cacheHitRate.toFixed(1)}%) is too low. Consider improving cache strategy.`);
    }

    if (!validation.domQueryEfficiency) {
      const avgQueries = report.totalDomQueries / Math.max(report.totalOperations, 1);
      recommendations.push(`DOM queries per operation (${avgQueries.toFixed(1)}) is too high. Optimize selectors and caching.`);
    }

    if (!validation.memoryUsage) {
      recommendations.push('Memory usage is too high. Check for memory leaks and optimize cache sizes.');
    }

    if (!validation.errorRate) {
      recommendations.push('Error rate is too high. Improve error handling and fallback mechanisms.');
    }

    if (report.slowestOperations.length > 0) {
      const slowest = report.slowestOperations[0];
      recommendations.push(`Slowest operation: ${slowest.operationName} (${slowest.duration.toFixed(2)}ms)`);
    }

    return recommendations;
  }

  /**
   * Run quick performance check
   */
  async quickCheck(): Promise<{ passed: boolean; duration: number }> {
    const detector = new SteamPageDetector();

    // Simulate a typical Steam game page
    Object.defineProperty(window, 'location', {
      value: { href: 'https://store.steampowered.com/app/123456/Test_Game/' },
      writable: true
    });

    const startTime = performance.now();
    const result = await detector.detectGame();
    const duration = performance.now() - startTime;

    return {
      passed: duration <= this.TARGET_DETECTION_TIME,
      duration
    };
  }

  /**
   * Generate performance report summary
   */
  generateSummary(result: ValidationResult): string {
    const status = result.passed ? '✓ PASSED' : '✗ FAILED';
    const recommendations = result.recommendations.length > 0
      ? `\nRecommendations:\n${result.recommendations.map(r => `- ${r}`).join('\n')}`
      : '';

    return `Performance Validation ${status}

Detection Performance:
- Average Time: ${result.averageDetectionTime.toFixed(2)}ms (target: ${result.targetTime}ms)
- Max Time: ${result.maxDetectionTime.toFixed(2)}ms
- Tests Passed: ${result.passedTests}/${result.totalTests}

Component Performance:
- Cache Performance: ${result.details.cachePerformance ? '✓' : '✗'}
- DOM Query Efficiency: ${result.details.domQueryEfficiency ? '✓' : '✗'}
- Memory Usage: ${result.details.memoryUsage ? '✓' : '✗'}
- Error Rate: ${result.details.errorRate ? '✓' : '✗'}${recommendations}`;
  }
}

/**
 * Global performance validator instance
 */
export const GlobalPerformanceValidator = new PerformanceValidator();
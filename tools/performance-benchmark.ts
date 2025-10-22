/**
 * Performance Benchmarking Tool for HLTBDisplay Component
 *
 * This tool provides comprehensive performance benchmarking capabilities
 * to measure and compare performance before/after optimizations.
 *
 * Usage:
 *   ts-node tools/performance-benchmark.ts
 *   ts-node tools/performance-benchmark.ts --iterations 100
 *   ts-node tools/performance-benchmark.ts --output benchmark-results.json
 */

import { HLTBDisplay } from '../src/content/components/HLTBDisplay';
import { HLTBData, ComponentMetrics } from '../src/content/types/HLTB';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Benchmark configuration
 */
interface BenchmarkConfig {
  iterations: number;
  warmupIterations: number;
  outputFile?: string;
  verbose: boolean;
}

/**
 * Benchmark results for a single test
 */
interface BenchmarkResult {
  name: string;
  iterations: number;
  measurements: {
    times: number[];
    metrics: ComponentMetrics[];
  };
  statistics: {
    mean: number;
    median: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
    stdDev: number;
  };
}

/**
 * Complete benchmark report
 */
interface BenchmarkReport {
  timestamp: string;
  config: BenchmarkConfig;
  environment: {
    platform: string;
    nodeVersion: string;
  };
  results: BenchmarkResult[];
  summary: {
    totalTests: number;
    totalTime: number;
    overallPerformance: 'PASS' | 'FAIL';
    failedTests: string[];
  };
}

/**
 * Statistics utility functions
 */
class Stats {
  static mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  static median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  static percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  static standardDeviation(values: number[]): number {
    const avg = this.mean(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    return Math.sqrt(this.mean(squareDiffs));
  }

  static calculateStatistics(values: number[]) {
    return {
      mean: this.mean(values),
      median: this.median(values),
      min: Math.min(...values),
      max: Math.max(...values),
      p95: this.percentile(values, 95),
      p99: this.percentile(values, 99),
      stdDev: this.standardDeviation(values)
    };
  }
}

/**
 * Mock HLTB data for benchmarking
 */
const BENCHMARK_DATA: HLTBData = {
  mainStory: 12.5,
  mainExtra: 18.3,
  completionist: 25.8,
  allStyles: 15.2,
  gameId: 123456,
  source: 'api',
  confidence: 'high'
};

/**
 * Performance Benchmarking Tool
 */
class PerformanceBenchmark {
  private config: BenchmarkConfig;
  private results: BenchmarkResult[] = [];

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = {
      iterations: config.iterations || 50,
      warmupIterations: config.warmupIterations || 10,
      outputFile: config.outputFile,
      verbose: config.verbose ?? true
    };
  }

  /**
   * Run all benchmarks
   */
  async run(): Promise<BenchmarkReport> {
    this.log('🚀 Starting HLTBDisplay Performance Benchmark');
    this.log(`Configuration: ${JSON.stringify(this.config, null, 2)}`);
    this.log('');

    const startTime = Date.now();

    // Run warmup iterations
    await this.warmup();

    // Run benchmark tests
    await this.benchmarkCreation();
    await this.benchmarkMount();
    await this.benchmarkRenderSuccess();
    await this.benchmarkRenderLoading();
    await this.benchmarkRenderError();
    await this.benchmarkStateTransitions();
    await this.benchmarkCompleteWorkflow();
    await this.benchmarkMemoryUsage();

    const totalTime = Date.now() - startTime;

    // Generate report
    const report = this.generateReport(totalTime);

    // Save report if output file specified
    if (this.config.outputFile) {
      this.saveReport(report);
    }

    // Print summary
    this.printSummary(report);

    return report;
  }

  /**
   * Warmup iterations to stabilize JIT
   */
  private async warmup(): Promise<void> {
    this.log(`⏳ Running ${this.config.warmupIterations} warmup iterations...`);

    for (let i = 0; i < this.config.warmupIterations; i++) {
      const display = new HLTBDisplay();
      const container = this.createContainer();
      display.mount(container);
      display.setData(BENCHMARK_DATA);
      display.destroy();
    }

    this.log('✅ Warmup complete\n');
  }

  /**
   * Benchmark: Component Creation
   */
  private async benchmarkCreation(): Promise<void> {
    this.log('📊 Benchmarking: Component Creation');

    const times: number[] = [];
    const metrics: ComponentMetrics[] = [];

    for (let i = 0; i < this.config.iterations; i++) {
      const start = performance.now();
      const display = new HLTBDisplay();
      const duration = performance.now() - start;

      times.push(duration);
      metrics.push(display.getMetrics());
    }

    const result: BenchmarkResult = {
      name: 'Component Creation',
      iterations: this.config.iterations,
      measurements: { times, metrics },
      statistics: Stats.calculateStatistics(times)
    };

    this.results.push(result);
    this.printResult(result, 10); // Budget: 10ms
  }

  /**
   * Benchmark: Mount to DOM
   */
  private async benchmarkMount(): Promise<void> {
    this.log('📊 Benchmarking: Mount to DOM');

    const times: number[] = [];
    const metrics: ComponentMetrics[] = [];

    for (let i = 0; i < this.config.iterations; i++) {
      const display = new HLTBDisplay();
      const container = this.createContainer();

      const start = performance.now();
      display.mount(container);
      const duration = performance.now() - start;

      times.push(duration);
      metrics.push(display.getMetrics());
      display.destroy();
    }

    const result: BenchmarkResult = {
      name: 'Mount to DOM',
      iterations: this.config.iterations,
      measurements: { times, metrics },
      statistics: Stats.calculateStatistics(times)
    };

    this.results.push(result);
    this.printResult(result, 20); // Budget: 20ms
  }

  /**
   * Benchmark: Render Success State
   */
  private async benchmarkRenderSuccess(): Promise<void> {
    this.log('📊 Benchmarking: Render Success State');

    const times: number[] = [];
    const metrics: ComponentMetrics[] = [];

    for (let i = 0; i < this.config.iterations; i++) {
      const display = new HLTBDisplay();
      const container = this.createContainer();
      display.mount(container);

      const start = performance.now();
      display.setData(BENCHMARK_DATA);
      const duration = performance.now() - start;

      times.push(duration);
      metrics.push(display.getMetrics());
      display.destroy();
    }

    const result: BenchmarkResult = {
      name: 'Render Success State',
      iterations: this.config.iterations,
      measurements: { times, metrics },
      statistics: Stats.calculateStatistics(times)
    };

    this.results.push(result);
    this.printResult(result, 20); // Budget: 20ms
  }

  /**
   * Benchmark: Render Loading State
   */
  private async benchmarkRenderLoading(): Promise<void> {
    this.log('📊 Benchmarking: Render Loading State');

    const times: number[] = [];
    const metrics: ComponentMetrics[] = [];

    for (let i = 0; i < this.config.iterations; i++) {
      const display = new HLTBDisplay({ showLoading: true });
      const container = this.createContainer();
      display.mount(container);

      const start = performance.now();
      display.setLoading();
      const duration = performance.now() - start;

      times.push(duration);
      metrics.push(display.getMetrics());
      display.destroy();
    }

    const result: BenchmarkResult = {
      name: 'Render Loading State',
      iterations: this.config.iterations,
      measurements: { times, metrics },
      statistics: Stats.calculateStatistics(times)
    };

    this.results.push(result);
    this.printResult(result, 10); // Budget: 10ms
  }

  /**
   * Benchmark: Render Error State
   */
  private async benchmarkRenderError(): Promise<void> {
    this.log('📊 Benchmarking: Render Error State');

    const times: number[] = [];
    const metrics: ComponentMetrics[] = [];

    for (let i = 0; i < this.config.iterations; i++) {
      const display = new HLTBDisplay({ showErrors: true });
      const container = this.createContainer();
      display.mount(container);

      const start = performance.now();
      display.setError('Benchmark error');
      const duration = performance.now() - start;

      times.push(duration);
      metrics.push(display.getMetrics());
      display.destroy();
    }

    const result: BenchmarkResult = {
      name: 'Render Error State',
      iterations: this.config.iterations,
      measurements: { times, metrics },
      statistics: Stats.calculateStatistics(times)
    };

    this.results.push(result);
    this.printResult(result, 10); // Budget: 10ms
  }

  /**
   * Benchmark: State Transitions
   */
  private async benchmarkStateTransitions(): Promise<void> {
    this.log('📊 Benchmarking: State Transitions');

    const times: number[] = [];
    const metrics: ComponentMetrics[] = [];

    for (let i = 0; i < this.config.iterations; i++) {
      const display = new HLTBDisplay();
      const container = this.createContainer();
      display.mount(container);

      const start = performance.now();
      display.setLoading();
      display.setData(BENCHMARK_DATA);
      display.setLoading();
      display.setError('Error');
      display.setData(BENCHMARK_DATA);
      const duration = performance.now() - start;

      times.push(duration);
      metrics.push(display.getMetrics());
      display.destroy();
    }

    const result: BenchmarkResult = {
      name: 'State Transitions (5 changes)',
      iterations: this.config.iterations,
      measurements: { times, metrics },
      statistics: Stats.calculateStatistics(times)
    };

    this.results.push(result);
    this.printResult(result, 50); // Budget: 50ms for 5 transitions
  }

  /**
   * Benchmark: Complete Workflow
   */
  private async benchmarkCompleteWorkflow(): Promise<void> {
    this.log('📊 Benchmarking: Complete Workflow (Create → Mount → Render)');

    const times: number[] = [];
    const metrics: ComponentMetrics[] = [];

    for (let i = 0; i < this.config.iterations; i++) {
      const start = performance.now();

      const display = new HLTBDisplay();
      const container = this.createContainer();
      display.mount(container);
      display.setData(BENCHMARK_DATA);

      const duration = performance.now() - start;

      times.push(duration);
      metrics.push(display.getMetrics());
      display.destroy();
    }

    const result: BenchmarkResult = {
      name: 'Complete Workflow',
      iterations: this.config.iterations,
      measurements: { times, metrics },
      statistics: Stats.calculateStatistics(times)
    };

    this.results.push(result);
    this.printResult(result, 50); // Budget: 50ms
  }

  /**
   * Benchmark: Memory Usage
   */
  private async benchmarkMemoryUsage(): Promise<void> {
    this.log('📊 Benchmarking: Memory Usage');

    if (!(performance as any).memory) {
      this.log('⚠️  Memory API not available, skipping memory benchmark\n');
      return;
    }

    const measurements: number[] = [];

    for (let i = 0; i < 10; i++) {
      const initialMemory = (performance as any).memory.usedJSHeapSize;

      const display = new HLTBDisplay();
      const container = this.createContainer();
      display.mount(container);
      display.setData(BENCHMARK_DATA);

      const withComponentMemory = (performance as any).memory.usedJSHeapSize;
      const memoryUsed = withComponentMemory - initialMemory;

      measurements.push(memoryUsed);

      display.destroy();

      // Force GC if available
      if (global.gc) {
        global.gc();
      }
    }

    const stats = Stats.calculateStatistics(measurements);

    this.log(`  Memory per instance:`);
    this.log(`    Average: ${(stats.mean / 1024).toFixed(2)} KB`);
    this.log(`    Median:  ${(stats.median / 1024).toFixed(2)} KB`);
    this.log(`    Min:     ${(stats.min / 1024).toFixed(2)} KB`);
    this.log(`    Max:     ${(stats.max / 1024).toFixed(2)} KB`);
    this.log(`    P95:     ${(stats.p95 / 1024).toFixed(2)} KB`);
    this.log(`  Status: ${stats.p95 < 50 * 1024 ? '✅ PASS' : '❌ FAIL'} (Budget: < 50 KB)\n`);
  }

  /**
   * Create a test container element
   */
  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    document.body.appendChild(container);
    return container;
  }

  /**
   * Print individual benchmark result
   */
  private printResult(result: BenchmarkResult, budget: number): void {
    const { statistics } = result;
    const passed = statistics.p95 < budget;

    this.log(`  Mean:   ${statistics.mean.toFixed(2)}ms`);
    this.log(`  Median: ${statistics.median.toFixed(2)}ms`);
    this.log(`  Min:    ${statistics.min.toFixed(2)}ms`);
    this.log(`  Max:    ${statistics.max.toFixed(2)}ms`);
    this.log(`  P95:    ${statistics.p95.toFixed(2)}ms`);
    this.log(`  P99:    ${statistics.p99.toFixed(2)}ms`);
    this.log(`  StdDev: ${statistics.stdDev.toFixed(2)}ms`);
    this.log(`  Status: ${passed ? '✅ PASS' : '❌ FAIL'} (Budget: < ${budget}ms)\n`);
  }

  /**
   * Generate complete benchmark report
   */
  private generateReport(totalTime: number): BenchmarkReport {
    const failedTests = this.results
      .filter(r => {
        const budgets: Record<string, number> = {
          'Component Creation': 10,
          'Mount to DOM': 20,
          'Render Success State': 20,
          'Render Loading State': 10,
          'Render Error State': 10,
          'State Transitions (5 changes)': 50,
          'Complete Workflow': 50
        };
        return r.statistics.p95 >= (budgets[r.name] || 50);
      })
      .map(r => r.name);

    return {
      timestamp: new Date().toISOString(),
      config: this.config,
      environment: {
        platform: process.platform,
        nodeVersion: process.version
      },
      results: this.results,
      summary: {
        totalTests: this.results.length,
        totalTime,
        overallPerformance: failedTests.length === 0 ? 'PASS' : 'FAIL',
        failedTests
      }
    };
  }

  /**
   * Save report to JSON file
   */
  private saveReport(report: BenchmarkReport): void {
    const outputPath = path.resolve(this.config.outputFile!);
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    this.log(`\n💾 Report saved to: ${outputPath}`);
  }

  /**
   * Print summary of all benchmarks
   */
  private printSummary(report: BenchmarkReport): void {
    this.log('\n' + '='.repeat(60));
    this.log('📈 BENCHMARK SUMMARY');
    this.log('='.repeat(60));

    this.log(`Total Tests:    ${report.summary.totalTests}`);
    this.log(`Total Time:     ${(report.summary.totalTime / 1000).toFixed(2)}s`);
    this.log(`Overall Status: ${report.summary.overallPerformance === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);

    if (report.summary.failedTests.length > 0) {
      this.log(`\nFailed Tests:`);
      report.summary.failedTests.forEach(test => {
        this.log(`  ❌ ${test}`);
      });
    }

    this.log('\n' + '='.repeat(60));

    // Performance comparison table
    this.log('\nPerformance Summary (P95):');
    this.log('-'.repeat(60));
    this.log(`${'Test'.padEnd(35)} | ${'P95'.padEnd(10)} | Status`);
    this.log('-'.repeat(60));

    const budgets: Record<string, number> = {
      'Component Creation': 10,
      'Mount to DOM': 20,
      'Render Success State': 20,
      'Render Loading State': 10,
      'Render Error State': 10,
      'State Transitions (5 changes)': 50,
      'Complete Workflow': 50
    };

    report.results.forEach(result => {
      const budget = budgets[result.name] || 50;
      const p95 = result.statistics.p95.toFixed(2);
      const status = result.statistics.p95 < budget ? '✅' : '❌';
      this.log(`${result.name.padEnd(35)} | ${(p95 + 'ms').padEnd(10)} | ${status}`);
    });

    this.log('-'.repeat(60) + '\n');
  }

  /**
   * Log message if verbose mode enabled
   */
  private log(message: string): void {
    if (this.config.verbose) {
      console.log(message);
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): Partial<BenchmarkConfig> {
  const args = process.argv.slice(2);
  const config: Partial<BenchmarkConfig> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--iterations':
        config.iterations = parseInt(args[++i], 10);
        break;
      case '--warmup':
        config.warmupIterations = parseInt(args[++i], 10);
        break;
      case '--output':
        config.outputFile = args[++i];
        break;
      case '--quiet':
        config.verbose = false;
        break;
    }
  }

  return config;
}

/**
 * Main execution
 */
async function main() {
  // Setup JSDOM environment
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');

  (global as any).window = dom.window;
  (global as any).document = dom.window.document;
  (global as any).performance = {
    now: () => Date.now(),
    memory: undefined // Can be mocked if needed
  };

  // Parse arguments
  const config = parseArgs();

  // Run benchmark
  const benchmark = new PerformanceBenchmark(config);
  const report = await benchmark.run();

  // Exit with appropriate code
  process.exit(report.summary.overallPerformance === 'PASS' ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Benchmark error:', error);
    process.exit(1);
  });
}

export { PerformanceBenchmark, BenchmarkReport, BenchmarkResult, BenchmarkConfig };

import { getLogger } from './loggingService';

export interface BenchmarkResult {
  name: string;
  duration: number;
  memoryBefore: number;
  memoryAfter: number;
  memoryDelta: number;
  passed: boolean;
  threshold: number;
}

/**
 * Performance benchmarking for immersive modes
 * Tracks load times, memory usage, and rendering performance
 */
export class PerformanceBenchmark {
  private logger = getLogger();
  private results: BenchmarkResult[] = [];

  // Performance targets (in milliseconds)
  private targets = {
    writingModeLoad: 1000,
    editingModeLoad: 2000,
    claimMatchingLoad: 2000,
    claimReviewLoad: 2000,
    sentenceParsing: 500, // per 10,000 words
    claimMatching: 1000, // per 1,000 claims
    similarityCalc: 100 // per claim
  };

  // Memory targets (in MB)
  private memoryTargets = {
    initialLoad: 200,
    perModeOverhead: 50,
    cacheSize: 100
  };

  /**
   * Benchmark mode loading performance
   */
  async benchmarkModeLoad(
    modeName: 'writing' | 'editing' | 'matching' | 'review',
    loadFn: () => Promise<void>
  ): Promise<BenchmarkResult> {
    const memoryBefore = this.getMemoryUsage();
    const startTime = performance.now();

    try {
      await loadFn();
      const duration = performance.now() - startTime;
      const memoryAfter = this.getMemoryUsage();

      // Map mode names to target keys
      const targetKeyMap: Record<string, keyof typeof this.targets> = {
        'writing': 'writingModeLoad',
        'editing': 'editingModeLoad',
        'matching': 'claimMatchingLoad',
        'review': 'claimReviewLoad'
      };

      const thresholdKey = targetKeyMap[modeName];
      const threshold = (this.targets[thresholdKey] as number) || 2000;
      const passed = duration <= threshold;

      const result: BenchmarkResult = {
        name: `${modeName}ModeLoad`,
        duration,
        memoryBefore,
        memoryAfter,
        memoryDelta: memoryAfter - memoryBefore,
        passed,
        threshold
      };

      this.results.push(result);
      this.logResult(result);

      return result;
    } catch (error) {
      this.logger.error(`Benchmark failed for ${modeName} mode: ${error}`);
      throw error;
    }
  }

  /**
   * Benchmark sentence parsing performance
   */
  async benchmarkSentenceParsing(
    wordCount: number,
    parseFn: () => Promise<any>
  ): Promise<BenchmarkResult> {
    const memoryBefore = this.getMemoryUsage();
    const startTime = performance.now();

    try {
      await parseFn();
      const duration = performance.now() - startTime;
      const memoryAfter = this.getMemoryUsage();

      // Scale threshold based on word count (500ms per 10,000 words)
      const threshold = (wordCount / 10000) * this.targets.sentenceParsing;
      const passed = duration <= threshold;

      const result: BenchmarkResult = {
        name: `sentenceParsing_${wordCount}words`,
        duration,
        memoryBefore,
        memoryAfter,
        memoryDelta: memoryAfter - memoryBefore,
        passed,
        threshold
      };

      this.results.push(result);
      this.logResult(result);

      return result;
    } catch (error) {
      this.logger.error(`Benchmark failed for sentence parsing: ${error}`);
      throw error;
    }
  }

  /**
   * Benchmark claim matching performance
   */
  async benchmarkClaimMatching(
    claimCount: number,
    matchFn: () => Promise<any>
  ): Promise<BenchmarkResult> {
    const memoryBefore = this.getMemoryUsage();
    const startTime = performance.now();

    try {
      await matchFn();
      const duration = performance.now() - startTime;
      const memoryAfter = this.getMemoryUsage();

      // Scale threshold based on claim count (1000ms per 1,000 claims)
      const threshold = (claimCount / 1000) * this.targets.claimMatching;
      const passed = duration <= threshold;

      const result: BenchmarkResult = {
        name: `claimMatching_${claimCount}claims`,
        duration,
        memoryBefore,
        memoryAfter,
        memoryDelta: memoryAfter - memoryBefore,
        passed,
        threshold
      };

      this.results.push(result);
      this.logResult(result);

      return result;
    } catch (error) {
      this.logger.error(`Benchmark failed for claim matching: ${error}`);
      throw error;
    }
  }

  /**
   * Benchmark similarity calculation performance
   */
  async benchmarkSimilarityCalc(
    claimCount: number,
    calcFn: () => Promise<any>
  ): Promise<BenchmarkResult> {
    const memoryBefore = this.getMemoryUsage();
    const startTime = performance.now();

    try {
      await calcFn();
      const duration = performance.now() - startTime;
      const memoryAfter = this.getMemoryUsage();

      // Scale threshold based on claim count (100ms per claim)
      const threshold = claimCount * (this.targets.similarityCalc / 1);
      const passed = duration <= threshold;

      const result: BenchmarkResult = {
        name: `similarityCalc_${claimCount}claims`,
        duration,
        memoryBefore,
        memoryAfter,
        memoryDelta: memoryAfter - memoryBefore,
        passed,
        threshold
      };

      this.results.push(result);
      this.logResult(result);

      return result;
    } catch (error) {
      this.logger.error(`Benchmark failed for similarity calculation: ${error}`);
      throw error;
    }
  }

  /**
   * Get memory usage in MB
   */
  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024);
  }

  /**
   * Log benchmark result
   */
  private logResult(result: BenchmarkResult): void {
    const status = result.passed ? '✓' : '✗';
    const memoryStr = `${result.memoryBefore}MB → ${result.memoryAfter}MB (Δ${result.memoryDelta}MB)`;
    
    this.logger.info(
      `${status} ${result.name}: ${result.duration.toFixed(2)}ms (threshold: ${result.threshold.toFixed(2)}ms) | Memory: ${memoryStr}`
    );
  }

  /**
   * Get all benchmark results
   */
  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  /**
   * Get summary of benchmark results
   */
  getSummary(): {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    avgDuration: number;
    avgMemoryDelta: number;
  } {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;
    const passRate = total > 0 ? (passed / total) * 100 : 0;
    const avgDuration = total > 0 ? this.results.reduce((sum, r) => sum + r.duration, 0) / total : 0;
    const avgMemoryDelta = total > 0 ? this.results.reduce((sum, r) => sum + r.memoryDelta, 0) / total : 0;

    return {
      total,
      passed,
      failed,
      passRate,
      avgDuration,
      avgMemoryDelta
    };
  }

  /**
   * Clear results
   */
  clear(): void {
    this.results = [];
  }

  /**
   * Export results as JSON
   */
  exportResults(): string {
    return JSON.stringify({
      results: this.results,
      summary: this.getSummary(),
      timestamp: new Date().toISOString()
    }, null, 2);
  }
}

// Singleton instance
let instance: PerformanceBenchmark | null = null;

export function getBenchmark(): PerformanceBenchmark {
  if (!instance) {
    instance = new PerformanceBenchmark();
  }
  return instance;
}

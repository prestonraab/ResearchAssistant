import { getLogger } from './loggingService';
import { getPerformanceMonitor } from './performanceMonitor';

/**
 * Performance Logger - Centralized logging for performance metrics
 * 
 * Provides structured logging for:
 * - Activation times (by phase)
 * - Memory usage (current, peak, trends)
 * - Cache statistics (hit rates, sizes)
 * - Error rates (by operation)
 * 
 * **Validates: Requirements NFR-1 (Performance Targets)**
 * - Tracks activation time < 2s
 * - Monitors memory usage < 100MB idle, < 300MB active
 * - Logs cache performance metrics
 */
export class PerformanceLogger {
  private _logger: any = null;
  private monitor = getPerformanceMonitor();
  
  private activationStartTime: number = 0;
  private phaseStartTimes: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private peakMemoryUsage: number = 0;
  private sessionStartTime: number = Date.now();

  constructor() {
    this.peakMemoryUsage = process.memoryUsage().heapUsed;
  }

  private get logger() {
    if (!this._logger) {
      this._logger = getLogger();
    }
    return this._logger;
  }

  /**
   * Log the start of extension activation
   * Call this at the beginning of the activation process
   */
  logActivationStart(): void {
    this.activationStartTime = performance.now();
    this.logger.info('[Performance] Extension activation started');
  }

  /**
   * Log the start of a specific initialization phase
   * @param phase - Phase name (e.g., 'Phase1', 'Phase2', 'Phase3')
   */
  logPhaseStart(phase: string): void {
    const startTime = performance.now();
    this.phaseStartTimes.set(phase, startTime);
    this.logger.debug(`[Performance] ${phase} initialization started`);
  }

  /**
   * Log the completion of a specific initialization phase
   * @param phase - Phase name (e.g., 'Phase1', 'Phase2', 'Phase3')
   * @param metadata - Optional metadata about the phase
   */
  logPhaseComplete(phase: string, metadata?: Record<string, unknown>): void {
    const startTime = this.phaseStartTimes.get(phase);
    if (!startTime) {
      this.logger.warn(`[Performance] No start time recorded for ${phase}`);
      return;
    }

    const duration = performance.now() - startTime;
    this.phaseStartTimes.delete(phase);

    // Log with appropriate level based on duration
    const logMessage = `[Performance] ${phase} completed in ${duration.toFixed(2)}ms`;
    
    if (phase === 'Phase1' && duration > 500) {
      this.logger.warn(`${logMessage} (target: < 500ms)`, metadata);
    } else if (phase === 'Phase2' && duration > 2000) {
      this.logger.warn(`${logMessage} (target: < 2000ms)`, metadata);
    } else {
      this.logger.info(logMessage, metadata);
    }
  }

  /**
   * Log the completion of extension activation
   * Call this after all phases are complete
   */
  logActivationComplete(): void {
    if (this.activationStartTime === 0) {
      this.logger.warn('[Performance] Activation start time not recorded');
      return;
    }

    const totalDuration = performance.now() - this.activationStartTime;
    const memoryUsageMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    // Log with appropriate level based on duration
    const logMessage = `[Performance] Extension activation complete in ${totalDuration.toFixed(2)}ms`;
    
    if (totalDuration > 2000) {
      this.logger.warn(`${logMessage} (target: < 2000ms)`, {
        memoryUsageMB,
        sessionDurationMs: Date.now() - this.sessionStartTime
      });
    } else {
      this.logger.info(logMessage, {
        memoryUsageMB,
        sessionDurationMs: Date.now() - this.sessionStartTime
      });
    }

    this.activationStartTime = 0;
  }

  /**
   * Log current memory usage
   * @param component - Component name for context
   */
  logMemoryUsage(component?: string): void {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const externalMB = Math.round(usage.external / 1024 / 1024);

    // Track peak memory
    if (usage.heapUsed > this.peakMemoryUsage) {
      this.peakMemoryUsage = usage.heapUsed;
    }

    const componentLabel = component ? ` [${component}]` : '';
    const logMessage = `[Memory]${componentLabel} Heap: ${heapUsedMB}MB / ${heapTotalMB}MB, External: ${externalMB}MB`;

    // Log with appropriate level based on usage
    if (heapUsedMB > 300) {
      this.logger.warn(logMessage);
    } else if (heapUsedMB > 200) {
      this.logger.info(logMessage);
    } else {
      this.logger.debug(logMessage);
    }
  }

  /**
   * Log memory usage as percentage of threshold
   * @param threshold - Threshold in MB (e.g., 300 for 300MB)
   */
  logMemoryUsagePercent(threshold: number = 300): void {
    const usage = process.memoryUsage().heapUsed;
    const usageMB = Math.round(usage / 1024 / 1024);
    const percent = Math.round((usage / (threshold * 1024 * 1024)) * 100);

    const logMessage = `[Memory] ${usageMB}MB (${percent}% of ${threshold}MB threshold)`;

    if (percent > 100) {
      this.logger.error(logMessage);
    } else if (percent > 80) {
      this.logger.warn(logMessage);
    } else {
      this.logger.debug(logMessage);
    }
  }

  /**
   * Log cache statistics
   * @param cacheName - Name of the cache
   * @param stats - Cache statistics
   */
  logCacheStats(
    cacheName: string,
    stats: {
      size: number;
      maxSize: number;
      hitRate?: number;
      missRate?: number;
    }
  ): void {
    const usagePercent = Math.round((stats.size / stats.maxSize) * 100);
    
    let logMessage = `[Cache] ${cacheName}: ${stats.size}/${stats.maxSize} items (${usagePercent}%)`;
    
    if (stats.hitRate !== undefined && stats.missRate !== undefined) {
      const hitRatePercent = Math.round(stats.hitRate * 100);
      logMessage += ` - Hit rate: ${hitRatePercent}%`;
    }

    // Log with appropriate level based on usage
    if (usagePercent > 90) {
      this.logger.warn(logMessage);
    } else {
      this.logger.debug(logMessage);
    }
  }

  /**
   * Log operation performance
   * @param operation - Operation name
   * @param duration - Duration in milliseconds
   * @param threshold - Optional threshold in milliseconds
   */
  logOperationPerformance(
    operation: string,
    duration: number,
    threshold?: number
  ): void {
    const logMessage = `[Perf] ${operation}: ${duration.toFixed(2)}ms`;

    if (threshold && duration > threshold) {
      this.logger.warn(`${logMessage} (threshold: ${threshold}ms)`);
    } else {
      this.logger.debug(logMessage);
    }
  }

  /**
   * Log error occurrence
   * @param operation - Operation that failed
   * @param error - Error object or message
   */
  logError(operation: string, error: Error | string): void {
    // Track error count
    const currentCount = this.errorCounts.get(operation) || 0;
    this.errorCounts.set(operation, currentCount + 1);

    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error(`[Error] ${operation}: ${errorMessage}`);
  }

  /**
   * Log error rate for an operation
   * @param operation - Operation name
   * @param totalAttempts - Total number of attempts
   */
  logErrorRate(operation: string, totalAttempts: number): void {
    const errorCount = this.errorCounts.get(operation) || 0;
    const errorRate = totalAttempts > 0 ? (errorCount / totalAttempts) * 100 : 0;

    const logMessage = `[ErrorRate] ${operation}: ${errorCount}/${totalAttempts} (${errorRate.toFixed(1)}%)`;

    if (errorRate > 10) {
      this.logger.warn(logMessage);
    } else if (errorRate > 0) {
      this.logger.info(logMessage);
    } else {
      this.logger.debug(logMessage);
    }
  }

  /**
   * Log performance summary for a session
   * Call this periodically or at extension deactivation
   */
  logPerformanceSummary(): void {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const sessionDurationMin = (sessionDuration / 1000 / 60).toFixed(1);
    const currentMemoryMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const peakMemoryMB = Math.round(this.peakMemoryUsage / 1024 / 1024);

    // Get performance statistics from monitor
    const allStats = this.monitor.getAllStats();
    const operationCount = allStats.size;

    this.logger.info('[Performance Summary]', {
      sessionDurationMin,
      currentMemoryMB,
      peakMemoryMB,
      operationCount,
      errorCount: this.errorCounts.size,
      totalErrors: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0)
    });

    // Log top slow operations
    const slowOps: Array<[string, any]> = [];
    for (const [op, stats] of allStats.entries()) {
      if (stats.avg > 100) { // Only log operations averaging > 100ms
        slowOps.push([op, stats]);
      }
    }

    if (slowOps.length > 0) {
      slowOps.sort((a, b) => b[1].avg - a[1].avg);
      this.logger.info('[Slow Operations]', {
        operations: slowOps.slice(0, 5).map(([op, stats]) => ({
          operation: op,
          avgMs: stats.avg.toFixed(2),
          maxMs: stats.max.toFixed(2),
          count: stats.count
        }))
      });
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): {
    sessionDurationMs: number;
    currentMemoryMB: number;
    peakMemoryMB: number;
    errorCount: number;
    totalErrors: number;
  } {
    return {
      sessionDurationMs: Date.now() - this.sessionStartTime,
      currentMemoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      peakMemoryMB: Math.round(this.peakMemoryUsage / 1024 / 1024),
      errorCount: this.errorCounts.size,
      totalErrors: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0)
    };
  }

  /**
   * Reset error counts
   */
  resetErrorCounts(): void {
    this.errorCounts.clear();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.phaseStartTimes.clear();
    this.errorCounts.clear();
  }
}

// Global performance logger instance
let globalLogger: PerformanceLogger | undefined;

export function initializePerformanceLogger(): PerformanceLogger {
  globalLogger = new PerformanceLogger();
  return globalLogger;
}

export function getPerformanceLogger(): PerformanceLogger {
  if (!globalLogger) {
    globalLogger = new PerformanceLogger();
  }
  return globalLogger;
}

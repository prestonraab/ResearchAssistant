import { getLogger } from './loggingService';
import { getPerformanceLogger } from './performanceLogger';
import { getPerformanceMonitor } from './performanceMonitor';

/**
 * Metrics data point for time-series tracking
 */
export interface MetricDataPoint {
  timestamp: number;
  value: number;
  metadata?: Record<string, unknown>;
}

/**
 * Cache metrics
 */
export interface CacheMetrics {
  name: string;
  size: number;
  maxSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
}

/**
 * Feature availability status
 */
export interface FeatureStatus {
  name: string;
  available: boolean;
  lastError?: string;
  lastErrorTime?: number;
}

/**
 * Aggregated performance metrics
 */
export interface AggregatedMetrics {
  activationTime?: number;
  memoryUsage: MetricDataPoint[];
  cacheMetrics: CacheMetrics[];
  errorRates: Map<string, number>;
  featureAvailability: FeatureStatus[];
  sessionDurationMs: number;
  peakMemoryMB: number;
  currentMemoryMB: number;
}

/**
 * Metrics Collector - Aggregates performance metrics from various sources
 * 
 * Collects and tracks:
 * - Activation time (from PerformanceLogger)
 * - Memory usage over time (periodic sampling)
 * - Cache hit rates (from services)
 * - Error rates (from PerformanceLogger)
 * - Feature availability (from FeatureManager)
 * 
 * **Validates: Requirements NFR-1 (Performance Targets)**
 * - Tracks activation time < 2s
 * - Monitors memory usage < 100MB idle, < 300MB active
 * - Logs cache performance metrics
 * 
 * **Validates: Requirements NFR-2 (Reliability Targets)**
 * - Tracks error rates
 * - Monitors feature availability
 */
export class MetricsCollector {
  private logger = getLogger();
  private performanceLogger = getPerformanceLogger();
  private performanceMonitor = getPerformanceMonitor();

  // Time-series data
  private memoryHistory: MetricDataPoint[] = [];
  private readonly MAX_HISTORY_POINTS = 1000; // Keep last 1000 data points
  private readonly MEMORY_SAMPLE_INTERVAL_MS = 5000; // Sample every 5 seconds

  // Cache metrics tracking
  private cacheMetrics: Map<string, CacheMetrics> = new Map();

  // Error tracking
  private errorCounts: Map<string, number> = new Map();
  private errorTimestamps: Map<string, number[]> = new Map();

  // Feature availability
  private featureStatus: Map<string, FeatureStatus> = new Map();

  // Monitoring
  private memoryMonitorInterval?: NodeJS.Timeout;
  private sessionStartTime: number = Date.now();

  constructor() {
    // Initialize memory history with current usage
    this.recordMemoryUsage();
  }

  /**
   * Start collecting metrics
   * Should be called during extension activation
   */
  startCollecting(): void {
    // Start periodic memory sampling
    this.memoryMonitorInterval = setInterval(() => {
      this.recordMemoryUsage();
    }, this.MEMORY_SAMPLE_INTERVAL_MS);

    this.logger.debug('[MetricsCollector] Started collecting metrics');
  }

  /**
   * Stop collecting metrics
   * Should be called during extension deactivation
   */
  stopCollecting(): void {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = undefined;
    }

    this.logger.debug('[MetricsCollector] Stopped collecting metrics');
  }

  /**
   * Record current memory usage
   */
  private recordMemoryUsage(): void {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;

    const dataPoint: MetricDataPoint = {
      timestamp: Date.now(),
      value: heapUsedMB
    };

    this.memoryHistory.push(dataPoint);

    // Keep only last MAX_HISTORY_POINTS
    if (this.memoryHistory.length > this.MAX_HISTORY_POINTS) {
      this.memoryHistory.shift();
    }
  }

  /**
   * Register cache metrics
   * @param cacheName - Name of the cache
   * @param size - Current size of cache
   * @param maxSize - Maximum size of cache
   * @param hitCount - Number of cache hits
   * @param missCount - Number of cache misses
   */
  registerCacheMetrics(
    cacheName: string,
    size: number,
    maxSize: number,
    hitCount: number,
    missCount: number
  ): void {
    const totalRequests = hitCount + missCount;
    const hitRate = totalRequests > 0 ? hitCount / totalRequests : 0;

    this.cacheMetrics.set(cacheName, {
      name: cacheName,
      size,
      maxSize,
      hitCount,
      missCount,
      hitRate
    });

    this.logger.debug(`[MetricsCollector] Cache metrics registered: ${cacheName}`, {
      size,
      maxSize,
      hitRate: (hitRate * 100).toFixed(1) + '%'
    });
  }

  /**
   * Update cache metrics
   * @param cacheName - Name of the cache
   * @param hitCount - Number of cache hits
   * @param missCount - Number of cache misses
   */
  updateCacheMetrics(cacheName: string, hitCount: number, missCount: number): void {
    const metrics = this.cacheMetrics.get(cacheName);
    if (!metrics) {
      this.logger.warn(`[MetricsCollector] Cache metrics not found: ${cacheName}`);
      return;
    }

    metrics.hitCount = hitCount;
    metrics.missCount = missCount;
    metrics.hitRate = (hitCount + missCount) > 0 ? hitCount / (hitCount + missCount) : 0;
  }

  /**
   * Record an error occurrence
   * @param operation - Operation that failed
   * @param error - Error object or message
   */
  recordError(operation: string, error: Error | string): void {
    // Track error count
    const currentCount = this.errorCounts.get(operation) || 0;
    this.errorCounts.set(operation, currentCount + 1);

    // Track error timestamps for rate calculation
    if (!this.errorTimestamps.has(operation)) {
      this.errorTimestamps.set(operation, []);
    }
    this.errorTimestamps.get(operation)!.push(Date.now());

    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.debug(`[MetricsCollector] Error recorded: ${operation}`, {
      error: errorMessage
    });
  }

  /**
   * Register feature availability
   * @param featureName - Name of the feature
   * @param available - Whether feature is available
   * @param error - Optional error message if unavailable
   */
  registerFeature(featureName: string, available: boolean, error?: string): void {
    this.featureStatus.set(featureName, {
      name: featureName,
      available,
      lastError: error,
      lastErrorTime: error ? Date.now() : undefined
    });

    this.logger.debug(`[MetricsCollector] Feature registered: ${featureName}`, {
      available,
      error
    });
  }

  /**
   * Update feature availability
   * @param featureName - Name of the feature
   * @param available - Whether feature is available
   * @param error - Optional error message if unavailable
   */
  updateFeature(featureName: string, available: boolean, error?: string): void {
    const status = this.featureStatus.get(featureName);
    if (!status) {
      this.registerFeature(featureName, available, error);
      return;
    }

    status.available = available;
    status.lastError = error;
    status.lastErrorTime = error ? Date.now() : undefined;
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): AggregatedMetrics {
    const performanceMetrics = this.performanceLogger.getMetrics();

    // Calculate error rates
    const errorRates = new Map<string, number>();
    for (const [operation, count] of this.errorCounts.entries()) {
      // Calculate errors per minute
      const timestamps = this.errorTimestamps.get(operation) || [];
      if (timestamps.length > 0) {
        const timeSpanMs = Date.now() - timestamps[0];
        const timeSpanMin = Math.max(timeSpanMs / 1000 / 60, 1); // At least 1 minute
        const errorRate = count / timeSpanMin;
        errorRates.set(operation, errorRate);
      }
    }

    // Calculate feature availability percentage
    const featureAvailability = Array.from(this.featureStatus.values());
    const availableCount = featureAvailability.filter(f => f.available).length;
    const availabilityPercent = featureAvailability.length > 0
      ? (availableCount / featureAvailability.length) * 100
      : 100;

    return {
      activationTime: performanceMetrics.sessionDurationMs,
      memoryUsage: [...this.memoryHistory],
      cacheMetrics: Array.from(this.cacheMetrics.values()),
      errorRates,
      featureAvailability,
      sessionDurationMs: performanceMetrics.sessionDurationMs,
      peakMemoryMB: performanceMetrics.peakMemoryMB,
      currentMemoryMB: performanceMetrics.currentMemoryMB
    };
  }

  /**
   * Get memory usage history
   */
  getMemoryHistory(): MetricDataPoint[] {
    return [...this.memoryHistory];
  }

  /**
   * Get average memory usage
   */
  getAverageMemoryUsage(): number {
    if (this.memoryHistory.length === 0) {
      return 0;
    }

    const sum = this.memoryHistory.reduce((acc, point) => acc + point.value, 0);
    return sum / this.memoryHistory.length;
  }

  /**
   * Get peak memory usage
   */
  getPeakMemoryUsage(): number {
    if (this.memoryHistory.length === 0) {
      return 0;
    }

    return Math.max(...this.memoryHistory.map(point => point.value));
  }

  /**
   * Get cache metrics for a specific cache
   */
  getCacheMetrics(cacheName: string): CacheMetrics | undefined {
    return this.cacheMetrics.get(cacheName);
  }

  /**
   * Get all cache metrics
   */
  getAllCacheMetrics(): CacheMetrics[] {
    return Array.from(this.cacheMetrics.values());
  }

  /**
   * Get error count for an operation
   */
  getErrorCount(operation: string): number {
    return this.errorCounts.get(operation) || 0;
  }

  /**
   * Get total error count
   */
  getTotalErrorCount(): number {
    return Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0);
  }

  /**
   * Get feature availability percentage
   */
  getFeatureAvailabilityPercent(): number {
    if (this.featureStatus.size === 0) {
      return 100;
    }

    const availableCount = Array.from(this.featureStatus.values())
      .filter(f => f.available).length;

    return (availableCount / this.featureStatus.size) * 100;
  }

  /**
   * Get feature status
   */
  getFeatureStatus(featureName: string): FeatureStatus | undefined {
    return this.featureStatus.get(featureName);
  }

  /**
   * Get all feature statuses
   */
  getAllFeatureStatuses(): FeatureStatus[] {
    return Array.from(this.featureStatus.values());
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    const metrics = this.getMetrics();
    return JSON.stringify(metrics, (key, value) => {
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      return value;
    }, 2);
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.memoryHistory = [];
    this.cacheMetrics.clear();
    this.errorCounts.clear();
    this.errorTimestamps.clear();
    this.featureStatus.clear();
    this.sessionStartTime = Date.now();

    this.logger.debug('[MetricsCollector] Metrics cleared');
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stopCollecting();
    this.clearMetrics();
  }
}

// Global metrics collector instance
let globalCollector: MetricsCollector | undefined;

export function initializeMetricsCollector(): MetricsCollector {
  globalCollector = new MetricsCollector();
  return globalCollector;
}

export function getMetricsCollector(): MetricsCollector {
  if (!globalCollector) {
    globalCollector = new MetricsCollector();
  }
  return globalCollector;
}

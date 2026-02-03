import { getLogger } from './loggingService';

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Performance monitoring and optimization service
 */
export class PerformanceMonitor {
  private logger = getLogger();
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private thresholds: Map<string, number> = new Map();

  constructor() {
    // Set default performance thresholds (in milliseconds)
    this.thresholds.set('outline.parse', 100);
    this.thresholds.set('claims.load', 500);
    this.thresholds.set('embedding.generate', 200);
    this.thresholds.set('coverage.analyze', 1000);
    this.thresholds.set('search.query', 100);
  }

  /**
   * Measure the performance of an async operation
   */
  async measureAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      
      this.recordMetric(operation, duration, metadata);
      this.checkThreshold(operation, duration);
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(operation, duration, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Measure the performance of a sync operation
   */
  measureSync<T>(
    operation: string,
    fn: () => T,
    metadata?: Record<string, unknown>
  ): T {
    const startTime = performance.now();
    
    try {
      const result = fn();
      const duration = performance.now() - startTime;
      
      this.recordMetric(operation, duration, metadata);
      this.checkThreshold(operation, duration);
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(operation, duration, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Record a performance metric
   */
  private recordMetric(operation: string, duration: number, metadata?: any): void {
    const metric: PerformanceMetrics = {
      operation,
      duration,
      timestamp: new Date(),
      metadata
    };

    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    const operationMetrics = this.metrics.get(operation)!;
    operationMetrics.push(metric);

    // Keep only last 100 metrics per operation
    if (operationMetrics.length > 100) {
      operationMetrics.shift();
    }

    this.logger.debug(`Performance: ${operation} took ${duration.toFixed(2)}ms`, metadata);
  }

  /**
   * Check if operation exceeded threshold
   */
  private checkThreshold(operation: string, duration: number): void {
    const threshold = this.thresholds.get(operation);
    
    if (threshold && duration > threshold) {
      this.logger.warn(
        `Performance warning: ${operation} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`
      );
    }
  }

  /**
   * Get performance statistics for an operation
   */
  getStats(operation: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p95: number;
  } | null {
    const metrics = this.metrics.get(operation);
    
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);
    const p95Index = Math.floor(durations.length * 0.95);

    return {
      count: durations.length,
      avg: sum / durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      p95: durations[p95Index]
    };
  }

  /**
   * Get all performance statistics
   */
  getAllStats(): Map<string, any> {
    const allStats = new Map();
    
    for (const operation of this.metrics.keys()) {
      const stats = this.getStats(operation);
      if (stats) {
        allStats.set(operation, stats);
      }
    }
    
    return allStats;
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Set performance threshold for an operation
   */
  setThreshold(operation: string, thresholdMs: number): void {
    this.thresholds.set(operation, thresholdMs);
  }
}

// Global performance monitor instance
let globalMonitor: PerformanceMonitor | undefined;

export function initializePerformanceMonitor(): PerformanceMonitor {
  globalMonitor = new PerformanceMonitor();
  return globalMonitor;
}

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!globalMonitor) {
    globalMonitor = new PerformanceMonitor();
  }
  return globalMonitor;
}

/**
 * Decorator for measuring method performance
 */
export function measurePerformance(operation: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const monitor = getPerformanceMonitor();

    descriptor.value = async function (...args: any[]) {
      return monitor.measureAsync(
        `${operation}.${propertyKey}`,
        () => originalMethod.apply(this, args)
      );
    };

    return descriptor;
  };
}

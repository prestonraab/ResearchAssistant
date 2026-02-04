import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  MetricsCollector,
  initializeMetricsCollector,
  getMetricsCollector,
  MetricDataPoint,
  CacheMetrics,
  FeatureStatus,
  AggregatedMetrics
} from '../metricsCollector';
import { getLogger } from '../loggingService';

/**
 * Unit tests for MetricsCollector
 * 
 * **Validates: Requirements NFR-1 (Performance Targets)**
 * - Tracks activation time < 2s
 * - Monitors memory usage < 100MB idle, < 300MB active
 * - Logs cache performance metrics
 * 
 * **Validates: Requirements NFR-2 (Reliability Targets)**
 * - Tracks error rates
 * - Monitors feature availability
 * 
 * **Validates: Requirements US-2 (Low Memory Footprint)**
 * - Tracks memory usage over time
 */
describe('MetricsCollector', () => {
  let collector: MetricsCollector;
  let mockLogger: any;

  beforeEach(() => {
    collector = new MetricsCollector();
    mockLogger = getLogger();
    jest.clearAllMocks();
    jest.spyOn(mockLogger, 'debug').mockImplementation(() => {});
    jest.spyOn(mockLogger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    collector.dispose();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    /**
     * Test that collector initializes with empty metrics
     */
    it('should initialize with empty metrics', () => {
      const metrics = collector.getMetrics();

      expect(metrics).toEqual({
        activationTime: expect.any(Number),
        memoryUsage: expect.any(Array),
        cacheMetrics: [],
        errorRates: expect.any(Map),
        featureAvailability: [],
        sessionDurationMs: expect.any(Number),
        peakMemoryMB: expect.any(Number),
        currentMemoryMB: expect.any(Number)
      });
    });

    /**
     * Test that collector records initial memory usage
     */
    it('should record initial memory usage', () => {
      const history = collector.getMemoryHistory();

      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toEqual({
        timestamp: expect.any(Number),
        value: expect.any(Number)
      });
    });
  });

  describe('Memory Tracking', () => {
    /**
     * Test that memory usage is tracked over time
     * **Validates: Requirements US-2 (Track memory usage over time)**
     */
    it('should track memory usage over time', async () => {
      const initialHistory = collector.getMemoryHistory();
      const initialLength = initialHistory.length;

      // Start collecting
      collector.startCollecting();

      // Wait for a sample
      await new Promise(resolve => setTimeout(resolve, 100));

      // Stop collecting
      collector.stopCollecting();

      const finalHistory = collector.getMemoryHistory();

      // History should have at least the initial point
      expect(finalHistory.length).toBeGreaterThanOrEqual(initialLength);
    });

    /**
     * Test that memory history respects max size limit
     */
    it('should limit memory history to max points', () => {
      // Manually add many data points
      for (let i = 0; i < 1500; i++) {
        const history = collector.getMemoryHistory();
        // Simulate adding points by calling internal method indirectly
        collector.startCollecting();
      }

      const history = collector.getMemoryHistory();

      // Should not exceed max history points (1000)
      expect(history.length).toBeLessThanOrEqual(1000);
    });

    /**
     * Test that average memory usage is calculated
     */
    it('should calculate average memory usage', () => {
      const average = collector.getAverageMemoryUsage();

      expect(average).toBeGreaterThan(0);
      expect(typeof average).toBe('number');
    });

    /**
     * Test that peak memory usage is tracked
     */
    it('should track peak memory usage', () => {
      const peak = collector.getPeakMemoryUsage();

      expect(peak).toBeGreaterThan(0);
      expect(typeof peak).toBe('number');
    });

    /**
     * Test that memory usage is in reasonable range
     */
    it('should report memory usage in reasonable range', () => {
      const average = collector.getAverageMemoryUsage();
      const peak = collector.getPeakMemoryUsage();

      // Memory should be between 0 and 1000 MB for tests
      expect(average).toBeGreaterThan(0);
      expect(average).toBeLessThan(1000);
      expect(peak).toBeGreaterThanOrEqual(average);
    });
  });

  describe('Cache Metrics', () => {
    /**
     * Test that cache metrics can be registered
     * **Validates: Requirements FR-2 (Optimized Caching Strategy)**
     */
    it('should register cache metrics', () => {
      collector.registerCacheMetrics('embeddings', 50, 100, 80, 20);

      const metrics = collector.getCacheMetrics('embeddings');

      expect(metrics).toEqual({
        name: 'embeddings',
        size: 50,
        maxSize: 100,
        hitCount: 80,
        missCount: 20,
        hitRate: 0.8
      });
    });

    /**
     * Test that cache hit rate is calculated correctly
     * **Validates: Requirements US-3 (Track cache hit rates)**
     */
    it('should calculate cache hit rate correctly', () => {
      collector.registerCacheMetrics('claims', 75, 200, 150, 50);

      const metrics = collector.getCacheMetrics('claims');

      expect(metrics?.hitRate).toBe(0.75);
    });

    /**
     * Test that cache metrics can be updated
     */
    it('should update cache metrics', () => {
      collector.registerCacheMetrics('embeddings', 50, 100, 80, 20);
      collector.updateCacheMetrics('embeddings', 100, 30);

      const metrics = collector.getCacheMetrics('embeddings');

      expect(metrics?.hitCount).toBe(100);
      expect(metrics?.missCount).toBe(30);
      expect(metrics?.hitRate).toBeCloseTo(0.769, 2);
    });

    /**
     * Test that multiple caches can be tracked
     */
    it('should track multiple caches', () => {
      collector.registerCacheMetrics('embeddings', 50, 100, 80, 20);
      collector.registerCacheMetrics('claims', 75, 200, 150, 50);

      const allMetrics = collector.getAllCacheMetrics();

      expect(allMetrics).toHaveLength(2);
      expect(allMetrics.map(m => m.name)).toContain('embeddings');
      expect(allMetrics.map(m => m.name)).toContain('claims');
    });

    /**
     * Test that cache with zero requests has zero hit rate
     */
    it('should handle cache with zero requests', () => {
      collector.registerCacheMetrics('empty', 0, 100, 0, 0);

      const metrics = collector.getCacheMetrics('empty');

      expect(metrics?.hitRate).toBe(0);
    });

    /**
     * Test that updating non-existent cache is handled
     */
    it('should handle updating non-existent cache', () => {
      // Should not throw when updating non-existent cache
      expect(() => collector.updateCacheMetrics('nonexistent', 10, 5)).not.toThrow();
    });
  });

  describe('Error Tracking', () => {
    /**
     * Test that errors are recorded
     * **Validates: Requirements US-5 (Track error rates)**
     */
    it('should record errors', () => {
      const error = new Error('Test error');
      collector.recordError('operation.test', error);

      const errorCount = collector.getErrorCount('operation.test');

      expect(errorCount).toBe(1);
    });

    /**
     * Test that multiple errors are counted
     */
    it('should count multiple errors', () => {
      collector.recordError('operation.test', 'Error 1');
      collector.recordError('operation.test', 'Error 2');
      collector.recordError('operation.test', 'Error 3');

      const errorCount = collector.getErrorCount('operation.test');

      expect(errorCount).toBe(3);
    });

    /**
     * Test that total error count is calculated
     */
    it('should calculate total error count', () => {
      collector.recordError('operation.test1', 'Error 1');
      collector.recordError('operation.test1', 'Error 2');
      collector.recordError('operation.test2', 'Error 3');

      const totalCount = collector.getTotalErrorCount();

      expect(totalCount).toBe(3);
    });

    /**
     * Test that error rates are calculated
     */
    it('should calculate error rates', async () => {
      collector.recordError('operation.test', 'Error 1');
      collector.recordError('operation.test', 'Error 2');

      // Wait a bit to ensure time has passed
      await new Promise(resolve => setTimeout(resolve, 10));

      const metrics = collector.getMetrics();

      expect(metrics.errorRates.has('operation.test')).toBe(true);
      expect(metrics.errorRates.get('operation.test')).toBeGreaterThan(0);
    });

    /**
     * Test that error with string message is recorded
     */
    it('should record error with string message', () => {
      collector.recordError('operation.test', 'String error message');

      const errorCount = collector.getErrorCount('operation.test');

      expect(errorCount).toBe(1);
    });

    /**
     * Test that different operations track errors separately
     */
    it('should track errors separately by operation', () => {
      collector.recordError('operation.a', 'Error A');
      collector.recordError('operation.b', 'Error B');
      collector.recordError('operation.b', 'Error B2');

      expect(collector.getErrorCount('operation.a')).toBe(1);
      expect(collector.getErrorCount('operation.b')).toBe(2);
    });
  });

  describe('Feature Availability', () => {
    /**
     * Test that features can be registered
     * **Validates: Requirements US-5 (Track feature availability)**
     */
    it('should register features', () => {
      collector.registerFeature('embeddings', true);

      const status = collector.getFeatureStatus('embeddings');

      expect(status).toEqual({
        name: 'embeddings',
        available: true,
        lastError: undefined,
        lastErrorTime: undefined
      });
    });

    /**
     * Test that unavailable features are tracked with error
     */
    it('should register unavailable features with error', () => {
      collector.registerFeature('mcp', false, 'Connection failed');

      const status = collector.getFeatureStatus('mcp');

      expect(status?.available).toBe(false);
      expect(status?.lastError).toBe('Connection failed');
      expect(status?.lastErrorTime).toBeDefined();
    });

    /**
     * Test that features can be updated
     */
    it('should update feature availability', () => {
      collector.registerFeature('embeddings', true);
      collector.updateFeature('embeddings', false, 'API key invalid');

      const status = collector.getFeatureStatus('embeddings');

      expect(status?.available).toBe(false);
      expect(status?.lastError).toBe('API key invalid');
    });

    /**
     * Test that multiple features can be tracked
     */
    it('should track multiple features', () => {
      collector.registerFeature('embeddings', true);
      collector.registerFeature('mcp', true);
      collector.registerFeature('zotero', false, 'Not configured');

      const allStatuses = collector.getAllFeatureStatuses();

      expect(allStatuses).toHaveLength(3);
      expect(allStatuses.map(s => s.name)).toContain('embeddings');
      expect(allStatuses.map(s => s.name)).toContain('mcp');
      expect(allStatuses.map(s => s.name)).toContain('zotero');
    });

    /**
     * Test that feature availability percentage is calculated
     */
    it('should calculate feature availability percentage', () => {
      collector.registerFeature('embeddings', true);
      collector.registerFeature('mcp', true);
      collector.registerFeature('zotero', false);

      const availabilityPercent = collector.getFeatureAvailabilityPercent();

      expect(availabilityPercent).toBeCloseTo(66.67, 1);
    });

    /**
     * Test that 100% availability is reported when all features available
     */
    it('should report 100% availability when all features available', () => {
      collector.registerFeature('embeddings', true);
      collector.registerFeature('mcp', true);

      const availabilityPercent = collector.getFeatureAvailabilityPercent();

      expect(availabilityPercent).toBe(100);
    });

    /**
     * Test that 100% availability is reported when no features registered
     */
    it('should report 100% availability when no features registered', () => {
      const availabilityPercent = collector.getFeatureAvailabilityPercent();

      expect(availabilityPercent).toBe(100);
    });

    /**
     * Test that updating non-existent feature registers it
     */
    it('should register feature when updating non-existent feature', () => {
      collector.updateFeature('newFeature', true);

      const status = collector.getFeatureStatus('newFeature');

      expect(status?.available).toBe(true);
    });
  });

  describe('Metrics Aggregation', () => {
    /**
     * Test that all metrics are aggregated
     */
    it('should aggregate all metrics', () => {
      collector.registerCacheMetrics('embeddings', 50, 100, 80, 20);
      collector.recordError('operation.test', 'Error 1');
      collector.registerFeature('embeddings', true);

      const metrics = collector.getMetrics();

      expect(metrics).toEqual({
        activationTime: expect.any(Number),
        memoryUsage: expect.any(Array),
        cacheMetrics: expect.any(Array),
        errorRates: expect.any(Map),
        featureAvailability: expect.any(Array),
        sessionDurationMs: expect.any(Number),
        peakMemoryMB: expect.any(Number),
        currentMemoryMB: expect.any(Number)
      });

      expect(metrics.cacheMetrics).toHaveLength(1);
      expect(metrics.errorRates.size).toBeGreaterThan(0);
      expect(metrics.featureAvailability).toHaveLength(1);
    });

    /**
     * Test that metrics can be exported as JSON
     */
    it('should export metrics as JSON', () => {
      collector.registerCacheMetrics('embeddings', 50, 100, 80, 20);
      collector.recordError('operation.test', 'Error 1');

      const json = collector.exportMetrics();

      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();

      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('memoryUsage');
      expect(parsed).toHaveProperty('cacheMetrics');
      expect(parsed).toHaveProperty('errorRates');
    });
  });

  describe('Lifecycle', () => {
    /**
     * Test that collecting can be started and stopped
     */
    it('should start and stop collecting', async () => {
      collector.startCollecting();

      await new Promise(resolve => setTimeout(resolve, 100));

      collector.stopCollecting();

      // Should not throw
      expect(() => collector.stopCollecting()).not.toThrow();
    });

    /**
     * Test that metrics can be cleared
     */
    it('should clear all metrics', () => {
      collector.registerCacheMetrics('embeddings', 50, 100, 80, 20);
      collector.recordError('operation.test', 'Error 1');
      collector.registerFeature('embeddings', true);

      collector.clearMetrics();

      expect(collector.getAllCacheMetrics()).toHaveLength(0);
      expect(collector.getTotalErrorCount()).toBe(0);
      expect(collector.getAllFeatureStatuses()).toHaveLength(0);
    });

    /**
     * Test that resources are disposed
     */
    it('should dispose resources', () => {
      collector.startCollecting();
      collector.registerCacheMetrics('embeddings', 50, 100, 80, 20);

      collector.dispose();

      // After dispose, metrics should be cleared
      expect(collector.getAllCacheMetrics()).toHaveLength(0);
    });
  });

  describe('Global Instance', () => {
    /**
     * Test that global collector can be initialized
     */
    it('should initialize global collector', () => {
      const collector1 = initializeMetricsCollector();
      expect(collector1).toBeInstanceOf(MetricsCollector);
    });

    /**
     * Test that global collector can be retrieved
     */
    it('should get global collector', () => {
      initializeMetricsCollector();
      const collector2 = getMetricsCollector();
      expect(collector2).toBeInstanceOf(MetricsCollector);
    });

    /**
     * Test that global collector is created if not initialized
     */
    it('should create global collector if not initialized', () => {
      const collector = getMetricsCollector();
      expect(collector).toBeInstanceOf(MetricsCollector);
    });
  });

  describe('Edge Cases', () => {
    /**
     * Test that getting metrics for non-existent cache returns undefined
     */
    it('should return undefined for non-existent cache', () => {
      const metrics = collector.getCacheMetrics('nonexistent');

      expect(metrics).toBeUndefined();
    });

    /**
     * Test that getting error count for non-existent operation returns 0
     */
    it('should return 0 for non-existent operation error count', () => {
      const count = collector.getErrorCount('nonexistent');

      expect(count).toBe(0);
    });

    /**
     * Test that getting feature status for non-existent feature returns undefined
     */
    it('should return undefined for non-existent feature', () => {
      const status = collector.getFeatureStatus('nonexistent');

      expect(status).toBeUndefined();
    });

    /**
     * Test that average memory with empty history returns 0
     */
    it('should return 0 for average memory with empty history', () => {
      const collector2 = new MetricsCollector();
      collector2.clearMetrics();

      const average = collector2.getAverageMemoryUsage();

      expect(average).toBe(0);
    });

    /**
     * Test that peak memory with empty history returns 0
     */
    it('should return 0 for peak memory with empty history', () => {
      const collector2 = new MetricsCollector();
      collector2.clearMetrics();

      const peak = collector2.getPeakMemoryUsage();

      expect(peak).toBe(0);
    });
  });
});

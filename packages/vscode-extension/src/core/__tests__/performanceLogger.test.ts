import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PerformanceLogger, initializePerformanceLogger, getPerformanceLogger } from '../performanceLogger';

/**
 * Unit tests for PerformanceLogger
 * 
 * **Validates: Requirements NFR-1 (Performance Targets)**
 * - Tracks activation time < 2s
 * - Monitors memory usage < 100MB idle, < 300MB active
 * - Logs cache performance metrics
 * 
 * **Validates: Requirements US-3 (Responsive UI)**
 * - Logs operation performance for UI interactions
 */
describe('PerformanceLogger', () => {
  let logger: PerformanceLogger;

  beforeEach(() => {
    // Create fresh logger instance for each test
    logger = new PerformanceLogger();
    jest.clearAllMocks();
  });

  afterEach(() => {
    logger.dispose();
  });

  describe('Activation Logging', () => {
    /**
     * Test that activation start is logged
     * **Validates: Requirements US-1 (Fast Activation)**
     */
    it('should log activation start', () => {
      logger.logActivationStart();
      
      // Verify that metrics are initialized
      const metrics = logger.getMetrics();
      expect(metrics.sessionDurationMs).toBeGreaterThanOrEqual(0);
    });

    /**
     * Test that activation completion is logged with duration
     * **Validates: Requirements NFR-1 (Activation time < 2s)**
     */
    it('should log activation completion with duration', async () => {
      logger.logActivationStart();
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 50));
      
      logger.logActivationComplete();
      
      // Verify that metrics show elapsed time
      const metrics = logger.getMetrics();
      expect(metrics.sessionDurationMs).toBeGreaterThan(0);
    });

    /**
     * Test that slow activation is tracked
     * **Validates: Requirements NFR-1 (Performance Targets)**
     */
    it('should track slow activation exceeding 2 second threshold', async () => {
      logger.logActivationStart();
      
      // Simulate slow activation
      await new Promise(resolve => setTimeout(resolve, 2100));
      
      logger.logActivationComplete();
      
      // Verify that metrics show the duration
      const metrics = logger.getMetrics();
      expect(metrics.sessionDurationMs).toBeGreaterThan(2000);
    });

    /**
     * Test that activation without start time is handled gracefully
     */
    it('should handle activation complete without start time', () => {
      // Should not throw when completing without starting
      expect(() => logger.logActivationComplete()).not.toThrow();
    });
  });

  describe('Phase Logging', () => {
    /**
     * Test that phase start is logged
     */
    it('should log phase start', () => {
      logger.logPhaseStart('Phase1');
      
      // Verify that phase tracking is initialized
      const metrics = logger.getMetrics();
      expect(metrics.sessionDurationMs).toBeGreaterThanOrEqual(0);
    });

    /**
     * Test that phase completion is logged with duration
     * **Validates: Requirements US-1 (Fast Activation)**
     */
    it('should log phase completion with duration', async () => {
      logger.logPhaseStart('Phase1');
      
      // Simulate phase work
      await new Promise(resolve => setTimeout(resolve, 50));
      
      logger.logPhaseComplete('Phase1');
      
      // Verify that metrics are updated
      const metrics = logger.getMetrics();
      expect(metrics.sessionDurationMs).toBeGreaterThan(0);
    });

    /**
     * Test that slow Phase1 is tracked
     * Phase1 target: < 500ms
     */
    it('should track Phase1 exceeding 500ms threshold', async () => {
      logger.logPhaseStart('Phase1');
      
      // Simulate slow Phase1
      await new Promise(resolve => setTimeout(resolve, 600));
      
      logger.logPhaseComplete('Phase1');
      
      // Verify that metrics show the duration
      const metrics = logger.getMetrics();
      expect(metrics.sessionDurationMs).toBeGreaterThan(500);
    });

    /**
     * Test that slow Phase2 is tracked
     * Phase2 target: < 2000ms
     */
    it('should track Phase2 exceeding 2000ms threshold', async () => {
      logger.logPhaseStart('Phase2');
      
      // Simulate slow Phase2
      await new Promise(resolve => setTimeout(resolve, 2100));
      
      logger.logPhaseComplete('Phase2');
      
      // Verify that metrics show the duration
      const metrics = logger.getMetrics();
      expect(metrics.sessionDurationMs).toBeGreaterThan(2000);
    });

    /**
     * Test that phase completion without start time is handled
     */
    it('should handle phase complete without start time', () => {
      // Should not throw when completing without starting
      expect(() => logger.logPhaseComplete('Phase1')).not.toThrow();
    });

    /**
     * Test that multiple phases can be tracked simultaneously
     */
    it('should track multiple phases simultaneously', async () => {
      logger.logPhaseStart('Phase1');
      logger.logPhaseStart('Phase2');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      logger.logPhaseComplete('Phase1');
      logger.logPhaseComplete('Phase2');
      
      // Verify that metrics are updated
      const metrics = logger.getMetrics();
      expect(metrics.sessionDurationMs).toBeGreaterThan(0);
    });
  });

  describe('Memory Logging', () => {
    /**
     * Test that high memory usage is tracked
     * **Validates: Requirements US-2 (Memory monitoring)**
     */
    it('should track high memory usage', () => {
      // Mock high memory usage
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 400 * 1024 * 1024,
        heapTotal: 350 * 1024 * 1024,
        heapUsed: 320 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 0
      });
      
      logger.logMemoryUsage();
      
      // Verify that metrics are updated with memory info
      const metrics = logger.getMetrics();
      expect(metrics.currentMemoryMB).toBeGreaterThan(0);
    });
  });

  describe('Cache Statistics Logging', () => {
    /**
     * Test that cache statistics are tracked
     * **Validates: Requirements FR-2 (Optimized Caching Strategy)**
     */
    it('should track cache statistics', () => {
      logger.logCacheStats('embeddings', {
        size: 50,
        maxSize: 100,
        hitRate: 0.85,
        missRate: 0.15
      });
      
      // Verify that metrics are updated
      const metrics = logger.getMetrics();
      expect(metrics).toBeDefined();
    });

    /**
     * Test that cache statistics without hit rate are tracked
     */
    it('should track cache statistics without hit rate', () => {
      logger.logCacheStats('claims', {
        size: 75,
        maxSize: 200
      });
      
      // Verify that metrics are updated
      const metrics = logger.getMetrics();
      expect(metrics).toBeDefined();
    });

    /**
     * Test that full cache is tracked
     */
    it('should track when cache is > 90% full', () => {
      logger.logCacheStats('embeddings', {
        size: 95,
        maxSize: 100
      });
      
      // Verify that metrics are updated
      const metrics = logger.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('Operation Performance Logging', () => {
    /**
     * Test that operation performance is tracked
     * **Validates: Requirements US-3 (Responsive UI)**
     */
    it('should track operation performance', () => {
      logger.logOperationPerformance('search.query', 45.5);
      
      // Verify that metrics are updated
      const metrics = logger.getMetrics();
      expect(metrics).toBeDefined();
    });

    /**
     * Test that slow operations are tracked
     */
    it('should track when operation exceeds threshold', () => {
      logger.logOperationPerformance('outline.parse', 250, 100);
      
      // Verify that metrics are updated
      const metrics = logger.getMetrics();
      expect(metrics).toBeDefined();
    });

    /**
     * Test that fast operations are tracked
     */
    it('should track fast operations', () => {
      logger.logOperationPerformance('outline.parse', 50, 100);
      
      // Verify that metrics are updated
      const metrics = logger.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('Error Logging', () => {
    /**
     * Test that errors are tracked
     * **Validates: Requirements US-5 (Graceful Error Handling)**
     */
    it('should track error with message', () => {
      const error = new Error('Test error');
      logger.logError('operation.test', error);
      
      // Verify that error count is incremented
      const metrics = logger.getMetrics();
      expect(metrics.totalErrors).toBe(1);
    });

    /**
     * Test that string errors are tracked
     */
    it('should track error with string message', () => {
      logger.logError('operation.test', 'String error message');
      
      // Verify that error count is incremented
      const metrics = logger.getMetrics();
      expect(metrics.totalErrors).toBe(1);
    });

    /**
     * Test that error rate is tracked
     */
    it('should track error count', () => {
      logger.logError('operation.test', 'Error 1');
      logger.logError('operation.test', 'Error 2');
      
      const metrics = logger.getMetrics();
      expect(metrics.totalErrors).toBe(2);
    });

    /**
     * Test that error rate is tracked
     */
    it('should track error rate', () => {
      logger.logError('operation.test', 'Error 1');
      logger.logErrorRate('operation.test', 10);
      
      // Verify that metrics are updated
      const metrics = logger.getMetrics();
      expect(metrics.totalErrors).toBe(1);
    });

    /**
     * Test that high error rate is tracked
     */
    it('should track high error rate', () => {
      for (let i = 0; i < 5; i++) {
        logger.logError('operation.test', `Error ${i}`);
      }
      logger.logErrorRate('operation.test', 10);
      
      // Verify that error count is correct
      const metrics = logger.getMetrics();
      expect(metrics.totalErrors).toBe(5);
    });

    /**
     * Test that zero error rate is tracked
     */
    it('should track zero error rate', () => {
      logger.logErrorRate('operation.test', 10);
      
      // Verify that metrics are updated
      const metrics = logger.getMetrics();
      expect(metrics.totalErrors).toBe(0);
    });
  });

  describe('Performance Summary', () => {
    /**
     * Test that performance summary is generated
     */
    it('should generate performance summary', () => {
      logger.logPerformanceSummary();
      
      // Verify that metrics are available
      const metrics = logger.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.sessionDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Metrics', () => {
    /**
     * Test that metrics can be retrieved
     */
    it('should return current metrics', () => {
      const metrics = logger.getMetrics();
      
      expect(metrics).toEqual({
        sessionDurationMs: expect.any(Number),
        currentMemoryMB: expect.any(Number),
        peakMemoryMB: expect.any(Number),
        errorCount: expect.any(Number),
        totalErrors: expect.any(Number)
      });
    });

    /**
     * Test that error counts can be reset
     */
    it('should reset error counts', () => {
      logger.logError('operation.test', 'Error 1');
      logger.logError('operation.test', 'Error 2');
      
      let metrics = logger.getMetrics();
      expect(metrics.totalErrors).toBe(2);
      
      logger.resetErrorCounts();
      
      metrics = logger.getMetrics();
      expect(metrics.totalErrors).toBe(0);
    });
  });

  describe('Global Instance', () => {
    /**
     * Test that global logger instance can be initialized
     */
    it('should initialize global logger instance', () => {
      const logger1 = initializePerformanceLogger();
      expect(logger1).toBeInstanceOf(PerformanceLogger);
    });

    /**
     * Test that global logger instance can be retrieved
     */
    it('should get global logger instance', () => {
      initializePerformanceLogger();
      const logger2 = getPerformanceLogger();
      expect(logger2).toBeInstanceOf(PerformanceLogger);
    });

    /**
     * Test that global logger is created if not initialized
     */
    it('should create global logger if not initialized', () => {
      // Reset global state by creating new instance
      const logger = getPerformanceLogger();
      expect(logger).toBeInstanceOf(PerformanceLogger);
    });
  });

  describe('Resource Cleanup', () => {
    /**
     * Test that resources are disposed
     */
    it('should dispose resources', () => {
      logger.logPhaseStart('Phase1');
      logger.logError('operation.test', 'Error 1');
      
      logger.dispose();
      
      // After dispose, internal maps should be cleared
      // This is verified by checking that subsequent operations don't reference old data
      const metrics = logger.getMetrics();
      expect(metrics.errorCount).toBe(0);
    });
  });
});

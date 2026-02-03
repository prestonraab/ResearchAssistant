import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PerformanceLogger, initializePerformanceLogger, getPerformanceLogger } from '../performanceLogger';
import { getLogger } from '../loggingService';

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
  let mockLogger: any;

  beforeEach(() => {
    // Create fresh logger instance for each test
    logger = new PerformanceLogger();
    
    // Mock the logging service - get the actual logger and spy on its methods
    mockLogger = getLogger();
    jest.clearAllMocks();
    
    // Spy on logger methods to track calls
    jest.spyOn(mockLogger, 'info').mockReturnValue(undefined);
    jest.spyOn(mockLogger, 'warn').mockReturnValue(undefined);
    jest.spyOn(mockLogger, 'debug').mockReturnValue(undefined);
    jest.spyOn(mockLogger, 'error').mockReturnValue(undefined);
  });

  afterEach(() => {
    logger.dispose();
    jest.clearAllMocks();
  });

  describe('Activation Logging', () => {
    /**
     * Test that activation start is logged
     * **Validates: Requirements US-1 (Fast Activation)**
     */
    it('should log activation start', () => {
      logger.logActivationStart();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[Performance] Extension activation started')
      );
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
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/\[Performance\] Extension activation complete in \d+\.\d+ms/),
        expect.any(Object)
      );
    });

    /**
     * Test that slow activation is logged as warning
     * **Validates: Requirements NFR-1 (Performance Targets)**
     */
    it('should warn if activation exceeds 2 second threshold', async () => {
      logger.logActivationStart();
      
      // Simulate slow activation
      await new Promise(resolve => setTimeout(resolve, 2100));
      
      logger.logActivationComplete();
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/\[Performance\] Extension activation complete in \d+\.\d+ms \(target: < 2000ms\)/),
        expect.any(Object)
      );
    });

    /**
     * Test that activation without start time is handled gracefully
     */
    it('should handle activation complete without start time', () => {
      logger.logActivationComplete();
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Activation start time not recorded')
      );
    });
  });

  describe('Phase Logging', () => {
    /**
     * Test that phase start is logged
     */
    it('should log phase start', () => {
      logger.logPhaseStart('Phase1');
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[Performance] Phase1 initialization started')
      );
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
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/\[Performance\] Phase1 completed in \d+\.\d+ms/),
        undefined
      );
    });

    /**
     * Test that slow Phase1 is logged as warning
     * Phase1 target: < 500ms
     */
    it('should warn if Phase1 exceeds 500ms threshold', async () => {
      logger.logPhaseStart('Phase1');
      
      // Simulate slow Phase1
      await new Promise(resolve => setTimeout(resolve, 600));
      
      logger.logPhaseComplete('Phase1');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/\[Performance\] Phase1 completed in \d+\.\d+ms \(target: < 500ms\)/),
        undefined
      );
    });

    /**
     * Test that slow Phase2 is logged as warning
     * Phase2 target: < 2000ms
     */
    it('should warn if Phase2 exceeds 2000ms threshold', async () => {
      logger.logPhaseStart('Phase2');
      
      // Simulate slow Phase2
      await new Promise(resolve => setTimeout(resolve, 2100));
      
      logger.logPhaseComplete('Phase2');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/\[Performance\] Phase2 completed in \d+\.\d+ms \(target: < 2000ms\)/),
        undefined
      );
    });

    /**
     * Test that phase completion without start time is handled
     */
    it('should handle phase complete without start time', () => {
      logger.logPhaseComplete('Phase1');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No start time recorded for Phase1')
      );
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
      
      // Both phases should be logged
      expect(mockLogger.info).toHaveBeenCalledTimes(2);
    });
  });

  describe('Memory Logging', () => {
    /**
     * Test that high memory usage is logged as warning
     * **Validates: Requirements US-2 (Memory monitoring)**
     */
    it('should warn on high memory usage', () => {
      // Mock high memory usage
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 400 * 1024 * 1024,
        heapTotal: 350 * 1024 * 1024,
        heapUsed: 320 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        arrayBuffers: 0
      });
      
      logger.logMemoryUsage();
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[Memory]')
      );
    });
  });

  describe('Cache Statistics Logging', () => {
    /**
     * Test that cache statistics are logged
     * **Validates: Requirements FR-2 (Optimized Caching Strategy)**
     */
    it('should log cache statistics', () => {
      logger.logCacheStats('embeddings', {
        size: 50,
        maxSize: 100,
        hitRate: 0.85,
        missRate: 0.15
      });
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[Cache]')
      );
    });

    /**
     * Test that cache statistics without hit rate are logged
     */
    it('should log cache statistics without hit rate', () => {
      logger.logCacheStats('claims', {
        size: 75,
        maxSize: 200
      });
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[Cache]')
      );
    });

    /**
     * Test that full cache is logged as warning
     */
    it('should warn when cache is > 90% full', () => {
      logger.logCacheStats('embeddings', {
        size: 95,
        maxSize: 100
      });
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[Cache]')
      );
    });
  });

  describe('Operation Performance Logging', () => {
    /**
     * Test that operation performance is logged
     * **Validates: Requirements US-3 (Responsive UI)**
     */
    it('should log operation performance', () => {
      logger.logOperationPerformance('search.query', 45.5);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[Perf]')
      );
    });

    /**
     * Test that slow operations are logged as warning
     */
    it('should warn when operation exceeds threshold', () => {
      logger.logOperationPerformance('outline.parse', 250, 100);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[Perf]')
      );
    });

    /**
     * Test that fast operations are logged as debug
     */
    it('should debug log fast operations', () => {
      logger.logOperationPerformance('outline.parse', 50, 100);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[Perf]')
      );
    });
  });

  describe('Error Logging', () => {
    /**
     * Test that errors are logged
     * **Validates: Requirements US-5 (Graceful Error Handling)**
     */
    it('should log error with message', () => {
      const error = new Error('Test error');
      logger.logError('operation.test', error);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('[Error]')
      );
    });

    /**
     * Test that string errors are logged
     */
    it('should log error with string message', () => {
      logger.logError('operation.test', 'String error message');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('[Error]')
      );
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
     * Test that error rate is logged
     */
    it('should log error rate', () => {
      logger.logError('operation.test', 'Error 1');
      logger.logErrorRate('operation.test', 10);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[ErrorRate]')
      );
    });

    /**
     * Test that high error rate is logged as warning
     */
    it('should warn on high error rate', () => {
      for (let i = 0; i < 5; i++) {
        logger.logError('operation.test', `Error ${i}`);
      }
      logger.logErrorRate('operation.test', 10);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[ErrorRate]')
      );
    });

    /**
     * Test that zero error rate is logged as debug
     */
    it('should debug log zero error rate', () => {
      logger.logErrorRate('operation.test', 10);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[ErrorRate]')
      );
    });
  });

  describe('Performance Summary', () => {
    /**
     * Test that performance summary is logged
     */
    it('should log performance summary', () => {
      logger.logPerformanceSummary();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[Performance Summary]'),
        expect.objectContaining({
          sessionDurationMin: expect.any(String),
          currentMemoryMB: expect.any(Number),
          peakMemoryMB: expect.any(Number),
          operationCount: expect.any(Number),
          errorCount: expect.any(Number),
          totalErrors: expect.any(Number)
        })
      );
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

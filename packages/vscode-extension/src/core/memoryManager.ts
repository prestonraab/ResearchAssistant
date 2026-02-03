import * as vscode from 'vscode';
import { ExtensionState } from './state';
import { getLogger } from './loggingService';

/**
 * MemoryManager - Monitors memory usage and triggers cache trimming
 * 
 * Implements automatic memory management with threshold-based cache trimming:
 * - WARNING (200MB): Trim 25% of cache
 * - CRITICAL (300MB): Trim 50% of cache
 * - EMERGENCY (400MB): Clear all caches
 * 
 * Validates: Requirements US-2 (Low Memory Footprint)
 */
export class MemoryManager {
  private readonly THRESHOLDS = {
    WARNING: 200 * 1024 * 1024,      // 200MB
    CRITICAL: 300 * 1024 * 1024,     // 300MB
    EMERGENCY: 400 * 1024 * 1024     // 400MB
  };

  private monitorInterval?: NodeJS.Timeout;
  private lastTrimTime = 0;
  private readonly TRIM_COOLDOWN = 30000; // 30 seconds between trims

  /**
   * Start monitoring memory usage
   * Checks every 30 seconds and trims caches based on thresholds
   */
  startMonitoring(state: ExtensionState): void {
    const logger = getLogger();
    
    if (this.monitorInterval) {
      logger.warn('Memory monitoring already started');
      return;
    }

    logger.info('Starting memory monitoring');

    this.monitorInterval = setInterval(() => {
      this.checkMemory(state);
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop monitoring memory usage
   */
  stopMonitoring(): void {
    const logger = getLogger();
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
      logger.info('Memory monitoring stopped');
    }
  }

  /**
   * Check current memory usage and take action if needed
   */
  private checkMemory(state: ExtensionState): void {
    const logger = getLogger();
    const usage = process.memoryUsage().heapUsed;
    const usageMB = Math.round(usage / 1024 / 1024);

    // Log memory usage
    logger.debug(`Memory usage: ${usageMB}MB`);

    // Check if we should trim (cooldown to avoid excessive trimming)
    const now = Date.now();
    if (now - this.lastTrimTime < this.TRIM_COOLDOWN) {
      return;
    }

    if (usage > this.THRESHOLDS.EMERGENCY) {
      this.handleEmergency(state, usageMB);
      this.lastTrimTime = now;
    } else if (usage > this.THRESHOLDS.CRITICAL) {
      this.handleCritical(state, usageMB);
      this.lastTrimTime = now;
    } else if (usage > this.THRESHOLDS.WARNING) {
      this.handleWarning(state, usageMB);
      this.lastTrimTime = now;
    }
  }

  /**
   * Handle warning level memory usage (200-300MB)
   * Trim 25% of cache
   */
  private handleWarning(state: ExtensionState, usageMB: number): void {
    const logger = getLogger();
    logger.warn(`Memory warning: ${usageMB}MB - Trimming caches lightly`);

    // Trim embedding cache to 75% of current size
    if (state.embeddingService) {
      state.embeddingService.trimCache(75);
    }
  }

  /**
   * Handle critical level memory usage (300-400MB)
   * Trim 50% of cache
   */
  private handleCritical(state: ExtensionState, usageMB: number): void {
    const logger = getLogger();
    logger.error(`Memory critical: ${usageMB}MB - Aggressive cache trimming`);

    // Trim embedding cache to 50% of current size
    if (state.embeddingService) {
      state.embeddingService.trimCache(50);
    }

    // Force garbage collection if available
    if (global.gc) {
      logger.debug('Forcing garbage collection');
      global.gc();
    }
  }

  /**
   * Handle emergency level memory usage (> 400MB)
   * Clear all caches
   */
  private handleEmergency(state: ExtensionState, usageMB: number): void {
    const logger = getLogger();
    logger.error(`Memory emergency: ${usageMB}MB - Clearing all caches`);

    // Clear all caches
    if (state.embeddingService) {
      state.embeddingService.clearCache();
    }

    // Force garbage collection
    if (global.gc) {
      logger.debug('Forcing garbage collection');
      global.gc();
    }

    // Show warning to user
    vscode.window.showWarningMessage(
      'Research Assistant: High memory usage detected. Caches cleared to free memory.'
    );
  }

  /**
   * Get current memory usage in MB
   */
  getMemoryUsageMB(): number {
    const usage = process.memoryUsage().heapUsed;
    return Math.round(usage / 1024 / 1024);
  }

  /**
   * Get memory usage as percentage of threshold
   */
  getMemoryUsagePercent(): number {
    const usage = process.memoryUsage().heapUsed;
    return Math.round((usage / this.THRESHOLDS.CRITICAL) * 100);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stopMonitoring();
  }
}

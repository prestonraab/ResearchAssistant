import { ExtensionState } from '../core/state';

export function startMemoryMonitoring(state: ExtensionState, logger: any): NodeJS.Timeout {
  const memoryMonitorInterval = setInterval(() => {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);

    const embeddingCacheSize = state.embeddingService.getCacheSize();

    if (heapUsedMB > heapTotalMB * 0.5) {
      logger.info(`Memory: ${heapUsedMB}/${heapTotalMB} MB | Embeddings: ${embeddingCacheSize}/${state.embeddingService['maxCacheSize']}`);
    }

    if (heapUsedMB > heapTotalMB * 0.7) {
      logger.warn(`High memory usage (${heapUsedMB}MB), triggering cleanup...`);

      state.embeddingService.trimCache(50);

      if (global.gc) {
        global.gc();
        logger.info('Garbage collection triggered');
      }

      const newUsage = process.memoryUsage();
      const newHeapUsedMB = Math.round(newUsage.heapUsed / 1024 / 1024);
      logger.info(`Memory after cleanup: ${newHeapUsedMB} MB (freed ${heapUsedMB - newHeapUsedMB} MB)`);
    }
  }, 60000);

  return memoryMonitorInterval;
}

export function stopMemoryMonitoring(interval: NodeJS.Timeout): void {
  if (interval) {
    clearInterval(interval);
  }
}

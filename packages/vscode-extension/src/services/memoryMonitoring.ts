import { ExtensionState } from '../core/state';
import * as os from 'os';
import { getOperationTracker } from './operationTracker';

interface Logger {
  info(message: string): void;
  warn(message: string): void;
}

/**
 * Get CPU usage percentage
 */
function getCPUUsage(): number {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  });

  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usage = 100 - ~~(100 * idle / total);
  return usage;
}

/**
 * Get active handles and requests (rough indicator of running operations)
 */
function getActiveOperations(): { handles: number; requests: number } {
  const handles = (process as any)._getActiveHandles?.()?.length || 0;
  const requests = (process as any)._getActiveRequests?.()?.length || 0;
  return { handles, requests };
}

export function startMemoryMonitoring(state: ExtensionState, logger: Logger): NodeJS.Timeout {
  let lastCPUUsage = getCPUUsage();
  const tracker = getOperationTracker();
  
  const memoryMonitorInterval = setInterval(() => {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const externalMB = Math.round(usage.external / 1024 / 1024);

    const embeddingCacheSize = state.embeddingService.getCacheSize();
    const cpuUsage = getCPUUsage();
    const activeOps = getActiveOperations();
    const activeSummary = tracker.getActiveSummary();

    if (heapUsedMB > heapTotalMB * 0.5) {
      logger.info(
        `Memory: ${heapUsedMB}/${heapTotalMB} MB (external: ${externalMB}MB) | ` +
        `CPU: ${cpuUsage}% | ` +
        `Active: ${activeOps.handles} handles, ${activeOps.requests} requests | ` +
        `Running: ${activeSummary} | ` +
        `Embeddings: ${embeddingCacheSize}/${state.embeddingService['maxCacheSize']}`
      );
    }

    if (heapUsedMB > heapTotalMB * 0.7) {
      logger.warn(
        `High memory usage (${heapUsedMB}MB), CPU: ${cpuUsage}%, ` +
        `Active ops: ${activeOps.handles} handles, ${activeOps.requests} requests, ` +
        `Running: ${activeSummary} - triggering cleanup...`
      );

      state.embeddingService.trimCache(50);

      if (global.gc) {
        global.gc();
        logger.info('Garbage collection triggered');
      }

      const newUsage = process.memoryUsage();
      const newHeapUsedMB = Math.round(newUsage.heapUsed / 1024 / 1024);
      const newActiveOps = getActiveOperations();
      logger.info(
        `Memory after cleanup: ${newHeapUsedMB} MB (freed ${heapUsedMB - newHeapUsedMB} MB) | ` +
        `Active ops after cleanup: ${newActiveOps.handles} handles, ${newActiveOps.requests} requests | ` +
        `Still running: ${tracker.getActiveSummary()}`
      );
    }
  }, 60000);

  return memoryMonitorInterval;
}

export function stopMemoryMonitoring(interval: NodeJS.Timeout): void {
  if (interval) {
    clearInterval(interval);
  }
}

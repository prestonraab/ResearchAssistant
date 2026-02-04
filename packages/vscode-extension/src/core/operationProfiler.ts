/**
 * OperationProfiler - Lightweight profiler for tracking operation timings
 * 
 * Provides detailed timing breakdowns for complex operations to identify bottlenecks.
 * Results are logged to the output channel and can be retrieved programmatically.
 */

import { getLogger } from './loggingService';

export interface ProfileEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  children: ProfileEntry[];
  metadata?: Record<string, any>;
}

export interface ProfileSummary {
  totalDuration: number;
  operations: Array<{
    name: string;
    duration: number;
    percentage: number;
    count: number;
    avgDuration: number;
  }>;
}

/**
 * Profiler for tracking nested operation timings
 */
export class OperationProfiler {
  private logger = getLogger();
  private rootEntry: ProfileEntry | null = null;
  private stack: ProfileEntry[] = [];
  private operationCounts: Map<string, { totalTime: number; count: number }> = new Map();
  private enabled: boolean = true;

  constructor(private name: string) {}

  /**
   * Enable or disable profiling
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Start profiling a new operation
   */
  start(operationName: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    const entry: ProfileEntry = {
      name: operationName,
      startTime: performance.now(),
      children: [],
      metadata
    };

    if (this.stack.length === 0) {
      this.rootEntry = entry;
    } else {
      const parent = this.stack[this.stack.length - 1];
      parent.children.push(entry);
    }

    this.stack.push(entry);
  }

  /**
   * End the current operation
   */
  end(metadata?: Record<string, any>): void {
    if (!this.enabled || this.stack.length === 0) return;

    const entry = this.stack.pop()!;
    entry.endTime = performance.now();
    entry.duration = entry.endTime - entry.startTime;
    
    if (metadata) {
      entry.metadata = { ...entry.metadata, ...metadata };
    }

    // Track aggregate stats
    const existing = this.operationCounts.get(entry.name) || { totalTime: 0, count: 0 };
    existing.totalTime += entry.duration;
    existing.count++;
    this.operationCounts.set(entry.name, existing);
  }

  /**
   * Time a synchronous operation
   */
  time<T>(operationName: string, fn: () => T, metadata?: Record<string, any>): T {
    if (!this.enabled) return fn();

    this.start(operationName, metadata);
    try {
      return fn();
    } finally {
      this.end();
    }
  }

  /**
   * Time an async operation
   */
  async timeAsync<T>(operationName: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    if (!this.enabled) return fn();

    this.start(operationName, metadata);
    try {
      return await fn();
    } finally {
      this.end();
    }
  }

  /**
   * Get summary of all operations
   */
  getSummary(): ProfileSummary {
    const totalDuration = this.rootEntry?.duration || 0;
    const operations: ProfileSummary['operations'] = [];

    for (const [name, stats] of this.operationCounts) {
      operations.push({
        name,
        duration: stats.totalTime,
        percentage: totalDuration > 0 ? (stats.totalTime / totalDuration) * 100 : 0,
        count: stats.count,
        avgDuration: stats.count > 0 ? stats.totalTime / stats.count : 0
      });
    }

    // Sort by total duration descending
    operations.sort((a, b) => b.duration - a.duration);

    return { totalDuration, operations };
  }

  /**
   * Log the profile results
   */
  logResults(): void {
    if (!this.enabled || !this.rootEntry) return;

    const summary = this.getSummary();
    
    this.logger.info(`[Profile: ${this.name}] Total: ${summary.totalDuration.toFixed(2)}ms`);
    this.logger.info(`[Profile: ${this.name}] Breakdown:`);
    
    for (const op of summary.operations.slice(0, 10)) { // Top 10 operations
      const bar = '█'.repeat(Math.round(op.percentage / 5)); // Visual bar
      this.logger.info(
        `  ${op.name}: ${op.duration.toFixed(2)}ms (${op.percentage.toFixed(1)}%) ` +
        `[${op.count}x, avg ${op.avgDuration.toFixed(2)}ms] ${bar}`
      );
    }
  }

  /**
   * Reset the profiler
   */
  reset(): void {
    this.rootEntry = null;
    this.stack = [];
    this.operationCounts.clear();
  }

  /**
   * Get the root entry for detailed analysis
   */
  getRootEntry(): ProfileEntry | null {
    return this.rootEntry;
  }
}

// Global profiler instances for different subsystems
const profilers: Map<string, OperationProfiler> = new Map();

/**
 * Get or create a profiler for a subsystem
 */
export function getProfiler(name: string): OperationProfiler {
  let profiler = profilers.get(name);
  if (!profiler) {
    profiler = new OperationProfiler(name);
    profilers.set(name, profiler);
  }
  return profiler;
}

/**
 * Log all profiler results
 */
export function logAllProfiles(): void {
  for (const profiler of profilers.values()) {
    profiler.logResults();
  }
}

/**
 * Reset all profilers
 */
export function resetAllProfiles(): void {
  for (const profiler of profilers.values()) {
    profiler.reset();
  }
}

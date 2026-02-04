/**
 * Tracks active operations by component to identify what's running
 */
export class OperationTracker {
  private activeOperations: Map<string, Set<string>> = new Map();
  private operationStartTimes: Map<string, number> = new Map();

  /**
   * Start tracking an operation
   */
  startOperation(component: string, operationId: string, description: string = ''): void {
    if (!this.activeOperations.has(component)) {
      this.activeOperations.set(component, new Set());
    }
    
    const opKey = `${component}:${operationId}`;
    this.activeOperations.get(component)!.add(operationId);
    this.operationStartTimes.set(opKey, Date.now());
    
    console.log(`[OperationTracker] START: ${component}.${operationId}${description ? ` (${description})` : ''}`);
  }

  /**
   * End tracking an operation
   */
  endOperation(component: string, operationId: string): void {
    const opKey = `${component}:${operationId}`;
    const startTime = this.operationStartTimes.get(opKey);
    const duration = startTime ? Date.now() - startTime : 0;
    
    this.activeOperations.get(component)?.delete(operationId);
    this.operationStartTimes.delete(opKey);
    
    if (this.activeOperations.get(component)?.size === 0) {
      this.activeOperations.delete(component);
    }
    
    console.log(`[OperationTracker] END: ${component}.${operationId} (${duration}ms)`);
  }

  /**
   * Get a summary of active operations by component
   */
  getActiveSummary(): string {
    if (this.activeOperations.size === 0) {
      return 'No active operations';
    }

    const summary: string[] = [];
    
    for (const [component, operations] of this.activeOperations.entries()) {
      const opList = Array.from(operations).join(', ');
      summary.push(`${component}: ${operations.size} (${opList})`);
    }

    return summary.join(' | ');
  }

  /**
   * Get detailed active operations with durations
   */
  getActiveDetails(): Array<{ component: string; operation: string; duration: number }> {
    const details: Array<{ component: string; operation: string; duration: number }> = [];
    const now = Date.now();

    for (const [component, operations] of this.activeOperations.entries()) {
      for (const operation of operations) {
        const opKey = `${component}:${operation}`;
        const startTime = this.operationStartTimes.get(opKey);
        if (startTime) {
          details.push({
            component,
            operation,
            duration: now - startTime
          });
        }
      }
    }

    return details.sort((a, b) => b.duration - a.duration);
  }

  /**
   * Clear all tracked operations
   */
  clear(): void {
    this.activeOperations.clear();
    this.operationStartTimes.clear();
  }
}

// Global singleton instance
let globalTracker: OperationTracker | null = null;

export function getOperationTracker(): OperationTracker {
  if (!globalTracker) {
    globalTracker = new OperationTracker();
  }
  return globalTracker;
}

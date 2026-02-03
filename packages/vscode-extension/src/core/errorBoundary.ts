import { getLogger } from './loggingService';

/**
 * ErrorBoundary - Utility for wrapping async operations with error handling
 * 
 * Provides:
 * - Timeout handling
 * - Retry logic with exponential backoff
 * - Fallback values
 * - Error logging and reporting
 * 
 * Validates: Requirements US-5 (Graceful Error Handling)
 */
export class ErrorBoundary {
  /**
   * Wrap an async operation with error handling
   * 
   * @param operation - The async operation to wrap
   * @param options - Configuration options
   * @returns Result of operation or fallback value
   */
  static async wrap<T>(
    operation: () => Promise<T>,
    options: {
      fallback?: T;
      timeout?: number;
      retries?: number;
      onError?: (error: Error) => void;
      operationName?: string;
    } = {}
  ): Promise<T> {
    const logger = getLogger();
    const {
      fallback,
      timeout = 5000,
      retries = 0,
      onError,
      operationName = 'Operation'
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Add timeout
        const result = await Promise.race([
          operation(),
          this.timeout(timeout)
        ]);

        if (attempt > 0) {
          logger.debug(`${operationName} succeeded on attempt ${attempt + 1}`);
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < retries) {
          // Exponential backoff: 1s, 2s, 4s, 8s, etc.
          const backoffMs = Math.pow(2, attempt) * 1000;
          logger.debug(`${operationName} failed on attempt ${attempt + 1}, retrying in ${backoffMs}ms`);
          await this.delay(backoffMs);
          continue;
        }

        // Final attempt failed
        logger.error(`${operationName} failed after ${attempt + 1} attempt(s):`, lastError);

        if (onError) {
          onError(lastError);
        }

        if (fallback !== undefined) {
          logger.debug(`${operationName} using fallback value`);
          return fallback;
        }

        throw lastError;
      }
    }

    throw lastError!;
  }

  /**
   * Create a timeout promise that rejects after specified milliseconds
   */
  private static timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
    });
  }

  /**
   * Create a delay promise
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wrap a sync operation with error handling
   */
  static wrapSync<T>(
    operation: () => T,
    options: {
      fallback?: T;
      onError?: (error: Error) => void;
      operationName?: string;
    } = {}
  ): T {
    const logger = getLogger();
    const {
      fallback,
      onError,
      operationName = 'Operation'
    } = options;

    try {
      return operation();
    } catch (error) {
      const err = error as Error;
      logger.error(`${operationName} failed:`, err);

      if (onError) {
        onError(err);
      }

      if (fallback !== undefined) {
        logger.debug(`${operationName} using fallback value`);
        return fallback;
      }

      throw err;
    }
  }
}

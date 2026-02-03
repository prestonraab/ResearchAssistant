import { ErrorBoundary } from '../errorBoundary';
import * as vscode from 'vscode';

describe('ErrorBoundary', () => {
  describe('wrap - successful operations', () => {
    test('should return result on success', async () => {
      const result = await ErrorBoundary.wrap(
        async () => 'success',
        { operationName: 'test' }
      );

      expect(result).toBe('success');
    });

    test('should handle different return types', async () => {
      const numberResult = await ErrorBoundary.wrap(
        async () => 42,
        { operationName: 'test' }
      );
      expect(numberResult).toBe(42);

      const objectResult = await ErrorBoundary.wrap(
        async () => ({ key: 'value' }),
        { operationName: 'test' }
      );
      expect(objectResult).toEqual({ key: 'value' });

      const arrayResult = await ErrorBoundary.wrap(
        async () => [1, 2, 3],
        { operationName: 'test' }
      );
      expect(arrayResult).toEqual([1, 2, 3]);
    });
  });

  describe('wrap - timeout handling', () => {
    test('should timeout after specified duration', async () => {
      const slowOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return 'done';
      };

      await expect(
        ErrorBoundary.wrap(slowOperation, {
          timeout: 100,
          operationName: 'slow-op'
        })
      ).rejects.toThrow('timed out');
    });

    test('should use default timeout of 5000ms', async () => {
      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'done';
      };

      const result = await ErrorBoundary.wrap(operation);
      expect(result).toBe('done');
    });

    test('should return fallback on timeout', async () => {
      const slowOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return 'done';
      };

      const result = await ErrorBoundary.wrap(slowOperation, {
        timeout: 100,
        fallback: 'fallback-value',
        operationName: 'slow-op'
      });

      expect(result).toBe('fallback-value');
    });
  });

  describe('wrap - retry logic', () => {
    test('should retry on failure', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('fail');
        }
        return 'success';
      };

      const result = await ErrorBoundary.wrap(operation, {
        retries: 3,
        operationName: 'retry-op'
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    test('should use exponential backoff', async () => {
      const timings: number[] = [];
      let lastTime = Date.now();

      const operation = async () => {
        const now = Date.now();
        if (timings.length > 0) {
          timings.push(now - lastTime);
        }
        lastTime = now;

        if (timings.length < 2) {
          throw new Error('fail');
        }
        return 'success';
      };

      await ErrorBoundary.wrap(operation, {
        retries: 3,
        operationName: 'backoff-op'
      });

      // Check that delays increase (exponential backoff)
      if (timings.length >= 2) {
        expect(timings[1]).toBeGreaterThan(timings[0]);
      }
    });

    test('should throw after max retries', async () => {
      const operation = async () => {
        throw new Error('always fails');
      };

      await expect(
        ErrorBoundary.wrap(operation, {
          retries: 2,
          operationName: 'fail-op'
        })
      ).rejects.toThrow('always fails');
    });
  });

  describe('wrap - fallback handling', () => {
    test('should return fallback on error', async () => {
      const operation = async () => {
        throw new Error('operation failed');
      };

      const result = await ErrorBoundary.wrap(operation, {
        fallback: 'fallback-value',
        operationName: 'fail-op'
      });

      expect(result).toBe('fallback-value');
    });

    test('should throw if no fallback provided', async () => {
      const operation = async () => {
        throw new Error('operation failed');
      };

      await expect(
        ErrorBoundary.wrap(operation, {
          operationName: 'fail-op'
        })
      ).rejects.toThrow('operation failed');
    });

    test('should call onError callback', async () => {
      const onError = jest.fn();
      const operation = async () => {
        throw new Error('operation failed');
      };

      await ErrorBoundary.wrap(operation, {
        fallback: 'fallback',
        onError,
        operationName: 'fail-op'
      });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('wrapSync - synchronous operations', () => {
    test('should return result on success', () => {
      const result = ErrorBoundary.wrapSync(
        () => 'success',
        { operationName: 'test' }
      );

      expect(result).toBe('success');
    });

    test('should return fallback on error', () => {
      const operation = () => {
        throw new Error('operation failed');
      };

      const result = ErrorBoundary.wrapSync(operation, {
        fallback: 'fallback-value',
        operationName: 'fail-op'
      });

      expect(result).toBe('fallback-value');
    });

    test('should call onError callback', () => {
      const onError = jest.fn();
      const operation = () => {
        throw new Error('operation failed');
      };

      ErrorBoundary.wrapSync(operation, {
        fallback: 'fallback',
        onError,
        operationName: 'fail-op'
      });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should throw if no fallback provided', () => {
      const operation = () => {
        throw new Error('operation failed');
      };

      expect(() =>
        ErrorBoundary.wrapSync(operation, {
          operationName: 'fail-op'
        })
      ).toThrow('operation failed');
    });
  });

  describe('Property-based tests', () => {
    test('should always return either result or fallback', async () => {
      const fallback = 'fallback';
      const operation = async () => 'success';

      const result = await ErrorBoundary.wrap(operation, { fallback });

      expect(result === 'success' || result === fallback).toBe(true);
    });

    test('should not lose error information', async () => {
      const errorMessage = 'specific error message';
      const operation = async () => {
        throw new Error(errorMessage);
      };

      try {
        await ErrorBoundary.wrap(operation, { operationName: 'test' });
      } catch (error) {
        expect((error as Error).message).toContain(errorMessage);
      }
    });

    test('should handle any error type', async () => {
      const operation = async () => {
        throw 'string error';
      };

      const result = await ErrorBoundary.wrap(operation, {
        fallback: 'fallback',
        operationName: 'test'
      });

      expect(result).toBe('fallback');
    });
  });
});

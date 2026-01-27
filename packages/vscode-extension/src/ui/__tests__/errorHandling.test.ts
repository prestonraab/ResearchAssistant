import {
  withErrorBoundary,
  withRetry,
  withTimeout,
  validateInput,
  safeJsonParse,
  getUserFriendlyErrorMessage,
  assert,
  debounce,
  throttle
} from '../errorHandling';

describe('Error Handling Utilities', () => {
  describe('withErrorBoundary', () => {
    test('should execute successful operation', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await withErrorBoundary(
        operation,
        { operation: 'test', component: 'test' },
        false
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    test('should catch and handle errors', async () => {
      const error = new Error('Test error');
      const operation = jest.fn().mockRejectedValue(error);

      const result = await withErrorBoundary(
        operation,
        { operation: 'test', component: 'test' },
        false
      );

      expect(result).toBeNull();
      expect(operation).toHaveBeenCalled();
    });

    test('should return null on error', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));

      const result = await withErrorBoundary(
        operation,
        { operation: 'test', component: 'test' },
        false
      );

      expect(result).toBeNull();
    });
  });

  describe('withRetry', () => {
    test('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await withRetry(operation, { maxRetries: 3 });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should retry on failure', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success');

      const result = await withRetry(operation, { maxRetries: 3, delayMs: 10 });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test('should throw after max retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(
        withRetry(operation, { maxRetries: 2, delayMs: 10 })
      ).rejects.toThrow('Always fails');

      expect(operation).toHaveBeenCalledTimes(2);
    });

    test('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce('success');

      await withRetry(operation, { maxRetries: 2, delayMs: 10, onRetry });

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    test.skip('should use exponential backoff', async () => {
      jest.useFakeTimers();
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce('success');

      const promise = withRetry(operation, {
        maxRetries: 2,
        delayMs: 100,
        backoffMultiplier: 2
      });

      jest.advanceTimersByTime(100);
      jest.runAllTimers();
      const result = await promise;

      jest.useRealTimers();
      expect(operation).toHaveBeenCalledTimes(2);
      expect(result).toBe('success');
    }, 15000);
  });

  describe('withTimeout', () => {
    test('should complete before timeout', async () => {
      jest.useFakeTimers();
      const operation = jest.fn().mockResolvedValue('success');

      const promise = withTimeout(operation, 1000);
      jest.advanceTimersByTime(500);
      const result = await promise;

      jest.useRealTimers();
      expect(result).toBe('success');
    });

    test('should throw on timeout', async () => {
      jest.useFakeTimers();
      const operation = jest.fn(() => new Promise(() => {})); // Never resolves

      const promise = withTimeout(operation, 100, 'Timeout');
      jest.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow('Timeout');
      jest.useRealTimers();
    });
  });

  describe('validateInput', () => {
    test('should pass valid input', () => {
      expect(() => {
        validateInput(5, (v) => v > 0, 'Must be positive');
      }).not.toThrow();
    });

    test('should throw on invalid input', () => {
      expect(() => {
        validateInput(-5, (v) => v > 0, 'Must be positive');
      }).toThrow('Must be positive');
    });
  });

  describe('safeJsonParse', () => {
    test('should parse valid JSON', () => {
      const result = safeJsonParse('{"key": "value"}', {});
      expect(result).toEqual({ key: 'value' });
    });

    test('should return default on invalid JSON', () => {
      const defaultValue = { default: true };
      const result = safeJsonParse('invalid json', defaultValue);
      expect(result).toEqual(defaultValue);
    });

    test('should handle empty string', () => {
      const result = safeJsonParse('', {});
      expect(result).toEqual({});
    });
  });

  describe('getUserFriendlyErrorMessage', () => {
    test('should map ENOENT to "File not found"', () => {
      const message = getUserFriendlyErrorMessage('ENOENT: no such file');
      expect(message).toBe('File not found');
    });

    test('should map EACCES to "Permission denied"', () => {
      const message = getUserFriendlyErrorMessage('EACCES: permission denied');
      expect(message).toBe('Permission denied');
    });

    test('should return original message if no mapping', () => {
      const message = getUserFriendlyErrorMessage('Custom error message');
      expect(message).toBe('Custom error message');
    });

    test('should handle Error objects', () => {
      const error = new Error('ETIMEDOUT: connection timed out');
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toBe('Operation timed out');
    });
  });

  describe('assert', () => {
    test('should pass when condition is true', () => {
      expect(() => {
        assert(true, 'Should not throw');
      }).not.toThrow();
    });

    test('should throw when condition is false', () => {
      expect(() => {
        assert(false, 'Assertion failed');
      }).toThrow('Assertion failed');
    });
  });

  describe('debounce', () => {
    test('should debounce function calls', async () => {
      jest.useFakeTimers();
      const func = jest.fn();
      const debounced = debounce(func, 100);

      debounced();
      debounced();
      debounced();

      expect(func).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    test('should reset timer on new call', async () => {
      jest.useFakeTimers();
      const func = jest.fn();
      const debounced = debounce(func, 100);

      debounced();
      jest.advanceTimersByTime(50);
      debounced();
      jest.advanceTimersByTime(50);

      expect(func).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });

  describe('throttle', () => {
    test('should throttle function calls', async () => {
      jest.useFakeTimers();
      const func = jest.fn();
      const throttled = throttle(func, 100);

      throttled();
      expect(func).toHaveBeenCalledTimes(1);

      throttled();
      throttled();
      expect(func).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    test('should call function at most once per interval', async () => {
      jest.useFakeTimers();
      const func = jest.fn();
      const throttled = throttle(func, 100);

      for (let i = 0; i < 10; i++) {
        throttled();
        jest.advanceTimersByTime(50);
      }

      expect(func).toHaveBeenCalledTimes(6);

      jest.useRealTimers();
    });
  });
});

import { jest } from '@jest/globals';

/**
 * Common test setup utilities
 * Use these to ensure consistent test behavior
 */

/**
 * Standard setup for all tests
 * Clears mock call history before each test
 * Restores original implementations after each test
 */
export const setupTest = () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
};

/**
 * Setup for tests that need to wait for async operations
 */
export const waitForAsync = (ms: number = 10) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Helper to suppress console output during tests
 */
export const suppressConsole = () => {
  let originalConsole: any;

  beforeAll(() => {
    originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info
    };
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    console.info = jest.fn();
  });

  afterAll(() => {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.info = originalConsole.info;
  });
};

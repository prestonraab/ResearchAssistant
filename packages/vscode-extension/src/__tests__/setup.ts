/**
 * Jest setup file for global test configuration
 * This runs after jest.setup.ts for each test file
 */
import { jest } from '@jest/globals';

// Increase timeout for integration tests
jest.setTimeout(10000);

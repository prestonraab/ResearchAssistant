// This file must be loaded before any tests to mock vscode
import { jest } from '@jest/globals';

// Mock loggingService before any imports
jest.mock('../core/loggingService', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    dispose: jest.fn(),
  };
  
  return {
    LoggingService: jest.fn(() => mockLogger),
    getLogger: jest.fn(() => mockLogger),
    initializeLogger: jest.fn(() => mockLogger),
    LogLevel: {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    }
  };
});

// Mock vscode - Jest will automatically use __mocks__/vscode.ts
jest.mock('vscode');

// Set timeout for all tests
jest.setTimeout(10000);

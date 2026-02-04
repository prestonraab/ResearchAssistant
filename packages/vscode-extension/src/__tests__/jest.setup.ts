// This file must be loaded before any tests to mock vscode
import { jest } from '@jest/globals';

// jest is already available globally from @jest/globals
// No need to redeclare it

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

// Mock OutlineParser
jest.mock('../core/outlineParserWrapper', () => ({
  OutlineParser: jest.fn().mockImplementation(() => ({
    parse: (jest.fn() as any).mockResolvedValue([]),
    updatePath: jest.fn(),
    onDidChange: { event: jest.fn() }
  }))
}));

// Mock ClaimsManager
jest.mock('../core/claimsManagerWrapper', () => ({
  ClaimsManager: jest.fn().mockImplementation(() => ({
    loadClaims: (jest.fn() as any).mockResolvedValue([]),
    updatePath: jest.fn(),
    requestReload: jest.fn()
  }))
}));

// Mock ReadingStatusManager
jest.mock('../core/readingStatusManager', () => ({
  ReadingStatusManager: jest.fn().mockImplementation(() => ({
    getStatistics: jest.fn().mockReturnValue({
      toRead: 0,
      reading: 0,
      read: 0,
      totalReadingTime: 0,
      averageReadingTime: 0
    })
  }))
}));

// Mock EmbeddingService from core package
jest.mock('@research-assistant/core', () => {
  const actual = jest.requireActual('@research-assistant/core') as any;
  return {
    ...actual,
    EmbeddingService: jest.fn().mockImplementation(() => ({
      initialize: (jest.fn() as any).mockResolvedValue(undefined),
      getEmbedding: (jest.fn() as any).mockResolvedValue([]),
      clearCache: jest.fn(),
      dispose: jest.fn()
    }))
  };
});

// Mock vscode - Jest will automatically use __mocks__/vscode.ts via moduleNameMapper
jest.mock('vscode');

// fs is mocked via moduleNameMapper in jest.config.js pointing to __mocks__/fs.ts

// Set timeout for all tests
jest.setTimeout(10000);

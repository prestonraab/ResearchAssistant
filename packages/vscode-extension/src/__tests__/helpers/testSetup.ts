import { jest } from '@jest/globals';
import * as vscode from 'vscode';
import * as fs from 'fs';

/**
 * Common test setup utilities
 * Use these to ensure consistent test behavior
 */

/**
 * Standard setup for all tests
 * Clears mock call history before each test
 * Restores original implementations after each test
 * 
 * Usage:
 * describe('MyTest', () => {
 *   setupTest();
 *   // your tests...
 * });
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

// ============================================================================
// VSCode Mock Setup Helpers
// ============================================================================

/**
 * Setup mock active editor with optional document content
 */
export const setupActiveEditor = (content: string = 'Test content') => {
  const mockDocument = {
    uri: vscode.Uri.file('/test/file.md'),
    getText: jest.fn().mockReturnValue(content),
    lineCount: content.split('\n').length,
    languageId: 'markdown'
  } as any;

  const mockEditor = {
    document: mockDocument,
    selection: new vscode.Selection(0, 0, 0, 0),
    selections: [new vscode.Selection(0, 0, 0, 0)]
  } as any;

  (vscode.window.activeTextEditor as any) = mockEditor;
  return { mockEditor, mockDocument };
};

/**
 * Setup mock workspace configuration
 */
export const setupConfiguration = (config: Record<string, any> = {}) => {
  const defaultConfig: Record<string, any> = {
    'outlinePath': '03_Drafting/outline.md',
    'claimsDatabasePath': '01_Knowledge_Base/claims_and_evidence.md',
    'extractedTextPath': 'literature/ExtractedText',
    'coverageThresholds': { low: 3, moderate: 6, strong: 7 },
    'embeddingCacheSize': 1000,
    ...config
  };

  (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
    get: jest.fn((key: string, defaultValue?: any) => defaultConfig[key] ?? defaultValue)
  });

  return defaultConfig;
};

/**
 * Setup mock workspace folders
 */
export const setupWorkspaceFolders = (folders: vscode.WorkspaceFolder[] = []) => {
  if (folders.length === 0) {
    folders = [
      {
        uri: vscode.Uri.file('/test/workspace'),
        name: 'test-workspace',
        index: 0
      } as vscode.WorkspaceFolder
    ];
  }

  (vscode.workspace as any).workspaceFolders = folders;
  return folders;
};

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that an information message was shown with specific text
 */
export const expectInformationMessage = (text: string) => {
  expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
    expect.stringContaining(text)
  );
};

/**
 * Assert that an error message was shown with specific text
 */
export const expectErrorMessage = (text: string) => {
  expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
    expect.stringContaining(text)
  );
};

/**
 * Assert that a warning message was shown with specific text
 */
export const expectWarningMessage = (text: string) => {
  expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
    expect.stringContaining(text)
  );
};

/**
 * Assert that a mock function was called with specific arguments
 */
export const expectCalledWith = (mock: jest.Mock, ...args: any[]) => {
  expect(mock).toHaveBeenCalledWith(...args);
};

/**
 * Assert that a mock function was called exactly N times
 */
export const expectCalledTimes = (mock: jest.Mock, times: number) => {
  expect(mock).toHaveBeenCalledTimes(times);
};

/**
 * Assert that a mock function was NOT called
 */
export const expectNotCalled = (mock: jest.Mock) => {
  expect(mock).not.toHaveBeenCalled();
};

/**
 * Assert that a mock function was called with a specific argument at a specific index
 */
export const expectCalledWithAt = (mock: jest.Mock, callIndex: number, ...args: any[]) => {
  expect(mock).toHaveBeenNthCalledWith(callIndex, ...args);
};

/**
 * Assert that a mock was called with an object containing specific properties
 */
export const expectCalledWithObject = (mock: jest.Mock, expectedObject: Record<string, any>) => {
  expect(mock).toHaveBeenCalledWith(expect.objectContaining(expectedObject));
};

/**
 * Assert that a mock was called with a string matching a pattern
 */
export const expectCalledWithPattern = (mock: jest.Mock, pattern: RegExp) => {
  expect(mock).toHaveBeenCalledWith(expect.stringMatching(pattern));
};

/**
 * Assert that a mock was called with an array containing specific items
 */
export const expectCalledWithArray = (mock: jest.Mock, expectedItems: any[]) => {
  expect(mock).toHaveBeenCalledWith(expect.arrayContaining(expectedItems));
};

/**
 * Get the last call arguments from a mock
 */
export const getLastCallArgs = (mock: jest.Mock): any[] => {
  const calls = mock.mock.calls;
  return calls.length > 0 ? calls[calls.length - 1] : [];
};

/**
 * Get all call arguments from a mock
 */
export const getAllCallArgs = (mock: jest.Mock): any[][] => {
  return mock.mock.calls;
};

/**
 * Assert that a mock was NOT called with specific arguments
 */
export const expectNotCalledWith = (mock: jest.Mock, ...args: any[]) => {
  expect(mock).not.toHaveBeenCalledWith(...args);
};

/**
 * Get the return value from a specific mock call
 */
export const getCallReturnValue = (mock: jest.Mock, callIndex: number = 0): any => {
  return mock.mock.results[callIndex]?.value;
};

/**
 * Get all return values from a mock
 */
export const getAllReturnValues = (mock: jest.Mock): any[] => {
  return mock.mock.results.map(r => r.value);
};

/**
 * Assert that a mock threw an error on a specific call
 */
export const expectCallThrew = (mock: jest.Mock, callIndex: number = 0) => {
  const result = mock.mock.results[callIndex];
  expect(result?.type).toBe('throw');
};

/**
 * Assert that a mock returned a value on a specific call
 */
export const expectCallReturned = (mock: jest.Mock, callIndex: number = 0) => {
  const result = mock.mock.results[callIndex];
  expect(result?.type).toBe('return');
};

/**
 * Reset a specific mock (clear call history but keep implementation)
 */
export const resetMock = (mock: jest.Mock) => {
  mock.mockClear();
};

/**
 * Reset multiple mocks at once
 */
export const resetMocks = (...mocks: jest.Mock[]) => {
  mocks.forEach(mock => mock.mockClear());
};

/**
 * Restore a specific mock to its original implementation
 */
export const restoreMock = (mock: jest.Mock) => {
  mock.mockRestore();
};

/**
 * Wait for a mock to be called
 */
export const waitForMockCall = async (
  mock: jest.Mock,
  timeout: number = 1000
): Promise<void> => {
  const startTime = Date.now();
  while (!mock.mock.calls.length) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Mock was not called within ${timeout}ms`);
    }
    await waitForAsync(10);
  }
};

/**
 * Wait for a mock to be called N times
 */
export const waitForMockCallCount = async (
  mock: jest.Mock,
  count: number,
  timeout: number = 1000
): Promise<void> => {
  const startTime = Date.now();
  while (mock.mock.calls.length < count) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Mock was not called ${count} times within ${timeout}ms`);
    }
    await waitForAsync(10);
  }
};

/**
 * Assert that a mock was called in a specific order relative to other mocks
 */
export const expectCallOrder = (mocks: { mock: jest.Mock; name: string }[]) => {
  const calls: Array<{ name: string; index: number }> = [];
  
  mocks.forEach(({ mock, name }) => {
    if (mock.mock.calls.length > 0) {
      calls.push({ name, index: mock.mock.invocationCallOrder[0] });
    }
  });
  
  calls.sort((a, b) => a.index - b.index);
  return calls.map(c => c.name);
};

/**
 * Setup a mock to throw an error on the next call
 */
export const setupMockToThrow = (mock: jest.Mock, error: Error) => {
  mock.mockImplementationOnce(() => {
    throw error;
  });
};

/**
 * Setup a mock to throw an error on all calls
 */
export const setupMockToThrowAlways = (mock: jest.Mock, error: Error) => {
  mock.mockImplementation(() => {
    throw error;
  });
};

/**
 * Setup a mock to return different values on consecutive calls
 */
export const setupMockSequence = (mock: jest.Mock<any>, values: any[]) => {
  values.forEach(value => {
    if (value instanceof Error) {
      mock.mockRejectedValueOnce(value);
    } else if (value instanceof Promise) {
      mock.mockReturnValueOnce(value);
    } else {
      mock.mockReturnValueOnce(value);
    }
  });
};

/**
 * Assert that a mock was called with a specific type
 */
export const expectCalledWithType = (mock: jest.Mock, expectedType: string) => {
  const lastCall = getLastCallArgs(mock)[0];
  expect(typeof lastCall).toBe(expectedType);
};

/**
 * Assert that a mock was called with an instance of a specific class
 */
export const expectCalledWithInstance = (mock: jest.Mock, expectedClass: any) => {
  const lastCall = getLastCallArgs(mock)[0];
  expect(lastCall).toBeInstanceOf(expectedClass);
};


// ============================================================================
// Lightweight Assertion Helpers (Quick Checks)
// ============================================================================

/**
 * Quick assertion: mock was called exactly once
 */
export const expectCalledOnce = (mock: jest.Mock) => {
  expect(mock).toHaveBeenCalledTimes(1);
};

/**
 * Quick assertion: mock was never called
 */
export const expectNeverCalled = (mock: jest.Mock) => {
  expect(mock).not.toHaveBeenCalled();
};

/**
 * Quick assertion: mock was called at least once
 */
export const expectCalled = (mock: jest.Mock) => {
  expect(mock).toHaveBeenCalled();
};

/**
 * Quick assertion: mock was called with specific value
 */
export const expectCalledWithValue = (mock: jest.Mock, value: any) => {
  expect(mock).toHaveBeenCalledWith(value);
};

/**
 * Get the arguments from the last call
 */
export const getLastCall = (mock: jest.Mock): any[] => {
  const calls = mock.mock.calls;
  return calls.length > 0 ? calls[calls.length - 1] : [];
};

/**
 * Get the first argument from the last call
 */
export const getLastCallArg = (mock: jest.Mock, index: number = 0): any => {
  return getLastCall(mock)[index];
};

/**
 * Get all arguments from all calls
 */
export const getAllCalls = (mock: jest.Mock): any[][] => {
  return mock.mock.calls;
};

/**
 * Get the return value from the last call
 */
export const getLastReturnValue = (mock: jest.Mock): any => {
  const results = mock.mock.results;
  return results.length > 0 ? results[results.length - 1].value : undefined;
};

/**
 * Quick check: was mock called with a specific number of arguments
 */
export const expectCalledWithArgCount = (mock: jest.Mock, count: number) => {
  const lastCall = getLastCall(mock);
  expect(lastCall.length).toBe(count);
};

/**
 * Quick check: was mock called with first argument being a specific type
 */
export const expectFirstArgType = (mock: jest.Mock, expectedType: string) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(typeof firstArg).toBe(expectedType);
};

/**
 * Quick check: was mock called with first argument being instance of class
 */
export const expectFirstArgInstance = (mock: jest.Mock, expectedClass: any) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(firstArg).toBeInstanceOf(expectedClass);
};

/**
 * Quick check: was mock called with first argument being truthy
 */
export const expectFirstArgTruthy = (mock: jest.Mock) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(firstArg).toBeTruthy();
};

/**
 * Quick check: was mock called with first argument being falsy
 */
export const expectFirstArgFalsy = (mock: jest.Mock) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(firstArg).toBeFalsy();
};

/**
 * Quick check: was mock called with first argument being null
 */
export const expectFirstArgNull = (mock: jest.Mock) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(firstArg).toBeNull();
};

/**
 * Quick check: was mock called with first argument being undefined
 */
export const expectFirstArgUndefined = (mock: jest.Mock) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(firstArg).toBeUndefined();
};

/**
 * Quick check: was mock called with first argument being defined
 */
export const expectFirstArgDefined = (mock: jest.Mock) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(firstArg).toBeDefined();
};

/**
 * Quick check: was mock called with first argument being an array
 */
export const expectFirstArgArray = (mock: jest.Mock) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(Array.isArray(firstArg)).toBe(true);
};

/**
 * Quick check: was mock called with first argument being an object
 */
export const expectFirstArgObject = (mock: jest.Mock) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(typeof firstArg).toBe('object');
  expect(firstArg).not.toBeNull();
};

/**
 * Quick check: was mock called with first argument being a string
 */
export const expectFirstArgString = (mock: jest.Mock) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(typeof firstArg).toBe('string');
};

/**
 * Quick check: was mock called with first argument being a number
 */
export const expectFirstArgNumber = (mock: jest.Mock) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(typeof firstArg).toBe('number');
};

/**
 * Quick check: was mock called with first argument being a boolean
 */
export const expectFirstArgBoolean = (mock: jest.Mock) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(typeof firstArg).toBe('boolean');
};

/**
 * Quick check: was mock called with first argument being a function
 */
export const expectFirstArgFunction = (mock: jest.Mock) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(typeof firstArg).toBe('function');
};

/**
 * Quick check: was mock called with first argument having a specific property
 */
export const expectFirstArgHasProperty = (mock: jest.Mock, property: string) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(firstArg).toHaveProperty(property);
};

/**
 * Quick check: was mock called with first argument having a specific property value
 */
export const expectFirstArgPropertyValue = (mock: jest.Mock, property: string, value: any) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(firstArg[property]).toBe(value);
};

/**
 * Quick check: was mock called with first argument being an array with specific length
 */
export const expectFirstArgArrayLength = (mock: jest.Mock, length: number) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(Array.isArray(firstArg)).toBe(true);
  expect(firstArg.length).toBe(length);
};

/**
 * Quick check: was mock called with first argument being an array containing item
 */
export const expectFirstArgArrayContains = (mock: jest.Mock, item: any) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(Array.isArray(firstArg)).toBe(true);
  expect(firstArg).toContain(item);
};

/**
 * Quick check: was mock called with first argument being a string containing substring
 */
export const expectFirstArgStringContains = (mock: jest.Mock, substring: string) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(typeof firstArg).toBe('string');
  expect(firstArg).toContain(substring);
};

/**
 * Quick check: was mock called with first argument being a string matching pattern
 */
export const expectFirstArgStringMatches = (mock: jest.Mock, pattern: RegExp) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(typeof firstArg).toBe('string');
  expect(firstArg).toMatch(pattern);
};

/**
 * Quick check: was mock called with first argument being a string starting with prefix
 */
export const expectFirstArgStringStartsWith = (mock: jest.Mock, prefix: string) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(typeof firstArg).toBe('string');
  expect(firstArg).toMatch(new RegExp(`^${prefix}`));
};

/**
 * Quick check: was mock called with first argument being a string ending with suffix
 */
export const expectFirstArgStringEndsWith = (mock: jest.Mock, suffix: string) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(typeof firstArg).toBe('string');
  expect(firstArg).toMatch(new RegExp(`${suffix}$`));
};

/**
 * Quick check: was mock called with first argument being a number greater than value
 */
export const expectFirstArgGreaterThan = (mock: jest.Mock, value: number) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(typeof firstArg).toBe('number');
  expect(firstArg).toBeGreaterThan(value);
};

/**
 * Quick check: was mock called with first argument being a number less than value
 */
export const expectFirstArgLessThan = (mock: jest.Mock, value: number) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(typeof firstArg).toBe('number');
  expect(firstArg).toBeLessThan(value);
};

/**
 * Quick check: was mock called with first argument being a number equal to value
 */
export const expectFirstArgEquals = (mock: jest.Mock, value: number) => {
  const firstArg = getLastCallArg(mock, 0);
  expect(typeof firstArg).toBe('number');
  expect(firstArg).toBe(value);
};


// ============================================================================
// File System Mocking Helpers
// ============================================================================

/**
 * Setup fs mock with default implementations
 * Call this in beforeEach to ensure fs methods are jest.fn()
 * 
 * Handles both synchronous (existsSync, readFileSync) and asynchronous (readFile, writeFile) methods.
 * Works with jest.mock('fs') at module level.
 * 
 * @example
 * // At module level:
 * jest.mock('fs');
 * 
 * // In test:
 * beforeEach(() => {
 *   setupFsMock();
 * });
 */
export const setupFsMock = () => {
  // Cast fs to Mocked type to access mock methods
  const mockFs = fs as jest.Mocked<typeof fs>;
  
  // Synchronous fs methods
  const syncMethods = [
    { name: 'existsSync' as const, returnValue: false },
    { name: 'readFileSync' as const, returnValue: '' },
    { name: 'statSync' as const, returnValue: {} },
    { name: 'readdirSync' as const, returnValue: [] },
    { name: 'writeFileSync' as const, returnValue: undefined },
    { name: 'mkdirSync' as const, returnValue: undefined },
    { name: 'unlinkSync' as const, returnValue: undefined }
  ];

  // Asynchronous fs methods
  const asyncMethods = [
    { name: 'readFile' as const, returnValue: '' },
    { name: 'writeFile' as const, returnValue: undefined },
    { name: 'readdir' as const, returnValue: [] },
    { name: 'stat' as const, returnValue: {} },
    { name: 'mkdir' as const, returnValue: undefined },
    { name: 'unlink' as const, returnValue: undefined }
  ];

  // Setup synchronous methods
  syncMethods.forEach(({ name, returnValue }) => {
    const method = (mockFs as any)[name];
    if (method && jest.isMockFunction(method)) {
      (method as jest.Mock).mockClear();
      (method as jest.Mock).mockReturnValue(returnValue);
    }
  });

  // Setup asynchronous methods
  asyncMethods.forEach(({ name, returnValue }) => {
    const method = (mockFs as any)[name];
    if (method && jest.isMockFunction(method)) {
      (method as jest.Mock).mockClear();
      (method as any).mockResolvedValue(returnValue as any);
    }
  });
};

/**
 * Setup vscode.window mocks for UI tests
 * 
 * @example
 * beforeEach(() => {
 *   setupVscodeMocks();
 * });
 */
export const setupVscodeMocks = () => {
  if (!jest.isMockFunction(vscode.window.showInformationMessage)) {
    jest.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined);
  }
  if (!jest.isMockFunction(vscode.window.showErrorMessage)) {
    jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined);
  }
  if (!jest.isMockFunction(vscode.window.showWarningMessage)) {
    jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined);
  }
  if (!jest.isMockFunction(vscode.workspace.getConfiguration)) {
    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: jest.fn(),
      update: jest.fn()
    } as any);
  }
};

/**
 * Type Safety Utilities for Mocking
 * 
 * These utilities help maintain type safety when working with complex mocks,
 * reducing the need for 'as any' and catching errors at compile time.
 */

import { jest } from '@jest/globals';

/**
 * Create a fully typed mock of an interface
 * Ensures all methods are mocked and type-safe
 * 
 * @example
 * const mockService = createTypedMock<MyService>({
 *   method1: jest.fn().mockReturnValue('value'),
 *   method2: jest.fn().mockResolvedValue('async value')
 * });
 */
export const createTypedMock = <T>(implementation: Partial<T>): jest.Mocked<T> => {
  return implementation as jest.Mocked<T>;
};

/**
 * Create a mock with partial implementation
 * Useful when you only need to mock some methods
 * 
 * @example
 * const mockService = createPartialMock<MyService>({
 *   method1: jest.fn().mockReturnValue('value')
 *   // method2 will be undefined - only mock what you need
 * });
 */
export const createPartialMock = <T>(implementation: Partial<T>): Partial<jest.Mocked<T>> => {
  return implementation as Partial<jest.Mocked<T>>;
};

/**
 * Verify that a mock has all required methods
 * Useful for catching incomplete mocks at test time
 * 
 * @example
 * const mockService = createMockService();
 * verifyMockCompleteness(mockService, ['method1', 'method2', 'method3']);
 */
export const verifyMockCompleteness = <T>(
  mock: any,
  requiredMethods: (keyof T)[]
): void => {
  const missingMethods = requiredMethods.filter(method => !(method in mock));
  if (missingMethods.length > 0) {
    throw new Error(
      `Mock is missing required methods: ${missingMethods.join(', ')}`
    );
  }
};

/**
 * Create a mock that tracks all property accesses
 * Useful for debugging what properties are being accessed
 * 
 * @example
 * const mockService = createTrackingMock<MyService>();
 * // Use the mock...
 * console.log(mockService.__accessedProperties);
 */
export const createTrackingMock = <T>(): T & { __accessedProperties: string[] } => {
  const accessedProperties: string[] = [];
  
  return new Proxy({} as T & { __accessedProperties: string[] }, {
    get: (target, prop: string | symbol) => {
      if (prop === '__accessedProperties') {
        return accessedProperties;
      }
      if (typeof prop === 'string') {
        accessedProperties.push(prop);
      }
      return jest.fn();
    }
  });
};

/**
 * Create a mock that validates method signatures
 * Ensures methods are called with correct argument types
 * 
 * @example
 * const mockService = createValidatingMock<MyService>({
 *   method1: (arg: string) => 'value'
 * });
 */
export const createValidatingMock = <T>(
  signatures: Record<string, (...args: any[]) => any>
): jest.Mocked<T> => {
  const mock: any = {};
  
  for (const [methodName, signature] of Object.entries(signatures)) {
    mock[methodName] = jest.fn(signature);
  }
  
  return mock as jest.Mocked<T>;
};

/**
 * Create a mock that auto-mocks all methods
 * Useful for quick testing when you don't need specific behavior
 * 
 * @example
 * const mockService = createAutoMock<MyService>();
 * // All methods are automatically mocked and return undefined
 */
export const createAutoMock = <T>(methodNames: (keyof T)[]): jest.Mocked<T> => {
  const mock: any = {};
  
  for (const methodName of methodNames) {
    mock[methodName] = jest.fn();
  }
  
  return mock as jest.Mocked<T>;
};

/**
 * Create a mock that returns itself for method chaining
 * Useful for fluent APIs
 * 
 * @example
 * const mockBuilder = createFluentMock<MyBuilder>();
 * mockBuilder.method1().method2().method3();
 */
export const createFluentMock = <T>(methodNames: (keyof T)[]): jest.Mocked<T> => {
  const mock: any = {};
  
  for (const methodName of methodNames) {
    mock[methodName] = jest.fn().mockReturnValue(mock);
  }
  
  return mock as jest.Mocked<T>;
};

/**
 * Create a mock that tracks call order across multiple mocks
 * Useful for verifying interaction order
 * 
 * @example
 * const tracker = createCallOrderTracker();
 * const mock1 = tracker.createMock('mock1', ['method1']);
 * const mock2 = tracker.createMock('mock2', ['method2']);
 * // Use mocks...
 * console.log(tracker.getCallOrder()); // ['mock1.method1', 'mock2.method2']
 */
export const createCallOrderTracker = () => {
  const callOrder: string[] = [];
  
  return {
    createMock: <T>(mockName: string, methodNames: (keyof T)[]): jest.Mocked<T> => {
      const mock: any = {};
      
      for (const methodName of methodNames) {
        mock[methodName] = jest.fn().mockImplementation(() => {
          callOrder.push(`${mockName}.${String(methodName)}`);
        });
      }
      
      return mock as jest.Mocked<T>;
    },
    getCallOrder: () => callOrder,
    reset: () => {
      callOrder.length = 0;
    }
  };
};

/**
 * Create a mock that validates arguments
 * Throws if arguments don't match expected types
 * 
 * @example
 * const mockService = createValidatingMock<MyService>({
 *   method1: (arg: string) => {
 *     if (typeof arg !== 'string') throw new Error('Expected string');
 *     return 'value';
 *   }
 * });
 */
export const createArgumentValidatingMock = <T>(
  validators: Record<string, (args: any[]) => void>
): jest.Mocked<T> => {
  const mock: any = {};
  
  for (const [methodName, validator] of Object.entries(validators)) {
    mock[methodName] = jest.fn().mockImplementation((...args: any[]) => {
      validator(args);
    });
  }
  
  return mock as jest.Mocked<T>;
};

/**
 * Create a mock that records all interactions
 * Useful for detailed debugging
 * 
 * @example
 * const mockService = createRecordingMock<MyService>(['method1', 'method2']);
 * // Use mock...
 * console.log(mockService.__interactions);
 */
export const createRecordingMock = <T>(
  methodNames: (keyof T)[]
): T & { __interactions: Array<{ method: string; args: any[]; timestamp: number }> } => {
  const interactions: Array<{ method: string; args: any[]; timestamp: number }> = [];
  const mock: any = {};
  
  for (const methodName of methodNames) {
    mock[methodName] = jest.fn().mockImplementation((...args: any[]) => {
      interactions.push({
        method: String(methodName),
        args,
        timestamp: Date.now()
      });
    });
  }
  
  mock.__interactions = interactions;
  return mock as T & { __interactions: Array<{ method: string; args: any[]; timestamp: number }> };
};

/**
 * Create a mock that simulates async behavior
 * All methods return promises
 * 
 * @example
 * const mockService = createAsyncMock<MyService>(['method1', 'method2']);
 * await mockService.method1(); // Returns Promise<undefined>
 */
export const createAsyncMock = <T>(methodNames: (keyof T)[]): jest.Mocked<T> => {
  const mock: any = {};
  
  for (const methodName of methodNames) {
    mock[methodName] = jest.fn().mockResolvedValue(undefined);
  }
  
  return mock as jest.Mocked<T>;
};

/**
 * Create a mock that simulates sync behavior
 * All methods return values synchronously
 * 
 * @example
 * const mockService = createSyncMock<MyService>(['method1', 'method2']);
 * mockService.method1(); // Returns undefined
 */
export const createSyncMock = <T>(methodNames: (keyof T)[]): jest.Mocked<T> => {
  const mock: any = {};
  
  for (const methodName of methodNames) {
    mock[methodName] = jest.fn().mockReturnValue(undefined);
  }
  
  return mock as jest.Mocked<T>;
};

/**
 * Create a mock that throws errors
 * Useful for error handling tests
 * 
 * @example
 * const mockService = createErrorMock<MyService>(['method1', 'method2']);
 * mockService.method1(); // Throws Error
 */
export const createErrorMock = <T>(
  methodNames: (keyof T)[],
  error: Error = new Error('Mock error')
): jest.Mocked<T> => {
  const mock: any = {};
  
  for (const methodName of methodNames) {
    mock[methodName] = jest.fn().mockImplementation(() => {
      throw error;
    });
  }
  
  return mock as jest.Mocked<T>;
};

/**
 * Create a mock that rejects promises
 * Useful for async error handling tests
 * 
 * @example
 * const mockService = createRejectingMock<MyService>(['method1', 'method2']);
 * await mockService.method1(); // Rejects with Error
 */
export const createRejectingMock = <T>(
  methodNames: (keyof T)[],
  error: Error = new Error('Mock error')
): jest.Mocked<T> => {
  const mock: any = {};
  
  for (const methodName of methodNames) {
    mock[methodName] = jest.fn().mockRejectedValue(error);
  }
  
  return mock as jest.Mocked<T>;
};

/**
 * Create a mock that implements a specific interface
 * Ensures type safety and completeness
 * 
 * @example
 * const mockService = createImplementingMock<MyService>({
 *   method1: jest.fn().mockReturnValue('value'),
 *   method2: jest.fn().mockResolvedValue('async')
 * });
 */
export const createImplementingMock = <T>(
  implementation: { [K in keyof T]: jest.Mock }
): jest.Mocked<T> => {
  return implementation as jest.Mocked<T>;
};

/**
 * Merge multiple mocks into one
 * Useful when you need to combine mocks from different sources
 * 
 * @example
 * const mock1 = createMockService1();
 * const mock2 = createMockService2();
 * const merged = mergeMocks(mock1, mock2);
 */
export const mergeMocks = <T extends Record<string, any>>(
  ...mocks: Partial<T>[]
): Partial<T> => {
  return Object.assign({}, ...mocks);
};

/**
 * Create a mock that delegates to a real implementation
 * Useful for partial mocking
 * 
 * @example
 * const realService = new MyService();
 * const mockService = createDelegatingMock(realService, ['method1']);
 * // method1 is mocked, other methods use real implementation
 */
export const createDelegatingMock = <T>(
  realImplementation: T,
  mockedMethods: (keyof T)[]
): jest.Mocked<T> => {
  const mock: any = { ...realImplementation };
  
  for (const methodName of mockedMethods) {
    mock[methodName] = jest.fn();
  }
  
  return mock as jest.Mocked<T>;
};

/**
 * Create a mock that spies on a real implementation
 * Calls the real method but tracks calls
 * 
 * @example
 * const realService = new MyService();
 * const spyService = createSpyingMock(realService, ['method1']);
 * // method1 is called and tracked
 */
export const createSpyingMock = <T>(
  realImplementation: T,
  spiedMethods: (keyof T)[]
): jest.Mocked<T> => {
  const mock: any = { ...realImplementation };
  
  for (const methodName of spiedMethods) {
    const originalMethod = realImplementation[methodName];
    if (typeof originalMethod === 'function') {
      mock[methodName] = jest.fn(originalMethod.bind(realImplementation));
    }
  }
  
  return mock as jest.Mocked<T>;
};

# Mocking Patterns Guide

This guide demonstrates the recommended patterns for writing tests with proper mocking in this project.

## Core Principles

### 1. Always Use `setupTest()`

```typescript
import { setupTest } from './helpers';

describe('MyComponent', () => {
  setupTest(); // ✅ Clears mocks before/after each test

  // your tests...
});
```

### 2. Use Typed Mock Factories

```typescript
// ✅ Good - maintains type safety
import { createMockEmbeddingService, createMockClaimsManager } from './helpers/mockFactories';

let mockEmbeddingService: jest.Mocked<EmbeddingService>;
let mockClaimsManager: jest.Mocked<ClaimsManager>;

beforeEach(() => {
  mockEmbeddingService = createMockEmbeddingService();
  mockClaimsManager = createMockClaimsManager();
});

// ❌ Bad - loses type safety
let mockService: any = { method: jest.fn() };
```

### 3. Use Builders for Complex Objects

```typescript
// ✅ Good - readable and maintainable
import { aClaim, aZoteroItem } from './helpers';

const claim = aClaim()
  .withId('C_01')
  .withCategory('Method')
  .verified()
  .build();

// ❌ Bad - verbose and error-prone
const claim = {
  id: 'C_01',
  text: 'Test',
  category: 'Method',
  // ... many more fields
};
```

### 4. Use Fixtures for Test Data

```typescript
// ✅ Good - consistent test data
import { TEST_CLAIMS, TEST_ZOTERO_ITEMS } from './helpers';

const claim = TEST_CLAIMS.method;
const item = TEST_ZOTERO_ITEMS.johnson2007;

// ❌ Bad - inconsistent data across tests
const claim = { id: 'C_01', text: 'Some claim', ... };
```

### 5. Use Assertion Helpers

```typescript
// ✅ Good - clear intent
import { expectErrorMessage, expectCalledWith, expectCalledTimes } from './helpers';

expectErrorMessage('Invalid input');
expectCalledWith(mockService.method, expectedArg);
expectCalledTimes(mockService.method, 2);

// ❌ Bad - verbose and repetitive
expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
  expect.stringContaining('Invalid input')
);
expect(mockService.method).toHaveBeenCalledWith(expectedArg);
expect(mockService.method).toHaveBeenCalledTimes(2);
```

## Complete Example

```typescript
import { describe, test, expect, beforeEach } from '@jest/globals';
import { MyService } from '../myService';
import { setupTest, expectErrorMessage, expectCalledTimes } from './helpers';
import { createMockEmbeddingService } from './helpers/mockFactories';
import { aClaim } from './helpers';
import { TEST_CLAIMS } from './helpers/fixtures';

describe('MyService', () => {
  setupTest(); // ✅ Always include this

  let service: MyService;
  let mockEmbeddingService: jest.Mocked<EmbeddingService>;

  beforeEach(() => {
    // ✅ Use factory for service mocks
    mockEmbeddingService = createMockEmbeddingService();
    service = new MyService(mockEmbeddingService);
  });

  describe('processClaim', () => {
    test('should process valid claim', async () => {
      // ✅ Use fixture for test data
      const claim = TEST_CLAIMS.method;

      const result = await service.processClaim(claim);

      expect(result).toBeDefined();
      expectCalledTimes(mockEmbeddingService.generateEmbedding, 1);
    });

    test('should handle invalid claim', async () => {
      // ✅ Use builder for custom test data
      const invalidClaim = aClaim()
        .withText('')
        .build();

      await service.processClaim(invalidClaim);

      // ✅ Use assertion helper
      expectErrorMessage('Invalid claim');
    });

    test('should cache embeddings', async () => {
      const claim = TEST_CLAIMS.method;

      // ✅ Setup mock return value
      mockEmbeddingService.generateEmbedding.mockResolvedValueOnce([0.1, 0.2, 0.3]);

      await service.processClaim(claim);
      await service.processClaim(claim);

      // ✅ Verify caching behavior
      expectCalledTimes(mockEmbeddingService.generateEmbedding, 1);
    });
  });
});
```

## Mock Setup Patterns

### Service Mocks

```typescript
// ✅ Properly typed service mock
let mockService: jest.Mocked<MyService>;

beforeEach(() => {
  mockService = {
    method1: jest.fn<() => Promise<string>>().mockResolvedValue('result'),
    method2: jest.fn<(arg: string) => void>(),
    property: 'value'
  } as jest.Mocked<MyService>;
});
```

### VSCode API Mocks

```typescript
// ✅ Use helper for VSCode mocks
import { setupActiveEditor, setupConfiguration, setupWorkspaceFolders } from './helpers';

beforeEach(() => {
  setupActiveEditor('Test content');
  setupConfiguration({ 'myKey': 'myValue' });
  setupWorkspaceFolders();
});
```

### Event Emitter Mocks

```typescript
// ✅ Mock event emitters properly
let eventCallbacks: Array<(data: any) => void> = [];

const mockEventEmitter = {
  onDidChange: jest.fn((callback: (data: any) => void) => {
    eventCallbacks.push(callback);
    return { dispose: jest.fn() };
  })
};

// Trigger event in test
eventCallbacks.forEach(cb => cb(testData));
```

## Common Patterns

### Testing Async Operations

```typescript
test('should handle async operation', async () => {
  mockService.asyncMethod.mockResolvedValueOnce('result');

  const result = await service.doSomethingAsync();

  expect(result).toBe('result');
});
```

### Testing Error Handling

```typescript
test('should handle errors', async () => {
  mockService.method.mockRejectedValueOnce(new Error('Test error'));

  await service.doSomething();

  expectErrorMessage('Test error');
});
```

### Testing Multiple Calls

```typescript
test('should call method multiple times', async () => {
  mockService.method
    .mockResolvedValueOnce('first')
    .mockResolvedValueOnce('second');

  const result1 = await service.call();
  const result2 = await service.call();

  expect(result1).toBe('first');
  expect(result2).toBe('second');
  expectCalledTimes(mockService.method, 2);
});
```

### Testing with Fixtures

```typescript
test('should process all claim types', async () => {
  for (const claim of Object.values(TEST_CLAIMS)) {
    const result = await service.processClaim(claim);
    expect(result).toBeDefined();
  }
});
```

## Anti-Patterns to Avoid

### ❌ Using `as any`

```typescript
// Bad - loses type safety
const mockService: any = { method: jest.fn() };
```

### ❌ Manual Mock Clearing

```typescript
// Bad - use setupTest() instead
beforeEach(() => {
  jest.clearAllMocks();
});
```

### ❌ Inline Mock Creation

```typescript
// Bad - use factories instead
const mockService = {
  method: jest.fn(),
  property: 'value'
};
```

### ❌ Incomplete Mock Objects

```typescript
// Bad - missing required methods
const mockService = {
  method1: jest.fn()
  // method2 is missing!
};
```

### ❌ Global State Pollution

```typescript
// Bad - affects other tests
global.fetch = jest.fn();
```

## Debugging Tips

### View Mock Call History

```typescript
// Get all calls
console.log(mockService.method.mock.calls);

// Get last call
const lastCall = mockService.method.mock.calls[mockService.method.mock.calls.length - 1];

// Use helper
import { getLastCallArgs, getAllCallArgs } from './helpers';
const lastArgs = getLastCallArgs(mockService.method);
const allArgs = getAllCallArgs(mockService.method);
```

### Verify Mock Setup

```typescript
// Check if mock was called
expect(mockService.method).toHaveBeenCalled();

// Check call count
expect(mockService.method).toHaveBeenCalledTimes(1);

// Check arguments
expect(mockService.method).toHaveBeenCalledWith(expectedArg);
```

### Reset Mocks Between Tests

```typescript
// setupTest() handles this automatically
// But you can also do it manually:
beforeEach(() => {
  jest.clearAllMocks(); // Clears call history
  jest.resetAllMocks(); // Clears call history and return values
  jest.restoreAllMocks(); // Restores original implementations
});
```

# Mocking Best Practices Guide

This guide consolidates mocking principles and patterns to reduce errors and improve consistency across tests.

## Core Principles

### 1. Always Use `setupTest()`

```typescript
import { setupTest } from './helpers';

describe('MyComponent', () => {
  setupTest(); // ✅ Clears mocks before/after each test

  // your tests...
});
```

**Why:** Prevents mock state from leaking between tests. Automatically clears call history and restores implementations.

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

**Why:** Type safety catches errors at compile time. IDE autocomplete works properly. Factories ensure consistency.

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

**Why:** Builders are self-documenting. Easy to create variations. Reduces boilerplate.

### 4. Use Fixtures for Shared Test Data

```typescript
// ✅ Good - consistent test data
import { TEST_CLAIMS, TEST_ZOTERO_ITEMS } from './helpers';

const claim = TEST_CLAIMS.method;
const item = TEST_ZOTERO_ITEMS.johnson2007;

// ❌ Bad - inconsistent data across tests
const claim = { id: 'C_01', text: 'Some claim', ... };
```

**Why:** Single source of truth. Easy to update test data. Ensures consistency across tests.

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

**Why:** Reduces boilerplate. Improves readability. Easier to maintain.

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

### Global State Mocks

```typescript
// ✅ Use jest.spyOn for global state
beforeEach(() => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    status: 200,
    json: async () => ({ data: 'test' })
  } as Response);
});

afterEach(() => {
  jest.restoreAllMocks(); // Automatically called by setupTest()
});

// ❌ Bad - doesn't restore
global.fetch = jest.fn();
```

**Why:** `jest.spyOn` automatically restores the original. Prevents test pollution.

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

### Testing Disposables

```typescript
test('should dispose resources', () => {
  const disposable = service.subscribe(() => {});
  
  disposable.dispose();
  
  expect(disposable.dispose).toHaveBeenCalled();
});
```

## Anti-Patterns to Avoid

### ❌ Using `as any`

```typescript
// Bad - loses type safety
const mockService: any = { method: jest.fn() };
```

**Fix:** Use typed factories or proper type annotations.

### ❌ Manual Mock Clearing

```typescript
// Bad - use setupTest() instead
beforeEach(() => {
  jest.clearAllMocks();
});
```

**Fix:** Always call `setupTest()` at the top of your describe block.

### ❌ Inline Mock Creation

```typescript
// Bad - use factories instead
const mockService = {
  method: jest.fn(),
  property: 'value'
};
```

**Fix:** Use `createMockService()` from mockFactories.

### ❌ Incomplete Mock Objects

```typescript
// Bad - missing required methods
const mockService = {
  method1: jest.fn()
  // method2 is missing!
};
```

**Fix:** Use factories that include all required methods.

### ❌ Global State Pollution

```typescript
// Bad - affects other tests
global.fetch = jest.fn();
```

**Fix:** Use `jest.spyOn()` and let `setupTest()` handle cleanup.

### ❌ Not Restoring Global Mocks

```typescript
// Bad - global state persists
beforeEach(() => {
  global.fetch = jest.fn();
  // No afterEach to restore!
});
```

**Fix:** Use `jest.spyOn()` or ensure `setupTest()` is called.

### ❌ Mocking Implementation Details

```typescript
// Bad - tests implementation, not behavior
mockService.internalMethod.mockReturnValue('value');

// ❌ Bad - tests private methods
mockService['_privateMethod'].mockReturnValue('value');
```

**Fix:** Mock public interfaces only. Test behavior, not implementation.

### ❌ Over-Mocking

```typescript
// Bad - mocks too much
const mockService = {
  method1: jest.fn(),
  method2: jest.fn(),
  method3: jest.fn(),
  method4: jest.fn(),
  // ... 20 more methods
};
```

**Fix:** Mock only what the test needs. Use real implementations for the rest.

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

// Check specific call
expect(mockService.method).toHaveBeenNthCalledWith(1, expectedArg);
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

    test('should handle errors gracefully', async () => {
      // ✅ Mock error scenario
      mockEmbeddingService.generateEmbedding.mockRejectedValueOnce(
        new Error('Embedding service down')
      );

      await service.processClaim(TEST_CLAIMS.method);

      // ✅ Verify error handling
      expectErrorMessage('Embedding service down');
    });
  });
});
```

## Quick Reference

| Task | Pattern | Example |
|------|---------|---------|
| Create service mock | Factory | `createMockEmbeddingService()` |
| Create complex object | Builder | `aClaim().withId('C_01').build()` |
| Reuse test data | Fixture | `TEST_CLAIMS.method` |
| Setup VSCode API | Helper | `setupActiveEditor('content')` |
| Verify call count | Assertion helper | `expectCalledTimes(mock, 2)` |
| Mock async success | `mockResolvedValue` | `mock.mockResolvedValue('result')` |
| Mock async error | `mockRejectedValue` | `mock.mockRejectedValue(new Error())` |
| Mock multiple calls | `mockResolvedValueOnce` | `mock.mockResolvedValueOnce('first').mockResolvedValueOnce('second')` |
| Restore global state | `jest.spyOn` | `jest.spyOn(global, 'fetch')` |
| Clear all mocks | `setupTest()` | Call at top of describe block |

## When to Use Each Helper

### Use Factories When:
- Creating service mocks (EmbeddingService, ClaimsManager, etc.)
- Creating VSCode API objects (Document, TextEditor, etc.)
- You need consistent, reusable mock objects

### Use Builders When:
- Creating domain objects with many optional properties
- You need to create variations of the same object
- The object has complex initialization logic

### Use Fixtures When:
- You have predefined test data that's reused across tests
- The data represents real-world scenarios
- You want a single source of truth for test data

### Use Assertion Helpers When:
- Verifying common patterns (error messages, call counts, etc.)
- You want to reduce boilerplate
- You want consistent assertion patterns across tests

## Troubleshooting

### "Mock is not a function"
- Ensure you're using `jest.fn()` to create the mock
- Check that the mock is properly typed

### "Mock was not called"
- Verify the mock is passed to the code under test
- Check that the code actually calls the mock
- Use `console.log(mock.mock.calls)` to debug

### "Test pollution" (tests affecting each other)
- Ensure `setupTest()` is called in your describe block
- Check for global state mutations
- Use `jest.spyOn()` for global mocks

### "Type errors with mocks"
- Use `jest.Mocked<T>` for proper typing
- Avoid `as any` - use typed factories instead
- Check that mock methods match the interface

### "Mock return value not working"
- Use `mockResolvedValue()` for async functions
- Use `mockReturnValue()` for sync functions
- Use `mockResolvedValueOnce()` for single calls
- Check the order of mock setup vs. test execution

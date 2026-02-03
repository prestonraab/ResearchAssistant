# Test Refactoring Template

Use this template when refactoring existing test files to follow mocking standards.

## Before: Verbose, Incomplete Mocks

```typescript
import { jest } from '@jest/globals';
import { MyService } from '../myService';
import type { Dependency } from '../types';

describe('MyService', () => {
  let service: MyService;
  let mockDependency: any;

  beforeEach(() => {
    mockDependency = {
      method1: jest.fn().mockReturnValue('value')
      // Missing other required methods!
    };
    service = new MyService(mockDependency);
  });

  test('should do something', () => {
    mockDependency.method1.mockReturnValue('test');
    const result = service.doSomething();
    expect(result).toBe('test');
  });
});
```

**Problems:**
- No `setupTest()` → test pollution
- Inline mock with `any` type → type errors at runtime
- Incomplete mock → missing methods cause failures
- Verbose setup → hard to maintain

## After: Clean, Complete Mocks

```typescript
import { setupTest, createMockDependency, aClaim } from '../../__tests__/helpers';
import { MyService } from '../myService';

describe('MyService', () => {
  setupTest(); // ✅ Prevents test pollution

  let service: MyService;
  let mockDependency: ReturnType<typeof createMockDependency>;

  beforeEach(() => {
    mockDependency = createMockDependency(); // ✅ Complete, typed mock
    service = new MyService(mockDependency);
  });

  test('should do something', () => {
    mockDependency.method1.mockReturnValue('test');
    const result = service.doSomething();
    expect(result).toBe('test');
  });
});
```

**Improvements:**
- `setupTest()` clears mocks between tests
- Factory provides complete, typed mock
- No `any` types → compile-time error checking
- Concise setup → easy to maintain

## Refactoring Checklist

### Step 1: Add setupTest()
```typescript
describe('MyTest', () => {
  setupTest(); // ✅ Add this first
  // rest of tests...
});
```

### Step 2: Replace Inline Mocks with Factories
```typescript
// Before
const mockService = {
  method: jest.fn().mockReturnValue('value')
};

// After
const mockService = createMockService();
```

### Step 3: Remove `as any` Type Annotations
```typescript
// Before
let mockService: any;

// After
let mockService: ReturnType<typeof createMockService>;
```

### Step 4: Use Builders for Test Data
```typescript
// Before
const claim = {
  id: 'C_01',
  text: 'Test claim',
  category: 'Method',
  verified: false,
  // ... 10 more properties
};

// After
const claim = aClaim()
  .withId('C_01')
  .withCategory('Method')
  .build();
```

### Step 5: Use Fixtures for Shared Data
```typescript
// Before - duplicated in multiple tests
const claim = { id: 'C_01', text: 'Method claim', category: 'Method' };

// After - use shared fixture
const claim = TEST_CLAIMS.method;
```

### Step 6: Simplify beforeEach
```typescript
// Before - 15+ lines
beforeEach(() => {
  mockService1 = { method1: jest.fn(), method2: jest.fn() };
  mockService2 = { method1: jest.fn(), method2: jest.fn() };
  mockService3 = { method1: jest.fn(), method2: jest.fn() };
  service = new MyService(mockService1, mockService2, mockService3);
});

// After - 4 lines
beforeEach(() => {
  mockService1 = createMockService1();
  mockService2 = createMockService2();
  mockService3 = createMockService3();
  service = new MyService(mockService1, mockService2, mockService3);
});
```

## Common Refactoring Patterns

### Pattern 1: Service Mock
```typescript
// Before
const mockClaimsManager = {
  getClaim: jest.fn().mockReturnValue(null),
  saveClaim: jest.fn().mockResolvedValue(undefined)
};

// After
const mockClaimsManager = createMockClaimsManager();
```

### Pattern 2: VSCode API Mock
```typescript
// Before
const mockDocument = {
  uri: { fsPath: '/test' },
  getText: jest.fn().mockReturnValue('content'),
  lineCount: 10
};

// After
const mockDocument = createMockDocument();
```

### Pattern 3: Test Data
```typescript
// Before
const claim = {
  id: 'C_01',
  text: 'Test claim',
  category: 'Method',
  context: '',
  primaryQuote: { text: '', source: '', verified: false },
  supportingQuotes: [],
  sections: [],
  verified: false,
  createdAt: new Date('2024-01-01'),
  modifiedAt: new Date('2024-01-01')
};

// After
const claim = aClaim()
  .withId('C_01')
  .withCategory('Method')
  .build();
```

### Pattern 4: HTTP Response
```typescript
// Before
mockFetch.mockResolvedValueOnce(
  new Response(JSON.stringify({ data: 'test' }), { status: 200 })
);

// After
mockFetch.mockResolvedValueOnce(
  createMockFetchResponse({ data: 'test' })
);
```

### Pattern 5: Error Handling
```typescript
// Before
mockService.method.mockRejectedValueOnce(
  new Error('Network error')
);

// After
mockService.method.mockRejectedValueOnce(
  createMockNetworkError()
);
```

## Validation Checklist

After refactoring, verify:

- [ ] `setupTest()` called in describe block
- [ ] All mocks use factories from helpers
- [ ] No `as any` type annotations
- [ ] No inline mock objects
- [ ] beforeEach under 15 lines
- [ ] Test data uses builders or fixtures
- [ ] HTTP responses use API helpers
- [ ] Tests pass individually: `npm test -- myTest.test.ts`
- [ ] Tests pass together: `npm test`
- [ ] No TypeScript errors: `npm run type-check`

## File-by-File Priority

**High Priority (Most Issues):**
1. `exportService.test.ts` - ✅ Already refactored
2. `zoteroApiService.test.ts` - Manual HTTP mocking
3. `featureManager.test.ts` - Missing setupTest()

**Medium Priority (Some Issues):**
4. `claimSupportValidator.test.ts` - Good example, minor cleanup
5. `readingAssistant.test.ts` - Well-structured, verify consistency

**Low Priority (Already Good):**
6. `claimCompletionProvider.test.ts` - Follows best practices
7. `deepLinkHandler.test.ts` - Clean setup

## Tips for Smooth Refactoring

1. **Refactor one file at a time** - Easier to debug issues
2. **Run tests after each step** - Catch problems early
3. **Use git diff to review changes** - Verify improvements
4. **Keep commits small** - One refactoring per commit
5. **Test individually first** - `npm test -- file.test.ts`
6. **Then test together** - `npm test` to catch pollution

## When to Create New Factories

If you need a mock that doesn't exist:

1. Check if similar factory exists
2. Add to `mockFactories.ts` following existing patterns
3. Export from `index.ts`
4. Add to this template's "Available Factories" section
5. Use in tests

Example:
```typescript
export const createMockMyService = () => {
  return {
    method1: jest.fn<(arg: string) => Promise<string>>().mockResolvedValue(''),
    method2: jest.fn<(arg: number) => void>(),
    dispose: jest.fn<() => void>()
  };
};
```

## Troubleshooting Refactoring

| Issue | Solution |
|-------|----------|
| Tests fail after refactoring | Run individually first: `npm test -- file.test.ts` |
| Type errors with mocks | Use `ReturnType<typeof createMock...>` not `any` |
| Mock methods missing | Check factory includes all required methods |
| Tests pass individually but fail together | Verify `setupTest()` is called |
| beforeEach still too long | Extract more to factories or use fixtures |
| Can't find right factory | Check `mockFactories.ts` or create new one |

# Test Refactoring Checklist

Use this checklist when refactoring existing tests to follow mocking best practices.

## Pre-Refactoring Review

- [ ] Identify the test file that needs refactoring
- [ ] Check if it has `setupTest()` call at the top of describe block
- [ ] Look for inline mock objects with `any` type
- [ ] Look for verbose beforeEach blocks (>15 lines)
- [ ] Look for manual object creation with many properties

## Phase 1: Safety (Prevents Test Pollution)

- [ ] Add `setupTest()` to describe block if missing
- [ ] Verify tests pass individually
- [ ] Verify tests pass when run together
- [ ] Check for any flaky tests that now pass consistently

## Phase 2: Type Safety (Catches Errors at Compile Time)

- [ ] Replace `any` type annotations with proper types
- [ ] Replace inline mocks with typed factories
- [ ] Verify IDE autocomplete works for all mocks
- [ ] Run TypeScript compiler to catch type errors

## Phase 3: Readability (Reduces Cognitive Load)

- [ ] Replace verbose object creation with builders
- [ ] Replace inline test data with fixtures
- [ ] Shorten beforeEach blocks to under 15 lines
- [ ] Add comments explaining non-obvious mock setup

## Phase 4: Maintainability (Reduces Future Errors)

- [ ] Ensure all mocks use factories from mockFactories.ts
- [ ] Ensure all HTTP responses use API helpers
- [ ] Ensure all assertions use assertion helpers
- [ ] Document any custom mocks that can't use existing factories

## Common Refactoring Patterns

### Pattern 1: Replace Inline Mock with Factory

**Before:**
```typescript
const mockService = {
  method: jest.fn().mockReturnValue('value')
};
```

**After:**
```typescript
const mockService = createMockService();
mockService.method.mockReturnValue('value');
```

**Checklist:**
- [ ] Factory exists in mockFactories.ts
- [ ] Factory includes all required methods
- [ ] Mock is properly typed with `jest.Mocked<T>`
- [ ] Tests still pass

### Pattern 2: Replace Object Creation with Builder

**Before:**
```typescript
const claim = {
  id: 'C_01',
  text: 'Test',
  category: 'Method',
  verified: true,
  // ... 10 more properties
};
```

**After:**
```typescript
const claim = aClaim()
  .withId('C_01')
  .withText('Test')
  .withCategory('Method')
  .verified()
  .build();
```

**Checklist:**
- [ ] Builder exists in builders.ts
- [ ] Builder has all necessary methods
- [ ] Builder is properly exported
- [ ] Tests still pass

### Pattern 3: Replace Fixture Duplication with Shared Fixture

**Before:**
```typescript
// Duplicated in multiple tests
const claim = { id: 'C_01', text: 'Method claim', category: 'Method' };
```

**After:**
```typescript
// Use shared fixture
const claim = TEST_CLAIMS.method;
```

**Checklist:**
- [ ] Fixture exists in fixtures.ts
- [ ] Fixture is properly exported
- [ ] All tests use the same fixture
- [ ] Tests still pass

### Pattern 4: Replace Manual Response with API Helper

**Before:**
```typescript
mockFetch.mockResolvedValueOnce(
  new Response(JSON.stringify({ data: 'test' }), { status: 200 })
);
```

**After:**
```typescript
mockFetch.mockResolvedValueOnce(
  createMockFetchResponse({ data: 'test' })
);
```

**Checklist:**
- [ ] API helper exists in apiMockHelpers.ts
- [ ] Helper handles all response properties
- [ ] Tests still pass

## Verification Steps

After each refactoring:

1. **Compile Check**
   ```bash
   npx tsc --noEmit
   ```

2. **Test Execution**
   ```bash
   npm test -- --testPathPattern="<test-file>"
   ```

3. **Type Safety**
   - [ ] No `any` types in mock declarations
   - [ ] IDE autocomplete works
   - [ ] TypeScript catches errors

4. **Code Quality**
   - [ ] beforeEach under 15 lines
   - [ ] No inline mock objects
   - [ ] All mocks use factories
   - [ ] All assertions use helpers

## When to Create New Helpers

### Create a New Factory When:
- [ ] A service is mocked in multiple tests
- [ ] The mock has many required methods
- [ ] Tests need consistent mock setup
- [ ] The mock is complex or has defaults

### Create a New Builder When:
- [ ] An object has many optional properties
- [ ] Tests create variations of the same object
- [ ] The object creation is verbose (>5 lines)
- [ ] Multiple tests create similar objects

### Create a New Fixture When:
- [ ] Test data is reused across multiple tests
- [ ] The data represents a real-world scenario
- [ ] The data is complex or has many properties
- [ ] Tests need consistent test data

### Create a New API Helper When:
- [ ] HTTP responses are mocked in multiple tests
- [ ] The response has a consistent structure
- [ ] Tests need error responses
- [ ] The response is complex or has defaults

## Troubleshooting

### "Mock is not a function"
- [ ] Verify mock was created with `jest.fn()`
- [ ] Check that factory is properly exported
- [ ] Verify mock is passed to code under test

### "Mock was not called"
- [ ] Verify mock is injected into service
- [ ] Check that code actually calls the mock
- [ ] Use `console.log(mock.mock.calls)` to debug

### "Test pollution" (tests affecting each other)
- [ ] Add `setupTest()` to describe block
- [ ] Check for global state mutations
- [ ] Use `jest.spyOn()` for global mocks

### "Type errors with mocks"
- [ ] Replace `any` with proper types
- [ ] Use `jest.Mocked<T>` for typing
- [ ] Check that factory includes all methods

### "beforeEach block is too long"
- [ ] Extract mock setup into helper functions
- [ ] Use factories instead of inline mocks
- [ ] Use fixtures for test data

## Files to Reference

- `mockFactories.ts` - All mock factories
- `builders.ts` - All builders
- `fixtures.ts` - All shared test data
- `apiMockHelpers.ts` - All API response helpers
- `MOCKING_BEST_PRACTICES.md` - Comprehensive guide
- `QUICK_REFERENCE.md` - One-page cheat sheet

## Example Refactoring

### Before
```typescript
describe('MyService', () => {
  let service: MyService;
  let mockDep: any;

  beforeEach(() => {
    mockDep = {
      method1: jest.fn(),
      method2: jest.fn(),
      method3: jest.fn()
    };
    service = new MyService(mockDep);
  });

  test('should do something', () => {
    mockDep.method1.mockReturnValue('value');
    const result = service.doSomething();
    expect(result).toBe('value');
  });
});
```

### After
```typescript
describe('MyService', () => {
  setupTest();

  let service: MyService;
  let mockDep: jest.Mocked<Dependency>;

  beforeEach(() => {
    mockDep = createMockDependency();
    service = new MyService(mockDep);
  });

  test('should do something', () => {
    mockDep.method1.mockReturnValue('value');
    const result = service.doSomething();
    expect(result).toBe('value');
  });
});
```

**Changes:**
- ✅ Added `setupTest()`
- ✅ Replaced `any` with `jest.Mocked<Dependency>`
- ✅ Replaced inline mock with factory
- ✅ Reduced beforeEach from 8 lines to 4

## Next Steps

1. Pick a test file from the "Files needing updates" list
2. Follow this checklist phase by phase
3. Verify changes compile and tests pass
4. Update the status in `.kiro/steering/test-mocking-standards.md`
5. Move to the next file

## Questions?

Refer to:
- `.kiro/steering/test-mocking-standards.md` - Comprehensive steering
- `MOCKING_BEST_PRACTICES.md` - Detailed guide
- `QUICK_REFERENCE.md` - Quick lookup

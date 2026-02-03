# Test Consistency Guide

This guide documents the standard patterns for writing tests in this project. Following these patterns will reduce mock-related errors and improve test maintainability.

## Core Principles

### 1. Always Use `setupTest()` Helper

Every test file should include this at the top level:

```typescript
import { setupTest } from './helpers';

describe('MyComponent', () => {
  setupTest(); // ✅ Always include this
  
  // your tests...
});
```

This ensures mocks are cleared between tests and prevents state leakage.

### 2. Use Mock Factories, Not Inline Mocks

```typescript
// ✅ Good - uses factory
import { createMockDocument, createMockClaim } from './helpers';

const mockDoc = createMockDocument({ languageId: 'typescript' });
const claim = createMockClaim({ id: 'C_01', text: 'Test' });

// ❌ Bad - inline mock
const mockDoc = { uri: {}, fileName: '', getText: jest.fn() };
const claim = { id: 'C_01', text: 'Test', category: '', ... };
```

### 3. Use Builders for Complex Objects

```typescript
// ✅ Good - readable and maintainable
import { aClaim, aZoteroItem } from './helpers';

const claim = aClaim()
  .withId('C_01')
  .withCategory('Method')
  .withPrimaryQuote('Test quote', 'Smith2023')
  .verified()
  .build();

// ❌ Bad - verbose and error-prone
const claim = createMockClaim({
  id: 'C_01',
  text: 'Test',
  category: 'Method',
  primaryQuote: { text: 'Test quote', source: 'Smith2023', verified: false },
  verified: true,
  // ... many more fields
});
```

### 4. Type Your Mocks Properly

```typescript
// ✅ Good - maintains type safety
let mockManager: jest.Mocked<ClaimsManager>;
let mockService: jest.Mocked<EmbeddingService>;

beforeEach(() => {
  mockManager = {
    getClaim: jest.fn<(id: string) => Claim | null>(),
    saveClaim: jest.fn<(claim: Claim) => Promise<void>>(),
    // ... all methods with proper types
  } as any;
});

// ❌ Bad - loses type safety
let mockManager: any;

beforeEach(() => {
  mockManager = {
    getClaim: jest.fn(),
    saveClaim: jest.fn()
  };
});
```

### 5. Use Fixtures for Test Data

```typescript
// ✅ Good - consistent test data
import { TEST_CLAIMS, TEST_ZOTERO_ITEMS } from './helpers';

const claim = TEST_CLAIMS.method;
const item = TEST_ZOTERO_ITEMS.johnson2007;

// ❌ Bad - inconsistent data across tests
const claim = { id: 'C_01', text: 'Some claim', ... };
```

### 6. Mock at the Right Level

```typescript
// ✅ Good - mock external dependencies
jest.mock('fs/promises');
jest.mock('node-fetch');

// ❌ Bad - don't mock internal business logic
jest.mock('../core/claimsManager');
```

### 7. Use Helper Functions for VSCode APIs

```typescript
// ✅ Good - uses helper
import { setupActiveEditor, setupConfiguration } from './helpers';

setupActiveEditor(mockDocument);
setupConfiguration({ autoActivate: true });

// ❌ Bad - manual setup
(vscode.window as any).activeTextEditor = { document: mockDoc, ... };
(vscode.workspace.getConfiguration as any).mockReturnValue({ ... });
```

### 8. Consistent Test Structure

```typescript
describe('ComponentName', () => {
  setupTest();

  let component: ComponentName;
  let mockDependency: jest.Mocked<Dependency>;

  beforeEach(() => {
    // Create fresh mocks
    mockDependency = createMockDependency();
    component = new ComponentName(mockDependency);
  });

  describe('feature', () => {
    it('should do something', () => {
      // Arrange
      const input = 'test';
      mockDependency.method.mockReturnValue('result');

      // Act
      const result = component.doSomething(input);

      // Assert
      expect(result).toBe('result');
      expect(mockDependency.method).toHaveBeenCalledWith(input);
    });
  });
});
```

### 9. Use `it` Not `test`

```typescript
// ✅ Good - consistent with project style
it('should do something', () => { ... });

// ❌ Bad - inconsistent
test('should do something', () => { ... });
```

### 10. Mock Return Values, Not Implementations

```typescript
// ✅ Good - simple and clear
mockService.getClaim.mockReturnValue(claim);
mockService.loadClaims.mockResolvedValue([claim1, claim2]);

// ❌ Bad - overly complex
mockService.getClaim.mockImplementation((id) => {
  if (id === 'C_01') return claim1;
  if (id === 'C_02') return claim2;
  return null;
});
```

## Common Patterns

### Testing VSCode Commands

```typescript
it('should register command', () => {
  (vscode.commands.registerCommand as jest.Mock).mockReturnValue({
    dispose: jest.fn()
  });
  
  const disposables = component.registerCommands();
  
  expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
    'extension.commandName',
    expect.any(Function)
  );
  expect(disposables.length).toBeGreaterThan(0);
});
```

### Testing Async Operations

```typescript
it('should handle async operation', async () => {
  mockService.asyncMethod.mockResolvedValue(result);
  
  const output = await component.doAsync();
  
  expect(output).toBe(result);
  expect(mockService.asyncMethod).toHaveBeenCalled();
});
```

### Testing Error Handling

```typescript
it('should handle errors gracefully', async () => {
  mockService.method.mockRejectedValue(new Error('Failed'));
  
  await component.doSomething();
  
  expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
    expect.stringContaining('Failed')
  );
});
```

### Testing with Progress

```typescript
it('should show progress', async () => {
  (vscode.window.withProgress as jest.Mock).mockImplementation(
    (options, task) => task({ report: jest.fn() })
  );
  
  await component.longOperation();
  
  expect(vscode.window.withProgress).toHaveBeenCalled();
});
```

## Available Helpers

### Mock Factories
- `createMockClaim(overrides?)`
- `createMockQuote(overrides?)`
- `createMockZoteroItem(overrides?)`
- `createMockDocument(overrides?)`
- `createMockTextEditor(overrides?)`
- `createMockPosition(line, char)`
- `createMockRange(startLine, startChar, endLine, endChar)`
- `createMockUri(fsPath)`
- `createMockWorkspaceFolder(overrides?)`
- `createMockMCPClient()`
- `createMockClaimsManager()`
- `createMockExtensionState(overrides?)`

### Builders
- `aClaim()` - ClaimBuilder
- `aZoteroItem()` - ZoteroItemBuilder
- `aMethodClaim()` - Pre-configured method claim
- `aResultClaim()` - Pre-configured result claim
- `aVerifiedClaim()` - Pre-configured verified claim

### Fixtures
- `TEST_CLAIMS` - Common claim examples
- `TEST_ZOTERO_ITEMS` - Common Zotero items
- `TEST_VERIFICATION_RESULTS` - Verification result examples
- `TEST_MARKDOWN_CONTENT` - Markdown content examples

### VSCode Helpers
- `setupWorkspace(folderPath?)`
- `clearWorkspace()`
- `setupConfiguration(config)`
- `setupActiveEditor(document?)`
- `clearActiveEditor()`
- `setupInformationMessage(response?)`
- `setupErrorMessage(response?)`
- `setupQuickPick(items, selectedItem?)`
- `setupInputBox(response?)`
- `setupCommand(commandId)`
- `mockCommandExecution(commandId, result?)`

### Assertion Helpers
- `expectInformationMessage(message)`
- `expectErrorMessage(message)`
- `expectCommandRegistered(commandId)`

### Test Setup
- `setupTest()` - Standard test setup (clears mocks)
- `waitForAsync(ms?)` - Wait for async operations
- `suppressConsole()` - Suppress console output

## Common Errors and Solutions

### Error: "Cannot redefine property"
**Cause:** Mocking the same module twice  
**Fix:** Remove duplicate mocks, use only global or local

### Error: "mockReturnValue is not a function"
**Cause:** Not properly typed as jest.Mock  
**Fix:** Use `as jest.Mock` or `jest.Mocked<T>`

### Error: "Mock was called with unexpected arguments"
**Cause:** Not clearing mocks between tests  
**Fix:** Always use `setupTest()` helper

### Error: "Cannot read property of undefined"
**Cause:** Incomplete mock objects  
**Fix:** Use mock factories that provide all required properties

## Migration Checklist

When updating an existing test file:

- [ ] Add `setupTest()` at the top of describe block
- [ ] Replace inline mocks with factory functions
- [ ] Use builders for complex object creation
- [ ] Add proper TypeScript types to mocks
- [ ] Use fixtures for test data
- [ ] Replace `test()` with `it()`
- [ ] Use helper functions for VSCode API setup
- [ ] Ensure consistent beforeEach/afterEach structure
- [ ] Remove redundant comments
- [ ] Verify all mocks are properly typed

## Examples

See these files for good examples:
- `claimHoverProvider.test.ts` - Good use of factories and fixtures
- `zoteroApiService.test.ts` - Good mock typing and structure
- `claimsManager.test.ts` - Good integration test patterns

# Testing Guide

## Quick Reference: Mocking Best Practices

### 1. Always Use `setupTest()`

```typescript
describe('MyComponent', () => {
  setupTest(); // ✅ Clears mocks between tests
  
  let component: MyComponent;
  let mockService: jest.Mocked<MyService>;
  
  beforeEach(() => {
    mockService = createMockService();
    component = new MyComponent(mockService);
  });
});
```

### 2. Create Fresh Mocks in `beforeEach`

```typescript
// ❌ BAD - Shared state leaks between tests
describe('Tests', () => {
  const mockService = createMockService();
  // Tests will affect each other!
});

// ✅ GOOD - Fresh mocks for each test
describe('Tests', () => {
  setupTest();
  let mockService: jest.Mocked<MyService>;
  
  beforeEach(() => {
    mockService = createMockService(); // Fresh every time
  });
});
```

### 3. Use Factory Functions

```typescript
// ✅ GOOD - Use factories from helpers
const claim = createMockClaim({ id: 'C_01', text: 'Test' });
const item = createMockZoteroItem({ key: 'ABC123' });

// ❌ BAD - Manual object creation
const claim = {
  id: 'C_01',
  text: 'Test',
  category: '',
  source: '',
  // ... 10 more fields
};
```

### 4. Use Builders for Complex Objects

```typescript
// ✅ GOOD - Readable and flexible
const claim = aClaim()
  .withId('C_01')
  .withText('ComBat uses Empirical Bayes')
  .withCategory('Method')
  .verified()
  .build();

// ✅ GOOD - Pre-configured builders
const claim = aVerifiedClaim()
  .withId('C_02')
  .build();
```

### 5. Mock at Service Boundaries

```typescript
// ✅ GOOD - Mock the service interface
const mockClaimsManager = createMockClaimsManager();
mockClaimsManager.getClaim.mockReturnValue(claim);

// ❌ BAD - Mocking internal implementation
jest.spyOn(claimsManager['_storage'], 'read');
```

### 6. Type Your Mocks

```typescript
// ✅ GOOD - Type-safe
const mockDoc: jest.Mocked<vscode.TextDocument> = createMockDocument();

// ❌ BAD - Loses type safety
const mockDoc: any = createMockDocument();
```

### 7. Mock Return Values, Not Implementations

```typescript
// ✅ GOOD - Clear intent
mockService.getData.mockResolvedValue(data);
mockService.getCount.mockReturnValue(5);

// ❌ BAD - Overspecified
mockService.getData.mockImplementation(async (id) => {
  if (id === '1') return data1;
  if (id === '2') return data2;
  // Complex logic that should be tested elsewhere
});
```

### 8. Use Fixtures for Common Data

```typescript
// ✅ GOOD - Shared test data
import { TEST_CLAIMS, TEST_ZOTERO_ITEMS } from './helpers';

const claim = TEST_CLAIMS.method;
const item = TEST_ZOTERO_ITEMS.johnson2007;

// ❌ BAD - Duplicated across tests
const claim = { id: 'C_01', text: '...', ... };
```

### 9. Handle Async Properly

```typescript
// ✅ GOOD - Proper async handling
test('should load data', async () => {
  mockService.getData.mockResolvedValue(data);
  const result = await component.loadData();
  expect(result).toEqual(data);
});

// ❌ BAD - Missing await
test('should load data', () => {
  mockService.getData.mockResolvedValue(data);
  component.loadData(); // Promise not awaited!
  expect(component.data).toEqual(data); // Will fail!
});
```

### 10. Don't Over-Mock

```typescript
// ✅ GOOD - Test real logic
class MyService {
  formatData(data: Data): string {
    return `${data.id}: ${data.name}`;
  }
}
// Test formatData directly, don't mock it!

// ❌ BAD - Mocking everything
mockService.formatData.mockReturnValue('mocked');
// You're not testing anything!
```

## Available Helper Functions

### Mock Factories (`mockFactories.ts`)

**Domain Models:**
- `createMockClaim(overrides?)` - Create a Claim object
- `createMockQuote(overrides?)` - Create a SourcedQuote object
- `createMockZoteroItem(overrides?)` - Create a ZoteroItem object
- `createMockVerificationResult(overrides?)` - Create a VerificationResult object

**VSCode APIs:**
- `createMockDocument(overrides?)` - Create a TextDocument
- `createMockTextEditor(overrides?)` - Create a TextEditor
- `createMockCancellationToken(overrides?)` - Create a CancellationToken
- `createMockPosition(line, character)` - Create a Position
- `createMockRange(startLine, startChar, endLine, endChar)` - Create a Range
- `createMockUri(fsPath)` - Create a Uri
- `createMockWorkspaceFolder(overrides?)` - Create a WorkspaceFolder

**Services:**
- `createMockMCPClient()` - Create an MCPClientManager
- `createMockClaimsManager()` - Create a ClaimsManager
- `createMockExtensionState(overrides?)` - Create extension state

### Builders (`builders.ts`)

**Claim Builder:**
```typescript
const claim = aClaim()
  .withId('C_01')
  .withText('Test claim')
  .withCategory('Method')
  .withSource('Smith2023', 1)
  .withContext('Test context')
  .withPrimaryQuote('Test quote', 'Smith2023')
  .withSupportingQuote('Supporting quote')
  .withSection('section-1')
  .verified()
  .build();
```

**Zotero Item Builder:**
```typescript
const item = aZoteroItem()
  .withKey('ABC123')
  .withTitle('Test Paper')
  .withAuthor('John', 'Smith')
  .withYear(2023)
  .withAbstract('Test abstract')
  .withDOI('10.1234/test')
  .asJournalArticle()
  .build();
```

**Pre-configured Builders:**
- `aMethodClaim()` - Claim with Method category
- `aResultClaim()` - Claim with Result category
- `aVerifiedClaim()` - Verified claim with quote
- `aJournalArticle()` - Journal article item
- `aBookItem()` - Book item

### Fixtures (`fixtures.ts`)

**Claims:**
- `TEST_CLAIMS.method` - Method claim
- `TEST_CLAIMS.result` - Result claim
- `TEST_CLAIMS.challenge` - Challenge claim
- `TEST_CLAIMS.unverified` - Unverified claim
- `TEST_CLAIMS.minimal` - Minimal claim

**Zotero Items:**
- `TEST_ZOTERO_ITEMS.johnson2007` - Johnson 2007 paper
- `TEST_ZOTERO_ITEMS.zhang2020` - Zhang 2020 paper
- `TEST_ZOTERO_ITEMS.leek2010` - Leek 2010 paper
- `TEST_ZOTERO_ITEMS.book` - Book item
- `TEST_ZOTERO_ITEMS.preprint` - Preprint item

**Collections:**
- `TEST_CLAIM_COLLECTIONS.methods` - Method claims
- `TEST_CLAIM_COLLECTIONS.verified` - Verified claims
- `TEST_ZOTERO_COLLECTIONS.articles` - Journal articles

**Markdown Content:**
- `TEST_MARKDOWN_CONTENT.singleClaim` - Single claim markdown
- `TEST_MARKDOWN_CONTENT.multipleClaims` - Multiple claims
- `TEST_MARKDOWN_CONTENT.claimWithReferences` - Text with claim refs

### VSCode Helpers (`vscodeHelpers.ts`)

**Document Helpers:**
```typescript
const doc = createDocumentWithText('C_01 reference');
const doc = createDocumentWithClaims(['C_01', 'C_02']);
setupWordAtPosition(mockDoc, 'C_01', 0, 5);
```

**Position & Range:**
```typescript
const pos = startOfDocument();
const pos = startOfLine(5);
const range = entireLine(3);
const range = wordRange(2, 10, 4);
```

**Workspace:**
```typescript
setupWorkspace('/test/workspace');
clearWorkspace();
setupConfiguration({ 'myExt.setting': 'value' });
```

**Window:**
```typescript
setupActiveEditor(mockDoc);
clearActiveEditor();
setupInformationMessage('OK');
setupErrorMessage();
setupQuickPick(items, selectedItem);
setupInputBox('user input');
```

**Commands:**
```typescript
const cmd = setupCommand('myExt.myCommand');
cmd.execute(arg1, arg2);

mockCommandExecution('myExt.otherCommand', result);
```

**Assertions:**
```typescript
expectInformationMessage('Success');
expectErrorMessage('Failed');
expectCommandRegistered('myExt.myCommand');
```

### Test Setup (`testSetup.ts`)

```typescript
setupTest(); // Use in every describe block
waitForAsync(ms); // Wait for async operations
suppressConsole(); // Suppress console output
```

## Common Patterns

### Testing a Component with Dependencies

```typescript
describe('MyComponent', () => {
  setupTest();
  
  let component: MyComponent;
  let mockDep1: jest.Mocked<Dependency1>;
  let mockDep2: jest.Mocked<Dependency2>;
  
  beforeEach(() => {
    mockDep1 = createMockDependency1();
    mockDep2 = createMockDependency2();
    component = new MyComponent(mockDep1, mockDep2);
  });
  
  describe('Feature X', () => {
    it('should do Y when Z', async () => {
      // Arrange
      mockDep1.getData.mockResolvedValue(testData);
      
      // Act
      const result = await component.doSomething();
      
      // Assert
      expect(result).toEqual(expectedValue);
      expect(mockDep1.getData).toHaveBeenCalledWith('param');
    });
  });
});
```

### Testing VSCode UI Components

```typescript
describe('MyHoverProvider', () => {
  setupTest();
  
  let provider: MyHoverProvider;
  let mockExtensionState: any;
  let mockDocument: jest.Mocked<vscode.TextDocument>;
  
  beforeEach(() => {
    mockExtensionState = createMockExtensionState();
    provider = new MyHoverProvider(mockExtensionState);
    mockDocument = createMockDocument();
  });
  
  it('should provide hover for claim reference', async () => {
    const position = createMockPosition(0, 5);
    setupWordAtPosition(mockDocument, 'C_01', 0, 3);
    
    const claim = aClaim().withId('C_01').build();
    mockExtensionState.claimsManager.getClaim.mockReturnValue(claim);
    
    const hover = await provider.provideHover(
      mockDocument,
      position,
      createMockCancellationToken()
    );
    
    expect(hover).not.toBeNull();
    expect(hover!.contents[0]).toContain('C_01');
  });
});
```

### Testing with Fixtures

```typescript
describe('ClaimValidator', () => {
  setupTest();
  
  let validator: ClaimValidator;
  
  beforeEach(() => {
    validator = new ClaimValidator();
  });
  
  it('should validate method claims', () => {
    const claim = TEST_CLAIMS.method;
    const result = validator.validate(claim);
    expect(result.valid).toBe(true);
  });
  
  it('should handle multiple claim types', () => {
    const claims = TEST_CLAIM_COLLECTIONS.verified;
    const results = validator.validateBatch(claims);
    expect(results.every(r => r.valid)).toBe(true);
  });
});
```

## Common Pitfalls

### 1. Mock Pollution

```typescript
// ❌ BAD
describe('Tests', () => {
  const mockService = createMockService();
  
  it('test 1', () => {
    mockService.getData.mockReturnValue('data1');
    // ...
  });
  
  it('test 2', () => {
    // mockService still has mockReturnValue from test 1!
  });
});

// ✅ GOOD
describe('Tests', () => {
  setupTest(); // Clears mocks
  let mockService: jest.Mocked<MyService>;
  
  beforeEach(() => {
    mockService = createMockService();
  });
});
```

### 2. Mocking Before Imports

```typescript
// ❌ BAD
import { MyService } from './myService';
jest.mock('./myService');

// ✅ GOOD
jest.mock('./myService');
import { MyService } from './myService';
```

### 3. Not Resetting Mocks

```typescript
// ✅ GOOD - Use setupTest() or manually reset
afterEach(() => {
  jest.clearAllMocks(); // Clear call history
  jest.restoreAllMocks(); // Restore original implementations
});
```

### 4. Testing Implementation Instead of Behavior

```typescript
// ❌ BAD - Testing implementation
it('should call internal method', () => {
  const spy = jest.spyOn(component as any, '_internalMethod');
  component.publicMethod();
  expect(spy).toHaveBeenCalled();
});

// ✅ GOOD - Testing behavior
it('should return correct result', () => {
  const result = component.publicMethod();
  expect(result).toEqual(expectedValue);
});
```

### 5. Forgetting to Await Async

```typescript
// ❌ BAD
it('should load data', () => {
  component.loadData(); // Returns Promise!
  expect(component.data).toBeDefined(); // Fails!
});

// ✅ GOOD
it('should load data', async () => {
  await component.loadData();
  expect(component.data).toBeDefined();
});
```

## Testing Checklist

Before writing a test, ask:

1. ✅ Am I using `setupTest()` in the describe block?
2. ✅ Am I creating fresh mocks in `beforeEach`?
3. ✅ Am I using factory functions instead of manual objects?
4. ✅ Am I mocking at service boundaries, not internals?
5. ✅ Am I testing behavior, not implementation?
6. ✅ Am I handling async properly with `async/await`?
7. ✅ Am I using fixtures for common test data?
8. ✅ Are my mocks properly typed?

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- claimHoverProvider.test.ts

# Run with coverage
npm test -- --coverage

# Run tests matching pattern
npm test -- --testNamePattern="should validate"
```

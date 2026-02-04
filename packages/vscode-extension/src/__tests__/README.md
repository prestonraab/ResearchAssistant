# Test Organization

This directory contains tests for the VSCode extension.

## Testing Strategy

**See [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) for the complete testing guide.**

The guide covers:
- When to use pure logic tests vs integration tests
- How to use test data builders
- When mocking is appropriate
- Good vs bad test examples
- Refactoring existing code

## Quick Start

```typescript
import { setupTest, aClaim, createMinimalDocument } from './helpers';

describe('MyComponent', () => {
  setupTest(); // Always include - clears mocks between tests
  
  test('should do something', () => {
    const claim = aClaim().withId('C_01').build();
    const doc = createMinimalDocument({ text: 'test' });
    // ... test logic
  });
});
```

## Directory Structure

```
__tests__/
├── TESTING_STRATEGY.md   # Complete testing guide (READ THIS FIRST)
├── helpers/              # Shared test utilities
│   ├── mockFactories.ts  # Factory functions for creating mocks
│   ├── minimalMocks.ts   # Lightweight VSCode API mocks
│   ├── fixtures.ts       # Shared test data
│   ├── builders.ts       # Builder pattern for complex objects
│   └── testSetup.ts      # Common setup/teardown utilities
└── jest.setup.ts         # Global Jest configuration

core/__tests__/           # Tests for core services
ui/__tests__/             # Tests for UI components
```

## Helper Utilities

### Test Data Builders (`helpers/builders.ts`)
Create complex test objects with fluent API:

```typescript
import { createMockClaim, createMockDocument, createMockMCPClient } from './helpers';

const claim = createMockClaim({ id: 'C_01', text: 'Test claim' });
const document = createMockDocument({ languageId: 'markdown' });
const mcpClient = createMockMCPClient();
```

### Fixtures (`helpers/fixtures.ts`)
Pre-configured test data for common scenarios:

```typescript
import { TEST_CLAIMS, TEST_ZOTERO_ITEMS } from './helpers';

const methodClaim = TEST_CLAIMS.method;
const article = TEST_ZOTERO_ITEMS.johnson2007;
```

### Builders (`helpers/builders.ts`)
Fluent API for building complex test objects:

```typescript
import { aClaim, aZoteroItem } from './helpers';

const claim = aClaim()
  .withId('C_01')
  .withCategory('Method')
  .withPrimaryQuote('Test quote', 'Johnson2007')
  .verified()
  .build();

const item = aZoteroItem()
  .withTitle('Test Paper')
  .withAuthor('John', 'Smith')
  .asJournalArticle()
  .build();
```

### VSCode Helpers (`helpers/vscodeHelpers.ts`)
Simplify common VSCode testing patterns:

```typescript
import { 
  setupWorkspace, 
  setupActiveEditor, 
  setupWordAtPosition,
  expectInformationMessage 
} from './helpers';

// Setup test environment
setupWorkspace('/test/workspace');
const editor = setupActiveEditor();
setupWordAtPosition(editor.document, 'C_01', 0, 5);

// Assertions
expectInformationMessage('Claim verified');
```

### Test Setup (`helpers/testSetup.ts`)
Common setup/teardown patterns:

```typescript
import { setupTest } from './helpers';

describe('MyComponent', () => {
  setupTest(); // Clears mocks before each test
  
  // ... tests
});
```

## Best Practices

### 1. Use Type-Safe Mocks
```typescript
// ❌ Bad - loses type safety
const mockClient = { verifyQuote: jest.fn() } as any;

// ✅ Good - type-safe
const mockClient = createMockMCPClient();
mockClient.verifyQuote.mockResolvedValue({ verified: true, similarity: 1.0 });
```

### 2. Use Fixtures for Common Data
```typescript
// ❌ Bad - duplicated test data
const claim = { id: 'C_01', text: 'ComBat uses...', category: 'Method', ... };

// ✅ Good - reusable fixture
const claim = TEST_CLAIMS.method;
```

### 3. Use Builders for Variations
```typescript
// ❌ Bad - hard to read
const claim = { ...TEST_CLAIMS.method, verified: true, sections: ['intro'] };

// ✅ Good - clear intent
const claim = aClaim()
  .withCategory('Method')
  .withSection('intro')
  .verified()
  .build();
```

### 4. Mock at Boundaries
```typescript
// ❌ Bad - mocking internal services
jest.mock('../core/claimsManager');

// ✅ Good - mock external services only
jest.mock('../../mcp/mcpClient');
// Use real ClaimsManager with temp files
```

### 5. Clear Mock State
```typescript
describe('MyComponent', () => {
  setupTest(); // Automatically clears mocks
  
  // Or manually:
  beforeEach(() => {
    jest.clearAllMocks();
  });
});
```

### 6. Use Descriptive Test Names
```typescript
// ❌ Bad
test('works', () => { ... });

// ✅ Good
test('should verify claim when quote matches exactly', () => { ... });
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test claimHoverProvider.test.ts

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage

# Run only unit tests
npm test -- __tests__/unit

# Run only integration tests
npm test -- __tests__/integration
```

## Debugging Tests

### VSCode Launch Configuration
Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Current File",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["${fileBasename}", "--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Debug Single Test
```typescript
test.only('should verify claim', () => {
  // This test will run in isolation
});
```

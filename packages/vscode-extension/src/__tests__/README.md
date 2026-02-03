# Test Organization

This directory contains tests for the VSCode extension, organized by test type and purpose.

## Directory Structure

```
__tests__/
├── helpers/              # Shared test utilities
│   ├── mockFactories.ts  # Factory functions for creating mocks
│   ├── fixtures.ts       # Shared test data
│   ├── builders.ts       # Builder pattern for complex objects
│   ├── vscodeHelpers.ts  # VSCode-specific test helpers
│   └── testSetup.ts      # Common setup/teardown utilities
├── unit/                 # Unit tests (heavy mocking)
├── integration/          # Integration tests (minimal mocking)
└── jest.setup.ts         # Global Jest configuration

core/__tests__/           # Tests for core services (mixed unit/integration)
ui/__tests__/             # Tests for UI components (unit tests)
```

## Test Types

### Unit Tests (`__tests__/unit/`)
- Test individual functions/classes in isolation
- Heavy use of mocks for dependencies
- Fast execution
- Focus on logic and edge cases

**When to use**: Testing business logic, algorithms, data transformations

### Integration Tests (`__tests__/integration/` and `core/__tests__/`)
- Test multiple components working together
- Minimal mocking (only external services)
- May use real file system with temp directories
- Slower but more realistic

**When to use**: Testing workflows, file operations, service interactions

### UI Tests (`ui/__tests__/`)
- Test VSCode UI components (providers, decorators, etc.)
- Mock VSCode APIs
- Test user interactions and display logic

## Helper Utilities

### Mock Factories (`helpers/mockFactories.ts`)
Create type-safe mocks for common objects:

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

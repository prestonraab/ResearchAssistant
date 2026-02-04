# Testing Strategy Guide

## Overview

This guide documents the testing strategy for the research-extension codebase. The core principle: **separate pure logic from VSCode integration** to minimize mocking and maximize test reliability.

**Key Insight:** Most of your code doesn't need VSCode—it just processes data. Extract that logic, test it directly, and mock only the thin VSCode integration layer.

## Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                VSCode Integration Layer                      │
│  (Thin wrappers - minimal testing with inline mocks)         │
│  Example: ClaimHoverProvider, ClaimCompletionProvider        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Pure Logic Layer                          │
│  (No VSCode deps - fully testable with real data)            │
│  Example: claimHoverLogic.ts, claimCompletionLogic.ts        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  (Real components with test data from builders)              │
│  Example: ClaimsManager, OutlineParser                       │
└─────────────────────────────────────────────────────────────┘
```

## When to Use Each Testing Approach

### 1. Pure Logic Tests (Preferred - 80% of tests)

**Use when:** Testing business logic, data transformations, formatting, parsing, or calculations.

**Characteristics:**
- ✅ No VSCode dependencies
- ✅ No mocks needed
- ✅ Fast execution
- ✅ Easy to write and maintain
- ✅ Refactoring-safe

**Example - Hover Rendering:**

```typescript
// claimHoverLogic.ts - Pure function
export function renderClaimHover(claim: Claim): string {
  let markdown = `### ${claim.id}: ${claim.text}\n\n`;
  
  if (claim.category) {
    markdown += `**Category**: ${claim.category}  \n`;
  }
  
  if (claim.verified) {
    markdown += `**Verification**: ✅ Verified  \n`;
  }
  
  return markdown;
}

// claimHoverLogic.test.ts - No mocks!
test('should render verified claim', () => {
  const claim = aClaim()
    .withId('C_01')
    .withText('Test claim')
    .withCategory('Method')
    .verified()
    .build();
  
  const result = renderClaimHover(claim);
  
  expect(result).toContain('### C_01: Test claim');
  expect(result).toContain('**Category**: Method');
  expect(result).toContain('✅ Verified');
});
```

**Benefits:**
- 17 tests for hover logic with zero mocks
- Tests verify actual output, not mock behavior
- Refactoring the rendering logic won't break tests
- Fast: entire suite runs in milliseconds

### 2. Integration Tests with Real Components

**Use when:** Testing interactions between components, data flow, or component behavior with real dependencies.

**Characteristics:**
- ✅ Uses real component instances
- ✅ Tests actual integration behavior
- ✅ Catches bugs that unit tests miss
- ⚠️ Mock only external boundaries (file system, network)

**Example - Completion Provider:**

```typescript
// claimCompletionLogic.test.ts
test('should prioritize claims in current section', () => {
  const claims = [
    aClaim().withId('C_03').withSections(['section-2']).build(),
    aClaim().withId('C_01').withSections(['section-1']).build(),
    aClaim().withId('C_02').withSections(['section-1']).build(),
  ];

  const sorted = sortClaimsBySection(claims, 'section-1');

  // Claims in section-1 come first, sorted by ID
  expect(sorted.map(c => c.id)).toEqual(['C_01', 'C_02', 'C_03']);
});
```

**When to use real components:**
- ClaimsManager - Use real instance with test data
- OutlineParser - Use real instance with test documents
- Data structures - Always use real objects, never mock

**When to mock:**
- File system operations (fs.readFile, fs.writeFile)
- Network calls (fetch, HTTP requests)
- VSCode APIs (window.showInformationMessage, workspace.openTextDocument)
- External services (Zotero API, embedding services)

### 3. Thin Integration Tests (VSCode Layer)

**Use when:** Testing the VSCode integration layer that delegates to pure logic.

**Characteristics:**
- ⚠️ Mock only VSCode APIs
- ✅ Use real logic functions
- ✅ Use minimal inline mocks
- ✅ Verify wiring is correct

**Example - Hover Provider Integration:**

```typescript
// ClaimHoverProvider.ts - Thin wrapper
export class ClaimHoverProvider implements vscode.HoverProvider {
  constructor(private extensionState: ExtensionState) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    const range = document.getWordRangeAtPosition(position, /C_\d+/);
    if (!range) return null;

    const claimId = document.getText(range);
    const claim = this.extensionState.claimsManager.getClaim(claimId);
    if (!claim) return null;

    // Delegate to pure logic (already tested)
    const markdownText = renderClaimHover(claim);
    
    return new vscode.Hover(new vscode.MarkdownString(markdownText), range);
  }
}

// ClaimHoverProvider.test.ts - Minimal mocking
test('should return hover for valid claim', async () => {
  // Use minimal mock helpers
  const doc = createMinimalDocument({ text: 'This is C_01 in text' });
  const pos = createMinimalPosition(0, 10);
  const token = createMinimalCancellationToken();
  
  // Use real ClaimsManager with test data
  const claimsManager = new ClaimsManager();
  claimsManager.addClaim(aClaim().withId('C_01').build());
  
  const provider = new ClaimHoverProvider({ claimsManager });
  const hover = await provider.provideHover(doc, pos, token);
  
  expect(hover).not.toBeNull();
  expect(hover?.contents[0].value).toContain('C_01');
});
```

**Key principle:** The integration test verifies that the provider correctly:
1. Extracts the claim ID from the document
2. Fetches the claim from ClaimsManager
3. Delegates to the pure logic function
4. Returns a proper VSCode Hover object

The actual rendering logic is tested separately in pure logic tests.

## Using Test Data Builders

Builders create complex test objects with sensible defaults and a fluent API.

### Available Builders

```typescript
import { 
  aClaim, 
  aZoteroItem, 
  aMethodClaim, 
  aVerifiedClaim,
  aJournalArticle,
  anOutlineSection 
} from './helpers';
```

### Builder Examples

**Basic Claim:**
```typescript
const claim = aClaim()
  .withId('C_01')
  .withText('Test claim')
  .withCategory('Method')
  .build();
```

**Verified Claim with Quote:**
```typescript
const claim = aClaim()
  .withId('C_02')
  .withText('Verified claim')
  .withPrimaryQuote('This is the quote', 'Smith2023')
  .verified()
  .build();
```

**Claim with Multiple Supporting Quotes:**
```typescript
const claim = aClaim()
  .withId('C_03')
  .withText('Well-supported claim')
  .withSupportingQuotes([
    { text: 'Quote 1', source: 'Source1', verified: true },
    { text: 'Quote 2', source: 'Source2', verified: true },
    { text: 'Quote 3', source: 'Source3', verified: false }
  ])
  .build();
```

**Claim in Specific Sections:**
```typescript
const claim = aClaim()
  .withId('C_04')
  .withText('Section-specific claim')
  .withSections(['section-1', 'section-2'])
  .build();
```

**Pre-configured Builders:**
```typescript
// Method claim with defaults
const methodClaim = aMethodClaim().build();

// Verified claim with quote
const verifiedClaim = aVerifiedClaim().build();

// Journal article
const article = aJournalArticle()
  .withTitle('My Paper')
  .withYear(2023)
  .build();
```

### Why Use Builders?

**Without builders (verbose, error-prone):**
```typescript
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
  modifiedAt: new Date('2024-01-01'),
};
```

**With builders (readable, maintainable):**
```typescript
const claim = aClaim()
  .withId('C_01')
  .withText('Test claim')
  .withCategory('Method')
  .build();
```

**Benefits:**
- ✅ Only specify what matters for the test
- ✅ Sensible defaults for all required fields
- ✅ Type-safe with IDE autocomplete
- ✅ Single place to update when types change
- ✅ Self-documenting test code

## Using Minimal Mock Helpers

For VSCode integration tests, use minimal mock helpers instead of full mock factories.

### Available Helpers

```typescript
import {
  createMinimalDocument,
  createMinimalPosition,
  createMinimalRange,
  createMinimalCancellationToken,
  createDocumentWithClaims,
  createDocumentWithWord
} from './helpers/minimalMocks';
```

### Minimal Mock Examples

**Document with Text:**
```typescript
const doc = createMinimalDocument({
  text: 'Line 1\nLine 2\nLine 3',
  languageId: 'markdown'
});

const text = doc.getText(); // 'Line 1\nLine 2\nLine 3'
const line = doc.lineAt(1); // { text: 'Line 2', ... }
```

**Position and Range:**
```typescript
const pos = createMinimalPosition(5, 10); // Line 5, character 10
const range = createMinimalRange(0, 0, 0, 5); // First 5 chars of line 0
```

**Document with Claims:**
```typescript
const doc = createDocumentWithClaims(['C_01', 'C_02', 'C_03']);
// Document contains: "This references C_01.\nThis references C_02.\nThis references C_03."
```

**Document with Specific Word:**
```typescript
const { document, range, word } = createDocumentWithWord('C_01', 0, 5);
// Document has 'C_01' at line 0, starting at character 5
// range points to the word location
```

### Why Minimal Mocks?

**Full mock factory (over-engineered):**
```typescript
const mockDoc = createMockDocument();
mockDoc.getText.mockReturnValue('text');
mockDoc.lineAt.mockReturnValue({ text: 'line' });
mockDoc.getWordRangeAtPosition.mockReturnValue(range);
// ... 20+ more methods you don't need
```

**Minimal mock (just what you need):**
```typescript
const doc = createMinimalDocument({ text: 'text' });
// Only includes methods actually used in tests
// No jest.fn() needed - real implementations
```

**Benefits:**
- ✅ No jest.fn() boilerplate
- ✅ No mock setup/teardown
- ✅ Real implementations, not mocked behavior
- ✅ Only includes what you actually use
- ✅ Easier to read and maintain

## When Mocking IS Appropriate

### External Boundaries

Mock these because they have side effects or external dependencies:

**File System:**
```typescript
jest.spyOn(fs, 'readFile').mockResolvedValue('file content');
jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
```

**Network Calls:**
```typescript
global.fetch = jest.fn().mockResolvedValue(
  createMockFetchResponse({ data: 'test' })
);
```

**VSCode UI:**
```typescript
jest.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined);
jest.spyOn(vscode.window, 'showErrorMessage').mockResolvedValue(undefined);
```

**External Services:**
```typescript
const mockZoteroApi = createMockZoteroApiService();
mockZoteroApi.fetchItems.mockResolvedValue([item1, item2]);
```

### When NOT to Mock

**Don't mock internal logic:**
```typescript
// ❌ Bad - mocking internal logic
const mockRenderer = jest.fn().mockReturnValue('markdown');
const result = mockRenderer(claim);

// ✅ Good - test real logic
const result = renderClaimHover(claim);
```

**Don't mock data structures:**
```typescript
// ❌ Bad - mocking a Claim object
const mockClaim = { id: 'C_01', getText: jest.fn() };

// ✅ Good - use builder
const claim = aClaim().withId('C_01').build();
```

**Don't mock components you control:**
```typescript
// ❌ Bad - mocking ClaimsManager
const mockClaimsManager = { getClaim: jest.fn() };

// ✅ Good - use real ClaimsManager with test data
const claimsManager = new ClaimsManager();
claimsManager.addClaim(aClaim().withId('C_01').build());
```

## Good vs Bad Test Examples

### Example 1: Hover Rendering

**❌ Bad - Over-mocked, tests mock behavior:**
```typescript
test('should render claim', async () => {
  mockDocument.getWordRangeAtPosition.mockReturnValue(range);
  mockDocument.getText.mockReturnValue('C_01');
  mockExtensionState.claimsManager.getClaim.mockReturnValue(claim);
  mockMarkdownString.appendMarkdown = jest.fn();
  
  const hover = await hoverProvider.provideHover(mockDocument, position, mockToken);
  
  expect(mockMarkdownString.appendMarkdown).toHaveBeenCalled();
  expect(hover).not.toBeNull();
  // Can't verify actual content!
});
```

**Problems:**
- 15+ lines of mock setup
- Tests that mocks were called, not actual output
- Can't verify the rendered markdown content
- Breaks when implementation changes
- Doesn't catch rendering bugs

**✅ Good - Pure logic, tests actual output:**
```typescript
test('should render verified claim with all fields', () => {
  const claim = aClaim()
    .withId('C_01')
    .withText('Test claim')
    .withCategory('Method')
    .verified()
    .build();
  
  const result = renderClaimHover(claim);
  
  expect(result).toContain('### C_01: Test claim');
  expect(result).toContain('**Category**: Method');
  expect(result).toContain('✅ Verified');
});
```

**Benefits:**
- 3 lines of setup
- Tests actual output
- Verifies exact markdown content
- Refactoring-safe
- Catches rendering bugs

### Example 2: Completion Sorting

**❌ Bad - Mocking data structures:**
```typescript
test('should sort claims', () => {
  const mockClaim1 = { id: 'C_02', getSections: jest.fn().mockReturnValue(['section-1']) };
  const mockClaim2 = { id: 'C_01', getSections: jest.fn().mockReturnValue(['section-1']) };
  
  const sorted = sortClaimsBySection([mockClaim1, mockClaim2], 'section-1');
  
  expect(sorted[0].id).toBe('C_01');
});
```

**Problems:**
- Mocking simple data structures
- Verbose mock setup
- Doesn't test real Claim objects

**✅ Good - Real data with builders:**
```typescript
test('should prioritize claims in current section', () => {
  const claims = [
    aClaim().withId('C_03').withSections(['section-2']).build(),
    aClaim().withId('C_01').withSections(['section-1']).build(),
    aClaim().withId('C_02').withSections(['section-1']).build(),
  ];

  const sorted = sortClaimsBySection(claims, 'section-1');

  expect(sorted.map(c => c.id)).toEqual(['C_01', 'C_02', 'C_03']);
});
```

**Benefits:**
- Tests real Claim objects
- Clear test intent
- Verifies complete sorting behavior

### Example 3: Integration Test

**❌ Bad - Mocking everything:**
```typescript
test('should provide hover', async () => {
  const mockDoc = { getText: jest.fn(), getWordRangeAtPosition: jest.fn() };
  const mockPos = { line: 0, character: 5 };
  const mockClaims = { getClaim: jest.fn().mockReturnValue({ id: 'C_01' }) };
  const mockRender = jest.fn().mockReturnValue('markdown');
  
  // ... test implementation
});
```

**Problems:**
- Everything is mocked
- Doesn't test real integration
- Brittle to implementation changes

**✅ Good - Mock only VSCode, use real components:**
```typescript
test('should return hover for valid claim', async () => {
  const doc = createMinimalDocument({ text: 'This is C_01 in text' });
  const pos = createMinimalPosition(0, 10);
  const token = createMinimalCancellationToken();
  
  const claimsManager = new ClaimsManager();
  claimsManager.addClaim(aClaim().withId('C_01').build());
  
  const provider = new ClaimHoverProvider({ claimsManager });
  const hover = await provider.provideHover(doc, pos, token);
  
  expect(hover).not.toBeNull();
  expect(hover?.contents[0].value).toContain('C_01');
});
```

**Benefits:**
- Minimal VSCode mocking
- Real ClaimsManager
- Real rendering logic
- Tests actual integration

## Refactoring Existing Code

### Step 1: Identify Pure Logic

Look for code that:
- Transforms data
- Formats strings
- Performs calculations
- Makes decisions based on data
- Has no VSCode dependencies

**Example - Before:**
```typescript
// ClaimHoverProvider.ts - 150 lines mixing logic with VSCode
export class ClaimHoverProvider {
  private buildHoverContent(claim: Claim): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString();
    markdown.appendMarkdown(`### ${claim.id}: ${claim.text}\n\n`);
    
    if (claim.category) {
      markdown.appendMarkdown(`**Category**: ${claim.category}  \n`);
    }
    
    // ... 100+ more lines
    
    return markdown;
  }
}
```

### Step 2: Extract to Pure Functions

Move the logic to a separate file with no VSCode imports:

**Example - After:**
```typescript
// claimHoverLogic.ts - Pure functions
export function renderClaimHover(claim: Claim): string {
  let markdown = `### ${claim.id}: ${claim.text}\n\n`;
  
  if (claim.category) {
    markdown += `**Category**: ${claim.category}  \n`;
  }
  
  // ... all rendering logic
  
  return markdown;
}
```

### Step 3: Write Pure Logic Tests

Test the extracted functions with real data:

```typescript
// claimHoverLogic.test.ts
test('should render claim with category', () => {
  const claim = aClaim()
    .withId('C_01')
    .withCategory('Method')
    .build();
  
  const result = renderClaimHover(claim);
  
  expect(result).toContain('**Category**: Method');
});
```

### Step 4: Refactor Integration Layer

Update the VSCode component to delegate to pure functions:

```typescript
// ClaimHoverProvider.ts - Now just 40 lines
export class ClaimHoverProvider {
  async provideHover(...): Promise<vscode.Hover | null> {
    const claimId = document.getText(range);
    const claim = this.claimsManager.getClaim(claimId);
    if (!claim) return null;
    
    // Delegate to pure function
    const markdownText = renderClaimHover(claim);
    
    return new vscode.Hover(new vscode.MarkdownString(markdownText), range);
  }
}
```

### Step 5: Keep Existing Integration Tests

Don't delete existing tests—they still verify the integration works:

```typescript
// ClaimHoverProvider.test.ts - Integration test still valuable
test('should return hover for valid claim', async () => {
  // ... test that provider correctly wires everything together
});
```

## Testing Checklist

### For New Features

- [ ] Extract pure logic to separate file (no VSCode imports)
- [ ] Write pure logic tests with real data (no mocks)
- [ ] Use builders for complex test objects
- [ ] Write thin integration test for VSCode layer
- [ ] Use minimal mocks for VSCode APIs
- [ ] Use real components for internal dependencies

### For Existing Code

- [ ] Identify pure logic mixed with VSCode integration
- [ ] Extract pure functions to separate file
- [ ] Write tests for pure logic
- [ ] Refactor integration layer to delegate to pure functions
- [ ] Keep existing integration tests
- [ ] Verify all tests still pass

### Code Review

- [ ] Pure logic has no VSCode imports
- [ ] Pure logic tests have no mocks
- [ ] Integration tests mock only VSCode APIs
- [ ] Builders used for complex objects
- [ ] Tests verify outputs, not mock calls
- [ ] Test names describe behavior, not implementation

## Summary

**The Golden Rule:** Separate pure logic from VSCode integration.

**Testing Hierarchy:**
1. **Pure logic tests** (80%) - No mocks, test real behavior
2. **Integration tests** (15%) - Real components, minimal VSCode mocks
3. **Thin integration tests** (5%) - Verify VSCode wiring

**Key Principles:**
- ✅ Extract pure functions - test without mocks
- ✅ Use builders - create test data easily
- ✅ Use minimal mocks - only for VSCode APIs
- ✅ Use real components - test actual integration
- ✅ Test outputs - not mock calls
- ✅ Refactoring-safe - tests pass when behavior unchanged

**Results:**
- 50%+ reduction in mock setup code
- Tests that catch real bugs
- Fast test execution
- Easy to maintain
- Refactoring-safe

## Additional Resources

- `helpers/builders.ts` - Test data builders
- `helpers/minimalMocks.ts` - Minimal VSCode mocks
- `core/claimHoverLogic.ts` - Example pure logic
- `core/__tests__/claimHoverLogic.test.ts` - Example pure logic tests
- `ui/claimHoverProvider.ts` - Example thin integration layer

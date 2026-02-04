# Failing Tests Summary

**Current Status:** 3 failed suites, 64 passed | 33 failed tests, 1,472 passed

## Failing Test Suites

### 1. ClaimExtractor.test.ts (4 failures)
**Location:** `packages/core/tests/unit/ClaimExtractor.test.ts`
- should skip questions
- should include line numbers (1-indexed)
- should categorize challenge claims
- should include surrounding context for claims

### 2. SearchService.test.ts (Compilation Error)
**Location:** `packages/core/tests/unit/SearchService.test.ts`
- Type error at line 107: `Type 'string' is not assignable to type 'SourcedQuote'`
- Blocks entire test suite from running

### 3. EmbeddingService.test.ts - Property Tests (4 failures)
**Location:** `packages/core/tests/property/EmbeddingService.test.ts`
- should never exceed maxCacheSize after operations complete (5002ms timeout)
- should maintain cache size limit during batch operations (5002ms timeout)
- should have cache size of 0 after clear (5004ms timeout)
- should evict least recently used entries when cache is full (5005ms timeout)

### 4. OutlineParser.test.ts - VSCode Extension (2 failures)
**Location:** `packages/vscode-extension/src/core/__tests__/outlineParser.test.ts`
- should return null for position outside any section
- Mock setup issue: `mockFs.readFile.mockResolvedValue` not a function

### 5. AutoQuoteVerifier.test.ts - VSCode Extension (5 failures)
**Location:** `packages/vscode-extension/src/__tests__/autoQuoteVerifier.test.ts`
- should add claim to queue if it has quote and source (expected 1, got 0)
- should update existing queue item if claim already in queue (expected 1, got 0)
- should return correct queue size (expected 1, got 0)
- should handle concurrent verification requests (expected 2, got 1)
- should handle queue processing errors gracefully (expected 1, got 0)

### 6. ClaimStrengthCalculator.test.ts - VSCode Extension (2 failures)
**Location:** `packages/vscode-extension/src/core/__tests__/claimStrengthCalculator.test.ts`
- should detect contradictory claims (expected true, got false)
- should detect contradictory keywords (expected > 0, got 0)

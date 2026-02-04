# Failing Tests Summary

**Current Status:** 4 failed suites, 63 passed | 34 failed tests, 1,471 passed

## Failing Test Suites

### 1. outlineParser.test.ts (24 failures)
- Mock setup broken: `mockFs.readFile.mockResolvedValue` not a function

### 3. autoQuoteVerifier.test.ts (4 failures)
- Queue size returns 0 when claims added; queue not populating

### 6. claimStrengthCalculator.test.ts (2 failures)
- Contradiction detection not working; `sentimentOpposition` not set

### 8. performance/memory.test.ts (1 failure)
- Heap memory usage exceeds 300MB threshold (currently 351.6MB)

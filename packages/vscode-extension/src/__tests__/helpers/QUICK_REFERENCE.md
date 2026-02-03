# Test Mocking Quick Reference

**TL;DR:** Use factories → builders → fixtures → API helpers. Always call `setupTest()`.

## One-Minute Setup

```typescript
import { setupTest, createMockClaimsManager, aClaim, TEST_CLAIMS } from './helpers';

describe('MyTest', () => {
  setupTest(); // ✅ Always first

  let mockClaims = createMockClaimsManager();
  
  test('should work', () => {
    const claim = aClaim().withId('C_01').build();
    // or use fixture:
    const claim = TEST_CLAIMS.method;
  });
});
```

## The Hierarchy (Use in This Order)

| Level | Use For | Example |
|-------|---------|---------|
| 1️⃣ Factories | Services, VSCode APIs | `createMockClaimsManager()` |
| 2️⃣ Builders | Domain objects | `aClaim().withId('C_01').build()` |
| 3️⃣ Fixtures | Shared test data | `TEST_CLAIMS.method` |
| 4️⃣ API Helpers | HTTP responses | `createMockFetchResponse({})` |

## Common Patterns

### Mock a Service
```typescript
const mockClaims = createMockClaimsManager();
mockClaims.getClaim.mockReturnValue(null);
```

### Create Test Data
```typescript
const claim = aClaim()
  .withId('C_01')
  .withCategory('Method')
  .verified()
  .build();
```

### Use Shared Fixture
```typescript
const claim = TEST_CLAIMS.method;
```

### Mock HTTP Response
```typescript
mockFetch.mockResolvedValueOnce(
  createMockFetchResponse({ data: 'test' })
);
```

### Test Async Success
```typescript
mockService.fetch.mockResolvedValueOnce({ data: 'test' });
const result = await service.getData();
expect(result.data).toBe('test');
```

### Test Async Error
```typescript
mockService.fetch.mockRejectedValueOnce(
  createMockError('Network error')
);
await expect(service.getData()).rejects.toThrow();
```

### Verify Mock Was Called
```typescript
expect(mockService.method).toHaveBeenCalled();
expectCalledTimes(mockService.method, 2);
expectCalledWith(mockService.method, expectedArg);
```

## Anti-Patterns (Never Do These)

❌ **Don't use `as any`**
```typescript
const mockService: any = { method: jest.fn() };
```

❌ **Don't create inline mocks**
```typescript
const mockService = { getClaim: jest.fn() };
```

❌ **Don't mutate global state**
```typescript
global.fetch = jest.fn();
```

❌ **Don't mock private methods**
```typescript
mockService['_private'].mockReturnValue('value');
```

## Available Factories

**Services:**
- `createMockEmbeddingService()`
- `createMockClaimsManager()`
- `createMockZoteroApiService()`
- `createMockMCPClient()`

**VSCode APIs:**
- `createMockDocument()`
- `createMockTextEditor()`
- `createMockExtensionContext()`
- `createMockWorkspaceFolder()`

**Other:**
- `createMockSentenceClaimQuoteLinkManager()`
- `createMockOutlineParser()`
- `createMockUnifiedQuoteSearch()`

## Available Builders

- `aClaim()` - Generic claim
- `aZoteroItem()` - Generic Zotero item
- `aMethodClaim()` - Pre-configured method claim
- `aVerifiedClaim()` - Pre-configured verified claim
- `aJournalArticle()` - Pre-configured journal article

## Available Fixtures

- `TEST_CLAIMS.method`, `.result`, `.challenge`, `.unverified`, `.minimal`
- `TEST_ZOTERO_ITEMS.johnson2007`, `.zhang2020`, `.leek2010`, `.book`, `.preprint`
- `TEST_VERIFICATION_RESULTS.verified`, `.highSimilarity`, `.mediumSimilarity`, `.lowSimilarity`, `.notFound`

## Available API Helpers

**Success:**
- `createMockFetchResponse(data)`
- `createMockZoteroResponse(items)`
- `createMockVerificationResponse(verified, similarity)`

**Errors:**
- `createMockErrorResponse(status, statusText)`
- `createMockError(message)`
- `createMockTimeoutError()`
- `createMockNetworkError()`

**Specific HTTP Errors:**
- `createMockUnauthorizedResponse()` - 401
- `createMockForbiddenResponse()` - 403
- `createMockNotFoundResponse()` - 404
- `createMockConflictResponse()` - 409
- `createMockServerErrorResponse()` - 500
- `createMockServiceUnavailableResponse()` - 503

**Special:**
- `createMockPaginatedResponse(items, page, pageSize, total)`
- `createMockStreamingResponse(chunks)`
- `createMockSlowResponse(data, delayMs)`
- `createMockFlakeyResponse(data, failureRate)`

## Assertion Helpers

```typescript
expectCalledTimes(mock, 2);
expectCalledWith(mock, arg);
expectCalledWithObject(mock, { key: 'value' });
expectCalledWithPattern(mock, /regex/);
expectCalledWithArray(mock, [item1, item2]);
expectErrorMessage('Error text');
expectInformationMessage('Info text');
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Tests pass individually but fail together | Add `setupTest()` to describe block |
| "Mock is not a function" | Use factory: `createMockService()` |
| Type errors with mocks | Use typed factories, not `as any` |
| beforeEach is too long | Use factories instead of inline mocks |
| Mock methods missing | Use factory that includes all methods |
| IDE doesn't autocomplete | Use typed factories with `jest.Mocked<T>` |

## Checklist Before Committing

- [ ] `setupTest()` called in describe block
- [ ] All mocks use factories from helpers
- [ ] No `as any` type annotations
- [ ] beforeEach under 15 lines
- [ ] Test data uses builders or fixtures
- [ ] HTTP responses use API helpers
- [ ] Assertions use helper functions
- [ ] Tests pass individually and together
